/**
 * 稳健统计工具
 * 统一的 median / MAD / percentile / sigma-clipped stats 实现
 * 供 stacking、composite、processing 等模块共享
 */

const MAD_TO_SIGMA = 1 / 0.6744897501960817; // 1 / Φ⁻¹(3/4)

/**
 * 检查数值是否有限
 */
export function isFiniteNum(v: number): boolean {
  return Number.isFinite(v);
}

/**
 * 安全有限值，无效时返回 fallback
 */
export function clampFinite(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

/**
 * 已排序数组的中位数（取下中位数，不插值）
 */
export function medianOfSorted(values: number[]): number {
  if (values.length === 0) return 0;
  return values[Math.floor(values.length / 2)];
}

/**
 * 数组中位数（会排序输入）
 */
export function robustMedian(values: number[]): number {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return (values[mid - 1] + values[mid]) * 0.5;
  }
  return values[mid];
}

/**
 * Float32Array 采样中位数
 */
export function robustMedianFloat32(arr: Float32Array, maxSamples: number = 50000): number {
  const n = arr.length;
  if (n === 0) return 0;

  const stride = Math.max(1, Math.floor(n / maxSamples));
  const samples: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const v = arr[i];
    if (Number.isFinite(v)) samples.push(v);
  }

  if (samples.length === 0) return 0;
  samples.sort((a, b) => a - b);
  return medianOfSorted(samples);
}

/**
 * 已排序数组的百分位数（线性插值）
 * p 范围 [0, 100]
 */
export function robustPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];

  const clamped = Math.max(0, Math.min(100, p));
  const pos = (clamped / 100) * (sorted.length - 1);
  const i0 = Math.floor(pos);
  const i1 = Math.min(sorted.length - 1, i0 + 1);
  const t = pos - i0;
  return sorted[i0] * (1 - t) + sorted[i1] * t;
}

/**
 * 已排序数组的百分位数（按比例 0-1）
 */
export function percentileByRatio(sorted: number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * ratio)));
  return sorted[idx];
}

/**
 * 计算 MAD (Median Absolute Deviation) 及对应 sigma
 * sigma = MAD / Φ⁻¹(3/4) ≈ MAD × 1.4826
 */
export function robustMAD(
  arr: Float32Array,
  maxSamples: number = 50000,
): { median: number; mad: number; sigma: number } {
  const n = arr.length;
  if (n === 0) return { median: 0, mad: 0, sigma: 0 };

  const stride = Math.max(1, Math.floor(n / maxSamples));
  const samples: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const v = arr[i];
    if (!isNaN(v) && isFinite(v)) samples.push(v);
  }

  if (samples.length === 0) return { median: 0, mad: 0, sigma: 0 };

  samples.sort((a, b) => a - b);
  const median = medianOfSorted(samples);

  const deviations = samples.map((v) => Math.abs(v - median));
  deviations.sort((a, b) => a - b);
  const mad = medianOfSorted(deviations);
  const sigma = mad > 0 ? mad * MAD_TO_SIGMA : 0;

  return { median, mad, sigma };
}

/**
 * Sigma-clipped 稳健统计
 * 迭代裁剪离群值后返回 median 和 sigma
 */
export function robustSigmaClippedStats(
  values: number[],
  sigmaClipIters: number,
): { median: number; sigma: number } {
  if (values.length === 0) return { median: 0, sigma: 0 };
  let work = values.slice();
  for (let iter = 0; iter <= sigmaClipIters; iter++) {
    work.sort((a, b) => a - b);
    const med = medianOfSorted(work);
    const absDev = work.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
    const mad = medianOfSorted(absDev);
    const sigma = mad > 0 ? mad * MAD_TO_SIGMA : 0;
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
 * Rousseeuw & Croux Sn 尺度估计器
 * 比 MAD 统计效率更高 (58% vs 37%)
 * Sn = cn × median_i { median_j |x_i - x_j| }
 */
export function robustSn(arr: Float32Array, maxSamples: number = 5000): number {
  const n = arr.length;
  if (n < 2) return 0;

  const stride = Math.max(1, Math.floor(n / maxSamples));
  const samples: number[] = [];
  for (let i = 0; i < n; i += stride) {
    const v = arr[i];
    if (Number.isFinite(v)) samples.push(v);
  }

  const m = samples.length;
  if (m < 2) return 0;

  samples.sort((a, b) => a - b);

  const innerMedians = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const diffs: number[] = [];
    for (let j = 0; j < m; j++) {
      diffs.push(Math.abs(samples[i] - samples[j]));
    }
    diffs.sort((a, b) => a - b);
    innerMedians[i] = diffs[Math.floor(diffs.length / 2)];
  }

  const sorted = Array.from(innerMedians).sort((a, b) => a - b);
  const rawSn = sorted[Math.floor(sorted.length / 2)];

  // Finite-sample correction factor cn ≈ 1.1926 for large n
  const cn =
    m <= 9 ? ([0, 0, 0.743, 1.851, 0.954, 1.351, 0.993, 1.198, 1.005, 1.131][m] ?? 1.1926) : 1.1926;

  return rawSn * cn;
}

/**
 * Biweight midvariance — 对尾部更稳健的方差估计
 */
export function robustBiweightMidvariance(arr: Float32Array, maxSamples: number = 50000): number {
  const { median, mad } = robustMAD(arr, maxSamples);
  if (mad <= 0) return 0;

  const stride = Math.max(1, Math.floor(arr.length / maxSamples));
  const c = 9; // tuning constant

  let numerator = 0;
  let denominator = 0;
  let n = 0;

  for (let i = 0; i < arr.length; i += stride) {
    const v = arr[i];
    if (!Number.isFinite(v)) continue;
    const u = (v - median) / (c * mad * MAD_TO_SIGMA);
    if (Math.abs(u) >= 1) continue;
    const u2 = u * u;
    const diff = v - median;
    numerator += diff * diff * (1 - u2) ** 4;
    denominator += (1 - u2) * (1 - 5 * u2);
    n++;
  }

  if (n < 2 || Math.abs(denominator) < 1e-12) return 0;
  return (n * numerator) / (denominator * denominator);
}
