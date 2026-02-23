/**
 * 背景中和 (BackgroundNeutralization)
 * 中和背景颜色偏色，使 R≈G≈B 背景变为中性灰色
 * 模仿 PixInsight BackgroundNeutralization 工具
 *
 * 与 ABE/DBE 的区别:
 * - ABE/DBE → 减去空间梯度（校正不均匀照明）
 * - BackgroundNeutralization → 中和颜色偏色（使背景中性化）
 */

import { clampByte } from "./color";

export interface BackgroundNeutralizeOptions {
  /** 仅采样低于此百分位的像素作为背景 (默认 0.2) */
  upperLimit: number;
  /** 排除最暗像素的百分位 (默认 0.01) */
  shadowsClip: number;
}

/**
 * 在 RGBA 数据上执行背景中和
 * 1. 采样背景像素 (排除亮目标和极暗像素)
 * 2. 计算 R/G/B 通道背景中值
 * 3. 计算目标中性值 = (medR + medG + medB) / 3
 * 4. 逐像素偏移使背景中性化
 */
export function backgroundNeutralizeRGBA(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  options?: Partial<BackgroundNeutralizeOptions>,
): Uint8ClampedArray {
  const upperLimit = Math.max(0.05, Math.min(0.95, options?.upperLimit ?? 0.2));
  const shadowsClip = Math.max(0, Math.min(0.5, options?.shadowsClip ?? 0.01));

  const pixelCount = Math.floor(rgbaData.length / 4);

  // 计算每个像素的亮度
  const luminances: Array<{ lum: number; idx: number }> = [];
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    const r = rgbaData[off];
    const g = rgbaData[off + 1];
    const b = rgbaData[off + 2];
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    luminances.push({ lum, idx: i });
  }

  // 按亮度排序
  luminances.sort((a, b) => a.lum - b.lum);

  // 选择背景像素：排除最暗 shadowsClip% 和最亮 (1-upperLimit)%
  const startIdx = Math.floor(luminances.length * shadowsClip);
  const endIdx = Math.floor(luminances.length * upperLimit);
  if (endIdx <= startIdx) return new Uint8ClampedArray(rgbaData);

  // 收集背景像素的 R/G/B 值
  const bgR: number[] = [];
  const bgG: number[] = [];
  const bgB: number[] = [];

  for (let i = startIdx; i < endIdx; i++) {
    const off = luminances[i].idx * 4;
    bgR.push(rgbaData[off]);
    bgG.push(rgbaData[off + 1]);
    bgB.push(rgbaData[off + 2]);
  }

  // 计算各通道中值
  bgR.sort((a, b) => a - b);
  bgG.sort((a, b) => a - b);
  bgB.sort((a, b) => a - b);

  const mid = Math.floor(bgR.length / 2);
  const medR = bgR.length % 2 === 0 ? (bgR[mid - 1] + bgR[mid]) * 0.5 : bgR[mid];
  const medG = bgG.length % 2 === 0 ? (bgG[mid - 1] + bgG[mid]) * 0.5 : bgG[mid];
  const medB = bgB.length % 2 === 0 ? (bgB[mid - 1] + bgB[mid]) * 0.5 : bgB[mid];

  // 目标中性值
  const target = (medR + medG + medB) / 3;

  // 计算偏移量
  const offsetR = target - medR;
  const offsetG = target - medG;
  const offsetB = target - medB;

  // 应用偏移
  const result = new Uint8ClampedArray(rgbaData);
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4;
    result[off] = clampByte(rgbaData[off] + offsetR);
    result[off + 1] = clampByte(rgbaData[off + 1] + offsetG);
    result[off + 2] = clampByte(rgbaData[off + 2] + offsetB);
    // alpha 不变
  }

  return result;
}
