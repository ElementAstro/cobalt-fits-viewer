/**
 * MultiscaleLinearTransform (MLT)
 * PixInsight 风格线性小波降噪
 *
 * 与现有模块的区别:
 * - multiscaleDenoise (imageOperations.ts): à trous 分解 + 全局硬阈值，无逐层控制
 * - MMT (multiscaleMedianTransform.ts): 中值滤波分解，逐层控制，非线性核
 * - MLT (本模块): à trous **线性**分解 + **逐层独立控制** + **线性掩膜自适应**
 *
 * 关键特性: 线性掩膜 (linear noise mask) — 根据局部信噪比自适应调节降噪强度
 * 亮区 (高 SNR) 降噪弱，暗区 (低 SNR) 降噪强
 */

import { computeMAD } from "../utils/pixelMath";
import { atrousSmooth } from "../utils/imageOperations";

export interface MLTLayerConfig {
  /** 噪声阈值 (σ 倍数, 默认 3) */
  noiseThreshold: number;
  /** 降噪量 0-1 (默认 0.5) */
  noiseReduction: number;
  /** 锐化偏置 -1 to 1 (>0 锐化, <0 柔化, 默认 0) */
  bias: number;
}

export interface MLTOptions {
  /** 启用线性掩膜自适应降噪 (默认 true) */
  useLinearMask: boolean;
  /** 线性掩膜放大系数 (默认 200，控制掩膜灵敏度) */
  linearMaskAmplification: number;
  /** 是否包含残差层 (默认 true) */
  residualEnabled: boolean;
}

const DEFAULT_LAYER: MLTLayerConfig = {
  noiseThreshold: 3,
  noiseReduction: 0.5,
  bias: 0,
};

/**
 * 构建线性掩膜
 * mask[i] = clamp(amplification * normalized[i], 0, 1)
 * 亮区掩膜值高 → 降噪弱; 暗区掩膜值低 → 降噪强
 */
function buildLinearMask(
  pixels: Float32Array,
  width: number,
  height: number,
  amplification: number,
): Float32Array {
  const n = width * height;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range <= 0) return new Float32Array(n);

  const mask = new Float32Array(n);
  const amp = Math.max(1, Math.min(10000, amplification));
  for (let i = 0; i < n; i++) {
    const normalized = (pixels[i] - min) / range;
    mask[i] = Math.max(0, Math.min(1, amp * normalized));
  }
  return mask;
}

/**
 * 处理单层细节系数
 * 当 linearMask 存在时，降噪量按掩膜自适应:
 *   effectiveReduction = reduction * (1 - mask[i])
 *   亮区 mask≈1 → effectiveReduction≈0 (不降噪)
 *   暗区 mask≈0 → effectiveReduction=reduction (完全降噪)
 */
function processLayer(
  detail: Float32Array,
  config: MLTLayerConfig,
  noiseSigma: number,
  linearMask: Float32Array | null,
): Float32Array {
  const n = detail.length;
  const result = new Float32Array(n);
  const threshold = Math.max(0, config.noiseThreshold) * noiseSigma;
  const reduction = Math.max(0, Math.min(1, config.noiseReduction));
  const bias = Math.max(-1, Math.min(1, config.bias));

  for (let i = 0; i < n; i++) {
    const d = detail[i];
    const absD = Math.abs(d);

    // 自适应降噪量: 有掩膜时根据局部亮度调节
    const effectiveReduction = linearMask ? reduction * (1 - linearMask[i]) : reduction;

    if (absD <= threshold) {
      // 低于噪声阈值: 按降噪量衰减 (软阈值)
      result[i] = d * (1 - effectiveReduction);
    } else {
      // 高于噪声阈值: 保留信号，应用锐化偏置
      result[i] = d * (1 + bias);
    }
  }

  return result;
}

/**
 * MultiscaleLinearTransform 主函数
 *
 * 分解步骤:
 * 1. smooth₀ = atrousSmooth(input, scale=0), detail₀ = input - smooth₀
 * 2. smooth₁ = atrousSmooth(smooth₀, scale=1), detail₁ = smooth₀ - smooth₁
 * 3. ... 每层 scale 递增 (dyadic spacing: 1, 2, 4, 8, ...)
 * 4. 构建线性掩膜 (可选)
 * 5. 逐层处理细节系数 (自适应阈值)
 * 6. 重建: output = residual + Σ(processedDetail_i)
 */
export function multiscaleLinearTransform(
  pixels: Float32Array,
  width: number,
  height: number,
  layerConfigs: MLTLayerConfig[] = [DEFAULT_LAYER, DEFAULT_LAYER, DEFAULT_LAYER, DEFAULT_LAYER],
  options?: Partial<MLTOptions>,
): Float32Array {
  const useLinearMask = options?.useLinearMask ?? true;
  const amplification = options?.linearMaskAmplification ?? 200;
  const residualEnabled = options?.residualEnabled ?? true;
  const numLayers = Math.max(1, Math.min(8, layerConfigs.length));
  const n = width * height;

  // 噪声估计
  const { mad } = computeMAD(pixels);
  const noiseSigma = mad > 0 ? mad / 0.6745 : 0;

  // 构建线性掩膜
  const linearMask = useLinearMask ? buildLinearMask(pixels, width, height, amplification) : null;

  // à trous 小波分解 (B3 样条核)
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
  // current 现在是残差 (最低频成分)

  // 逐层处理并重建
  const result = new Float32Array(n);

  if (residualEnabled) {
    for (let i = 0; i < n; i++) {
      result[i] = current[i];
    }
  }

  for (let s = 0; s < numLayers; s++) {
    const config = layerConfigs[s] ?? DEFAULT_LAYER;
    const processed = processLayer(details[s], config, noiseSigma, linearMask);
    for (let i = 0; i < n; i++) {
      result[i] += processed[i];
    }
  }

  return result;
}
