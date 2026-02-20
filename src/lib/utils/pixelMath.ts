/**
 * 像素数学运算
 */

/**
 * 计算像素统计信息
 */
export function calculateStats(pixels: Float32Array): {
  mean: number;
  median: number;
  stddev: number;
  min: number;
  max: number;
  snr: number;
} {
  const n = pixels.length;
  if (n === 0) return { mean: 0, median: 0, stddev: 0, min: 0, max: 0, snr: 0 };

  let sum = 0;
  let min = Infinity;
  let max = -Infinity;

  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (isNaN(v)) continue;
    sum += v;
    if (v < min) min = v;
    if (v > max) max = v;
  }

  const mean = sum / n;

  let sumSqDiff = 0;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (isNaN(v)) continue;
    sumSqDiff += (v - mean) * (v - mean);
  }
  const stddev = Math.sqrt(sumSqDiff / n);

  // 近似中值（采样排序）
  const sampleSize = Math.min(n, 10000);
  const step = Math.max(1, Math.floor(n / sampleSize));
  const samples: number[] = [];
  for (let i = 0; i < n; i += step) {
    if (!isNaN(pixels[i])) samples.push(pixels[i]);
  }
  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];

  const snr = stddev > 0 ? mean / stddev : 0;

  return { mean, median, stddev, min, max, snr };
}

/**
 * 计算直方图
 * 对超大图像 (>2M 像素) 自动采样以避免阻塞主线程
 * 可传入预计算的 min/max 避免重复扫描
 */
export function calculateHistogram(
  pixels: Float32Array,
  bins: number = 256,
  precomputedRange?: { min: number; max: number },
): { counts: number[]; edges: number[] } {
  const n = pixels.length;

  let min: number;
  let max: number;

  if (precomputedRange) {
    min = precomputedRange.min;
    max = precomputedRange.max;
  } else {
    min = Infinity;
    max = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = pixels[i];
      if (!isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }

  if (min === max) {
    const counts = new Array(bins).fill(0);
    counts[0] = n;
    const edges = Array.from({ length: bins + 1 }, (_, i) => min + i);
    return { counts, edges };
  }

  const range = max - min;
  const binWidth = range / bins;
  const edges = Array.from({ length: bins + 1 }, (_, i) => min + i * binWidth);

  // Use Uint32Array for faster binning
  const rawCounts = new Uint32Array(bins);

  // Sample for very large images (>2M pixels) to keep computation <10ms
  const sampleThreshold = 2_000_000;
  if (n > sampleThreshold) {
    const stride = Math.max(1, Math.floor(n / sampleThreshold));
    for (let i = 0; i < n; i += stride) {
      const v = pixels[i];
      if (isNaN(v)) continue;
      const bin = Math.min(bins - 1, Math.floor((v - min) / binWidth));
      rawCounts[bin]++;
    }
  } else {
    for (let i = 0; i < n; i++) {
      const v = pixels[i];
      if (isNaN(v)) continue;
      const bin = Math.min(bins - 1, Math.floor((v - min) / binWidth));
      rawCounts[bin]++;
    }
  }

  // Convert to regular array for compatibility
  const counts = Array.from(rawCounts);
  return { counts, edges };
}

/**
 * 区域统计（选区内）
 */
export function calculateRegionStats(
  pixels: Float32Array,
  width: number,
  x: number,
  y: number,
  regionWidth: number,
  regionHeight: number,
): ReturnType<typeof calculateStats> {
  const region = new Float32Array(regionWidth * regionHeight);
  let idx = 0;

  for (let ry = y; ry < y + regionHeight; ry++) {
    for (let rx = x; rx < x + regionWidth; rx++) {
      region[idx++] = pixels[ry * width + rx];
    }
  }

  return calculateStats(region);
}

/**
 * 计算区域直方图
 * 提取指定区域内的像素，计算直方图分布
 */
export function calculateRegionHistogram(
  pixels: Float32Array,
  width: number,
  x: number,
  y: number,
  regionWidth: number,
  regionHeight: number,
  bins: number = 256,
  globalRange?: { min: number; max: number },
): { counts: number[]; edges: number[] } {
  const regionPixels = new Float32Array(regionWidth * regionHeight);
  let idx = 0;

  for (let ry = y; ry < y + regionHeight; ry++) {
    for (let rx = x; rx < x + regionWidth; rx++) {
      regionPixels[idx++] = pixels[ry * width + rx];
    }
  }

  return calculateHistogram(regionPixels, bins, globalRange);
}

// ===== 自动拉伸算法 =====

/**
 * ZScale 算法 (IRAF/DS9)
 * 通过线性回归采样像素来确定最佳显示范围
 */
function collectFinitePixels(pixels: Float32Array): number[] {
  const values: number[] = [];
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (Number.isFinite(v)) values.push(v);
  }
  return values;
}

function percentileFromSorted(sorted: number[], percentile: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const p = Math.max(0, Math.min(100, percentile));
  const pos = (p / 100) * (sorted.length - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(sorted.length - 1, i0 + 1);
  const t = pos - i0;
  return sorted[i0] * (1 - t) + sorted[i1] * t;
}

function dilateMask(mask: boolean[], kernelSize: number): boolean[] {
  if (kernelSize <= 1) return mask.slice();
  const radius = Math.floor(kernelSize / 2);
  const out = new Array<boolean>(mask.length).fill(false);
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i]) continue;
    const start = Math.max(0, i - radius);
    const end = Math.min(mask.length - 1, i + radius);
    for (let j = start; j <= end; j++) out[j] = true;
  }
  return out;
}

export function computeZScale(
  pixels: Float32Array,
  nSamples: number = 1000,
  contrast: number = 0.25,
  maxReject: number = 0.5,
  minNPixels: number = 5,
  kRej: number = 2.5,
  maxIterations: number = 5,
): { z1: number; z2: number } {
  const finite = collectFinitePixels(pixels);
  if (finite.length === 0) return { z1: 0, z2: 1 };

  const safeSamples = Math.max(1, Math.floor(nSamples));
  const stride = Math.max(1, Math.floor(finite.length / safeSamples));
  const samples = finite.filter((_, idx) => idx % stride === 0).slice(0, safeSamples);
  if (samples.length === 0) return { z1: 0, z2: 1 };

  samples.sort((a, b) => a - b);

  const npix = samples.length;
  let vmin = samples[0];
  let vmax = samples[npix - 1];

  if (npix < 2) return { z1: vmin, z2: vmax };

  const minpix = Math.max(Math.max(1, Math.floor(minNPixels)), Math.floor(npix * maxReject));
  let ngoodpix = npix;
  let lastNgoodpix = npix + 1;
  let badpix = new Array<boolean>(npix).fill(false);
  const ngrow = Math.max(1, Math.floor(npix * 0.01));

  let fitSlope = 0;
  let fitIntercept = 0;

  for (let iter = 0; iter < Math.max(1, Math.floor(maxIterations)); iter++) {
    if (ngoodpix >= lastNgoodpix || ngoodpix < minpix) break;

    let sumW = 0;
    let sumX = 0;
    let sumY = 0;
    let sumXX = 0;
    let sumXY = 0;
    for (let i = 0; i < npix; i++) {
      if (badpix[i]) continue;
      const x = i;
      const y = samples[i];
      sumW += 1;
      sumX += x;
      sumY += y;
      sumXX += x * x;
      sumXY += x * y;
    }
    if (sumW < 2) break;

    const denom = sumW * sumXX - sumX * sumX;
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) break;

    fitSlope = (sumW * sumXY - sumX * sumY) / denom;
    fitIntercept = (sumY - fitSlope * sumX) / sumW;

    const residuals: number[] = [];
    for (let i = 0; i < npix; i++) {
      if (badpix[i]) continue;
      const fitted = fitIntercept + fitSlope * i;
      residuals.push(samples[i] - fitted);
    }
    if (residuals.length < 2) break;

    let mean = 0;
    for (let i = 0; i < residuals.length; i++) mean += residuals[i];
    mean /= residuals.length;
    let varAcc = 0;
    for (let i = 0; i < residuals.length; i++) {
      const d = residuals[i] - mean;
      varAcc += d * d;
    }
    const sigma = Math.sqrt(varAcc / residuals.length);
    if (!Number.isFinite(sigma) || sigma <= 0) break;

    const threshold = kRej * sigma;
    for (let i = 0; i < npix; i++) {
      if (badpix[i]) continue;
      const fitted = fitIntercept + fitSlope * i;
      const flat = samples[i] - fitted;
      if (flat < -threshold || flat > threshold) {
        badpix[i] = true;
      }
    }

    badpix = dilateMask(badpix, ngrow);
    lastNgoodpix = ngoodpix;
    ngoodpix = 0;
    for (let i = 0; i < npix; i++) if (!badpix[i]) ngoodpix++;
  }

  if (ngoodpix >= minpix) {
    let slope = fitSlope;
    if (contrast > 0) slope /= contrast;
    const centerPixel = Math.floor((npix - 1) / 2);
    const median = percentileFromSorted(samples, 50);
    vmin = Math.max(vmin, median - (centerPixel - 1) * slope);
    vmax = Math.min(vmax, median + (npix - centerPixel) * slope);
  }

  if (!Number.isFinite(vmin) || !Number.isFinite(vmax) || vmin === vmax) {
    return { z1: samples[0], z2: samples[npix - 1] };
  }
  return { z1: Math.min(vmin, vmax), z2: Math.max(vmin, vmax) };
}

/**
 * Percentile clipping
 * 返回指定百分位对应的像素值作为 black/white point
 */
export function computePercentile(
  pixels: Float32Array,
  lowPercentile: number = 1,
  highPercentile: number = 99,
): { z1: number; z2: number } {
  const finite = collectFinitePixels(pixels);
  if (finite.length === 0) return { z1: 0, z2: 1 };

  const lo = Math.max(0, Math.min(100, lowPercentile));
  const hi = Math.max(0, Math.min(100, highPercentile));
  const p1 = Math.min(lo, hi);
  const p2 = Math.max(lo, hi);

  const maxSamples = 50_000;
  let values = finite;
  if (values.length > maxSamples) {
    const stride = Math.max(1, Math.floor(values.length / maxSamples));
    values = values.filter((_, idx) => idx % stride === 0).slice(0, maxSamples);
  }

  values.sort((a, b) => a - b);
  return {
    z1: percentileFromSorted(values, p1),
    z2: percentileFromSorted(values, p2),
  };
}

/**
 * 计算 MAD (Median Absolute Deviation)
 */
export function computeMAD(pixels: Float32Array): { median: number; mad: number } {
  const n = pixels.length;
  if (n === 0) return { median: 0, mad: 0 };

  // Sample for performance
  const maxSamples = 50000;
  const stride = Math.max(1, Math.floor(n / maxSamples));
  const samples: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const v = pixels[i];
    if (!isNaN(v) && isFinite(v)) samples.push(v);
  }

  if (samples.length === 0) return { median: 0, mad: 0 };

  samples.sort((a, b) => a - b);
  const median = samples[Math.floor(samples.length / 2)];

  // Compute MAD
  const deviations = samples.map((v) => Math.abs(v - median));
  deviations.sort((a, b) => a - b);
  const mad = deviations[Math.floor(deviations.length / 2)];

  return { median, mad };
}

/**
 * Midtone Transfer Function (MTF)
 * PixInsight-style STF computation
 */
function _mtf(m: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x === m) return 0.5;
  return ((m - 1) * x) / ((2 * m - 1) * x - m);
}

/**
 * STF 自动拉伸 (Screen Transfer Function, PixInsight-style)
 * 自动计算最优的 blackPoint, whitePoint 和推荐的 stretch 参数
 */
export function computeAutoStretch(
  pixels: Float32Array,
  shadowsClipping: number = -2.8,
  targetBackground: number = 0.25,
): { blackPoint: number; whitePoint: number; midtone: number } {
  const n = pixels.length;
  if (n === 0) return { blackPoint: 0, whitePoint: 1, midtone: 0.5 };

  // Get extent
  let rawMin = Infinity,
    rawMax = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v) && isFinite(v)) {
      if (v < rawMin) rawMin = v;
      if (v > rawMax) rawMax = v;
    }
  }
  const range = rawMax - rawMin;
  if (range === 0) return { blackPoint: 0, whitePoint: 1, midtone: 0.5 };

  // Compute median and MAD
  const { median, mad } = computeMAD(pixels);

  // Normalize median to 0-1 range
  const medianNorm = (median - rawMin) / range;
  // Normalize MAD (scaled by 1.4826 for consistency with normal distribution sigma)
  const madNorm = (mad * 1.4826) / range;

  // Shadow clipping point
  const c0 = Math.max(0, medianNorm + shadowsClipping * madNorm);

  // Highlight clipping point - use 1.0 for most astronomical images
  const c1 = 1.0;

  // Midtone balance: find m such that MTF(m, medianNorm - c0) = targetBackground
  // Solving: targetBackground = ((m-1)*(median-c0)) / ((2m-1)*(median-c0) - m)
  // Rearranging for m:
  const normalizedMedian = medianNorm - c0;
  let m = 0.5;
  if (normalizedMedian > 0 && normalizedMedian < 1) {
    const t = targetBackground;
    m =
      (t * normalizedMedian - normalizedMedian) / (2 * t * normalizedMedian - t - normalizedMedian);
    m = Math.max(0.001, Math.min(0.999, m));
  }

  return {
    blackPoint: c0,
    whitePoint: c1,
    midtone: m,
  };
}

/**
 * Quickselect (Floyd-Rivest) — O(n) median selection in-place
 */
export function quickSelect(arr: Float32Array, lo: number, hi: number, k: number): number {
  while (hi > lo) {
    if (hi - lo > 600) {
      const n = hi - lo + 1;
      const i = k - lo + 1;
      const z = Math.log(n);
      const s = 0.5 * Math.exp((2 * z) / 3);
      const sd = 0.5 * Math.sqrt((z * s * (n - s)) / n) * (i - n / 2 < 0 ? -1 : 1);
      const newLo = Math.max(lo, Math.floor(k - (i * s) / n + sd));
      const newHi = Math.min(hi, Math.floor(k + ((n - i) * s) / n + sd));
      quickSelect(arr, newLo, newHi, k);
    }
    const t = arr[k];
    let i = lo;
    let j = hi;
    // swap lo, k
    arr[k] = arr[lo];
    arr[lo] = t;
    if (arr[hi] > t) {
      arr[lo] = arr[hi];
      arr[hi] = t;
    }
    while (i < j) {
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
      i++;
      j--;
      while (arr[i] < t) i++;
      while (arr[j] > t) j--;
    }
    if (arr[lo] === t) {
      const tmp2 = arr[lo];
      arr[lo] = arr[j];
      arr[j] = tmp2;
    } else {
      j++;
      const tmp2 = arr[j];
      arr[j] = arr[hi];
      arr[hi] = tmp2;
    }
    if (j <= k) lo = j + 1;
    if (k <= j) hi = j - 1;
  }
  return arr[k];
}

/**
 * 图像叠加 - 均值
 */
export function stackAverage(frames: Float32Array[]): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const result = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const frame of frames) {
      sum += frame[i];
    }
    result[i] = sum / frames.length;
  }
  return result;
}

/**
 * 图像叠加 - 中值 (使用 quickselect O(n) 替代完整排序)
 */
export function stackMedian(frames: Float32Array[]): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const fCount = frames.length;
  const result = new Float32Array(n);
  const vals = new Float32Array(fCount);
  const mid = Math.floor(fCount / 2);

  for (let i = 0; i < n; i++) {
    for (let f = 0; f < fCount; f++) {
      vals[f] = frames[f][i];
    }
    result[i] = quickSelect(vals, 0, fCount - 1, mid);
  }
  return result;
}

/**
 * 图像叠加 - Sigma Clipping (优化: 预分配 buffer, 原地操作)
 */
export function stackSigmaClip(frames: Float32Array[], sigma: number = 2.5): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const fCount = frames.length;
  const result = new Float32Array(n);
  const vals = new Float32Array(fCount);
  const mask = new Uint8Array(fCount);

  for (let i = 0; i < n; i++) {
    for (let f = 0; f < fCount; f++) {
      vals[f] = frames[f][i];
    }
    mask.fill(1);
    let count = fCount;

    for (let iter = 0; iter < 3; iter++) {
      let sum = 0;
      for (let f = 0; f < fCount; f++) {
        if (mask[f]) sum += vals[f];
      }
      const mean = sum / count;

      let sumSq = 0;
      for (let f = 0; f < fCount; f++) {
        if (mask[f]) {
          const d = vals[f] - mean;
          sumSq += d * d;
        }
      }
      const std = Math.sqrt(sumSq / count);
      if (std === 0) break;

      const threshold = sigma * std;
      let newCount = 0;
      for (let f = 0; f < fCount; f++) {
        if (mask[f]) {
          if (Math.abs(vals[f] - mean) > threshold) {
            mask[f] = 0;
          } else {
            newCount++;
          }
        }
      }
      if (newCount === 0) {
        mask.fill(1);
        count = fCount;
        break;
      }
      if (newCount === count) break;
      count = newCount;
    }

    let sum = 0;
    for (let f = 0; f < fCount; f++) {
      if (mask[f]) sum += vals[f];
    }
    result[i] = sum / count;
  }
  return result;
}

/**
 * 图像叠加 - 最小值
 */
export function stackMin(frames: Float32Array[]): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const result = new Float32Array(n);
  result.set(frames[0]);

  for (let f = 1; f < frames.length; f++) {
    const frame = frames[f];
    for (let i = 0; i < n; i++) {
      if (frame[i] < result[i]) result[i] = frame[i];
    }
  }
  return result;
}

/**
 * 图像叠加 - 最大值
 */
export function stackMax(frames: Float32Array[]): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const result = new Float32Array(n);
  result.set(frames[0]);

  for (let f = 1; f < frames.length; f++) {
    const frame = frames[f];
    for (let i = 0; i < n; i++) {
      if (frame[i] > result[i]) result[i] = frame[i];
    }
  }
  return result;
}

/**
 * 图像叠加 - Winsorized Sigma Clipping
 * 超出 sigma 的值替换为边界值而非丢弃，保持帧数一致
 */
export function stackWinsorizedSigmaClip(
  frames: Float32Array[],
  sigma: number = 2.5,
): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const fCount = frames.length;
  const result = new Float32Array(n);
  const vals = new Float32Array(fCount);

  for (let i = 0; i < n; i++) {
    for (let f = 0; f < fCount; f++) {
      vals[f] = frames[f][i];
    }

    for (let iter = 0; iter < 3; iter++) {
      let sum = 0;
      for (let f = 0; f < fCount; f++) sum += vals[f];
      const mean = sum / fCount;

      let sumSq = 0;
      for (let f = 0; f < fCount; f++) {
        const d = vals[f] - mean;
        sumSq += d * d;
      }
      const std = Math.sqrt(sumSq / fCount);
      if (std === 0) break;

      const lo = mean - sigma * std;
      const hi = mean + sigma * std;
      let changed = false;
      for (let f = 0; f < fCount; f++) {
        if (vals[f] < lo) {
          vals[f] = lo;
          changed = true;
        } else if (vals[f] > hi) {
          vals[f] = hi;
          changed = true;
        }
      }
      if (!changed) break;
    }

    let sum = 0;
    for (let f = 0; f < fCount; f++) sum += vals[f];
    result[i] = sum / fCount;
  }
  return result;
}

/**
 * 图像叠加 - 加权均值
 * weights 数组长度应与 frames 一致，值越大权重越高
 */
export function stackWeightedAverage(frames: Float32Array[], weights: number[]): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const fCount = frames.length;
  const result = new Float32Array(n);

  let totalWeight = 0;
  for (let f = 0; f < fCount; f++) totalWeight += weights[f];
  if (totalWeight === 0) return stackAverage(frames);

  for (let i = 0; i < n; i++) {
    let wsum = 0;
    for (let f = 0; f < fCount; f++) {
      wsum += frames[f][i] * weights[f];
    }
    result[i] = wsum / totalWeight;
  }
  return result;
}
