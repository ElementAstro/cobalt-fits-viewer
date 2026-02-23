/**
 * MultiscaleMedianTransform (MMT)
 * PixInsight 风格无振铃多尺度变换
 *
 * 与现有 multiscaleDenoise (à trous 线性小波) 的区别:
 * - multiscaleDenoise 使用线性 B3 样条核，会产生振铃伪影
 * - MMT 使用中值滤波做多尺度分解，天然无振铃，适合星点附近处理
 *
 * 每层可独立控制降噪阈值、降噪量、锐化偏置
 */

import { computeMAD } from "../utils/pixelMath";
import { medianFilter } from "../utils/imageOperations";

export interface MMTLayerConfig {
  /** 噪声阈值 (σ 倍数, 默认 3) */
  noiseThreshold: number;
  /** 降噪量 0-1 (默认 0.5) */
  noiseReduction: number;
  /** 锐化偏置 -1 to 1 (>0 锐化, <0 柔化, 默认 0) */
  bias: number;
}

export interface MMTOptions {
  /** 是否包含残差层 (默认 true) */
  residualEnabled: boolean;
}

const DEFAULT_LAYER: MMTLayerConfig = {
  noiseThreshold: 3,
  noiseReduction: 0.5,
  bias: 0,
};

/**
 * 处理单层细节系数
 */
function processLayer(
  detail: Float32Array,
  config: MMTLayerConfig,
  noiseSigma: number,
): Float32Array {
  const n = detail.length;
  const result = new Float32Array(n);
  const threshold = config.noiseThreshold * noiseSigma;
  const reduction = Math.max(0, Math.min(1, config.noiseReduction));
  const bias = Math.max(-1, Math.min(1, config.bias));

  for (let i = 0; i < n; i++) {
    const d = detail[i];
    const absD = Math.abs(d);

    if (absD <= threshold) {
      // 低于噪声阈值: 按降噪量衰减
      result[i] = d * (1 - reduction);
    } else {
      // 高于噪声阈值: 保留信号，应用锐化偏置
      // bias > 0: 增强细节 (锐化)
      // bias < 0: 衰减细节 (柔化)
      result[i] = d * (1 + bias);
    }
  }

  return result;
}

/**
 * MultiscaleMedianTransform 主函数
 *
 * 分解步骤:
 * 1. smooth₀ = median(input, r=1), detail₀ = input - smooth₀
 * 2. smooth₁ = median(smooth₀, r=2), detail₁ = smooth₀ - smooth₁
 * 3. ... 每层 radius 翻倍 (dyadic)
 * 4. 重建: output = residual + Σ(processedDetail_i)
 */
export function multiscaleMedianTransform(
  pixels: Float32Array,
  width: number,
  height: number,
  layerConfigs: MMTLayerConfig[] = [DEFAULT_LAYER, DEFAULT_LAYER, DEFAULT_LAYER, DEFAULT_LAYER],
  options?: Partial<MMTOptions>,
): Float32Array {
  const residualEnabled = options?.residualEnabled ?? true;
  const numLayers = Math.max(1, Math.min(8, layerConfigs.length));
  const n = width * height;

  // 估计全局噪声 σ
  const { mad } = computeMAD(pixels);
  const noiseSigma = mad > 0 ? mad / 0.6745 : 0;

  // 多尺度分解
  const details: Float32Array[] = [];
  let current: Float32Array = new Float32Array(pixels);

  for (let s = 0; s < numLayers; s++) {
    const radius = 1 << s; // 1, 2, 4, 8, ...
    const smoothed = medianFilter(current, width, height, radius);
    const detail = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      detail[i] = current[i] - smoothed[i];
    }
    details.push(detail);
    current = smoothed;
  }
  // current 现在是残差 (最低频成分)

  // 处理每层并重建
  const result = new Float32Array(n);

  // 添加残差
  if (residualEnabled) {
    for (let i = 0; i < n; i++) {
      result[i] = current[i];
    }
  }

  // 添加处理后的细节层
  for (let s = 0; s < numLayers; s++) {
    const config = layerConfigs[s] ?? DEFAULT_LAYER;
    const processed = processLayer(details[s], config, noiseSigma);
    for (let i = 0; i < n; i++) {
      result[i] += processed[i];
    }
  }

  return result;
}
