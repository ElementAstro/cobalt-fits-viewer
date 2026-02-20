/**
 * 图像编辑操作函数库
 * 提供像素级的图像变换操作：旋转、翻转、裁剪、反转、模糊、锐化、降噪、直方图均衡
 */

import { quickSelect, computeMAD } from "./pixelMath";
import { detectStars } from "../stacking/starDetection";
import {
  applySCNRRGBA,
  applyColorCalibrationRGBA,
  applySaturationRGBA,
  applyColorBalanceRGBA,
} from "../processing/color";

// ===== 几何变换 =====

/**
 * 旋转图像 90° 顺时针
 */
export function rotate90CW(
  pixels: Float32Array,
  width: number,
  height: number,
): { pixels: Float32Array; width: number; height: number } {
  const newW = height;
  const newH = width;
  const result = new Float32Array(newW * newH);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[x * newW + (height - 1 - y)] = pixels[y * width + x];
    }
  }
  return { pixels: result, width: newW, height: newH };
}

/**
 * 旋转图像 90° 逆时针
 */
export function rotate90CCW(
  pixels: Float32Array,
  width: number,
  height: number,
): { pixels: Float32Array; width: number; height: number } {
  const newW = height;
  const newH = width;
  const result = new Float32Array(newW * newH);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[(width - 1 - x) * newW + y] = pixels[y * width + x];
    }
  }
  return { pixels: result, width: newW, height: newH };
}

/**
 * 旋转图像 180°
 */
export function rotate180(
  pixels: Float32Array,
  width: number,
  height: number,
): { pixels: Float32Array; width: number; height: number } {
  const result = new Float32Array(width * height);
  const len = width * height;
  for (let i = 0; i < len; i++) {
    result[len - 1 - i] = pixels[i];
  }
  return { pixels: result, width, height };
}

/**
 * 水平翻转
 */
export function flipHorizontal(pixels: Float32Array, width: number, height: number): Float32Array {
  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      result[y * width + (width - 1 - x)] = pixels[y * width + x];
    }
  }
  return result;
}

/**
 * 垂直翻转
 */
export function flipVertical(pixels: Float32Array, width: number, height: number): Float32Array {
  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const srcRow = y * width;
    const dstRow = (height - 1 - y) * width;
    for (let x = 0; x < width; x++) {
      result[dstRow + x] = pixels[srcRow + x];
    }
  }
  return result;
}

// ===== 裁剪 =====

/**
 * 裁剪图像区域
 */
export function cropImage(
  pixels: Float32Array,
  srcWidth: number,
  x: number,
  y: number,
  cropWidth: number,
  cropHeight: number,
): { pixels: Float32Array; width: number; height: number } {
  const result = new Float32Array(cropWidth * cropHeight);
  for (let dy = 0; dy < cropHeight; dy++) {
    for (let dx = 0; dx < cropWidth; dx++) {
      result[dy * cropWidth + dx] = pixels[(y + dy) * srcWidth + (x + dx)];
    }
  }
  return { pixels: result, width: cropWidth, height: cropHeight };
}

// ===== 像素值操作 =====

/**
 * 反转像素值 (max - pixel)
 */
export function invertPixels(pixels: Float32Array): Float32Array {
  const result = new Float32Array(pixels.length);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  for (let i = 0; i < pixels.length; i++) {
    result[i] = max - (pixels[i] - min);
  }
  return result;
}

// ===== 滤镜操作 =====

/**
 * 高斯模糊 (可分离卷积)
 */
export function gaussianBlur(
  pixels: Float32Array,
  width: number,
  height: number,
  sigma: number = 2.0,
): Float32Array {
  const radius = Math.ceil(sigma * 3);
  const kernel = createGaussianKernel(radius, sigma);

  // 水平方向
  const temp = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let wSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sx = Math.min(Math.max(x + k, 0), width - 1);
        const w = kernel[k + radius];
        sum += pixels[y * width + sx] * w;
        wSum += w;
      }
      temp[y * width + x] = sum / wSum;
    }
  }

  // 垂直方向
  const result = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let wSum = 0;
      for (let k = -radius; k <= radius; k++) {
        const sy = Math.min(Math.max(y + k, 0), height - 1);
        const w = kernel[k + radius];
        sum += temp[sy * width + x] * w;
        wSum += w;
      }
      result[y * width + x] = sum / wSum;
    }
  }

  return result;
}

function createGaussianKernel(radius: number, sigma: number): Float32Array {
  const size = radius * 2 + 1;
  const kernel = new Float32Array(size);
  const s2 = 2 * sigma * sigma;
  for (let i = 0; i < size; i++) {
    const d = i - radius;
    kernel[i] = Math.exp(-(d * d) / s2);
  }
  return kernel;
}

/**
 * 锐化 (Unsharp Mask)
 */
export function sharpen(
  pixels: Float32Array,
  width: number,
  height: number,
  amount: number = 1.5,
  sigma: number = 1.0,
): Float32Array {
  const blurred = gaussianBlur(pixels, width, height, sigma);
  const result = new Float32Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = pixels[i] + amount * (pixels[i] - blurred[i]);
  }
  return result;
}

/**
 * 降噪 (中值滤波)
 */
export function medianFilter(
  pixels: Float32Array,
  width: number,
  height: number,
  radius: number = 1,
): Float32Array {
  const result = new Float32Array(width * height);
  const windowSize = (2 * radius + 1) * (2 * radius + 1);
  const window = new Float32Array(windowSize);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let idx = 0;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          const sy = Math.min(Math.max(y + ky, 0), height - 1);
          const sx = Math.min(Math.max(x + kx, 0), width - 1);
          window[idx++] = pixels[sy * width + sx];
        }
      }
      // 使用 quickSelect O(n) 获取中值
      const sub = window.slice(0, idx);
      result[y * width + x] = quickSelect(sub, 0, idx - 1, Math.floor(idx / 2));
    }
  }

  return result;
}

// ===== 直方图操作 =====

/**
 * 直方图均衡化
 */
export function histogramEqualize(pixels: Float32Array): Float32Array {
  const len = pixels.length;

  // 获取范围
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < len; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  if (min === max) return new Float32Array(pixels);

  const range = max - min;
  const bins = 65536;

  // 计算直方图
  const histogram = new Uint32Array(bins);
  for (let i = 0; i < len; i++) {
    const normalized = (pixels[i] - min) / range;
    const bin = Math.min(Math.floor(normalized * (bins - 1)), bins - 1);
    histogram[bin]++;
  }

  // 计算 CDF
  const cdf = new Float32Array(bins);
  cdf[0] = histogram[0];
  for (let i = 1; i < bins; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }

  // 归一化 CDF
  const cdfMin = cdf[0];
  const cdfRange = cdf[bins - 1] - cdfMin;
  if (cdfRange === 0) return new Float32Array(pixels);

  // 应用均衡化
  const result = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const normalized = (pixels[i] - min) / range;
    const bin = Math.min(Math.floor(normalized * (bins - 1)), bins - 1);
    result[i] = min + ((cdf[bin] - cdfMin) / cdfRange) * range;
  }

  return result;
}

// ===== 任意角度旋转 =====

/**
 * 任意角度旋转（双线性插值）
 * angleDeg: 旋转角度（度数，顺时针为正）
 */
export function rotateArbitrary(
  pixels: Float32Array,
  width: number,
  height: number,
  angleDeg: number,
): { pixels: Float32Array; width: number; height: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // 计算旋转后图像尺寸
  const newW = Math.ceil(Math.abs(width * cos) + Math.abs(height * sin));
  const newH = Math.ceil(Math.abs(width * sin) + Math.abs(height * cos));
  const result = new Float32Array(newW * newH);

  // 原图和新图的中心
  const cx = width / 2;
  const cy = height / 2;
  const ncx = newW / 2;
  const ncy = newH / 2;

  for (let ny = 0; ny < newH; ny++) {
    for (let nx = 0; nx < newW; nx++) {
      // 逆变换：从目标坐标反算源坐标
      const dx = nx - ncx;
      const dy = ny - ncy;
      const sx = cos * dx + sin * dy + cx;
      const sy = -sin * dx + cos * dy + cy;

      // 双线性插值
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const x1 = x0 + 1;
      const y1 = y0 + 1;
      const fx = sx - x0;
      const fy = sy - y0;

      if (x0 >= 0 && x1 < width && y0 >= 0 && y1 < height) {
        const v00 = pixels[y0 * width + x0];
        const v10 = pixels[y0 * width + x1];
        const v01 = pixels[y1 * width + x0];
        const v11 = pixels[y1 * width + x1];
        result[ny * newW + nx] =
          v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
      }
    }
  }
  return { pixels: result, width: newW, height: newH };
}

// ===== 背景提取 =====

/**
 * 对一组采样值做 sigma clipping（迭代）
 */
function sigmaClipSamples(values: number[], sigma: number, maxIters: number): number[] {
  if (values.length <= 2) return values;
  let working = values.slice();
  const s = Math.max(0.5, sigma);

  for (let iter = 0; iter < Math.max(1, maxIters); iter++) {
    if (working.length <= 2) break;
    let sum = 0;
    for (let i = 0; i < working.length; i++) sum += working[i];
    const mean = sum / working.length;
    let varAcc = 0;
    for (let i = 0; i < working.length; i++) {
      const d = working[i] - mean;
      varAcc += d * d;
    }
    const std = Math.sqrt(varAcc / Math.max(1, working.length));
    if (!Number.isFinite(std) || std <= 0) break;

    const threshold = s * std;
    const next = working.filter((v) => Math.abs(v - mean) <= threshold);
    if (next.length === 0 || next.length === working.length) break;
    working = next;
  }

  return working;
}

function estimateSExtractorBackground(values: number[], sigma: number): number {
  if (values.length === 0) return 0;
  const clipped = sigmaClipSamples(values, sigma, 10);
  if (clipped.length === 0) return 0;

  const sorted = clipped.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) * 0.5 : sorted[mid];

  let sum = 0;
  for (let i = 0; i < clipped.length; i++) sum += clipped[i];
  const mean = sum / clipped.length;

  let varAcc = 0;
  for (let i = 0; i < clipped.length; i++) {
    const d = clipped[i] - mean;
    varAcc += d * d;
  }
  const std = Math.sqrt(varAcc / Math.max(1, clipped.length));
  if (!Number.isFinite(std) || std <= 1e-12) return median;

  // photutils SExtractorBackground:
  // mode = 2.5 * median - 1.5 * mean, but fallback to median when skew is high.
  const skewMetric = (mean - median) / std;
  if (skewMetric > 0.3) return median;
  return 2.5 * median - 1.5 * mean;
}

function buildBackgroundModel(
  pixels: Float32Array,
  width: number,
  height: number,
  gridX: number,
  gridY: number,
  sigma: number,
): Float32Array {
  const gx = Math.max(2, Math.min(64, Math.round(gridX)));
  const gy = Math.max(2, Math.min(64, Math.round(gridY)));
  const cellW = Math.max(1, Math.ceil(width / gx));
  const cellH = Math.max(1, Math.ceil(height / gy));

  const sampleGrid = new Float32Array(gx * gy);
  for (let y = 0; y < gy; y++) {
    for (let x = 0; x < gx; x++) {
      const x0 = x * cellW;
      const y0 = y * cellH;
      const x1 = Math.min(width, x0 + cellW);
      const y1 = Math.min(height, y0 + cellH);
      const values: number[] = [];
      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const v = pixels[py * width + px];
          if (Number.isFinite(v)) values.push(v);
        }
      }
      sampleGrid[y * gx + x] = estimateSExtractorBackground(values, sigma);
    }
  }

  const background = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const fy = (y / Math.max(1, height - 1)) * (gy - 1);
    const y0 = Math.max(0, Math.min(gy - 2, Math.floor(fy)));
    const y1 = Math.min(gy - 1, y0 + 1);
    const wy = fy - y0;
    for (let x = 0; x < width; x++) {
      const fx = (x / Math.max(1, width - 1)) * (gx - 1);
      const x0 = Math.max(0, Math.min(gx - 2, Math.floor(fx)));
      const x1 = Math.min(gx - 1, x0 + 1);
      const wx = fx - x0;

      const v00 = sampleGrid[y0 * gx + x0];
      const v10 = sampleGrid[y0 * gx + x1];
      const v01 = sampleGrid[y1 * gx + x0];
      const v11 = sampleGrid[y1 * gx + x1];
      background[y * width + x] =
        v00 * (1 - wx) * (1 - wy) + v10 * wx * (1 - wy) + v01 * (1 - wx) * wy + v11 * wx * wy;
    }
  }
  return background;
}

/**
 * 自动背景提取 (ABE)
 * 采用 sigma-clip + SExtractor 背景估计 + 双线性插值构建背景模型
 */
export function extractBackground(
  pixels: Float32Array,
  width: number,
  height: number,
  gridSize: number = 8,
): Float32Array {
  const grid = Math.max(2, Math.min(64, Math.round(gridSize)));
  const background = buildBackgroundModel(pixels, width, height, grid, grid, 3);
  const result = new Float32Array(width * height);
  for (let i = 0; i < result.length; i++) result[i] = pixels[i] - background[i];
  return result;
}

// ===== 亮度/对比度/Gamma 调整 =====

/**
 * 调整亮度：pixel + amount
 * amount 范围建议 [-0.5, 0.5]（归一化像素空间）
 */
export function adjustBrightness(pixels: Float32Array, amount: number): Float32Array {
  const result = new Float32Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    result[i] = pixels[i] + amount;
  }
  return result;
}

/**
 * 调整对比度：(pixel - mean) * factor + mean
 * factor > 1 增加对比度, < 1 减少对比度
 */
export function adjustContrast(pixels: Float32Array, factor: number): Float32Array {
  const n = pixels.length;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += pixels[i];
  const mean = sum / n;

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = (pixels[i] - mean) * factor + mean;
  }
  return result;
}

/**
 * 独立 Gamma 调整：先归一化到 [0,1]，应用 gamma，再映射回原始范围
 */
export function adjustGamma(pixels: Float32Array, gamma: number): Float32Array {
  const n = pixels.length;
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(pixels);

  const invGamma = 1 / gamma;
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const normalized = (pixels[i] - min) / range;
    result[i] = min + Math.pow(Math.max(0, Math.min(1, normalized)), invGamma) * range;
  }
  return result;
}

// ===== Levels 调整 =====

/**
 * Levels 调整：输入范围裁剪 + gamma + 输出范围映射
 * inputBlack/inputWhite: 归一化 [0,1] 范围的输入裁剪点
 * gamma: 中间调 gamma
 * outputBlack/outputWhite: 归一化 [0,1] 范围的输出映射
 */
export function applyLevels(
  pixels: Float32Array,
  inputBlack: number,
  inputWhite: number,
  gamma: number = 1,
  outputBlack: number = 0,
  outputWhite: number = 1,
): Float32Array {
  const n = pixels.length;
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(pixels);

  const ibAbs = min + inputBlack * range;
  const iwAbs = min + inputWhite * range;
  const inputSpan = iwAbs - ibAbs;
  if (inputSpan <= 0) return new Float32Array(pixels);

  const obAbs = min + outputBlack * range;
  const owAbs = min + outputWhite * range;
  const outputSpan = owAbs - obAbs;
  const invGamma = 1 / gamma;

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = (pixels[i] - ibAbs) / inputSpan;
    v = Math.max(0, Math.min(1, v));
    v = Math.pow(v, invGamma);
    result[i] = obAbs + v * outputSpan;
  }
  return result;
}

// ===== MTF (Midtone Transfer Function) =====

/**
 * PixInsight-style Midtone Transfer Function
 * f(x, m) = ((m-1)*x) / ((2m-1)*x - m)
 */
function mtf(m: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (x === m) return 0.5;
  return ((m - 1) * x) / ((2 * m - 1) * x - m);
}

/**
 * 应用 MTF 中间调传递函数
 * midtone: 中间调平衡 [0.001, 0.999]，<0.5 提亮，>0.5 压暗
 * shadowsClip/highlightsClip: 归一化裁剪点 [0,1]
 */
export function applyMTF(
  pixels: Float32Array,
  midtone: number,
  shadowsClip: number = 0,
  highlightsClip: number = 1,
): Float32Array {
  midtone = Math.max(0.001, Math.min(0.999, midtone));
  shadowsClip = Math.max(0, Math.min(1, shadowsClip));
  highlightsClip = Math.max(0, Math.min(1, highlightsClip));
  const n = pixels.length;
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(pixels);

  const clipLow = min + shadowsClip * range;
  const clipHigh = min + highlightsClip * range;
  const clipSpan = clipHigh - clipLow;
  if (clipSpan <= 0) return new Float32Array(pixels);

  // Build 256-entry LUT for speed
  const LUT_SIZE = 256;
  const lut = new Float32Array(LUT_SIZE);
  for (let i = 0; i < LUT_SIZE; i++) {
    lut[i] = mtf(midtone, i / (LUT_SIZE - 1));
  }

  const result = new Float32Array(n);
  const lutMax = LUT_SIZE - 1;
  for (let i = 0; i < n; i++) {
    let v = (pixels[i] - clipLow) / clipSpan;
    v = Math.max(0, Math.min(1, v));
    const idx = Math.round(v * lutMax);
    result[i] = min + lut[idx] * range;
  }
  return result;
}

// ===== StarMask 星点掩膜 =====

/**
 * 生成星点掩膜图像
 * 基于星点检测结果，在每颗星位置绘制高斯轮廓
 * scale: 掩膜扩展系数 (1.0 = FWHM 大小)
 */
export function generateStarMask(
  pixels: Float32Array,
  width: number,
  height: number,
  scale: number = 1.5,
): Float32Array {
  let stars = detectStars(pixels, width, height).map((star) => ({
    cx: star.cx,
    cy: star.cy,
    fwhm: star.fwhm,
  }));
  if (stars.length === 0) {
    // Fallback to a more permissive profile for sparse/synthetic frames.
    stars = detectStars(pixels, width, height, {
      profile: "accurate",
      sigmaThreshold: 3,
      minArea: 2,
      borderMargin: Math.max(2, Math.floor(Math.min(width, height) / 16)),
    }).map((star) => ({
      cx: star.cx,
      cy: star.cy,
      fwhm: star.fwhm,
    }));
  }
  if (stars.length === 0) {
    // Last resort: local-maximum peak picker from robust background stats.
    const { median, mad } = computeMAD(pixels);
    const sigma = mad > 0 ? mad / 0.6745 : 0;
    const threshold = median + Math.max(1e-4, sigma * 2.5);
    const peaks: Array<{ cx: number; cy: number; fwhm: number; value: number }> = [];
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = y * width + x;
        const v = pixels[idx];
        if (v < threshold) continue;
        if (
          v >= pixels[idx - 1] &&
          v >= pixels[idx + 1] &&
          v >= pixels[idx - width] &&
          v >= pixels[idx + width]
        ) {
          peaks.push({ cx: x, cy: y, fwhm: 2, value: v });
        }
      }
    }
    peaks.sort((a, b) => b.value - a.value);
    stars = peaks.slice(0, 256).map(({ cx, cy, fwhm }) => ({ cx, cy, fwhm }));
  }
  const mask = new Float32Array(width * height);

  for (const star of stars) {
    const sigma = (star.fwhm * scale) / 2.3548;
    const r = Math.ceil(sigma * 3);
    const s2 = 2 * sigma * sigma;
    const cx = Math.round(star.cx);
    const cy = Math.round(star.cy);

    for (let dy = -r; dy <= r; dy++) {
      const py = cy + dy;
      if (py < 0 || py >= height) continue;
      for (let dx = -r; dx <= r; dx++) {
        const px = cx + dx;
        if (px < 0 || px >= width) continue;
        const dist2 = dx * dx + dy * dy;
        const val = Math.exp(-dist2 / s2);
        const idx = py * width + px;
        if (val > mask[idx]) mask[idx] = val;
      }
    }
  }

  return mask;
}

/**
 * 使用掩膜混合原始像素和处理后像素
 * result = original * (1 - mask) + processed * mask
 * 当 invert=true 时: result = original * mask + processed * (1 - mask)
 */
export function applyWithMask(
  original: Float32Array,
  processed: Float32Array,
  mask: Float32Array,
  invert: boolean = false,
): Float32Array {
  const n = original.length;
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const m = invert ? 1 - mask[i] : mask[i];
    result[i] = original[i] * (1 - m) + processed[i] * m;
  }
  return result;
}

/**
 * 应用星点掩膜保护或隔离星点
 * 当 invert=false: 保留星点，非星点区域置零 (隔离星点)
 * 当 invert=true: 移除星点，保留非星点区域 (无星图像)
 */
export function applyStarMask(
  pixels: Float32Array,
  width: number,
  height: number,
  scale: number = 1.5,
  invert: boolean = false,
): Float32Array {
  const mask = generateStarMask(pixels, width, height, scale);
  const n = pixels.length;
  const result = new Float32Array(n);

  // 计算背景中值用于填充星点区域
  const { median } = computeMAD(pixels);

  for (let i = 0; i < n; i++) {
    const m = invert ? 1 - mask[i] : mask[i];
    result[i] = pixels[i] * m + median * (1 - m);
  }
  return result;
}

// ===== Binarize / Rescale =====

/**
 * 二值化：像素值 > threshold → 1, 否则 → 0
 * threshold: 归一化阈值 [0,1]
 */
export function binarize(pixels: Float32Array, threshold: number): Float32Array {
  threshold = Math.max(0, Math.min(1, threshold));
  const n = pixels.length;
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(n);

  const absThreshold = min + threshold * range;
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = pixels[i] > absThreshold ? max : min;
  }
  return result;
}

/**
 * 重缩放：将像素值映射到 [min, max] → [0, 1]
 */
export function rescalePixels(pixels: Float32Array): Float32Array {
  const n = pixels.length;
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(n).fill(0.5);

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = (pixels[i] - min) / range;
  }
  return result;
}

// ===== SCNR (Subtractive Chromatic Noise Reduction) =====

/**
 * SCNR 去绿噪 — 在 RGBA 数据上操作
 * method: "averageNeutral" | "maximumNeutral"
 * amount: 强度 [0, 1]
 */
export function applySCNR(
  rgbaData: Uint8ClampedArray,
  method: "averageNeutral" | "maximumNeutral" = "averageNeutral",
  amount: number = 1.0,
): Uint8ClampedArray {
  return applySCNRRGBA(rgbaData, method, amount);
}

/**
 * SCNR 在 Float32Array 单通道上的简化版
 * 当图像为灰度时无效果，返回原数据
 */
export function applySCNRGray(pixels: Float32Array): Float32Array {
  return new Float32Array(pixels);
}

// ===== CLAHE (Contrast Limited Adaptive Histogram Equalization) =====

/**
 * CLAHE 局部自适应直方图均衡
 * tileSize: tileGridSize（每个维度上的网格数，OpenCV 语义）
 * clipLimit: 对比度限制（OpenCV 语义，按 tileArea / bins 归一化）
 */
export function clahe(
  pixels: Float32Array,
  width: number,
  height: number,
  tileSize: number = 8,
  clipLimit: number = 3.0,
): Float32Array {
  const tileGrid = Math.max(2, Math.min(64, Math.round(tileSize)));
  const clip = Math.max(0.01, Math.min(100, clipLimit));
  const n = width * height;

  // 归一化到 [0,1]
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(pixels);

  const tilesX = tileGrid;
  const tilesY = tileGrid;
  const tileW = Math.max(1, Math.ceil(width / tilesX));
  const tileH = Math.max(1, Math.ceil(height / tilesY));
  const BINS = 256;

  // 为每个 tile 计算裁剪后的 CDF
  const cdfs = new Array<Float32Array>(tilesX * tilesY);

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const startX = tx * tileW;
      const startY = ty * tileH;
      const endX = Math.min(startX + tileW, width);
      const endY = Math.min(startY + tileH, height);
      const tilePixelCount = (endX - startX) * (endY - startY);
      if (tilePixelCount <= 0) {
        const identity = new Float32Array(BINS);
        for (let i = 0; i < BINS; i++) identity[i] = i / (BINS - 1);
        cdfs[ty * tilesX + tx] = identity;
        continue;
      }

      // 计算直方图
      const hist = new Uint32Array(BINS);
      for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
          const v = (pixels[y * width + x] - min) / range;
          const bin = Math.min(BINS - 1, Math.floor(v * (BINS - 1)));
          hist[bin]++;
        }
      }

      // OpenCV 语义：limit = clipLimit * tileArea / histBins
      const limit = Math.max(1, Math.floor((clip * tilePixelCount) / BINS));
      let excess = 0;
      for (let i = 0; i < BINS; i++) {
        if (hist[i] > limit) {
          excess += hist[i] - limit;
          hist[i] = limit;
        }
      }
      // 重分配超出部分（均匀分配到所有 bins）
      const increment = Math.floor(excess / BINS);
      const remainder = excess - increment * BINS;
      for (let i = 0; i < BINS; i++) {
        hist[i] += increment + (i < remainder ? 1 : 0);
      }

      // 计算 CDF
      const cdf = new Float32Array(BINS);
      cdf[0] = hist[0];
      for (let i = 1; i < BINS; i++) {
        cdf[i] = cdf[i - 1] + hist[i];
      }
      // 归一化 CDF
      const cdfMax = cdf[BINS - 1];
      if (cdfMax > 0) {
        for (let i = 0; i < BINS; i++) {
          cdf[i] /= cdfMax;
        }
      }
      cdfs[ty * tilesX + tx] = cdf;
    }
  }

  // 双线性插值应用 CLAHE
  const result = new Float32Array(n);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = (pixels[y * width + x] - min) / range;
      const bin = Math.min(BINS - 1, Math.max(0, Math.floor(v * (BINS - 1))));

      // 像素在 tile 网格中的位置
      const txf = (x + 0.5) / tileW - 0.5;
      const tyf = (y + 0.5) / tileH - 0.5;
      const tx0 = Math.max(0, Math.min(tilesX - 2, Math.floor(txf)));
      const ty0 = Math.max(0, Math.min(tilesY - 2, Math.floor(tyf)));
      const tx1 = Math.min(tilesX - 1, tx0 + 1);
      const ty1 = Math.min(tilesY - 1, ty0 + 1);
      const fx = Math.max(0, Math.min(1, txf - tx0));
      const fy = Math.max(0, Math.min(1, tyf - ty0));

      const v00 = cdfs[ty0 * tilesX + tx0][bin];
      const v10 = cdfs[ty0 * tilesX + tx1][bin];
      const v01 = cdfs[ty1 * tilesX + tx0][bin];
      const v11 = cdfs[ty1 * tilesX + tx1][bin];

      const mapped =
        v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;

      result[y * width + x] = min + mapped * range;
    }
  }

  return result;
}

// ===== CurvesTransformation 曲线变换 =====

/**
 * Akima 子样条插值
 * 给定控制点数组 (已按 x 排序)，生成 LUT
 */
function akimaInterpolate(points: { x: number; y: number }[], lutSize: number): Float32Array {
  const n = points.length;
  const lut = new Float32Array(lutSize);

  if (n === 0) {
    for (let i = 0; i < lutSize; i++) lut[i] = i / (lutSize - 1);
    return lut;
  }
  if (n === 1) {
    lut.fill(points[0].y);
    return lut;
  }
  if (n === 2) {
    const p0 = points[0],
      p1 = points[1];
    const slope = (p1.y - p0.y) / (p1.x - p0.x || 1);
    for (let i = 0; i < lutSize; i++) {
      const t = i / (lutSize - 1);
      if (t <= p0.x) lut[i] = p0.y;
      else if (t >= p1.x) lut[i] = p1.y;
      else lut[i] = p0.y + slope * (t - p0.x);
    }
    return lut;
  }

  // 计算差值斜率
  const m = new Float32Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    m[i] = (points[i + 1].y - points[i].y) / (points[i + 1].x - points[i].x || 1e-10);
  }

  // Akima 权重计算切线
  const t = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      t[i] = m[0];
    } else if (i === n - 1) {
      t[i] = m[n - 2];
    } else if (i === 1 || i === n - 2) {
      t[i] = (m[i - 1] + m[i]) / 2;
    } else {
      const w1 = Math.abs(m[i + 1] - m[i]);
      const w2 = Math.abs(m[i - 1] - m[i - 2]);
      if (w1 + w2 === 0) {
        t[i] = (m[i - 1] + m[i]) / 2;
      } else {
        t[i] = (w1 * m[i - 1] + w2 * m[i]) / (w1 + w2);
      }
    }
  }

  // 对每个 LUT 位置进行 Hermite 插值
  for (let i = 0; i < lutSize; i++) {
    const x = i / (lutSize - 1);

    if (x <= points[0].x) {
      lut[i] = points[0].y;
      continue;
    }
    if (x >= points[n - 1].x) {
      lut[i] = points[n - 1].y;
      continue;
    }

    // 找到区间
    let seg = 0;
    for (let j = 0; j < n - 1; j++) {
      if (x >= points[j].x && x < points[j + 1].x) {
        seg = j;
        break;
      }
    }

    const h = points[seg + 1].x - points[seg].x;
    const s = (x - points[seg].x) / (h || 1e-10);
    const s2 = s * s;
    const s3 = s2 * s;

    // Hermite 基函数
    const h00 = 2 * s3 - 3 * s2 + 1;
    const h10 = s3 - 2 * s2 + s;
    const h01 = -2 * s3 + 3 * s2;
    const h11 = s3 - s2;

    lut[i] = Math.max(
      0,
      Math.min(
        1,
        h00 * points[seg].y + h10 * h * t[seg] + h01 * points[seg + 1].y + h11 * h * t[seg + 1],
      ),
    );
  }

  return lut;
}

/**
 * 曲线变换
 * points: 控制点数组 [{x, y}], x/y 范围 [0,1], 必须按 x 排序
 */
export function applyCurves(
  pixels: Float32Array,
  points: { x: number; y: number }[],
): Float32Array {
  const n = pixels.length;

  // 获取范围
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(pixels);

  // 生成 LUT
  const LUT_SIZE = 4096;
  const lut = akimaInterpolate(points, LUT_SIZE);
  const lutMax = LUT_SIZE - 1;

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const normalized = (pixels[i] - min) / range;
    const clamped = Math.max(0, Math.min(1, normalized));
    const idx = Math.round(clamped * lutMax);
    result[i] = min + lut[idx] * range;
  }

  return result;
}

// ===== Morphological Operations 形态学操作 =====

/**
 * 形态学腐蚀 (Erosion)：取圆形邻域最小值
 */
export function morphErode(
  pixels: Float32Array,
  width: number,
  height: number,
  radius: number = 1,
): Float32Array {
  const result = new Float32Array(width * height);
  const r2 = radius * radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = Infinity;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          if (kx * kx + ky * ky > r2) continue;
          const sy = Math.min(Math.max(y + ky, 0), height - 1);
          const sx = Math.min(Math.max(x + kx, 0), width - 1);
          const v = pixels[sy * width + sx];
          if (v < minVal) minVal = v;
        }
      }
      result[y * width + x] = minVal;
    }
  }

  return result;
}

/**
 * 形态学膨胀 (Dilation)：取圆形邻域最大值
 */
export function morphDilate(
  pixels: Float32Array,
  width: number,
  height: number,
  radius: number = 1,
): Float32Array {
  const result = new Float32Array(width * height);
  const r2 = radius * radius;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxVal = -Infinity;
      for (let ky = -radius; ky <= radius; ky++) {
        for (let kx = -radius; kx <= radius; kx++) {
          if (kx * kx + ky * ky > r2) continue;
          const sy = Math.min(Math.max(y + ky, 0), height - 1);
          const sx = Math.min(Math.max(x + kx, 0), width - 1);
          const v = pixels[sy * width + sx];
          if (v > maxVal) maxVal = v;
        }
      }
      result[y * width + x] = maxVal;
    }
  }

  return result;
}

/**
 * 形态学操作: erode, dilate, open (erode→dilate), close (dilate→erode)
 */
export function morphologicalOp(
  pixels: Float32Array,
  width: number,
  height: number,
  operation: "erode" | "dilate" | "open" | "close",
  radius: number = 1,
): Float32Array {
  radius = Math.max(1, Math.min(10, Math.round(radius)));
  switch (operation) {
    case "erode":
      return morphErode(pixels, width, height, radius);
    case "dilate":
      return morphDilate(pixels, width, height, radius);
    case "open":
      return morphDilate(morphErode(pixels, width, height, radius), width, height, radius);
    case "close":
      return morphErode(morphDilate(pixels, width, height, radius), width, height, radius);
  }
}

// ===== HDR Multiscale Transform =====

/**
 * B3 样条 à trous 小波分解核
 */
const B3_KERNEL = [
  1 / 256,
  1 / 64,
  3 / 128,
  1 / 64,
  1 / 256,
  1 / 64,
  1 / 16,
  3 / 32,
  1 / 16,
  1 / 64,
  3 / 128,
  3 / 32,
  9 / 64,
  3 / 32,
  3 / 128,
  1 / 64,
  1 / 16,
  3 / 32,
  1 / 16,
  1 / 64,
  1 / 256,
  1 / 64,
  3 / 128,
  1 / 64,
  1 / 256,
];

/**
 * à trous 平滑 (单层)
 */
function atrousSmooth(
  pixels: Float32Array,
  width: number,
  height: number,
  scale: number,
): Float32Array {
  const n = width * height;
  const result = new Float32Array(n);
  const step = 1 << scale; // 2^scale

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      let ki = 0;
      for (let ky = -2; ky <= 2; ky++) {
        for (let kx = -2; kx <= 2; kx++) {
          const sy = Math.min(Math.max(y + ky * step, 0), height - 1);
          const sx = Math.min(Math.max(x + kx * step, 0), width - 1);
          sum += pixels[sy * width + sx] * B3_KERNEL[ki++];
        }
      }
      result[y * width + x] = sum;
    }
  }

  return result;
}

/**
 * HDR Multiscale Transform
 * 使用 à trous 小波分解进行动态范围压缩
 * layers: 分解层数 (3-8)
 * amount: 压缩强度 [0, 1]
 */
export function hdrMultiscaleTransform(
  pixels: Float32Array,
  width: number,
  height: number,
  layers: number = 5,
  amount: number = 0.7,
): Float32Array {
  layers = Math.max(1, Math.min(10, Math.round(layers)));
  amount = Math.max(0, Math.min(1, amount));
  const n = width * height;

  // 归一化到 [0,1]
  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(pixels);

  const normalized = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    normalized[i] = (pixels[i] - min) / range;
  }

  // à trous 小波分解
  const waveletLayers: Float32Array[] = [];
  let current: Float32Array = normalized;
  for (let s = 0; s < layers; s++) {
    const smoothed = atrousSmooth(current, width, height, s);
    const detail = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      detail[i] = current[i] - smoothed[i];
    }
    waveletLayers.push(detail);
    current = smoothed;
  }
  const residual = current;

  // 计算中值用于非线性压缩
  const { median } = computeMAD(normalized);

  // 非线性压缩小波系数
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) result[i] = residual[i];
  for (let s = 0; s < layers; s++) {
    const detail = waveletLayers[s];
    for (let i = 0; i < n; i++) {
      const w = detail[i];
      // 压缩公式: w' = w * (median / (median + |w|))^amount
      const compression = Math.pow(median / (median + Math.abs(w) + 1e-10), amount);
      result[i] += w * compression;
    }
  }

  // 映射回原始范围
  const output = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    output[i] = min + Math.max(0, Math.min(1, result[i])) * range;
  }

  return output;
}

// ===== Range Selection / Luminance Mask =====

/**
 * 创建亮度范围掩膜
 * lowBound/highBound: 归一化亮度范围 [0,1]
 * fuzziness: 边界平滑度 [0, 0.5]
 */
export function createRangeMask(
  pixels: Float32Array,
  lowBound: number,
  highBound: number,
  fuzziness: number = 0.1,
): Float32Array {
  const n = pixels.length;

  let min = Infinity,
    max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range === 0) return new Float32Array(n).fill(1);

  const mask = new Float32Array(n);
  const fuzz = Math.max(0.001, fuzziness);

  for (let i = 0; i < n; i++) {
    const v = (pixels[i] - min) / range;

    // 下界平滑过渡
    let lo = 1;
    if (v < lowBound) {
      lo = Math.max(0, 1 - (lowBound - v) / fuzz);
    }
    // 上界平滑过渡
    let hi = 1;
    if (v > highBound) {
      hi = Math.max(0, 1 - (v - highBound) / fuzz);
    }

    mask[i] = lo * hi;
  }

  return mask;
}

/**
 * 应用亮度范围掩膜：仅处理指定亮度范围内的像素
 */
export function applyRangeMask(
  pixels: Float32Array,
  lowBound: number,
  highBound: number,
  fuzziness: number = 0.1,
): Float32Array {
  const mask = createRangeMask(pixels, lowBound, highBound, fuzziness);
  const n = pixels.length;

  // 计算中值作为填充值
  const { median } = computeMAD(pixels);

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    result[i] = pixels[i] * mask[i] + median * (1 - mask[i]);
  }
  return result;
}

// ===== Color Saturation =====

/**
 * 调整 RGBA 数据的颜色饱和度
 * amount: 饱和度倍数 (-1 到 2)，0=不变，>0 增加，<0 减少
 */
export function adjustSaturation(rgbaData: Uint8ClampedArray, amount: number): Uint8ClampedArray {
  return applySaturationRGBA(rgbaData, amount);
}

export function applyColorCalibration(
  rgbaData: Uint8ClampedArray,
  percentile: number = 0.92,
): Uint8ClampedArray {
  return applyColorCalibrationRGBA(rgbaData, percentile);
}

export function adjustColorBalance(
  rgbaData: Uint8ClampedArray,
  redGain: number,
  greenGain: number,
  blueGain: number,
): Uint8ClampedArray {
  return applyColorBalanceRGBA(rgbaData, redGain, greenGain, blueGain);
}

// ===== PixelMath Expression Evaluator =====

/**
 * 简易 PixelMath 表达式解析器
 * 支持: +, -, *, /, ^, min, max, abs, sqrt, log, exp, clamp
 * 变量: $T (当前像素值), $mean, $median, $min, $max
 */
export function evaluatePixelExpression(pixels: Float32Array, expression: string): Float32Array {
  const n = pixels.length;

  // 预计算统计量
  let pMin = Infinity,
    pMax = -Infinity,
    sum = 0;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < pMin) pMin = v;
      if (v > pMax) pMax = v;
      sum += v;
    }
  }
  const pMean = sum / n;
  const { median: pMedian } = computeMAD(pixels);

  // 词法分析器
  const tokenize = (expr: string): string[] => {
    const tokens: string[] = [];
    let i = 0;
    while (i < expr.length) {
      if (/\s/.test(expr[i])) {
        i++;
        continue;
      }
      if (/[0-9.]/.test(expr[i])) {
        let num = "";
        while (i < expr.length && /[0-9.eE\-+]/.test(expr[i])) {
          if (
            (expr[i] === "-" || expr[i] === "+") &&
            num.length > 0 &&
            !/[eE]/.test(num[num.length - 1])
          )
            break;
          num += expr[i++];
        }
        tokens.push(num);
      } else if (expr[i] === "$") {
        let varName = "$";
        i++;
        while (i < expr.length && /[a-zA-Z]/.test(expr[i])) varName += expr[i++];
        tokens.push(varName);
      } else if (/[a-z]/i.test(expr[i])) {
        let fn = "";
        while (i < expr.length && /[a-z0-9]/i.test(expr[i])) fn += expr[i++];
        tokens.push(fn);
      } else {
        tokens.push(expr[i++]);
      }
    }
    return tokens;
  };

  // 递归下降解析器
  const createEvaluator = (tokens: string[]) => {
    let pos = 0;

    const peek = () => tokens[pos] ?? "";
    const consume = (expected?: string) => {
      if (expected && tokens[pos] !== expected) {
        throw new Error(`Expected '${expected}' at position ${pos}`);
      }
      return tokens[pos++];
    };

    const parseExpr = (pixelVal: number): number => {
      let left = parseTerm(pixelVal);
      while (peek() === "+" || peek() === "-") {
        const op = consume();
        const right = parseTerm(pixelVal);
        left = op === "+" ? left + right : left - right;
      }
      return left;
    };

    const parseTerm = (pixelVal: number): number => {
      let left = parsePower(pixelVal);
      while (peek() === "*" || peek() === "/") {
        const op = consume();
        const right = parsePower(pixelVal);
        left = op === "*" ? left * right : left / (right || 1e-10);
      }
      return left;
    };

    const parsePower = (pixelVal: number): number => {
      let base = parseUnary(pixelVal);
      while (peek() === "^") {
        consume();
        const exp = parseUnary(pixelVal);
        base = Math.pow(base, exp);
      }
      return base;
    };

    const parseUnary = (pixelVal: number): number => {
      if (peek() === "-") {
        consume();
        return -parseAtom(pixelVal);
      }
      return parseAtom(pixelVal);
    };

    const parseAtom = (pixelVal: number): number => {
      const tok = peek();

      // 数字
      if (/^[0-9.]/.test(tok)) {
        consume();
        return parseFloat(tok);
      }

      // 变量
      if (tok === "$T") {
        consume();
        return pixelVal;
      }
      if (tok === "$mean") {
        consume();
        return pMean;
      }
      if (tok === "$median") {
        consume();
        return pMedian;
      }
      if (tok === "$min") {
        consume();
        return pMin;
      }
      if (tok === "$max") {
        consume();
        return pMax;
      }

      // 括号
      if (tok === "(") {
        consume("(");
        const val = parseExpr(pixelVal);
        consume(")");
        return val;
      }

      // 函数
      const fnName = consume();
      consume("(");
      const arg1 = parseExpr(pixelVal);
      let arg2: number | undefined;
      if (peek() === ",") {
        consume(",");
        arg2 = parseExpr(pixelVal);
      }
      consume(")");

      switch (fnName) {
        case "min":
          return Math.min(arg1, arg2 ?? arg1);
        case "max":
          return Math.max(arg1, arg2 ?? arg1);
        case "abs":
          return Math.abs(arg1);
        case "sqrt":
          return Math.sqrt(Math.max(0, arg1));
        case "log":
          return Math.log1p(Math.max(0, arg1));
        case "ln":
          return Math.log(Math.max(1e-10, arg1));
        case "log10":
          return Math.log10(Math.max(1e-10, arg1));
        case "exp":
          return Math.exp(Math.min(20, arg1));
        case "sin":
          return Math.sin(arg1);
        case "cos":
          return Math.cos(arg1);
        case "atan2":
          return Math.atan2(arg1, arg2 ?? 0);
        case "clamp":
          return Math.max(0, Math.min(arg2 ?? 1, arg1));
        case "pow":
          return Math.pow(Math.max(0, arg1), arg2 ?? 1);
        case "avg":
          return arg2 !== undefined ? (arg1 + arg2) / 2 : arg1;
        case "round":
          return Math.round(arg1 * (arg2 ?? 1)) / (arg2 ?? 1);
        case "floor":
          return Math.floor(arg1);
        case "ceil":
          return Math.ceil(arg1);
        case "iif": {
          // iif(condition, trueVal) — condition > 0 returns trueVal, else 0
          return arg1 > 0 ? (arg2 ?? 1) : 0;
        }
        default:
          throw new Error(`Unknown function: ${fnName}`);
      }
    };

    return (pixelVal: number): number => {
      pos = 0;
      return parseExpr(pixelVal);
    };
  };

  const tokens = tokenize(expression);
  const evaluate = createEvaluator(tokens);

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    try {
      result[i] = evaluate(pixels[i]);
    } catch {
      result[i] = pixels[i];
    }
  }

  return result;
}

// ===== Deconvolution (Richardson-Lucy) =====

/**
 * Richardson-Lucy 去卷积
 * psfSigma: PSF 高斯宽度
 * iterations: 迭代次数（num_iter）
 * regularization: 兼容参数，映射为 filter_epsilon（避免除零）
 * options.clip: 对输出做 [-1, 1] 裁剪（与 scikit-image 一致）
 */
export function richardsonLucy(
  pixels: Float32Array,
  width: number,
  height: number,
  psfSigma: number = 2.0,
  iterations: number = 20,
  regularization: number = 0.1,
  options?: { filterEpsilon?: number; clip?: boolean },
): Float32Array {
  psfSigma = Math.max(0.3, Math.min(10, psfSigma));
  iterations = Math.max(0, Math.min(200, Math.round(iterations)));
  const filterEpsilon = Math.max(0, options?.filterEpsilon ?? regularization);
  const clip = options?.clip ?? false;
  const n = width * height;

  if (iterations === 0) return new Float32Array(pixels);

  // Richardson-Lucy 要求非负输入，先平移到正域
  let minVal = Infinity;
  for (let i = 0; i < n; i++) {
    if (pixels[i] < minVal) minVal = pixels[i];
  }
  const offset = minVal < 0 ? -minVal : 0;

  const observed = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    observed[i] = Math.max(0, pixels[i] + offset);
  }

  // 初始估计
  const estimate = new Float32Array(observed);
  const tiny = 1e-12;

  for (let iter = 0; iter < iterations; iter++) {
    // 正向卷积: conv(estimate, psf)
    const blurred = gaussianBlur(estimate, width, height, psfSigma);
    const ratio = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const denom = blurred[i];
      ratio[i] = denom > filterEpsilon ? observed[i] / Math.max(denom, tiny) : 0;
    }

    // 反向卷积（高斯核对称）
    const correction = gaussianBlur(ratio, width, height, psfSigma);
    for (let i = 0; i < n; i++) {
      estimate[i] = Math.max(0, estimate[i] * correction[i]);
    }
  }

  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = estimate[i] - offset;
    if (clip) v = Math.max(-1, Math.min(1, v));
    result[i] = v;
  }
  return result;
}

/**
 * Dynamic Background Extraction (DBE)
 * 在规则采样网格上做 sigma-clip，估计背景并减除
 */
export function dynamicBackgroundExtract(
  pixels: Float32Array,
  width: number,
  height: number,
  samplesX: number = 12,
  samplesY: number = 8,
  sigma: number = 2.5,
): Float32Array {
  const sx = Math.max(2, Math.min(64, Math.round(samplesX)));
  const sy = Math.max(2, Math.min(64, Math.round(samplesY)));
  const background = buildBackgroundModel(pixels, width, height, sx, sy, Math.max(0.5, sigma));
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = pixels[i] - background[i];
  return out;
}

/**
 * Multiscale denoise (a trous wavelet thresholding)
 */
export function multiscaleDenoise(
  pixels: Float32Array,
  width: number,
  height: number,
  layers: number = 4,
  threshold: number = 2.5,
): Float32Array {
  const n = width * height;
  const lv = Math.max(1, Math.min(8, Math.round(layers)));
  const k = Math.max(0.1, Math.min(10, threshold));
  let current: Float32Array<ArrayBufferLike> = new Float32Array(pixels);
  const details: Float32Array[] = [];

  for (let s = 0; s < lv; s++) {
    const smooth = atrousSmooth(current, width, height, s);
    const detail = new Float32Array(n);
    for (let i = 0; i < n; i++) detail[i] = current[i] - smooth[i];
    details.push(detail);
    current = smooth;
  }

  const out = new Float32Array(n);
  out.set(current);
  for (let s = 0; s < details.length; s++) {
    const d = details[s];
    const absVals = new Float32Array(n);
    for (let i = 0; i < n; i++) absVals[i] = Math.abs(d[i]);
    const noise = quickSelect(absVals, 0, n - 1, Math.floor(n / 2)) / 0.6745;
    const th = noise * k;
    for (let i = 0; i < n; i++) {
      const v = d[i];
      const a = Math.abs(v);
      out[i] += a <= th ? 0 : Math.sign(v) * (a - th);
    }
  }

  return out;
}

/**
 * Local contrast enhancement (unsharp large-scale blend)
 */
export function localContrastEnhancement(
  pixels: Float32Array,
  width: number,
  height: number,
  sigma: number = 8,
  amount: number = 0.35,
): Float32Array {
  const blur = gaussianBlur(pixels, width, height, Math.max(0.5, sigma));
  const gain = Math.max(0, Math.min(2, amount));
  const out = new Float32Array(pixels.length);
  for (let i = 0; i < pixels.length; i++) {
    out[i] = pixels[i] + (pixels[i] - blur[i]) * gain;
  }
  return out;
}

/**
 * 基于星点检测估计用于去卷积的 PSF sigma
 */
export function estimatePSFSigma(
  pixels: Float32Array,
  width: number,
  height: number,
  maxSamples: number = 50,
): number {
  const stars = detectStars(pixels, width, height, { maxStars: maxSamples });
  if (stars.length === 0) return 2;
  const fwhms = stars.map((s) => s.fwhm).sort((a, b) => a - b);
  const medianFwhm = fwhms[Math.floor(fwhms.length / 2)];
  return Math.max(0.5, Math.min(8, medianFwhm / 2.3548));
}

/**
 * 基于星点掩膜的缩星
 */
export function starReduction(
  pixels: Float32Array,
  width: number,
  height: number,
  scale: number = 1.2,
  strength: number = 0.6,
): Float32Array {
  const mask = generateStarMask(pixels, width, height, Math.max(0.3, scale));
  const reducedCore = morphErode(pixels, width, height, 1);
  const out = new Float32Array(pixels.length);
  const k = Math.max(0, Math.min(1, strength));
  for (let i = 0; i < out.length; i++) {
    const m = Math.max(0, Math.min(1, mask[i])) * k;
    out[i] = pixels[i] * (1 - m) + reducedCore[i] * m;
  }
  return out;
}

/**
 * 自动 PSF 估计 + Richardson-Lucy 去卷积
 */
export function deconvolutionAuto(
  pixels: Float32Array,
  width: number,
  height: number,
  iterations: number = 20,
  regularization: number = 0.1,
): Float32Array {
  const psfSigma = estimatePSFSigma(pixels, width, height);
  return richardsonLucy(pixels, width, height, psfSigma, iterations, regularization);
}

// ===== 操作类型定义 =====

export type ScientificImageOperation =
  | { type: "rotate90cw" }
  | { type: "rotate90ccw" }
  | { type: "rotate180" }
  | { type: "flipH" }
  | { type: "flipV" }
  | { type: "invert" }
  | { type: "blur"; sigma: number }
  | { type: "sharpen"; amount: number; sigma: number }
  | { type: "denoise"; radius: number }
  | { type: "histogramEq" }
  | { type: "crop"; x: number; y: number; width: number; height: number }
  | { type: "brightness"; amount: number }
  | { type: "contrast"; factor: number }
  | { type: "gamma"; gamma: number }
  | {
      type: "levels";
      inputBlack: number;
      inputWhite: number;
      gamma: number;
      outputBlack: number;
      outputWhite: number;
    }
  | { type: "rotateArbitrary"; angle: number }
  | { type: "backgroundExtract"; gridSize: number }
  | { type: "mtf"; midtone: number; shadowsClip: number; highlightsClip: number }
  | { type: "starMask"; scale: number; invert: boolean }
  | { type: "binarize"; threshold: number }
  | { type: "rescale" }
  | { type: "clahe"; tileSize: number; clipLimit: number }
  | { type: "curves"; points: { x: number; y: number }[] }
  | { type: "morphology"; operation: "erode" | "dilate" | "open" | "close"; radius: number }
  | { type: "hdr"; layers: number; amount: number }
  | { type: "rangeMask"; low: number; high: number; fuzziness: number }
  | { type: "pixelMath"; expression: string }
  | { type: "deconvolution"; psfSigma: number; iterations: number; regularization: number }
  | { type: "dbe"; samplesX: number; samplesY: number; sigma: number }
  | { type: "multiscaleDenoise"; layers: number; threshold: number }
  | { type: "localContrast"; sigma: number; amount: number }
  | { type: "starReduction"; scale: number; strength: number }
  | { type: "deconvolutionAuto"; iterations: number; regularization: number };

export type ColorImageOperation =
  | { type: "scnr"; method: "averageNeutral" | "maximumNeutral"; amount: number }
  | { type: "colorCalibration"; percentile: number }
  | { type: "saturation"; amount: number }
  | { type: "colorBalance"; redGain: number; greenGain: number; blueGain: number };

export type ImageEditOperation = ScientificImageOperation | ColorImageOperation;

/**
 * 应用编辑操作到像素数据
 */
export function applyOperation(
  pixels: Float32Array,
  width: number,
  height: number,
  op: ScientificImageOperation,
): { pixels: Float32Array; width: number; height: number } {
  switch (op.type) {
    case "rotate90cw":
      return rotate90CW(pixels, width, height);
    case "rotate90ccw":
      return rotate90CCW(pixels, width, height);
    case "rotate180":
      return rotate180(pixels, width, height);
    case "flipH":
      return { pixels: flipHorizontal(pixels, width, height), width, height };
    case "flipV":
      return { pixels: flipVertical(pixels, width, height), width, height };
    case "invert":
      return { pixels: invertPixels(pixels), width, height };
    case "blur":
      return { pixels: gaussianBlur(pixels, width, height, op.sigma), width, height };
    case "sharpen":
      return { pixels: sharpen(pixels, width, height, op.amount, op.sigma), width, height };
    case "denoise":
      return { pixels: medianFilter(pixels, width, height, op.radius), width, height };
    case "histogramEq":
      return { pixels: histogramEqualize(pixels), width, height };
    case "crop":
      return cropImage(pixels, width, op.x, op.y, op.width, op.height);
    case "brightness":
      return { pixels: adjustBrightness(pixels, op.amount), width, height };
    case "contrast":
      return { pixels: adjustContrast(pixels, op.factor), width, height };
    case "gamma":
      return { pixels: adjustGamma(pixels, op.gamma), width, height };
    case "levels":
      return {
        pixels: applyLevels(
          pixels,
          op.inputBlack,
          op.inputWhite,
          op.gamma,
          op.outputBlack,
          op.outputWhite,
        ),
        width,
        height,
      };
    case "rotateArbitrary":
      return rotateArbitrary(pixels, width, height, op.angle);
    case "backgroundExtract":
      return { pixels: extractBackground(pixels, width, height, op.gridSize), width, height };
    case "mtf":
      return {
        pixels: applyMTF(pixels, op.midtone, op.shadowsClip, op.highlightsClip),
        width,
        height,
      };
    case "starMask":
      return { pixels: applyStarMask(pixels, width, height, op.scale, op.invert), width, height };
    case "binarize":
      return { pixels: binarize(pixels, op.threshold), width, height };
    case "rescale":
      return { pixels: rescalePixels(pixels), width, height };
    case "clahe":
      return { pixels: clahe(pixels, width, height, op.tileSize, op.clipLimit), width, height };
    case "curves":
      return { pixels: applyCurves(pixels, op.points), width, height };
    case "morphology":
      return {
        pixels: morphologicalOp(pixels, width, height, op.operation, op.radius),
        width,
        height,
      };
    case "hdr":
      return {
        pixels: hdrMultiscaleTransform(pixels, width, height, op.layers, op.amount),
        width,
        height,
      };
    case "rangeMask":
      return { pixels: applyRangeMask(pixels, op.low, op.high, op.fuzziness), width, height };
    case "pixelMath":
      return { pixels: evaluatePixelExpression(pixels, op.expression), width, height };
    case "deconvolution":
      return {
        pixels: richardsonLucy(
          pixels,
          width,
          height,
          op.psfSigma,
          op.iterations,
          op.regularization,
        ),
        width,
        height,
      };
    case "dbe":
      return {
        pixels: dynamicBackgroundExtract(pixels, width, height, op.samplesX, op.samplesY, op.sigma),
        width,
        height,
      };
    case "multiscaleDenoise":
      return {
        pixels: multiscaleDenoise(pixels, width, height, op.layers, op.threshold),
        width,
        height,
      };
    case "localContrast":
      return {
        pixels: localContrastEnhancement(pixels, width, height, op.sigma, op.amount),
        width,
        height,
      };
    case "starReduction":
      return {
        pixels: starReduction(pixels, width, height, op.scale, op.strength),
        width,
        height,
      };
    case "deconvolutionAuto":
      return {
        pixels: deconvolutionAuto(pixels, width, height, op.iterations, op.regularization),
        width,
        height,
      };
  }
}
