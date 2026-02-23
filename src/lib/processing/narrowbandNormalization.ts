/**
 * 窄带归一化 (NarrowbandNormalization)
 * SHO/HOO 合成前的通道强度归一化
 * 以参考通道 (通常 Hα) 为基准归一化其他通道
 *
 * 复用: estimateLinearMatch() from composite/linearMatch.ts
 */

import { estimateLinearMatch, applyLinearMatch } from "../composite/linearMatch";

export type NormalizationMethod = "median" | "mean" | "percentile" | "linearMatch";

export interface NarrowbandNormResult {
  /** 归一化后的通道数据 */
  normalized: Float32Array[];
  /** 各通道的缩放因子 */
  factors: number[];
}

/**
 * 计算单通道的统计量
 */
function channelStat(data: Float32Array, method: NormalizationMethod): number {
  const n = data.length;
  if (n === 0) return 1;

  if (method === "mean") {
    let sum = 0;
    let count = 0;
    for (let i = 0; i < n; i++) {
      const v = data[i];
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    return count > 0 ? sum / count : 1;
  }

  // median / percentile: 排序取中值
  const sorted: number[] = [];
  const step = Math.max(1, Math.floor(n / 50000));
  for (let i = 0; i < n; i += step) {
    const v = data[i];
    if (Number.isFinite(v)) sorted.push(v);
  }
  if (sorted.length === 0) return 1;
  sorted.sort((a, b) => a - b);

  if (method === "percentile") {
    // 使用 75th percentile
    const idx = Math.floor(sorted.length * 0.75);
    return sorted[idx] || 1;
  }

  // median
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) * 0.5 : sorted[mid];
}

/**
 * 窄带通道归一化
 *
 * @param channels 通道数据数组 (如 [Ha, OIII, SII])
 * @param referenceIndex 参考通道索引 (通常 0=Ha)
 * @param method 归一化方法
 * @param manualFactors 可选手动缩放因子 (覆盖自动计算)
 */
export function normalizeNarrowband(
  channels: Float32Array[],
  referenceIndex: number = 0,
  method: NormalizationMethod = "median",
  manualFactors?: number[],
): NarrowbandNormResult {
  if (channels.length === 0) return { normalized: [], factors: [] };

  const refIdx = Math.max(0, Math.min(channels.length - 1, referenceIndex));
  const reference = channels[refIdx];
  const factors: number[] = [];
  const normalized: Float32Array[] = [];

  for (let c = 0; c < channels.length; c++) {
    if (c === refIdx) {
      factors.push(1);
      normalized.push(new Float32Array(channels[c]));
      continue;
    }

    // 使用手动因子 (如果提供)
    if (manualFactors && manualFactors[c] !== undefined && Number.isFinite(manualFactors[c])) {
      const factor = manualFactors[c];
      factors.push(factor);
      const out = new Float32Array(channels[c].length);
      for (let i = 0; i < out.length; i++) {
        out[i] = channels[c][i] * factor;
      }
      normalized.push(out);
      continue;
    }

    if (method === "linearMatch") {
      // 使用现有 linearMatch 进行全局线性拟合
      const params = estimateLinearMatch(channels[c], reference);
      factors.push(params.scale);
      normalized.push(applyLinearMatch(channels[c], params, true));
    } else {
      // 基于统计量的简单缩放
      const refStat = channelStat(reference, method);
      const chStat = channelStat(channels[c], method);
      const factor = chStat > 1e-12 ? refStat / chStat : 1;
      factors.push(factor);

      const out = new Float32Array(channels[c].length);
      for (let i = 0; i < out.length; i++) {
        out[i] = channels[c][i] * factor;
      }
      normalized.push(out);
    }
  }

  return { normalized, factors };
}
