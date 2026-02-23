/**
 * 坏点修正 (CosmeticCorrection)
 * 检测并修复热点、冷点、坏列、坏行
 * 模仿 PixInsight CosmeticCorrection 工具
 */

import { computeMAD } from "../utils/pixelMath";

export interface CosmeticCorrectionOptions {
  /** 热点检测阈值 (σ 倍数, 默认 5) */
  hotSigma: number;
  /** 冷点检测阈值 (σ 倍数, 默认 5) */
  coldSigma: number;
  /** 使用中值插值修复 (true) 或线性插值 (false) */
  useMedian: boolean;
  /** 检测坏列 */
  detectColumns: boolean;
  /** 检测坏行 */
  detectRows: boolean;
  /** 坏列/行判定阈值：该列/行中坏点比例超过此值则标记 (默认 0.5) */
  lineDefectRatio: number;
}

export interface CosmeticCorrectionResult {
  pixels: Float32Array;
  hotCount: number;
  coldCount: number;
  columnCount: number;
  rowCount: number;
}

const DEFAULT_OPTIONS: CosmeticCorrectionOptions = {
  hotSigma: 5,
  coldSigma: 5,
  useMedian: true,
  detectColumns: false,
  detectRows: false,
  lineDefectRatio: 0.5,
};

/**
 * 用 3×3 邻域中值替换坏点
 */
function medianInterpolate(
  pixels: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  badMask: Uint8Array,
): number {
  const values: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const idx = ny * width + nx;
      if (badMask[idx]) continue;
      values.push(pixels[idx]);
    }
  }
  if (values.length === 0) return pixels[y * width + x];
  values.sort((a, b) => a - b);
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) * 0.5 : values[mid];
}

/**
 * 用 3×3 邻域均值替换坏点
 */
function linearInterpolate(
  pixels: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
  badMask: Uint8Array,
): number {
  let sum = 0;
  let count = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const idx = ny * width + nx;
      if (badMask[idx]) continue;
      sum += pixels[idx];
      count++;
    }
  }
  return count > 0 ? sum / count : pixels[y * width + x];
}

/**
 * 坏点修正主函数
 */
export function cosmeticCorrection(
  pixels: Float32Array,
  width: number,
  height: number,
  options?: Partial<CosmeticCorrectionOptions>,
): CosmeticCorrectionResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const n = width * height;

  // 1. 全局噪声估计
  const { median, mad } = computeMAD(pixels);
  const sigma = mad > 0 ? mad / 0.6745 : 0;

  // 2. 标记坏点
  const badMask = new Uint8Array(n);
  let hotCount = 0;
  let coldCount = 0;

  if (sigma > 0) {
    const hotThreshold = median + opts.hotSigma * sigma;
    const coldThreshold = median - opts.coldSigma * sigma;

    for (let i = 0; i < n; i++) {
      const v = pixels[i];
      if (v > hotThreshold) {
        badMask[i] = 1;
        hotCount++;
      } else if (v < coldThreshold) {
        badMask[i] = 1;
        coldCount++;
      }
    }
  }

  // 3. 坏列/行检测
  let columnCount = 0;
  let rowCount = 0;

  if (opts.detectColumns && width > 2) {
    for (let x = 0; x < width; x++) {
      let colBadCount = 0;
      for (let y = 0; y < height; y++) {
        if (badMask[y * width + x]) colBadCount++;
      }
      if (colBadCount / height > opts.lineDefectRatio) {
        columnCount++;
        for (let y = 0; y < height; y++) {
          badMask[y * width + x] = 1;
        }
      }
    }
  }

  if (opts.detectRows && height > 2) {
    for (let y = 0; y < height; y++) {
      let rowBadCount = 0;
      for (let x = 0; x < width; x++) {
        if (badMask[y * width + x]) rowBadCount++;
      }
      if (rowBadCount / width > opts.lineDefectRatio) {
        rowCount++;
        for (let x = 0; x < width; x++) {
          badMask[y * width + x] = 1;
        }
      }
    }
  }

  // 4. 修复坏点
  const result = new Float32Array(pixels);
  const interpolate = opts.useMedian ? medianInterpolate : linearInterpolate;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (badMask[y * width + x]) {
        result[y * width + x] = interpolate(pixels, width, height, x, y, badMask);
      }
    }
  }

  return { pixels: result, hotCount, coldCount, columnCount, rowCount };
}
