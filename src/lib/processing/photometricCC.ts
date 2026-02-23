/**
 * PhotometricColorCalibration (简化版)
 * 基于星点统计的 G2V 太阳型光谱白参考
 *
 * 与现有 ColorCalibration 的区别:
 * - 现有: 取亮像素百分位做白参考 → 不考虑光谱类型
 * - PCC: 基于星点亮度分布，假设中等亮度星群的平均色指数趋近 G2V
 *
 * 复用: detectStars() from starDetection.ts
 */

import { detectStars } from "../stacking/starDetection";
import { clampByte } from "./color";

export interface PhotometricCCOptions {
  /** 最少星点数 (默认 20) */
  minStars: number;
  /** 排除暗星的百分位 (默认 0.25) */
  percentileLow: number;
  /** 排除亮星的百分位 (默认 0.75) */
  percentileHigh: number;
  /** 星点采样半径倍数 (默认 2) */
  starSampleRadius: number;
}

/**
 * 从 RGBA 图像中提取星点位置处的 RGB 均值
 */
function sampleStarColors(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  stars: Array<{ cx: number; cy: number; fwhm: number }>,
  sampleRadius: number,
): Array<{ r: number; g: number; b: number; lum: number }> {
  const colors: Array<{ r: number; g: number; b: number; lum: number }> = [];

  for (const star of stars) {
    const cx = Math.round(star.cx);
    const cy = Math.round(star.cy);
    const radius = Math.max(1, Math.round(star.fwhm * sampleRadius * 0.5));

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const px = cx + dx;
        const py = cy + dy;
        if (px < 0 || px >= width || py < 0 || py >= height) continue;
        const off = (py * width + px) * 4;
        rSum += rgbaData[off];
        gSum += rgbaData[off + 1];
        bSum += rgbaData[off + 2];
        count++;
      }
    }

    if (count > 0) {
      const r = rSum / count;
      const g = gSum / count;
      const b = bSum / count;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      colors.push({ r, g, b, lum });
    }
  }

  return colors;
}

/**
 * PhotometricColorCalibration 主函数
 *
 * 简化实现:
 * 1. 检测星点 (复用 detectStars)
 * 2. 提取每颗星的 RGB 像素平均值
 * 3. 按亮度排序取中间范围 (排除饱和星和暗弱星)
 * 4. 假设中等亮度星群趋近 G2V 白色 → 计算 RGB 增益使样本 R≈G≈B
 */
export function photometricColorCalibrate(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  monoPixels: Float32Array,
  options?: Partial<PhotometricCCOptions>,
): Uint8ClampedArray {
  const minStars = Math.max(5, options?.minStars ?? 20);
  const pLow = Math.max(0, Math.min(0.5, options?.percentileLow ?? 0.25));
  const pHigh = Math.max(0.5, Math.min(1, options?.percentileHigh ?? 0.75));
  const sampleRadius = Math.max(1, Math.min(5, options?.starSampleRadius ?? 2));

  // 1. 检测星点
  const stars = detectStars(monoPixels, width, height, {
    maxStars: 500,
    sigmaThreshold: 4,
  });

  if (stars.length < minStars) {
    // 星点不足，退回原始数据
    return new Uint8ClampedArray(rgbaData);
  }

  // 2. 提取星点颜色
  const starColors = sampleStarColors(rgbaData, width, height, stars, sampleRadius);
  if (starColors.length < minStars) {
    return new Uint8ClampedArray(rgbaData);
  }

  // 3. 按亮度排序，取中间范围
  starColors.sort((a, b) => a.lum - b.lum);
  const startIdx = Math.floor(starColors.length * pLow);
  const endIdx = Math.floor(starColors.length * pHigh);
  if (endIdx <= startIdx) return new Uint8ClampedArray(rgbaData);

  const selected = starColors.slice(startIdx, endIdx);

  // 4. 计算 RGB 均值
  let avgR = 0;
  let avgG = 0;
  let avgB = 0;
  for (const c of selected) {
    avgR += c.r;
    avgG += c.g;
    avgB += c.b;
  }
  avgR /= selected.length;
  avgG /= selected.length;
  avgB /= selected.length;

  // 5. 计算增益使 R≈G≈B (目标为三通道均值)
  const target = (avgR + avgG + avgB) / 3;
  const rGain = avgR > 1 ? target / avgR : 1;
  const gGain = avgG > 1 ? target / avgG : 1;
  const bGain = avgB > 1 ? target / avgB : 1;

  // 6. 应用增益
  const pixelCount = Math.floor(rgbaData.length / 4);
  const result = new Uint8ClampedArray(rgbaData);
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    result[off] = clampByte(rgbaData[off] * rGain);
    result[off + 1] = clampByte(rgbaData[off + 1] * gGain);
    result[off + 2] = clampByte(rgbaData[off + 2] * bGain);
  }

  return result;
}
