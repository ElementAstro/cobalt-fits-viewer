/**
 * CFA 去马赛克 (Debayer)
 * 支持 RGGB, BGGR, GRBG, GBRG 模式
 * 三种插值算法: Bilinear, VNG, SuperPixel
 */

export type BayerPattern = "RGGB" | "BGGR" | "GRBG" | "GBRG";
export type DebayerMethod = "bilinear" | "vng" | "superPixel";

export interface DebayerResult {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
  width: number;
  height: number;
}

/**
 * 获取 Bayer 模式中 (x%2, y%2) 位置对应的颜色通道
 * 返回 0=R, 1=G, 2=B
 */
function bayerColor(pattern: BayerPattern, x: number, y: number): number {
  const px = x & 1;
  const py = y & 1;
  switch (pattern) {
    case "RGGB":
      if (px === 0 && py === 0) return 0;
      if (px === 1 && py === 1) return 2;
      return 1;
    case "BGGR":
      if (px === 0 && py === 0) return 2;
      if (px === 1 && py === 1) return 0;
      return 1;
    case "GRBG":
      if (px === 1 && py === 0) return 0;
      if (px === 0 && py === 1) return 2;
      return 1;
    case "GBRG":
      if (px === 0 && py === 0) return 1;
      if (px === 1 && py === 0) return 2;
      if (px === 0 && py === 1) return 0;
      return 1;
  }
}

/**
 * 安全取像素值 (边界镜像)
 */
function getPixel(raw: Float32Array, width: number, height: number, x: number, y: number): number {
  const cx = Math.max(0, Math.min(width - 1, x));
  const cy = Math.max(0, Math.min(height - 1, y));
  return raw[cy * width + cx];
}

/**
 * 双线性插值去马赛克
 * 对每个缺失通道，用相邻同色像素的平均值填充
 */
function debayerBilinear(
  raw: Float32Array,
  width: number,
  height: number,
  pattern: BayerPattern,
): DebayerResult {
  const n = width * height;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const color = bayerColor(pattern, x, y);
      const val = raw[idx];

      if (color === 0) {
        // R pixel
        r[idx] = val;
        g[idx] =
          (getPixel(raw, width, height, x - 1, y) +
            getPixel(raw, width, height, x + 1, y) +
            getPixel(raw, width, height, x, y - 1) +
            getPixel(raw, width, height, x, y + 1)) /
          4;
        b[idx] =
          (getPixel(raw, width, height, x - 1, y - 1) +
            getPixel(raw, width, height, x + 1, y - 1) +
            getPixel(raw, width, height, x - 1, y + 1) +
            getPixel(raw, width, height, x + 1, y + 1)) /
          4;
      } else if (color === 2) {
        // B pixel
        b[idx] = val;
        g[idx] =
          (getPixel(raw, width, height, x - 1, y) +
            getPixel(raw, width, height, x + 1, y) +
            getPixel(raw, width, height, x, y - 1) +
            getPixel(raw, width, height, x, y + 1)) /
          4;
        r[idx] =
          (getPixel(raw, width, height, x - 1, y - 1) +
            getPixel(raw, width, height, x + 1, y - 1) +
            getPixel(raw, width, height, x - 1, y + 1) +
            getPixel(raw, width, height, x + 1, y + 1)) /
          4;
      } else {
        // G pixel
        g[idx] = val;
        const _px = x & 1;
        const py = y & 1;

        // 判断 G 位于 R 行还是 B 行
        const isRRow =
          (pattern === "RGGB" && py === 0) ||
          (pattern === "GRBG" && py === 0) ||
          (pattern === "BGGR" && py === 1) ||
          (pattern === "GBRG" && py === 1);

        if (isRRow) {
          r[idx] =
            (getPixel(raw, width, height, x - 1, y) + getPixel(raw, width, height, x + 1, y)) / 2;
          b[idx] =
            (getPixel(raw, width, height, x, y - 1) + getPixel(raw, width, height, x, y + 1)) / 2;
        } else {
          b[idx] =
            (getPixel(raw, width, height, x - 1, y) + getPixel(raw, width, height, x + 1, y)) / 2;
          r[idx] =
            (getPixel(raw, width, height, x, y - 1) + getPixel(raw, width, height, x, y + 1)) / 2;
        }
      }
    }
  }

  return { r, g, b, width, height };
}

/**
 * SuperPixel 去马赛克
 * 2×2 合并，输出尺寸减半
 */
function debayerSuperPixel(
  raw: Float32Array,
  width: number,
  height: number,
  pattern: BayerPattern,
): DebayerResult {
  const newW = Math.floor(width / 2);
  const newH = Math.floor(height / 2);
  const n = newW * newH;
  const r = new Float32Array(n);
  const g = new Float32Array(n);
  const b = new Float32Array(n);

  for (let ny = 0; ny < newH; ny++) {
    for (let nx = 0; nx < newW; nx++) {
      const srcX = nx * 2;
      const srcY = ny * 2;
      const outIdx = ny * newW + nx;

      // 从 2×2 块中提取各通道
      const v00 = raw[srcY * width + srcX];
      const v10 = raw[srcY * width + srcX + 1];
      const v01 = raw[(srcY + 1) * width + srcX];
      const v11 = raw[(srcY + 1) * width + srcX + 1];

      const c00 = bayerColor(pattern, srcX, srcY);
      const c10 = bayerColor(pattern, srcX + 1, srcY);
      const c01 = bayerColor(pattern, srcX, srcY + 1);
      const c11 = bayerColor(pattern, srcX + 1, srcY + 1);

      let rSum = 0,
        gSum = 0,
        bSum = 0;
      let rCount = 0,
        gCount = 0,
        bCount = 0;

      const vals = [v00, v10, v01, v11];
      const colors = [c00, c10, c01, c11];
      for (let i = 0; i < 4; i++) {
        if (colors[i] === 0) {
          rSum += vals[i];
          rCount++;
        } else if (colors[i] === 1) {
          gSum += vals[i];
          gCount++;
        } else {
          bSum += vals[i];
          bCount++;
        }
      }

      r[outIdx] = rCount > 0 ? rSum / rCount : 0;
      g[outIdx] = gCount > 0 ? gSum / gCount : 0;
      b[outIdx] = bCount > 0 ? bSum / bCount : 0;
    }
  }

  return { r, g, b, width: newW, height: newH };
}

/**
 * VNG (Variable Number of Gradients) 去马赛克
 * 简化版: 计算 8 个方向梯度，选择梯度最小的方向进行插值
 */
function debayerVNG(
  raw: Float32Array,
  width: number,
  height: number,
  pattern: BayerPattern,
): DebayerResult {
  // 先用双线性作为基础
  const result = debayerBilinear(raw, width, height, pattern);

  // 对内部像素用 VNG 细化绿色通道
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const color = bayerColor(pattern, x, y);
      if (color === 1) continue; // 已经是 G，跳过

      // 计算 8 个方向的梯度
      const idx = y * width + x;
      const gradients: number[] = [];
      const gValues: number[] = [];

      // 方向: N, NE, E, SE, S, SW, W, NW
      const dirs = [
        [0, -1],
        [1, -1],
        [1, 0],
        [1, 1],
        [0, 1],
        [-1, 1],
        [-1, 0],
        [-1, -1],
      ];

      for (const [dx, dy] of dirs) {
        const nx1 = x + dx;
        const ny1 = y + dy;
        const nx2 = x + dx * 2;
        const ny2 = y + dy * 2;

        const v0 = raw[idx];
        const v1 = getPixel(raw, width, height, nx1, ny1);
        const v2 = getPixel(raw, width, height, nx2, ny2);

        const grad = Math.abs(v0 - v2) + Math.abs(v1 - (v0 + v2) * 0.5);
        gradients.push(grad);
        gValues.push(v1);
      }

      // 选择梯度最小的 4 个方向求平均
      const sorted = gradients.map((g, i) => ({ g, v: gValues[i] })).sort((a, b) => a.g - b.g);

      const threshold = sorted[0].g * 1.5 + 1e-10;
      let sum = 0;
      let count = 0;
      for (const { g, v } of sorted) {
        if (g <= threshold || count < 2) {
          sum += v;
          count++;
        }
      }

      result.g[idx] = count > 0 ? sum / count : result.g[idx];
    }
  }

  return result;
}

/**
 * CFA 去马赛克主函数
 */
export function debayer(
  raw: Float32Array,
  width: number,
  height: number,
  pattern: BayerPattern = "RGGB",
  method: DebayerMethod = "bilinear",
): DebayerResult {
  switch (method) {
    case "superPixel":
      return debayerSuperPixel(raw, width, height, pattern);
    case "vng":
      return debayerVNG(raw, width, height, pattern);
    case "bilinear":
    default:
      return debayerBilinear(raw, width, height, pattern);
  }
}
