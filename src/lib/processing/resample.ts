/**
 * 图像缩放/Bin (IntegerResample + Resample)
 * 提供精确 NxN 合并 (bin) 和通用缩放 (双三次/Lanczos 插值)
 */

export type BinMode = "average" | "sum" | "median";
export type ResampleMethod = "bilinear" | "bicubic" | "lanczos3";

/**
 * Integer Bin: 精确 NxN 像素合并
 * factor=2: 每 2×2 像素合并为 1 个像素，输出尺寸减半
 */
export function integerBin(
  pixels: Float32Array,
  width: number,
  height: number,
  factor: number = 2,
  mode: BinMode = "average",
): { pixels: Float32Array; width: number; height: number } {
  const f = Math.max(2, Math.min(8, Math.round(factor)));
  const newW = Math.floor(width / f);
  const newH = Math.floor(height / f);
  if (newW < 1 || newH < 1) return { pixels: new Float32Array(pixels), width, height };

  const result = new Float32Array(newW * newH);
  const blockSize = f * f;

  for (let ny = 0; ny < newH; ny++) {
    for (let nx = 0; nx < newW; nx++) {
      const srcX = nx * f;
      const srcY = ny * f;

      if (mode === "median") {
        const values: number[] = [];
        for (let dy = 0; dy < f; dy++) {
          for (let dx = 0; dx < f; dx++) {
            values.push(pixels[(srcY + dy) * width + (srcX + dx)]);
          }
        }
        values.sort((a, b) => a - b);
        const mid = Math.floor(values.length / 2);
        result[ny * newW + nx] =
          values.length % 2 === 0 ? (values[mid - 1] + values[mid]) * 0.5 : values[mid];
      } else {
        let sum = 0;
        for (let dy = 0; dy < f; dy++) {
          for (let dx = 0; dx < f; dx++) {
            sum += pixels[(srcY + dy) * width + (srcX + dx)];
          }
        }
        result[ny * newW + nx] = mode === "average" ? sum / blockSize : sum;
      }
    }
  }

  return { pixels: result, width: newW, height: newH };
}

/**
 * 双线性插值采样
 */
function sampleBilinear(
  pixels: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const fx = x - x0;
  const fy = y - y0;

  const cx0 = Math.max(0, Math.min(width - 1, x0));
  const cy0 = Math.max(0, Math.min(height - 1, y0));

  const v00 = pixels[cy0 * width + cx0];
  const v10 = pixels[cy0 * width + x1];
  const v01 = pixels[y1 * width + cx0];
  const v11 = pixels[y1 * width + x1];

  return v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
}

/**
 * 双三次插值核函数 (Catmull-Rom)
 */
function cubicKernel(x: number): number {
  const ax = Math.abs(x);
  if (ax <= 1) return 1.5 * ax * ax * ax - 2.5 * ax * ax + 1;
  if (ax <= 2) return -0.5 * ax * ax * ax + 2.5 * ax * ax - 4 * ax + 2;
  return 0;
}

/**
 * 双三次插值采样
 */
function sampleBicubic(
  pixels: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  let sum = 0;
  let wSum = 0;

  for (let dy = -1; dy <= 2; dy++) {
    for (let dx = -1; dx <= 2; dx++) {
      const sx = Math.max(0, Math.min(width - 1, ix + dx));
      const sy = Math.max(0, Math.min(height - 1, iy + dy));
      const w = cubicKernel(fx - dx) * cubicKernel(fy - dy);
      sum += pixels[sy * width + sx] * w;
      wSum += w;
    }
  }

  return wSum > 0 ? sum / wSum : 0;
}

/**
 * Lanczos-3 核函数
 */
function lanczos3Kernel(x: number): number {
  if (x === 0) return 1;
  const ax = Math.abs(x);
  if (ax >= 3) return 0;
  const piX = Math.PI * x;
  return (Math.sin(piX) / piX) * (Math.sin(piX / 3) / (piX / 3));
}

/**
 * Lanczos-3 插值采样
 */
function sampleLanczos3(
  pixels: Float32Array,
  width: number,
  height: number,
  x: number,
  y: number,
): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;

  let sum = 0;
  let wSum = 0;

  for (let dy = -2; dy <= 3; dy++) {
    for (let dx = -2; dx <= 3; dx++) {
      const sx = Math.max(0, Math.min(width - 1, ix + dx));
      const sy = Math.max(0, Math.min(height - 1, iy + dy));
      const w = lanczos3Kernel(fx - dx) * lanczos3Kernel(fy - dy);
      sum += pixels[sy * width + sx] * w;
      wSum += w;
    }
  }

  return wSum > 0 ? sum / wSum : 0;
}

/**
 * 通用图像缩放
 * 支持双线性、双三次 (Catmull-Rom)、Lanczos-3 插值
 */
export function resampleImage(
  pixels: Float32Array,
  width: number,
  height: number,
  targetWidth: number,
  targetHeight: number,
  method: ResampleMethod = "lanczos3",
): { pixels: Float32Array; width: number; height: number } {
  const tw = Math.max(1, Math.round(targetWidth));
  const th = Math.max(1, Math.round(targetHeight));
  if (tw === width && th === height) return { pixels: new Float32Array(pixels), width, height };

  const result = new Float32Array(tw * th);
  const scaleX = width / tw;
  const scaleY = height / th;

  const sampler =
    method === "bilinear" ? sampleBilinear : method === "bicubic" ? sampleBicubic : sampleLanczos3;

  for (let ny = 0; ny < th; ny++) {
    const srcY = (ny + 0.5) * scaleY - 0.5;
    for (let nx = 0; nx < tw; nx++) {
      const srcX = (nx + 0.5) * scaleX - 0.5;
      result[ny * tw + nx] = sampler(pixels, width, height, srcX, srcY);
    }
  }

  return { pixels: result, width: tw, height: th };
}
