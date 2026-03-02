/**
 * 统一图像积分（叠加）引擎
 * 使用策略模式：每种拒绝/合并算法仅需实现 combine() 方法
 * 统一处理 NaN 跳过、Range Rejection、拒绝计数、拒绝图生成
 */

// ─── 类型定义 ───

export interface RejectionContext {
  /** 低端拒绝 sigma */
  sigmaLow: number;
  /** 高端拒绝 sigma */
  sigmaHigh: number;
  /** 迭代次数 */
  iterations: number;
  /** 算法特有参数 */
  params: Record<string, number>;
}

export interface CombineResult {
  /** 合并后的像素值 */
  value: number;
  /** 低端被拒绝的像素数 */
  rejectedLow: number;
  /** 高端被拒绝的像素数 */
  rejectedHigh: number;
}

export interface PixelRejectionStrategy {
  /** 策略名称 */
  readonly name: string;
  /** 对单个像素位置的 N 帧有效值进行拒绝+合并
   *  frameIndices: 每个有效值对应的原始帧索引 (用于加权等需要帧对应关系的策略)
   */
  combine(
    values: Float32Array,
    count: number,
    ctx: RejectionContext,
    frameIndices?: Uint16Array,
  ): CombineResult;
}

export interface IntegrationOptions {
  /** 拒绝+合并策略 */
  strategy: PixelRejectionStrategy;
  /** Range rejection 低端阈值 (低于此值的像素视为无效) */
  rangeLow?: number;
  /** Range rejection 高端阈值 (高于此值的像素视为无效) */
  rangeHigh?: number;
  /** 是否生成拒绝图 */
  generateRejectionMap?: boolean;
  /** 拒绝上下文 (sigma, iterations 等) */
  context?: Partial<RejectionContext>;
}

export interface IntegrationResult {
  /** 叠加后的像素数据 */
  pixels: Float32Array;
  /** 拒绝图 (每个像素位置的 low/high 拒绝帧数) */
  rejectionMap?: { low: Uint16Array; high: Uint16Array };
  /** 统计信息 */
  stats: {
    totalRejectedLow: number;
    totalRejectedHigh: number;
    pixelCount: number;
  };
}

// ─── 统一积分入口 ───

export function integrateFrames(
  frames: Float32Array[],
  options: IntegrationOptions,
): IntegrationResult {
  if (frames.length === 0) {
    return {
      pixels: new Float32Array(0),
      stats: { totalRejectedLow: 0, totalRejectedHigh: 0, pixelCount: 0 },
    };
  }

  const n = frames[0].length;
  const fCount = frames.length;
  const result = new Float32Array(n);
  const vals = new Float32Array(fCount);

  const rangeLow = options.rangeLow ?? -Infinity;
  const rangeHigh = options.rangeHigh ?? Infinity;
  const genMap = options.generateRejectionMap === true;

  let rejLowMap: Uint16Array | undefined;
  let rejHighMap: Uint16Array | undefined;
  if (genMap) {
    rejLowMap = new Uint16Array(n);
    rejHighMap = new Uint16Array(n);
  }

  let totalRejectedLow = 0;
  let totalRejectedHigh = 0;

  const ctx: RejectionContext = {
    sigmaLow: options.context?.sigmaLow ?? 2.5,
    sigmaHigh: options.context?.sigmaHigh ?? 2.5,
    iterations: options.context?.iterations ?? 3,
    params: options.context?.params ?? {},
  };

  const strategy = options.strategy;
  const indices = new Uint16Array(fCount);

  for (let i = 0; i < n; i++) {
    let count = 0;
    for (let f = 0; f < fCount; f++) {
      const value = frames[f][i];
      if (!Number.isFinite(value)) continue;
      if (value < rangeLow || value > rangeHigh) continue;
      vals[count] = value;
      indices[count] = f;
      count++;
    }

    if (count === 0) {
      result[i] = Number.NaN;
      continue;
    }

    const cr = strategy.combine(vals, count, ctx, indices);
    result[i] = cr.value;
    totalRejectedLow += cr.rejectedLow;
    totalRejectedHigh += cr.rejectedHigh;

    if (genMap && rejLowMap && rejHighMap) {
      rejLowMap[i] = cr.rejectedLow;
      rejHighMap[i] = cr.rejectedHigh;
    }
  }

  return {
    pixels: result,
    rejectionMap: genMap ? { low: rejLowMap!, high: rejHighMap! } : undefined,
    stats: { totalRejectedLow, totalRejectedHigh, pixelCount: n },
  };
}

// ─── 内置策略 ───

/** 均值 */
export function averageStrategy(): PixelRejectionStrategy {
  return {
    name: "average",
    combine(values, count) {
      let sum = 0;
      for (let i = 0; i < count; i++) sum += values[i];
      return { value: sum / count, rejectedLow: 0, rejectedHigh: 0 };
    },
  };
}

/** 中值 */
export function medianStrategy(): PixelRejectionStrategy {
  return {
    name: "median",
    combine(values, count) {
      // 部分排序仅取中间值
      const work = values.subarray(0, count);
      work.sort();
      return { value: work[Math.floor(count / 2)], rejectedLow: 0, rejectedHigh: 0 };
    },
  };
}

/** Sigma Clipping (支持非对称 sigmaLow/sigmaHigh) */
export function sigmaClipStrategy(sigmaOrLow?: number, sigmaHigh?: number): PixelRejectionStrategy {
  return {
    name: "sigma",
    combine(values, count, ctx) {
      const sLow = sigmaOrLow ?? ctx.sigmaLow;
      const sHigh = sigmaHigh ?? ctx.sigmaHigh;
      const iterations = ctx.iterations;
      const mask = new Uint8Array(count);
      mask.fill(1, 0, count);
      let active = count;
      let rejLow = 0;
      let rejHigh = 0;

      for (let iter = 0; iter < iterations; iter++) {
        let sum = 0;
        for (let f = 0; f < count; f++) {
          if (mask[f]) sum += values[f];
        }
        const mean = sum / active;

        let sumSq = 0;
        for (let f = 0; f < count; f++) {
          if (mask[f]) {
            const d = values[f] - mean;
            sumSq += d * d;
          }
        }
        const std = Math.sqrt(sumSq / active);
        if (std === 0) break;

        let newActive = 0;
        let newRejLow = 0;
        let newRejHigh = 0;
        for (let f = 0; f < count; f++) {
          if (!mask[f]) continue;
          const diff = values[f] - mean;
          if (diff > sHigh * std) {
            mask[f] = 0;
            newRejHigh++;
          } else if (-diff > sLow * std) {
            mask[f] = 0;
            newRejLow++;
          } else {
            newActive++;
          }
        }

        if (newActive === 0) {
          // Restore all — don't reject everything
          mask.fill(1, 0, count);
          active = count;
          rejLow = 0;
          rejHigh = 0;
          break;
        }

        rejLow += newRejLow;
        rejHigh += newRejHigh;

        if (newActive === active) break;
        active = newActive;
      }

      let sum = 0;
      for (let f = 0; f < count; f++) {
        if (mask[f]) sum += values[f];
      }
      return {
        value: active > 0 ? sum / active : Number.NaN,
        rejectedLow: rejLow,
        rejectedHigh: rejHigh,
      };
    },
  };
}

/** Winsorized Sigma Clipping (支持非对称) */
export function winsorizedSigmaClipStrategy(
  sigmaOrLow?: number,
  sigmaHigh?: number,
): PixelRejectionStrategy {
  return {
    name: "winsorized",
    combine(values, count, ctx) {
      const sLow = sigmaOrLow ?? ctx.sigmaLow;
      const sHigh = sigmaHigh ?? ctx.sigmaHigh;
      const iterations = ctx.iterations;
      // Work on a copy for in-place winsorization
      const work = new Float32Array(count);
      for (let i = 0; i < count; i++) work[i] = values[i];

      let rejLow = 0;
      let rejHigh = 0;

      for (let iter = 0; iter < iterations; iter++) {
        let sum = 0;
        for (let f = 0; f < count; f++) sum += work[f];
        const mean = sum / count;

        let sumSq = 0;
        for (let f = 0; f < count; f++) {
          const d = work[f] - mean;
          sumSq += d * d;
        }
        const std = Math.sqrt(sumSq / count);
        if (std === 0) break;

        const lo = mean - sLow * std;
        const hi = mean + sHigh * std;
        let changed = false;
        for (let f = 0; f < count; f++) {
          if (work[f] < lo) {
            work[f] = lo;
            changed = true;
            rejLow++;
          } else if (work[f] > hi) {
            work[f] = hi;
            changed = true;
            rejHigh++;
          }
        }
        if (!changed) break;
      }

      let sum = 0;
      for (let f = 0; f < count; f++) sum += work[f];
      return { value: sum / count, rejectedLow: rejLow, rejectedHigh: rejHigh };
    },
  };
}

/** 最小值 */
export function minStrategy(): PixelRejectionStrategy {
  return {
    name: "min",
    combine(values, count) {
      let min = values[0];
      for (let i = 1; i < count; i++) {
        if (values[i] < min) min = values[i];
      }
      return { value: min, rejectedLow: 0, rejectedHigh: 0 };
    },
  };
}

/** 最大值 */
export function maxStrategy(): PixelRejectionStrategy {
  return {
    name: "max",
    combine(values, count) {
      let max = values[0];
      for (let i = 1; i < count; i++) {
        if (values[i] > max) max = values[i];
      }
      return { value: max, rejectedLow: 0, rejectedHigh: 0 };
    },
  };
}

/** 加权均值 */
export function weightedAverageStrategy(weights: number[]): PixelRejectionStrategy {
  return {
    name: "weighted",
    combine(values, count, _ctx, frameIndices) {
      let weightedSum = 0;
      let weightSum = 0;
      for (let i = 0; i < count; i++) {
        const fi = frameIndices ? frameIndices[i] : i;
        const w = fi < weights.length ? weights[fi] : 0;
        if (!Number.isFinite(w) || w <= 0) continue;
        weightedSum += values[i] * w;
        weightSum += w;
      }
      if (weightSum <= 0) {
        let sum = 0;
        for (let i = 0; i < count; i++) sum += values[i];
        return { value: sum / count, rejectedLow: 0, rejectedHigh: 0 };
      }
      return { value: weightedSum / weightSum, rejectedLow: 0, rejectedHigh: 0 };
    },
  };
}

// ─── 新增拒绝算法 (Phase C3) ───

/** Percentile Clipping */
export function percentileClipStrategy(
  percentileLow: number = 10,
  percentileHigh: number = 90,
): PixelRejectionStrategy {
  return {
    name: "percentile",
    combine(values, count) {
      const work = values.subarray(0, count);
      work.sort();
      const lo = Math.max(0, Math.floor((percentileLow / 100) * count));
      const hi = Math.min(count, Math.ceil((percentileHigh / 100) * count));
      const start = Math.min(lo, hi - 1);
      const end = Math.max(lo + 1, hi);

      let sum = 0;
      let n = 0;
      for (let i = start; i < end && i < count; i++) {
        sum += work[i];
        n++;
      }
      return {
        value: n > 0 ? sum / n : Number.NaN,
        rejectedLow: start,
        rejectedHigh: count - end,
      };
    },
  };
}

/** Linear Fit Clipping */
export function linearFitClipStrategy(): PixelRejectionStrategy {
  return {
    name: "linearFit",
    combine(values, count, ctx) {
      if (count < 3) {
        let sum = 0;
        for (let i = 0; i < count; i++) sum += values[i];
        return { value: sum / count, rejectedLow: 0, rejectedHigh: 0 };
      }

      const sLow = ctx.sigmaLow;
      const sHigh = ctx.sigmaHigh;
      const iterations = ctx.iterations;

      // Sort to get a rank-ordered sequence
      const work = new Float32Array(count);
      for (let i = 0; i < count; i++) work[i] = values[i];
      work.sort();

      const mask = new Uint8Array(count);
      mask.fill(1, 0, count);
      let active = count;
      let rejLow = 0;
      let rejHigh = 0;

      for (let iter = 0; iter < iterations; iter++) {
        // Linear regression: y = a + b*x where x = rank index
        let sx = 0,
          sy = 0,
          sxx = 0,
          sxy = 0,
          sw = 0;
        for (let i = 0; i < count; i++) {
          if (!mask[i]) continue;
          sx += i;
          sy += work[i];
          sxx += i * i;
          sxy += i * work[i];
          sw++;
        }
        if (sw < 3) break;

        const denom = sw * sxx - sx * sx;
        if (Math.abs(denom) < 1e-12) break;

        const b = (sw * sxy - sx * sy) / denom;
        const a = (sy - b * sx) / sw;

        // Compute residual sigma
        let sumResidSq = 0;
        for (let i = 0; i < count; i++) {
          if (!mask[i]) continue;
          const resid = work[i] - (a + b * i);
          sumResidSq += resid * resid;
        }
        const sigma = Math.sqrt(sumResidSq / sw);
        if (sigma === 0) break;

        let newActive = 0;
        let newRejLow = 0;
        let newRejHigh = 0;
        for (let i = 0; i < count; i++) {
          if (!mask[i]) continue;
          const resid = work[i] - (a + b * i);
          if (resid > sHigh * sigma) {
            mask[i] = 0;
            newRejHigh++;
          } else if (-resid > sLow * sigma) {
            mask[i] = 0;
            newRejLow++;
          } else {
            newActive++;
          }
        }

        if (newActive === 0) {
          mask.fill(1, 0, count);
          active = count;
          rejLow = 0;
          rejHigh = 0;
          break;
        }

        rejLow += newRejLow;
        rejHigh += newRejHigh;
        if (newActive === active) break;
        active = newActive;
      }

      let sum = 0;
      for (let i = 0; i < count; i++) {
        if (mask[i]) sum += work[i];
      }
      return {
        value: active > 0 ? sum / active : Number.NaN,
        rejectedLow: rejLow,
        rejectedHigh: rejHigh,
      };
    },
  };
}

/** Generalized Extreme Studentized Deviate (ESD) rejection */
export function esdStrategy(): PixelRejectionStrategy {
  return {
    name: "esd",
    combine(values, count, ctx) {
      if (count < 3) {
        let sum = 0;
        for (let i = 0; i < count; i++) sum += values[i];
        return { value: sum / count, rejectedLow: 0, rejectedHigh: 0 };
      }

      const significance = ctx.params.significance ?? 0.05;
      const maxOutliersFrac = ctx.params.maxOutliers ?? 0.3;
      const relaxation = ctx.params.relaxation ?? 1.5;
      const maxOutliers = Math.max(1, Math.floor(count * maxOutliersFrac));

      const work = new Float32Array(count);
      for (let i = 0; i < count; i++) work[i] = values[i];

      const rejected = new Uint8Array(count);
      let rejLow = 0;
      let rejHigh = 0;
      let _bestK = 0;

      // Precompute t-distribution critical values (approximation)
      for (let k = 1; k <= maxOutliers; k++) {
        const nk = count - k + 1;
        if (nk < 3) break;

        // Trimmed mean and std (exclude already rejected)
        const trimLow = Math.floor(k * 0.2);
        const trimHigh = Math.floor(k * 0.3);
        const sorted = work.slice(0, count).sort();
        const trimStart = trimLow;
        const trimEnd = count - trimHigh;

        if (trimEnd <= trimStart + 1) break;

        let mean = 0;
        let trimCount = 0;
        for (let i = trimStart; i < trimEnd; i++) {
          if (rejected[i]) continue;
          mean += sorted[i];
          trimCount++;
        }
        if (trimCount < 2) break;
        mean /= trimCount;

        let sumSq = 0;
        for (let i = trimStart; i < trimEnd; i++) {
          if (rejected[i]) continue;
          const d = sorted[i] - mean;
          sumSq += d * d;
        }
        const std = Math.sqrt(sumSq / trimCount);
        if (std <= 0) break;

        // Find max test statistic R_k
        let maxR = 0;
        let maxIdx = -1;
        for (let i = 0; i < count; i++) {
          if (rejected[i]) continue;
          const diff = work[i] - mean;
          // Apply relaxation to low-end (diff < 0)
          const effectiveStd = diff < 0 ? std * relaxation : std;
          const R = Math.abs(diff) / effectiveStd;
          if (R > maxR) {
            maxR = R;
            maxIdx = i;
          }
        }

        if (maxIdx < 0) break;

        // Critical value lambda_k (t-distribution approximation)
        const p = 1 - significance / (2 * nk);
        // Approximate t-quantile using rational approximation
        const tp = approximateTQuantile(p, nk - 2);
        const lambda = ((nk - 1) * tp) / Math.sqrt((nk - 2 + tp * tp) * nk);

        if (maxR > lambda) {
          rejected[maxIdx] = 1;
          if (work[maxIdx] < mean) {
            rejLow++;
          } else {
            rejHigh++;
          }
          _bestK = k;
        } else {
          break;
        }
      }

      // Average non-rejected values
      let sum = 0;
      let active = 0;
      for (let i = 0; i < count; i++) {
        if (!rejected[i]) {
          sum += work[i];
          active++;
        }
      }

      return {
        value: active > 0 ? sum / active : Number.NaN,
        rejectedLow: rejLow,
        rejectedHigh: rejHigh,
      };
    },
  };
}

/** Averaged Sigma Clipping (Poisson noise model) */
export function averagedSigmaClipStrategy(
  sigmaOrLow?: number,
  sigmaHigh?: number,
): PixelRejectionStrategy {
  return {
    name: "averagedSigma",
    combine(values, count, ctx) {
      const sLow = sigmaOrLow ?? ctx.sigmaLow;
      const sHigh = sigmaHigh ?? ctx.sigmaHigh;
      const iterations = ctx.iterations;

      const mask = new Uint8Array(count);
      mask.fill(1, 0, count);
      let active = count;
      let rejLow = 0;
      let rejHigh = 0;

      for (let iter = 0; iter < iterations; iter++) {
        let sum = 0;
        for (let f = 0; f < count; f++) {
          if (mask[f]) sum += values[f];
        }
        const mean = sum / active;

        // Poisson noise estimate: sigma = sqrt(mean)
        const std = mean > 0 ? Math.sqrt(mean) : 0;
        if (std === 0) break;

        let newActive = 0;
        let newRejLow = 0;
        let newRejHigh = 0;
        for (let f = 0; f < count; f++) {
          if (!mask[f]) continue;
          const diff = values[f] - mean;
          if (diff > sHigh * std) {
            mask[f] = 0;
            newRejHigh++;
          } else if (-diff > sLow * std) {
            mask[f] = 0;
            newRejLow++;
          } else {
            newActive++;
          }
        }

        if (newActive === 0) {
          mask.fill(1, 0, count);
          active = count;
          rejLow = 0;
          rejHigh = 0;
          break;
        }

        rejLow += newRejLow;
        rejHigh += newRejHigh;
        if (newActive === active) break;
        active = newActive;
      }

      let sum = 0;
      for (let f = 0; f < count; f++) {
        if (mask[f]) sum += values[f];
      }
      return {
        value: active > 0 ? sum / active : Number.NaN,
        rejectedLow: rejLow,
        rejectedHigh: rejHigh,
      };
    },
  };
}

// ─── 辅助函数 ───

/**
 * 近似 t 分布分位数 (Abramowitz & Stegun rational approximation)
 */
function approximateTQuantile(p: number, df: number): number {
  if (df <= 0) return 0;
  // Normal approximation for large df
  const a = 1 / (df - 0.5);
  const _b = 48 / (a * a);

  // Inverse normal CDF approximation (Beasley-Springer-Moro)
  const x = p;
  let t: number;
  if (x <= 0.5) {
    const y = Math.sqrt(-2 * Math.log(x));
    t =
      -(2.515517 + 0.802853 * y + 0.010328 * y * y) /
        (1 + 1.432788 * y + 0.189269 * y * y + 0.001308 * y * y * y) +
      y;
  } else {
    const y = Math.sqrt(-2 * Math.log(1 - x));
    t =
      (2.515517 + 0.802853 * y + 0.010328 * y * y) /
        (1 + 1.432788 * y + 0.189269 * y * y + 0.001308 * y * y * y) -
      y;
  }

  // Cornish-Fisher expansion for t-distribution correction
  const g1 = (t * t + 1) / (4 * df);
  const g2 = (5 * t * t * t * t + 16 * t * t + 3) / (96 * df * df);
  return t + g1 * t + g2 * t;
}
