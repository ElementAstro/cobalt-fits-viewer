/**
 * 天文图像校准帧处理
 * 支持暗场减除、平场校正、偏置帧减除
 */

import { quickSelect } from "../utils/pixelMath";

/**
 * 暗场减除: result = light - dark
 * 暗场捕获传感器热噪声，需与 light 相同温度/曝光时间
 */
export function subtractDark(light: Float32Array, dark: Float32Array): Float32Array {
  const n = light.length;
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = light[i] - dark[i];
  }
  return result;
}

/**
 * 偏置帧减除: result = light - bias
 * 偏置帧捕获传感器读出噪声（零秒曝光）
 */
export function subtractBias(light: Float32Array, bias: Float32Array): Float32Array {
  const n = light.length;
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = light[i] - bias[i];
  }
  return result;
}

/**
 * 归一化平场：flat / mean(flat)
 * 使平场均值为 1.0，用于后续除法校正
 */
export function normalizeFlat(flat: Float32Array): Float32Array {
  const n = flat.length;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const v = flat[i];
    if (!isNaN(v) && isFinite(v) && v > 0) {
      sum += v;
      count++;
    }
  }
  const mean = count > 0 ? sum / count : 1;

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = flat[i] / mean;
  }
  return result;
}

/**
 * 平场校正: result = light / normalizedFlat
 * 校正光学系统的不均匀照明（暗角、灰尘等）
 */
export function applyFlat(light: Float32Array, normalizedFlat: Float32Array): Float32Array {
  const n = light.length;
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = normalizedFlat[i];
    // 避免除以零或极小值
    result[i] = f > 0.01 ? light[i] / f : light[i];
  }
  return result;
}

/**
 * 完整校准管线
 * calibrated = (light - dark) / normalize(flat - bias)
 *
 * 简化版（无 bias）: calibrated = (light - dark) / normalize(flat)
 * 最简版（无校准帧）: 直接返回原始数据
 */
export function calibrateFrame(
  light: Float32Array,
  dark?: Float32Array | null,
  flat?: Float32Array | null,
  bias?: Float32Array | null,
): Float32Array {
  let result = light;

  // 1. 暗场减除
  if (dark) {
    result = subtractDark(result, dark);
  }

  // 2. 平场校正
  if (flat) {
    let correctedFlat: Float32Array;
    if (bias) {
      // flat - bias 然后归一化
      correctedFlat = normalizeFlat(subtractBias(flat, bias));
    } else {
      correctedFlat = normalizeFlat(flat);
    }
    result = applyFlat(result, correctedFlat);
  } else if (bias && !dark) {
    // 仅有 bias，减除读出噪声
    result = subtractBias(result, bias);
  }

  return result;
}

/**
 * 创建主暗场（master dark）：对多个暗场帧取中值
 */
export function createMasterDark(darkFrames: Float32Array[]): Float32Array {
  if (darkFrames.length === 0) return new Float32Array(0);
  if (darkFrames.length === 1) return new Float32Array(darkFrames[0]);

  const n = darkFrames[0].length;
  const result = new Float32Array(n);
  const vals = new Float32Array(darkFrames.length);

  for (let i = 0; i < n; i++) {
    for (let f = 0; f < darkFrames.length; f++) {
      vals[f] = darkFrames[f][i];
    }
    result[i] = quickSelect(vals, 0, vals.length - 1, Math.floor(vals.length / 2));
  }
  return result;
}

/**
 * 创建主平场（master flat）：对多个平场帧取均值后归一化
 */
export function createMasterFlat(flatFrames: Float32Array[]): Float32Array {
  if (flatFrames.length === 0) return new Float32Array(0);
  if (flatFrames.length === 1) return normalizeFlat(flatFrames[0]);

  const n = flatFrames[0].length;
  const result = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (const frame of flatFrames) {
      sum += frame[i];
    }
    result[i] = sum / flatFrames.length;
  }
  return normalizeFlat(result);
}
