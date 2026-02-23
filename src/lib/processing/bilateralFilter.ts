/**
 * 双边滤波 (Bilateral Filter)
 * 边缘保留平滑：空间域高斯 + 像素值域高斯
 * 保留锐利边缘同时平滑噪声
 */

export interface BilateralFilterOptions {
  /** 空间域高斯 σ (1-10, 默认 2) */
  spatialSigma: number;
  /** 值域高斯 σ (0.01-0.5, 归一化像素空间, 默认 0.1) */
  rangeSigma: number;
}

/**
 * 双边滤波核心实现
 * 对每个像素，邻域权重 = exp(-d²/2σ_s²) × exp(-Δv²/2σ_r²)
 */
export function bilateralFilter(
  pixels: Float32Array,
  width: number,
  height: number,
  spatialSigma: number = 2,
  rangeSigma: number = 0.1,
): Float32Array {
  const sSigma = Math.max(0.5, Math.min(10, spatialSigma));
  const rSigma = Math.max(0.001, Math.min(1, rangeSigma));

  const radius = Math.ceil(sSigma * 2.5);
  const n = width * height;
  const result = new Float32Array(n);

  // 归一化到 [0,1] 用于值域比较
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
  if (range === 0) return new Float32Array(pixels);

  const invRange = 1 / range;
  const inv2SpatialSigmaSq = 1 / (2 * sSigma * sSigma);
  const inv2RangeSigmaSq = 1 / (2 * rSigma * rSigma);

  // 预计算空间域权重
  const spatialKernelSize = 2 * radius + 1;
  const spatialWeights = new Float32Array(spatialKernelSize * spatialKernelSize);
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dy * dy;
      spatialWeights[(dy + radius) * spatialKernelSize + (dx + radius)] = Math.exp(
        -d2 * inv2SpatialSigmaSq,
      );
    }
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = y * width + x;
      const centerNorm = (pixels[centerIdx] - min) * invRange;

      let weightedSum = 0;
      let weightSum = 0;

      for (let dy = -radius; dy <= radius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;

          const neighborIdx = ny * width + nx;
          const neighborNorm = (pixels[neighborIdx] - min) * invRange;
          const diff = centerNorm - neighborNorm;

          const spatialW = spatialWeights[(dy + radius) * spatialKernelSize + (dx + radius)];
          const rangeW = Math.exp(-diff * diff * inv2RangeSigmaSq);
          const w = spatialW * rangeW;

          weightedSum += pixels[neighborIdx] * w;
          weightSum += w;
        }
      }

      result[centerIdx] = weightSum > 0 ? weightedSum / weightSum : pixels[centerIdx];
    }
  }

  return result;
}
