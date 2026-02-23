/**
 * 分层小波锐化 (WaveletSharpen)
 * 使用 à trous 小波分解，每层独立控制锐化量
 * 可选星点掩膜保护
 *
 * 与现有 sharpen() (单尺度 Unsharp Mask) 的区别:
 * - 多尺度: 精细结构和粗糙结构分别控制
 * - 星点保护: 避免锐化星点导致伪影
 */

import { atrousSmooth, generateStarMask } from "../utils/imageOperations";

export interface WaveletSharpenLayer {
  /** 锐化量 0-3 (0=不变, >1=增强, 默认 1) */
  amount: number;
}

export interface WaveletSharpenOptions {
  /** 使用星点掩膜保护 (默认 false) */
  protectStars: boolean;
  /** 星点掩膜尺度 (默认 1.5) */
  starScale: number;
}

/**
 * 分层小波锐化主函数
 */
export function waveletSharpen(
  pixels: Float32Array,
  width: number,
  height: number,
  layers: WaveletSharpenLayer[] = [{ amount: 1.5 }, { amount: 1.2 }, { amount: 1 }],
  options?: Partial<WaveletSharpenOptions>,
): Float32Array {
  const protectStars = options?.protectStars ?? false;
  const starScale = Math.max(0.5, Math.min(4, options?.starScale ?? 1.5));
  const numLayers = Math.max(1, Math.min(8, layers.length));
  const n = width * height;

  // 小波分解
  const details: Float32Array[] = [];
  let current = new Float32Array(pixels) as Float32Array;

  for (let s = 0; s < numLayers; s++) {
    const smoothed = atrousSmooth(current, width, height, s);
    const detail = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      detail[i] = current[i] - smoothed[i];
    }
    details.push(detail);
    current = smoothed;
  }

  // 星点掩膜 (可选)
  let starMask: Float32Array | null = null;
  if (protectStars) {
    starMask = generateStarMask(pixels, width, height, starScale);
  }

  // 重建: 残差 + Σ(detail_i * amount_i)
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = current[i];
  }

  for (let s = 0; s < numLayers; s++) {
    const amount = Math.max(0, Math.min(3, layers[s]?.amount ?? 1));
    const detail = details[s];
    for (let i = 0; i < n; i++) {
      let sharpened = detail[i] * amount;
      // 星点保护: 在星点区域减少锐化
      if (starMask) {
        const protection = 1 - starMask[i];
        sharpened = detail[i] * (1 + (amount - 1) * protection);
      }
      result[i] += sharpened;
    }
  }

  return result;
}
