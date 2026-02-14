/**
 * 图像编辑操作函数库
 * 提供像素级的图像变换操作：旋转、翻转、裁剪、反转、模糊、锐化、降噪、直方图均衡
 */

import { quickSelect } from "./pixelMath";

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
 * 简化版自动背景提取 (ABE)
 * 将图像分为 NxN 网格，对每格取中值作为背景采样点，
 * 使用 sigma clipping 剔除含星点的采样点，双线性插值生成背景模型并减除
 */
export function extractBackground(
  pixels: Float32Array,
  width: number,
  height: number,
  gridSize: number = 8,
): Float32Array {
  const cellW = Math.floor(width / gridSize);
  const cellH = Math.floor(height / gridSize);
  const samples = new Float32Array(gridSize * gridSize);

  // 对每个网格计算中值
  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const startX = gx * cellW;
      const startY = gy * cellH;
      const w = Math.min(cellW, width - startX);
      const h = Math.min(cellH, height - startY);
      const cellPixels = new Float32Array(w * h);
      let idx = 0;
      for (let y = startY; y < startY + h; y++) {
        for (let x = startX; x < startX + w; x++) {
          cellPixels[idx++] = pixels[y * width + x];
        }
      }
      // 取中值
      samples[gy * gridSize + gx] = quickSelect(cellPixels, 0, idx - 1, Math.floor(idx / 2));
    }
  }

  // Sigma clipping 剔除星点区域采样
  let sum = 0,
    count = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i];
    count++;
  }
  const mean = sum / count;
  let sqSum = 0;
  for (let i = 0; i < samples.length; i++) sqSum += (samples[i] - mean) ** 2;
  const stddev = Math.sqrt(sqSum / count);
  const sigmaThresh = 2.0;

  // 将离群采样点替换为均值
  for (let i = 0; i < samples.length; i++) {
    if (Math.abs(samples[i] - mean) > sigmaThresh * stddev) {
      samples[i] = mean;
    }
  }

  // 双线性插值生成全尺寸背景模型
  const background = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // 映射到网格坐标
      const gxf = (x / width) * (gridSize - 1);
      const gyf = (y / height) * (gridSize - 1);
      const gx0 = Math.min(Math.floor(gxf), gridSize - 2);
      const gy0 = Math.min(Math.floor(gyf), gridSize - 2);
      const fx = gxf - gx0;
      const fy = gyf - gy0;

      const v00 = samples[gy0 * gridSize + gx0];
      const v10 = samples[gy0 * gridSize + gx0 + 1];
      const v01 = samples[(gy0 + 1) * gridSize + gx0];
      const v11 = samples[(gy0 + 1) * gridSize + gx0 + 1];
      background[y * width + x] =
        v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
    }
  }

  // 减除背景
  const result = new Float32Array(width * height);
  for (let i = 0; i < result.length; i++) {
    result[i] = pixels[i] - background[i];
  }
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

// ===== 操作类型定义 =====

export type ImageEditOperation =
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
  | { type: "backgroundExtract"; gridSize: number };

/**
 * 应用编辑操作到像素数据
 */
export function applyOperation(
  pixels: Float32Array,
  width: number,
  height: number,
  op: ImageEditOperation,
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
  }
}
