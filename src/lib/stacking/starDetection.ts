/**
 * 星点检测模块
 * - 兼容入口: detectStars() 默认 legacy 配置，保持编辑器/掩膜旧行为
 * - 新入口: detectStarsAsync() 支持分块异步、去混叠、形态过滤、可取消
 */

export type StarDetectionProfile = "legacy" | "fast" | "balanced" | "accurate";
export type StarDetectionConnectivity = 4 | 8;

export interface DetectedStar {
  /** 质心 X 坐标 (亚像素精度) */
  cx: number;
  /** 质心 Y 坐标 (亚像素精度) */
  cy: number;
  /** 星点总通量 (所有像素之和减去背景) */
  flux: number;
  /** 星点峰值像素 */
  peak: number;
  /** 星点像素数 */
  area: number;
  /** 估算半高全宽 (FWHM) */
  fwhm: number;
  /** 圆度 [0,1]，越接近 1 越圆 */
  roundness?: number;
  /** 椭率 [0,1]，越接近 0 越圆 */
  ellipticity?: number;
  /** 主轴方向 (弧度) */
  theta?: number;
  /** 信噪比估计 */
  snr?: number;
  /** 锐度估计 */
  sharpness?: number;
  /** 诊断标记位 */
  flags?: number;
}

export interface DetectedStarExtended extends DetectedStar {
  roundness: number;
  ellipticity: number;
  theta: number;
  snr: number;
  sharpness: number;
  flags: number;
}

export interface StarDetectionOptions {
  profile?: StarDetectionProfile;
  /** 检测阈值，单位为背景噪声 sigma */
  sigmaThreshold?: number;
  /** 最大返回星点数 */
  maxStars?: number;
  /** 最小星点面积 */
  minArea?: number;
  /** 最大星点面积 */
  maxArea?: number;
  /** 边缘剔除像素宽度 */
  borderMargin?: number;
  /** 背景网格尺寸 */
  meshSize?: number;
  /** sigma-clipping 迭代次数 */
  sigmaClipIters?: number;
  /** 是否启用 matched filter */
  applyMatchedFilter?: boolean;
  /** matched filter FWHM */
  filterFwhm?: number;
  /** 去混叠分层数 */
  deblendNLevels?: number;
  /** 去混叠最小对比度 */
  deblendMinContrast?: number;
  /** 连通方式 */
  connectivity?: StarDetectionConnectivity;
  /** 形态过滤：最小 FWHM */
  minFwhm?: number;
  /** 形态过滤：最大 FWHM */
  maxFwhm?: number;
  /** 形态过滤：最大椭率 */
  maxEllipticity?: number;
  /** 形态过滤：最小锐度 */
  minSharpness?: number;
  /** 形态过滤：最大锐度 */
  maxSharpness?: number;
  /** 峰值上限（用于抑制饱和星） */
  peakMax?: number;
  /** 最小 SNR */
  snrMin?: number;
}

export interface StarDetectionRuntime {
  signal?: AbortSignal;
  onProgress?: (progress: number, stage: string) => void;
  /** 每处理多少行让出一次主线程 */
  chunkRows?: number;
}

interface ResolvedStarDetectionOptions extends Required<Omit<StarDetectionOptions, "peakMax">> {
  peakMax?: number;
}

const PROFILE_PRESETS: Record<StarDetectionProfile, ResolvedStarDetectionOptions> = {
  legacy: {
    profile: "legacy",
    sigmaThreshold: 5,
    maxStars: 200,
    minArea: 3,
    maxArea: 500,
    borderMargin: 10,
    meshSize: 64,
    sigmaClipIters: 0,
    applyMatchedFilter: false,
    filterFwhm: 2.2,
    deblendNLevels: 1,
    deblendMinContrast: 0.2,
    connectivity: 4,
    minFwhm: 0.3,
    maxFwhm: 20,
    maxEllipticity: 1,
    minSharpness: 0,
    maxSharpness: 1e9,
    snrMin: 0,
  },
  fast: {
    profile: "fast",
    sigmaThreshold: 6,
    maxStars: 160,
    minArea: 4,
    maxArea: 550,
    borderMargin: 12,
    meshSize: 96,
    sigmaClipIters: 1,
    applyMatchedFilter: false,
    filterFwhm: 2.4,
    deblendNLevels: 8,
    deblendMinContrast: 0.12,
    connectivity: 8,
    minFwhm: 0.7,
    maxFwhm: 12,
    maxEllipticity: 0.7,
    minSharpness: 0.3,
    maxSharpness: 12,
    snrMin: 2.5,
  },
  balanced: {
    profile: "balanced",
    sigmaThreshold: 5,
    maxStars: 220,
    minArea: 3,
    maxArea: 600,
    borderMargin: 10,
    meshSize: 64,
    sigmaClipIters: 2,
    applyMatchedFilter: true,
    filterFwhm: 2.2,
    deblendNLevels: 16,
    deblendMinContrast: 0.08,
    connectivity: 8,
    minFwhm: 0.6,
    maxFwhm: 11,
    maxEllipticity: 0.65,
    minSharpness: 0.25,
    maxSharpness: 18,
    snrMin: 2,
  },
  accurate: {
    profile: "accurate",
    sigmaThreshold: 4.5,
    maxStars: 320,
    minArea: 3,
    maxArea: 800,
    borderMargin: 8,
    meshSize: 48,
    sigmaClipIters: 3,
    applyMatchedFilter: true,
    filterFwhm: 2,
    deblendNLevels: 32,
    deblendMinContrast: 0.05,
    connectivity: 8,
    minFwhm: 0.5,
    maxFwhm: 10,
    maxEllipticity: 0.55,
    minSharpness: 0.2,
    maxSharpness: 24,
    snrMin: 1.8,
  },
};

const EPS = 1e-8;
const FLAG_DEBLENDED = 1 << 0;

function resolveOptions(
  options: StarDetectionOptions | undefined,
  fallbackProfile: StarDetectionProfile,
): ResolvedStarDetectionOptions {
  const profile = options?.profile ?? fallbackProfile;
  const preset = PROFILE_PRESETS[profile];
  return {
    ...preset,
    ...options,
    profile,
  };
}

function makeAbortError() {
  const err = new Error("Aborted");
  err.name = "AbortError";
  return err;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw makeAbortError();
}

function reportProgress(
  runtime: StarDetectionRuntime | undefined,
  progress: number,
  stage: string,
) {
  runtime?.onProgress?.(Math.max(0, Math.min(1, progress)), stage);
}

function medianSorted(values: number[]) {
  if (values.length === 0) return 0;
  return values[Math.floor(values.length / 2)];
}

function robustStats(values: number[], sigmaClipIters: number): { median: number; sigma: number } {
  if (values.length === 0) return { median: 0, sigma: 0 };
  let work = values.slice();
  for (let iter = 0; iter <= sigmaClipIters; iter++) {
    work.sort((a, b) => a - b);
    const med = medianSorted(work);
    const absDev = work.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = medianSorted(absDev);
    const sigma = mad > 0 ? mad / 0.6744897501960817 : 0;
    if (iter === sigmaClipIters || sigma <= 0) {
      return { median: med, sigma };
    }
    const lower = med - 3 * sigma;
    const upper = med + 3 * sigma;
    const clipped = work.filter((v) => v >= lower && v <= upper);
    if (clipped.length < Math.max(8, Math.floor(work.length * 0.35))) {
      return { median: med, sigma };
    }
    work = clipped;
  }
  return { median: 0, sigma: 0 };
}

/**
 * 估算图像背景和噪声水平
 * 将图像分为网格块，对每块做稳健统计后双线性插值背景
 */
export function estimateBackground(
  pixels: Float32Array,
  width: number,
  height: number,
  meshSize: number = 64,
  sigmaClipIters: number = 2,
): { background: Float32Array; noise: number } {
  const n = pixels.length;
  const bg = new Float32Array(n);
  const nx = Math.max(1, Math.ceil(width / meshSize));
  const ny = Math.max(1, Math.ceil(height / meshSize));
  const meshValues: number[][] = Array.from({ length: nx * ny }, () => []);
  for (let y = 0; y < height; y++) {
    const my = Math.min(Math.floor(y / meshSize), ny - 1);
    for (let x = 0; x < width; x++) {
      const mx = Math.min(Math.floor(x / meshSize), nx - 1);
      const v = pixels[y * width + x];
      if (!Number.isNaN(v) && Number.isFinite(v)) {
        meshValues[my * nx + mx].push(v);
      }
    }
  }

  const meshMedians = new Float32Array(nx * ny);
  const meshSigmas = new Float32Array(nx * ny);
  for (let i = 0; i < meshValues.length; i++) {
    const stats = robustStats(meshValues[i], sigmaClipIters);
    meshMedians[i] = stats.median;
    meshSigmas[i] = stats.sigma;
  }

  for (let y = 0; y < height; y++) {
    const fy = (y + 0.5) / meshSize - 0.5;
    const my0 = Math.max(0, Math.min(ny - 1, Math.floor(fy)));
    const my1 = Math.min(ny - 1, my0 + 1);
    const ty = fy - my0;
    for (let x = 0; x < width; x++) {
      const fx = (x + 0.5) / meshSize - 0.5;
      const mx0 = Math.max(0, Math.min(nx - 1, Math.floor(fx)));
      const mx1 = Math.min(nx - 1, mx0 + 1);
      const tx = fx - mx0;
      const v00 = meshMedians[my0 * nx + mx0];
      const v10 = meshMedians[my0 * nx + mx1];
      const v01 = meshMedians[my1 * nx + mx0];
      const v11 = meshMedians[my1 * nx + mx1];
      bg[y * width + x] =
        v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty;
    }
  }

  const allSigmas = Array.from(meshSigmas).filter((v) => v > 0 && Number.isFinite(v));
  allSigmas.sort((a, b) => a - b);
  const noise = allSigmas.length > 0 ? allSigmas[Math.floor(allSigmas.length / 2)] : 1;
  return { background: bg, noise: Number.isFinite(noise) && noise > 0 ? noise : 1 };
}
function gaussianKernel1D(sigma: number) {
  const safe = Math.max(0.3, sigma);
  const radius = Math.max(1, Math.ceil(safe * 3));
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const s2 = 2 * safe * safe;
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    const v = Math.exp(-(i * i) / s2);
    kernel[i + radius] = v;
    sum += v;
  }
  if (sum > 0) {
    for (let i = 0; i < size; i++) kernel[i] /= sum;
  }
  return { kernel, radius };
}

function convolveSeparable(
  input: Float32Array,
  width: number,
  height: number,
  sigma: number,
): Float32Array {
  const { kernel, radius } = gaussianKernel1D(sigma);
  const temp = new Float32Array(input.length);
  const output = new Float32Array(input.length);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        acc += input[y * width + sx] * kernel[k + radius];
      }
      temp[y * width + x] = acc;
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        acc += temp[sy * width + x] * kernel[k + radius];
      }
      output[y * width + x] = acc;
    }
  }
  return output;
}

async function convolveSeparableAsync(
  input: Float32Array,
  width: number,
  height: number,
  sigma: number,
  runtime?: StarDetectionRuntime,
): Promise<Float32Array> {
  const { kernel, radius } = gaussianKernel1D(sigma);
  const temp = new Float32Array(input.length);
  const output = new Float32Array(input.length);
  const chunkRows = Math.max(8, runtime?.chunkRows ?? 32);

  for (let y = 0; y < height; y++) {
    throwIfAborted(runtime?.signal);
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.max(0, Math.min(width - 1, x + k));
        acc += input[y * width + sx] * kernel[k + radius];
      }
      temp[y * width + x] = acc;
    }
    if ((y + 1) % chunkRows === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  for (let y = 0; y < height; y++) {
    throwIfAborted(runtime?.signal);
    for (let x = 0; x < width; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.max(0, Math.min(height - 1, y + k));
        acc += temp[sy * width + x] * kernel[k + radius];
      }
      output[y * width + x] = acc;
    }
    if ((y + 1) % chunkRows === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }
  return output;
}

function getNeighborOffsets(width: number, connectivity: StarDetectionConnectivity) {
  if (connectivity === 4) {
    return [-width, width, -1, 1];
  }
  return [-width, width, -1, 1, -width - 1, -width + 1, width - 1, width + 1];
}

function computeComponentFlux(indices: number[], values: Float32Array) {
  let flux = 0;
  for (const idx of indices) flux += Math.max(0, values[idx]);
  return flux;
}

function findLocalMaxima(
  indices: number[],
  values: Float32Array,
  width: number,
  height: number,
  threshold: number,
) {
  const maxima: Array<{ idx: number; value: number }> = [];
  for (const idx of indices) {
    const value = values[idx];
    if (value < threshold) continue;
    const x = idx % width;
    const y = (idx / width) | 0;
    let isPeak = true;
    for (let dy = -1; dy <= 1 && isPeak; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nIdx = ny * width + nx;
        if (values[nIdx] > value) {
          isPeak = false;
          break;
        }
      }
    }
    if (isPeak) maxima.push({ idx, value });
  }
  maxima.sort((a, b) => b.value - a.value);
  return maxima;
}

function splitComponentBySeeds(
  indices: number[],
  values: Float32Array,
  width: number,
  height: number,
  threshold: number,
  options: ResolvedStarDetectionOptions,
): Array<{ indices: number[]; deblended: boolean }> {
  if (options.deblendNLevels <= 1) return [{ indices, deblended: false }];
  const totalFlux = computeComponentFlux(indices, values);
  if (totalFlux <= 0) return [{ indices, deblended: false }];

  const maxima = findLocalMaxima(indices, values, width, height, threshold);
  if (maxima.length <= 1) return [{ indices, deblended: false }];

  const candidateSeeds = maxima.slice(0, options.deblendNLevels);
  const seeds = candidateSeeds.filter(({ idx }) => {
    const x = idx % width;
    const y = (idx / width) | 0;
    let localFlux = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        localFlux += Math.max(0, values[ny * width + nx]);
      }
    }
    return localFlux >= options.deblendMinContrast * totalFlux;
  });
  if (seeds.length <= 1) return [{ indices, deblended: false }];

  const groups: number[][] = Array.from({ length: seeds.length }, () => []);
  for (const idx of indices) {
    const x = idx % width;
    const y = (idx / width) | 0;
    let bestSeed = 0;
    let bestDist = Infinity;
    for (let i = 0; i < seeds.length; i++) {
      const sx = seeds[i].idx % width;
      const sy = (seeds[i].idx / width) | 0;
      const dx = x - sx;
      const dy = y - sy;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist) {
        bestDist = d2;
        bestSeed = i;
      }
    }
    groups[bestSeed].push(idx);
  }

  const keep: Array<{ indices: number[]; deblended: boolean }> = [];
  for (const group of groups) {
    const subFlux = computeComponentFlux(group, values);
    if (subFlux >= options.deblendMinContrast * totalFlux) {
      keep.push({ indices: group, deblended: true });
    }
  }
  return keep.length > 1 ? keep : [{ indices, deblended: false }];
}

function measureStar(
  indices: number[],
  values: Float32Array,
  width: number,
  noise: number,
  deblended: boolean,
): DetectedStarExtended | null {
  if (indices.length === 0) return null;
  let flux = 0;
  let sumX = 0;
  let sumY = 0;
  let peak = 0;
  for (const idx of indices) {
    const v = Math.max(0, values[idx]);
    const x = idx % width;
    const y = (idx / width) | 0;
    flux += v;
    sumX += x * v;
    sumY += y * v;
    if (v > peak) peak = v;
  }
  if (flux <= 0) return null;

  const cx = sumX / flux;
  const cy = sumY / flux;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const idx of indices) {
    const v = Math.max(0, values[idx]);
    const x = idx % width;
    const y = (idx / width) | 0;
    const dx = x - cx;
    const dy = y - cy;
    sxx += dx * dx * v;
    syy += dy * dy * v;
    sxy += dx * dy * v;
  }
  sxx /= flux;
  syy /= flux;
  sxy /= flux;

  const trace = sxx + syy;
  const detTerm = Math.max(0, (trace * trace) / 4 - (sxx * syy - sxy * sxy));
  const lambda1 = Math.max(EPS, trace / 2 + Math.sqrt(detTerm));
  const lambda2 = Math.max(EPS, trace / 2 - Math.sqrt(detTerm));
  const sigmaMajor = Math.sqrt(lambda1);
  const sigmaMinor = Math.sqrt(lambda2);
  const sigmaEq = Math.sqrt((lambda1 + lambda2) / 2);
  const fwhm = 2.3548 * sigmaEq;
  const roundness = Math.max(0, Math.min(1, sigmaMinor / (sigmaMajor + EPS)));
  const ellipticity = 1 - roundness;
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const area = indices.length;
  const meanFlux = flux / Math.max(1, area);
  const sharpness = peak / (meanFlux + EPS);
  const snr = flux / (Math.sqrt(area) * Math.max(EPS, noise));
  return {
    cx,
    cy,
    flux,
    peak,
    area,
    fwhm,
    roundness,
    ellipticity,
    theta,
    snr,
    sharpness,
    flags: deblended ? FLAG_DEBLENDED : 0,
  };
}

function acceptStar(
  star: DetectedStarExtended,
  options: ResolvedStarDetectionOptions,
  width: number,
  height: number,
) {
  if (star.area < options.minArea || star.area > options.maxArea) return false;
  if (star.fwhm < options.minFwhm || star.fwhm > options.maxFwhm) return false;
  if (star.ellipticity > options.maxEllipticity) return false;
  if (star.sharpness < options.minSharpness || star.sharpness > options.maxSharpness) return false;
  if (options.peakMax !== undefined && star.peak > options.peakMax) return false;
  if (star.snr < options.snrMin) return false;
  if (
    star.cx < options.borderMargin ||
    star.cx >= width - options.borderMargin ||
    star.cy < options.borderMargin ||
    star.cy >= height - options.borderMargin
  ) {
    return false;
  }
  return true;
}
function detectStarsLegacy(
  pixels: Float32Array,
  width: number,
  height: number,
  options: StarDetectionOptions = {},
): DetectedStar[] {
  const {
    sigmaThreshold = 5,
    maxStars = 200,
    minArea = 3,
    maxArea = 500,
    borderMargin = 10,
  } = options;

  const { background, noise } = estimateBackground(
    pixels,
    width,
    height,
    options.meshSize ?? 64,
    0,
  );
  const n = width * height;
  const bgsub = new Float32Array(n);
  for (let i = 0; i < n; i++) bgsub[i] = pixels[i] - background[i];
  const threshold = sigmaThreshold * noise;
  const labels = new Int32Array(n);
  const stars: DetectedStar[] = [];
  const stack: number[] = [];
  let nextLabel = 1;

  for (let y = borderMargin; y < height - borderMargin; y++) {
    for (let x = borderMargin; x < width - borderMargin; x++) {
      const idx = y * width + x;
      if (labels[idx] !== 0 || bgsub[idx] < threshold) continue;
      const label = nextLabel++;
      stack.length = 0;
      stack.push(idx);
      labels[idx] = label;
      let sumFlux = 0;
      let sumX = 0;
      let sumY = 0;
      let peak = 0;
      let area = 0;
      let sumR2 = 0;
      while (stack.length > 0) {
        const ci = stack.pop()!;
        const cy = (ci / width) | 0;
        const cx = ci % width;
        const val = bgsub[ci];
        sumFlux += val;
        sumX += cx * val;
        sumY += cy * val;
        if (val > peak) peak = val;
        area++;
        const neighbors = [
          cy > 0 ? ci - width : -1,
          cy < height - 1 ? ci + width : -1,
          cx > 0 ? ci - 1 : -1,
          cx < width - 1 ? ci + 1 : -1,
        ];
        for (const ni of neighbors) {
          if (ni >= 0 && labels[ni] === 0 && bgsub[ni] >= threshold) {
            labels[ni] = label;
            stack.push(ni);
          }
        }
      }
      if (area < minArea || area > maxArea) continue;
      const centroidX = sumFlux > 0 ? sumX / sumFlux : 0;
      const centroidY = sumFlux > 0 ? sumY / sumFlux : 0;
      for (
        let py = Math.max(0, Math.floor(centroidY) - 10);
        py <= Math.min(height - 1, Math.ceil(centroidY) + 10);
        py++
      ) {
        for (
          let px = Math.max(0, Math.floor(centroidX) - 10);
          px <= Math.min(width - 1, Math.ceil(centroidX) + 10);
          px++
        ) {
          if (labels[py * width + px] === label) {
            const dx = px - centroidX;
            const dy = py - centroidY;
            sumR2 += (dx * dx + dy * dy) * bgsub[py * width + px];
          }
        }
      }
      const sigma2 = sumFlux > 0 ? sumR2 / sumFlux : 1;
      const fwhm = 2.3548 * Math.sqrt(Math.max(0.1, sigma2));
      if (fwhm > 20) continue;
      if (
        centroidX < borderMargin ||
        centroidX >= width - borderMargin ||
        centroidY < borderMargin ||
        centroidY >= height - borderMargin
      ) {
        continue;
      }
      stars.push({ cx: centroidX, cy: centroidY, flux: sumFlux, peak, area, fwhm });
    }
  }
  stars.sort((a, b) => b.flux - a.flux);
  return stars.slice(0, maxStars);
}

function detectStarsModernSync(
  pixels: Float32Array,
  width: number,
  height: number,
  options: ResolvedStarDetectionOptions,
): DetectedStarExtended[] {
  const { background, noise } = estimateBackground(
    pixels,
    width,
    height,
    options.meshSize,
    options.sigmaClipIters,
  );
  const n = pixels.length;
  const bgsub = new Float32Array(n);
  for (let i = 0; i < n; i++) bgsub[i] = pixels[i] - background[i];
  const detectImage =
    options.applyMatchedFilter && options.filterFwhm > 0
      ? convolveSeparable(bgsub, width, height, options.filterFwhm / 2.3548)
      : bgsub;
  const threshold = options.sigmaThreshold * Math.max(noise, EPS);
  const labels = new Int32Array(n);
  const stars: DetectedStarExtended[] = [];
  const stack: number[] = [];
  const neighborOffsets = getNeighborOffsets(width, options.connectivity);
  let label = 1;

  for (let y = options.borderMargin; y < height - options.borderMargin; y++) {
    for (let x = options.borderMargin; x < width - options.borderMargin; x++) {
      const start = y * width + x;
      if (labels[start] !== 0 || detectImage[start] < threshold) continue;
      labels[start] = label;
      stack.length = 0;
      stack.push(start);
      const component: number[] = [];
      while (stack.length > 0) {
        const idx = stack.pop()!;
        component.push(idx);
        const cx = idx % width;
        const cy = (idx / width) | 0;
        for (const offset of neighborOffsets) {
          const nIdx = idx + offset;
          if (nIdx < 0 || nIdx >= n) continue;
          const nx = nIdx % width;
          const ny = (nIdx / width) | 0;
          if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
          if (
            nx < options.borderMargin ||
            ny < options.borderMargin ||
            nx >= width - options.borderMargin ||
            ny >= height - options.borderMargin
          ) {
            continue;
          }
          if (labels[nIdx] === 0 && detectImage[nIdx] >= threshold) {
            labels[nIdx] = label;
            stack.push(nIdx);
          }
        }
      }
      label++;
      const splitComponents = splitComponentBySeeds(
        component,
        detectImage,
        width,
        height,
        threshold,
        options,
      );
      for (const part of splitComponents) {
        const star = measureStar(part.indices, bgsub, width, noise, part.deblended);
        if (star && acceptStar(star, options, width, height)) {
          stars.push(star);
        }
      }
    }
  }
  stars.sort((a, b) => b.flux - a.flux);
  return stars.slice(0, options.maxStars);
}

/**
 * 同步检测入口
 * 默认 profile 为 legacy，保持历史行为。
 */
export function detectStars(
  pixels: Float32Array,
  width: number,
  height: number,
  options: StarDetectionOptions = {},
): DetectedStar[] {
  const profile = options.profile ?? "legacy";
  if (profile === "legacy") {
    return detectStarsLegacy(pixels, width, height, options);
  }
  const resolved = resolveOptions(options, "legacy");
  return detectStarsModernSync(pixels, width, height, resolved);
}
/**
 * 异步检测入口
 * 默认 profile 为 balanced，适合堆叠链路。
 */
export async function detectStarsAsync(
  pixels: Float32Array,
  width: number,
  height: number,
  options: StarDetectionOptions = {},
  runtime: StarDetectionRuntime = {},
): Promise<DetectedStarExtended[]> {
  const profile = options.profile ?? "balanced";
  if (profile === "legacy") {
    reportProgress(runtime, 0.1, "legacy-start");
    throwIfAborted(runtime.signal);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const stars = detectStarsLegacy(pixels, width, height, options) as DetectedStarExtended[];
    for (const star of stars) {
      star.roundness ??= 1;
      star.ellipticity ??= 0;
      star.theta ??= 0;
      star.snr ??= 0;
      star.sharpness ??= 0;
      star.flags ??= 0;
    }
    reportProgress(runtime, 1, "done");
    return stars;
  }

  const resolved = resolveOptions({ ...options, profile }, "balanced");
  reportProgress(runtime, 0.02, "background");
  throwIfAborted(runtime.signal);
  const { background, noise } = estimateBackground(
    pixels,
    width,
    height,
    resolved.meshSize,
    resolved.sigmaClipIters,
  );

  const n = pixels.length;
  const bgsub = new Float32Array(n);
  const chunkRows = Math.max(8, runtime.chunkRows ?? 24);
  for (let y = 0; y < height; y++) {
    throwIfAborted(runtime.signal);
    const rowOffset = y * width;
    for (let x = 0; x < width; x++) {
      const idx = rowOffset + x;
      bgsub[idx] = pixels[idx] - background[idx];
    }
    if ((y + 1) % chunkRows === 0) {
      reportProgress(runtime, 0.04 + (y / Math.max(1, height - 1)) * 0.16, "subtract-background");
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  reportProgress(runtime, 0.22, "filter");
  const detectImage =
    resolved.applyMatchedFilter && resolved.filterFwhm > 0
      ? await convolveSeparableAsync(bgsub, width, height, resolved.filterFwhm / 2.3548, runtime)
      : bgsub;

  const threshold = resolved.sigmaThreshold * Math.max(noise, EPS);
  const labels = new Int32Array(n);
  const stars: DetectedStarExtended[] = [];
  const stack: number[] = [];
  const neighborOffsets = getNeighborOffsets(width, resolved.connectivity);
  let label = 1;
  let rowProgressCounter = 0;

  reportProgress(runtime, 0.4, "segment");

  for (let y = resolved.borderMargin; y < height - resolved.borderMargin; y++) {
    throwIfAborted(runtime.signal);
    for (let x = resolved.borderMargin; x < width - resolved.borderMargin; x++) {
      const start = y * width + x;
      if (labels[start] !== 0 || detectImage[start] < threshold) continue;
      labels[start] = label;
      stack.length = 0;
      stack.push(start);
      const component: number[] = [];
      while (stack.length > 0) {
        const idx = stack.pop()!;
        component.push(idx);
        const cx = idx % width;
        const cy = (idx / width) | 0;
        for (const offset of neighborOffsets) {
          const nIdx = idx + offset;
          if (nIdx < 0 || nIdx >= n) continue;
          const nx = nIdx % width;
          const ny = (nIdx / width) | 0;
          if (Math.abs(nx - cx) > 1 || Math.abs(ny - cy) > 1) continue;
          if (
            nx < resolved.borderMargin ||
            ny < resolved.borderMargin ||
            nx >= width - resolved.borderMargin ||
            ny >= height - resolved.borderMargin
          ) {
            continue;
          }
          if (labels[nIdx] === 0 && detectImage[nIdx] >= threshold) {
            labels[nIdx] = label;
            stack.push(nIdx);
          }
        }
      }
      label++;
      const splitComponents = splitComponentBySeeds(
        component,
        detectImage,
        width,
        height,
        threshold,
        resolved,
      );
      for (const part of splitComponents) {
        const star = measureStar(part.indices, bgsub, width, noise, part.deblended);
        if (star && acceptStar(star, resolved, width, height)) {
          stars.push(star);
        }
      }
    }
    rowProgressCounter++;
    if (rowProgressCounter >= chunkRows) {
      rowProgressCounter = 0;
      reportProgress(
        runtime,
        0.4 +
          ((y - resolved.borderMargin) / Math.max(1, height - resolved.borderMargin * 2)) * 0.52,
        "segment",
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  reportProgress(runtime, 0.94, "sort");
  stars.sort((a, b) => b.flux - a.flux);
  const out = stars.slice(0, resolved.maxStars);
  reportProgress(runtime, 1, "done");
  return out;
}
