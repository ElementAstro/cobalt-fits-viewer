/**
 * FluxCalibration
 * 基于 FITS header 信息 (EXPTIME, GAIN) 的流量校准
 * 将仪器计数转换为归一化流量单位
 *
 * result = pixels / (exptime * gainFactor)
 * 输出归一化到 [0, 1] 范围
 */

export interface FluxCalibrationOptions {
  /** 曝光时间 (秒) */
  exptime: number;
  /** 增益因子 (默认 1，即不校正增益) */
  gainFactor: number;
  /** 是否归一化输出到 [0,1] (默认 true) */
  normalize: boolean;
}

export function fluxCalibrate(
  pixels: Float32Array,
  options: Partial<FluxCalibrationOptions> = {},
): Float32Array {
  const exptime = Math.max(0.001, options.exptime ?? 1);
  const gainFactor = Math.max(0.001, options.gainFactor ?? 1);
  const normalize = options.normalize ?? true;
  const n = pixels.length;

  const divisor = exptime * gainFactor;
  const result = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    result[i] = pixels[i] / divisor;
  }

  if (normalize) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < n; i++) {
      const v = result[i];
      if (Number.isFinite(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    const range = max - min;
    if (range > 0) {
      for (let i = 0; i < n; i++) {
        result[i] = (result[i] - min) / range;
      }
    }
  }

  return result;
}
