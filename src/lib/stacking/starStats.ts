/**
 * 星点统计工具
 * 从检测结果计算 FWHM 统计信息
 */

import type { DetectedStar } from "./starDetection";

export interface StarFwhmStats {
  /** 中值 FWHM */
  medianFwhm: number;
  /** 均值 FWHM */
  meanFwhm: number;
  /** FWHM 标准差 */
  stdFwhm: number;
  /** 最小 FWHM */
  bestFwhm: number;
  /** 最大 FWHM */
  worstFwhm: number;
  /** 统计样本数 */
  count: number;
  /** 中值 SNR */
  medianSnr: number;
  /** 中值椭率 */
  medianEllipticity: number;
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  if (n % 2 === 1) return sorted[(n - 1) / 2];
  return (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
}

/**
 * 从星点检测结果计算 FWHM 统计
 * 只统计有效（FWHM > 0）的星点
 */
export function computeStarStats(stars: DetectedStar[]): StarFwhmStats | null {
  const valid = stars.filter((s) => s.fwhm > 0 && Number.isFinite(s.fwhm));
  if (valid.length === 0) return null;

  const fwhms = valid.map((s) => s.fwhm).sort((a, b) => a - b);
  const snrs = valid.map((s) => s.snr).sort((a, b) => a - b);
  const ellipticities = valid.map((s) => s.ellipticity).sort((a, b) => a - b);

  const count = fwhms.length;
  const medianFwhm = median(fwhms);
  const meanFwhm = fwhms.reduce((sum, v) => sum + v, 0) / count;
  const variance = fwhms.reduce((sum, v) => sum + (v - meanFwhm) ** 2, 0) / count;
  const stdFwhm = Math.sqrt(variance);

  return {
    medianFwhm,
    meanFwhm,
    stdFwhm,
    bestFwhm: fwhms[0],
    worstFwhm: fwhms[count - 1],
    count,
    medianSnr: median(snrs),
    medianEllipticity: median(ellipticities),
  };
}
