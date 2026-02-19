/**
 * 帧质量评估模块
 * 计算每帧的质量指标: 背景、噪声、SNR、星点数、FWHM、综合评分
 */

import {
  detectStars,
  detectStarsAsync,
  estimateBackground,
  type DetectedStar,
  type StarDetectionOptions,
  type StarDetectionRuntime,
} from "./starDetection";

export interface FrameQualityMetrics {
  /** 背景中值 */
  backgroundMedian: number;
  /** 背景噪声 (sigma) */
  backgroundNoise: number;
  /** 信噪比 (SNR = mean_signal / noise) */
  snr: number;
  /** 检测到的星点数 */
  starCount: number;
  /** 中值 FWHM (像素) */
  medianFwhm: number;
  /** 星点圆度 (0-1, 1=完美圆形) */
  roundness: number;
  /** 综合质量评分 (0-100) */
  score: number;
  /** 检测到的星点列表 */
  stars: DetectedStar[];
}

export interface FrameQualityScoringWeights {
  fwhm: number;
  snr: number;
  starCount: number;
  roundness: number;
}

export interface FrameQualityScoringThresholds {
  fwhmBest: number;
  fwhmWorst: number;
  starCountScale: number;
}

export interface FrameQualityOptions {
  detectionOptions?: StarDetectionOptions;
  scoringWeights?: Partial<FrameQualityScoringWeights>;
  scoringThresholds?: Partial<FrameQualityScoringThresholds>;
  starsOverride?: DetectedStar[];
}

export interface FrameQualityRuntime {
  signal?: AbortSignal;
  onProgress?: (progress: number, stage: string) => void;
  detectionRuntime?: StarDetectionRuntime;
}

const DEFAULT_WEIGHTS: FrameQualityScoringWeights = {
  fwhm: 0.4,
  snr: 0.3,
  starCount: 0.15,
  roundness: 0.15,
};

const DEFAULT_THRESHOLDS: FrameQualityScoringThresholds = {
  fwhmBest: 1.5,
  fwhmWorst: 7.5,
  starCountScale: 2,
};

function normalizeWeights(weights: FrameQualityScoringWeights): FrameQualityScoringWeights {
  const sum = weights.fwhm + weights.snr + weights.starCount + weights.roundness;
  if (sum <= 0) return DEFAULT_WEIGHTS;
  return {
    fwhm: weights.fwhm / sum,
    snr: weights.snr / sum,
    starCount: weights.starCount / sum,
    roundness: weights.roundness / sum,
  };
}

function resolveOptions(options: FrameQualityOptions | undefined) {
  const detectionDefaults: StarDetectionOptions = {
    profile: "legacy",
    sigmaThreshold: 5,
    minArea: 3,
    maxStars: 200,
  };

  const weights = normalizeWeights({
    ...DEFAULT_WEIGHTS,
    ...(options?.scoringWeights ?? {}),
  });

  const thresholds = {
    ...DEFAULT_THRESHOLDS,
    ...(options?.scoringThresholds ?? {}),
  };

  return {
    detectionOptions: {
      ...detectionDefaults,
      ...(options?.detectionOptions ?? {}),
    },
    weights,
    thresholds,
  };
}

function computeScore(
  starCount: number,
  fwhm: number,
  snr: number,
  roundness: number,
  weights: FrameQualityScoringWeights,
  thresholds: FrameQualityScoringThresholds,
): number {
  const fwhmScore =
    fwhm > 0
      ? Math.max(
          0,
          Math.min(
            100,
            100 * (1 - (fwhm - thresholds.fwhmBest) / (thresholds.fwhmWorst - thresholds.fwhmBest)),
          ),
        )
      : 50;

  const snrScore = snr > 0 ? Math.max(0, Math.min(100, 20 * Math.log10(snr))) : 0;
  const starScore = Math.min(100, starCount * thresholds.starCountScale);
  const roundScore = Math.max(0, Math.min(100, roundness * 100));

  return Math.round(
    fwhmScore * weights.fwhm +
      snrScore * weights.snr +
      starScore * weights.starCount +
      roundScore * weights.roundness,
  );
}

function buildMetrics(
  pixels: Float32Array,
  width: number,
  height: number,
  stars: DetectedStar[],
  noise: number,
  background: Float32Array,
  weights: FrameQualityScoringWeights,
  thresholds: FrameQualityScoringThresholds,
): FrameQualityMetrics {
  const bgSamples: number[] = [];
  const step = Math.max(1, Math.floor(background.length / 10000));
  for (let i = 0; i < background.length; i += step) {
    bgSamples.push(background[i]);
  }
  bgSamples.sort((a, b) => a - b);
  const backgroundMedian = bgSamples[Math.floor(bgSamples.length / 2)] ?? 0;

  const starCount = stars.length;

  let medianFwhm = 0;
  if (starCount > 0) {
    const fwhms = stars.map((s) => s.fwhm).sort((a, b) => a - b);
    medianFwhm = fwhms[Math.floor(fwhms.length / 2)] ?? 0;
  }

  let snr = 0;
  if (starCount > 0 && noise > 0) {
    const peaks = stars.map((s) => s.peak).sort((a, b) => a - b);
    const medianPeak = peaks[Math.floor(peaks.length / 2)] ?? 0;
    snr = medianPeak / noise;
  }

  let roundness = 1;
  if (starCount >= 5) {
    const fwhms = stars.map((s) => s.fwhm);
    const mean = fwhms.reduce((a, b) => a + b, 0) / fwhms.length;
    const variance = fwhms.reduce((acc, v) => acc + (v - mean) ** 2, 0) / fwhms.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    roundness = Math.max(0, Math.min(1, 1 - cv));
  }

  return {
    backgroundMedian,
    backgroundNoise: noise,
    snr,
    starCount,
    medianFwhm,
    roundness,
    score: computeScore(starCount, medianFwhm, snr, roundness, weights, thresholds),
    stars,
  };
}

/**
 * 同步评估（兼容旧调用）
 */
export function evaluateFrameQuality(
  pixels: Float32Array,
  width: number,
  height: number,
  options: FrameQualityOptions = {},
): FrameQualityMetrics {
  const resolved = resolveOptions(options);
  const { background, noise } = estimateBackground(
    pixels,
    width,
    height,
    resolved.detectionOptions.meshSize ?? 64,
    resolved.detectionOptions.sigmaClipIters ?? 2,
  );

  const stars =
    options.starsOverride && options.starsOverride.length > 0
      ? options.starsOverride
      : detectStars(pixels, width, height, resolved.detectionOptions);
  return buildMetrics(
    pixels,
    width,
    height,
    stars,
    noise,
    background,
    resolved.weights,
    resolved.thresholds,
  );
}

/**
 * 异步评估（用于堆叠链路）
 */
export async function evaluateFrameQualityAsync(
  pixels: Float32Array,
  width: number,
  height: number,
  options: FrameQualityOptions = {},
  runtime: FrameQualityRuntime = {},
): Promise<FrameQualityMetrics> {
  if (runtime.signal?.aborted) {
    const err = new Error("Aborted");
    err.name = "AbortError";
    throw err;
  }

  const resolved = resolveOptions(options);
  runtime.onProgress?.(0.05, "background");

  const { background, noise } = estimateBackground(
    pixels,
    width,
    height,
    resolved.detectionOptions.meshSize ?? 64,
    resolved.detectionOptions.sigmaClipIters ?? 2,
  );

  runtime.onProgress?.(0.25, "detect-stars");
  const stars =
    options.starsOverride && options.starsOverride.length > 0
      ? options.starsOverride
      : await detectStarsAsync(
          pixels,
          width,
          height,
          resolved.detectionOptions,
          runtime.detectionRuntime,
        );

  runtime.onProgress?.(0.95, "score");
  const metrics = buildMetrics(
    pixels,
    width,
    height,
    stars,
    noise,
    background,
    resolved.weights,
    resolved.thresholds,
  );
  runtime.onProgress?.(1, "done");
  return metrics;
}

/**
 * 批量评估帧质量（同步）
 */
export function evaluateFramesBatch(
  frames: Array<{ pixels: Float32Array; width: number; height: number }>,
  onProgress?: (current: number, total: number) => void,
  options: FrameQualityOptions = {},
): FrameQualityMetrics[] {
  const results: FrameQualityMetrics[] = [];

  for (let i = 0; i < frames.length; i++) {
    onProgress?.(i + 1, frames.length);
    results.push(
      evaluateFrameQuality(frames[i].pixels, frames[i].width, frames[i].height, options),
    );
  }

  return results;
}

/**
 * 批量评估帧质量（异步）
 */
export async function evaluateFramesBatchAsync(
  frames: Array<{ pixels: Float32Array; width: number; height: number }>,
  options: FrameQualityOptions = {},
  runtime: {
    signal?: AbortSignal;
    onProgress?: (current: number, total: number, stage: string) => void;
    detectionRuntime?: StarDetectionRuntime;
  } = {},
): Promise<FrameQualityMetrics[]> {
  const results: FrameQualityMetrics[] = [];

  for (let i = 0; i < frames.length; i++) {
    if (runtime.signal?.aborted) {
      const err = new Error("Aborted");
      err.name = "AbortError";
      throw err;
    }

    runtime.onProgress?.(i, frames.length, "start-frame");
    const metrics = await evaluateFrameQualityAsync(
      frames[i].pixels,
      frames[i].width,
      frames[i].height,
      options,
      {
        signal: runtime.signal,
        detectionRuntime: runtime.detectionRuntime,
        onProgress: (p, stage) => runtime.onProgress?.(i + p, frames.length, stage),
      },
    );
    results.push(metrics);
    runtime.onProgress?.(i + 1, frames.length, "done-frame");

    if (i + 1 < frames.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * 根据质量评分生成权重数组 (用于加权叠加)
 * 归一化为 [0, 1] 范围
 */
export function qualityToWeights(metrics: FrameQualityMetrics[]): number[] {
  if (metrics.length === 0) return [];

  const scores = metrics.map((m) => m.score);
  const maxScore = Math.max(...scores);

  if (maxScore === 0) return scores.map(() => 1);

  return scores.map((s) => s / maxScore);
}
