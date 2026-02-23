/**
 * DrizzleIntegration
 * 亚像素分辨率增强叠加
 * 将每个输入帧的像素 "滴落" 到更细的输出网格
 *
 * 复用: AlignmentTransform.matrix 仿射变换矩阵 from alignment.ts
 */

export type DrizzleKernel = "square" | "gaussian" | "tophat";

export interface DrizzleOptions {
  /** 输出放大倍数 (默认 2) */
  scale: number;
  /** pixfrac: drop 大小比例 0.4-1.0 (默认 0.7) */
  dropSize: number;
  /** 插值核 (默认 "square") */
  kernel: DrizzleKernel;
}

export interface DrizzleResult {
  pixels: Float32Array;
  width: number;
  height: number;
  weights: Float32Array;
}

export interface DrizzleFrame {
  pixels: Float32Array;
  width: number;
  height: number;
  /** 仿射变换矩阵 [a, b, tx, c, d, ty] */
  transform: [number, number, number, number, number, number];
}

/**
 * 计算核权重
 */
function kernelWeight(dx: number, dy: number, halfDrop: number, kernel: DrizzleKernel): number {
  if (kernel === "square") {
    return Math.abs(dx) <= halfDrop && Math.abs(dy) <= halfDrop ? 1 : 0;
  }
  if (kernel === "tophat") {
    const r = Math.sqrt(dx * dx + dy * dy);
    return r <= halfDrop ? 1 : 0;
  }
  // gaussian
  const r2 = dx * dx + dy * dy;
  const sigma = halfDrop * 0.5;
  return Math.exp(-r2 / (2 * sigma * sigma));
}

/**
 * 应用仿射变换: 将源坐标映射到参考坐标
 * x' = a*x + b*y + tx
 * y' = c*x + d*y + ty
 */
function applyTransform(
  transform: [number, number, number, number, number, number],
  x: number,
  y: number,
): [number, number] {
  const [a, b, tx, c, d, ty] = transform;
  return [a * x + b * y + tx, c * x + d * y + ty];
}

/**
 * Drizzle 积分主函数
 *
 * 核心算法:
 * 1. 创建放大后的输出网格
 * 2. 对每个输入帧的每个像素:
 *    - 通过 transform 映射到参考坐标
 *    - 缩放到输出网格坐标
 *    - 将像素值 "滴入" 目标区域
 * 3. 加权平均: output[i] = sum[i] / weights[i]
 */
export function drizzleIntegrate(
  frames: DrizzleFrame[],
  refWidth: number,
  refHeight: number,
  options?: Partial<DrizzleOptions>,
): DrizzleResult {
  const scale = Math.max(1, Math.min(4, Math.round(options?.scale ?? 2)));
  const dropSize = Math.max(0.2, Math.min(1, options?.dropSize ?? 0.7));
  const kernel = options?.kernel ?? "square";

  const outW = refWidth * scale;
  const outH = refHeight * scale;
  const outN = outW * outH;

  const sumData = new Float32Array(outN);
  const sumWeights = new Float32Array(outN);

  const halfDrop = dropSize * 0.5;

  for (const frame of frames) {
    for (let sy = 0; sy < frame.height; sy++) {
      for (let sx = 0; sx < frame.width; sx++) {
        const pixelValue = frame.pixels[sy * frame.width + sx];
        if (!Number.isFinite(pixelValue)) continue;

        // 映射到参考坐标
        const [refX, refY] = applyTransform(frame.transform, sx, sy);

        // 缩放到输出网格坐标
        const outX = refX * scale;
        const outY = refY * scale;

        // 计算 drop 覆盖的输出像素范围
        const dropRadius = Math.ceil(halfDrop * scale);
        const x0 = Math.max(0, Math.floor(outX - dropRadius));
        const x1 = Math.min(outW - 1, Math.ceil(outX + dropRadius));
        const y0 = Math.max(0, Math.floor(outY - dropRadius));
        const y1 = Math.min(outH - 1, Math.ceil(outY + dropRadius));

        for (let oy = y0; oy <= y1; oy++) {
          for (let ox = x0; ox <= x1; ox++) {
            const dx = (ox + 0.5 - outX) / scale;
            const dy = (oy + 0.5 - outY) / scale;

            const w = kernelWeight(dx, dy, halfDrop, kernel);
            if (w > 0) {
              const outIdx = oy * outW + ox;
              sumData[outIdx] += pixelValue * w;
              sumWeights[outIdx] += w;
            }
          }
        }
      }
    }
  }

  // 加权平均
  const result = new Float32Array(outN);
  for (let i = 0; i < outN; i++) {
    result[i] = sumWeights[i] > 0 ? sumData[i] / sumWeights[i] : 0;
  }

  return {
    pixels: result,
    width: outW,
    height: outH,
    weights: sumWeights,
  };
}
