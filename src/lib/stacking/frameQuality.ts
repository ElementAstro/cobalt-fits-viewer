/**
 * 帧质量评估模块
 * 计算每帧的质量指标: 背景、噪声、SNR、星点数、FWHM、综合评分
 */

import { detectStars, estimateBackground, type DetectedStar } from "./starDetection";

export interface FrameQualityMetrics {
  /** 背景中值 */
  backgroundMedian: number;
  /** 背景噪声 (sigma) */
  backgroundNoise: number;
  /** 信噪比 (SNR = mean_signal / noise) */
  snr: number;
  /** 检测到的星点数 */
  starCount: number;
  /** 中值 FWHM (角秒或像素) */
  medianFwhm: number;
  /** 星点圆度 (0-1, 1=完美圆形) */
  roundness: number;
  /** 综合质量评分 (0-100) */
  score: number;
  /** 检测到的星点列表 */
  stars: DetectedStar[];
}

/**
 * 评估单帧质量
 */
export function evaluateFrameQuality(
  pixels: Float32Array,
  width: number,
  height: number,
): FrameQualityMetrics {
  // 1. Background estimation
  const { background, noise } = estimateBackground(pixels, width, height);

  // Background median
  const bgSamples: number[] = [];
  const step = Math.max(1, Math.floor(background.length / 10000));
  for (let i = 0; i < background.length; i += step) {
    bgSamples.push(background[i]);
  }
  bgSamples.sort((a, b) => a - b);
  const backgroundMedian = bgSamples[Math.floor(bgSamples.length / 2)];

  // 2. Star detection
  const stars = detectStars(pixels, width, height, {
    sigmaThreshold: 5,
    maxStars: 200,
    minArea: 3,
  });

  const starCount = stars.length;

  // 3. Median FWHM
  let medianFwhm = 0;
  if (stars.length > 0) {
    const fwhms = stars.map((s) => s.fwhm).sort((a, b) => a - b);
    medianFwhm = fwhms[Math.floor(fwhms.length / 2)];
  }

  // 4. SNR estimation
  // Signal = median of star peak values minus background
  let snr = 0;
  if (stars.length > 0 && noise > 0) {
    const peaks = stars.map((s) => s.peak).sort((a, b) => a - b);
    const medianPeak = peaks[Math.floor(peaks.length / 2)];
    snr = medianPeak / noise;
  }

  // 5. Roundness - estimate from FWHM distribution spread
  // Low spread = round stars, high spread = elongated/tracking errors
  let roundness = 1;
  if (stars.length >= 5) {
    const fwhms = stars.map((s) => s.fwhm);
    const mean = fwhms.reduce((a, b) => a + b, 0) / fwhms.length;
    const variance = fwhms.reduce((s, v) => s + (v - mean) ** 2, 0) / fwhms.length;
    const cv = mean > 0 ? Math.sqrt(variance) / mean : 0;
    roundness = Math.max(0, Math.min(1, 1 - cv));
  }

  // 6. Composite score (0-100)
  const score = computeScore(starCount, medianFwhm, snr, noise, roundness);

  return {
    backgroundMedian,
    backgroundNoise: noise,
    snr,
    starCount,
    medianFwhm,
    roundness,
    score,
    stars,
  };
}

/**
 * 计算综合质量评分
 * 权重: FWHM(40%) + SNR(30%) + 星点数(15%) + 圆度(15%)
 */
function computeScore(
  starCount: number,
  fwhm: number,
  snr: number,
  noise: number,
  roundness: number,
): number {
  // FWHM score: lower is better, typical range 1.5-6 pixels
  const fwhmScore = fwhm > 0 ? Math.max(0, Math.min(100, 100 * (1 - (fwhm - 1.5) / 6))) : 50;

  // SNR score: higher is better, log scale
  const snrScore = snr > 0 ? Math.max(0, Math.min(100, 20 * Math.log10(snr))) : 0;

  // Star count score: more stars = better data, diminishing returns
  const starScore = Math.min(100, starCount * 2);

  // Roundness score: 0-1 mapped to 0-100
  const roundScore = roundness * 100;

  return Math.round(fwhmScore * 0.4 + snrScore * 0.3 + starScore * 0.15 + roundScore * 0.15);
}

/**
 * 批量评估帧质量
 */
export function evaluateFramesBatch(
  frames: Array<{ pixels: Float32Array; width: number; height: number }>,
  onProgress?: (current: number, total: number) => void,
): FrameQualityMetrics[] {
  const results: FrameQualityMetrics[] = [];

  for (let i = 0; i < frames.length; i++) {
    onProgress?.(i + 1, frames.length);
    results.push(evaluateFrameQuality(frames[i].pixels, frames[i].width, frames[i].height));
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
