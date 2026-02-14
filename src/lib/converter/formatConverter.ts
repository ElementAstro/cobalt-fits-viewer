/**
 * 格式转换核心引擎
 * FITS → PNG/JPEG/WebP/TIFF/BMP 及反向转换
 */

import type { ConvertOptions, StretchType, ColormapType } from "../fits/types";
import { computeZScale, computePercentile } from "../utils/pixelMath";

// ===== 像素拉伸算法 =====

/**
 * 对像素数据应用拉伸算法，输出 0-1 范围的归一化数据
 */
export function applyStretch(
  pixels: Float32Array,
  type: StretchType,
  blackPoint: number = 0,
  whitePoint: number = 1,
  gamma: number = 1,
): Float32Array {
  const [rawMin, rawMax] = getExtent(pixels);
  const range = rawMax - rawMin;
  if (range === 0) return new Float32Array(pixels.length).fill(0.5);

  const result = new Float32Array(pixels.length);

  // For zscale/percentile, override black/white points from data
  let bp: number, wp: number;
  if (type === "zscale") {
    const { z1, z2 } = computeZScale(pixels);
    bp = z1;
    wp = z2;
  } else if (type === "percentile") {
    const { z1, z2 } = computePercentile(pixels, 1, 99);
    bp = z1;
    wp = z2;
  } else {
    bp = rawMin + blackPoint * range;
    wp = rawMin + whitePoint * range;
  }
  const span = wp - bp;

  for (let i = 0; i < pixels.length; i++) {
    let v = (pixels[i] - bp) / span;
    v = Math.max(0, Math.min(1, v));

    switch (type) {
      case "linear":
        break;
      case "sqrt":
        v = Math.sqrt(v);
        break;
      case "log":
        v = Math.log1p(v * 1000) / Math.log1p(1000);
        break;
      case "asinh":
        v = Math.asinh(v * 10) / Math.asinh(10);
        break;
      case "power":
        v = Math.pow(v, 0.5);
        break;
      case "zscale":
        break; // Z-scale adjusts bp/wp before the loop (see applyStretch preprocess)
      case "minmax":
        break; // Already normalized
      case "percentile":
        break; // Percentile adjusts bp/wp before the loop (see applyStretch preprocess)
    }

    if (gamma !== 1 && gamma > 0) {
      v = Math.pow(v, 1 / gamma);
    }

    result[i] = Math.max(0, Math.min(1, v));
  }

  return result;
}

// ===== 色彩映射 =====

const LUT_SIZE = 4096;
const lutCache = new Map<ColormapType, Uint8Array>();

/**
 * 构建或获取预计算 LUT（4096 档位，每档 3 字节 RGB）
 * 比原来的 256 档位精度提升 16 倍，消除色带效应
 */
function getColormapLUT(colormap: ColormapType): Uint8Array {
  let lut = lutCache.get(colormap);
  if (lut) return lut;

  lut = new Uint8Array(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i++) {
    const v = i / (LUT_SIZE - 1);
    const [r, g, b] = colormapLookup(v, colormap);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  lutCache.set(colormap, lut);
  return lut;
}

/**
 * 将归一化的灰度值映射为 RGBA 颜色
 * 使用预计算 LUT（4096 档位）提升精度和性能
 * 返回 Uint8ClampedArray (length = pixels * 4)
 */
export function applyColormap(
  normalized: Float32Array,
  colormap: ColormapType,
  width: number,
  height: number,
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const lut = getColormapLUT(colormap);
  const lutMax = LUT_SIZE - 1;

  for (let i = 0; i < normalized.length; i++) {
    const idx = Math.round(Math.max(0, Math.min(1, normalized[i])) * lutMax);
    const lutOff = idx * 3;
    const offset = i * 4;
    rgba[offset] = lut[lutOff];
    rgba[offset + 1] = lut[lutOff + 1];
    rgba[offset + 2] = lut[lutOff + 2];
    rgba[offset + 3] = 255;
  }

  return rgba;
}

/**
 * 色彩映射查找表
 */
function colormapLookup(v: number, colormap: ColormapType): [number, number, number] {
  const byte = Math.round(v * 255);

  switch (colormap) {
    case "grayscale":
      return [byte, byte, byte];
    case "inverted":
      return [255 - byte, 255 - byte, 255 - byte];
    case "red":
      return [byte, 0, 0];
    case "green":
      return [0, byte, 0];
    case "blue":
      return [0, 0, byte];
    case "heat":
      return heatmap(v);
    case "cool":
      return coolmap(v);
    case "thermal":
      return thermalmap(v);
    case "rainbow":
      return rainbowmap(v);
    case "jet":
      return jetmap(v);
    case "viridis":
      return viridisApprox(v);
    case "plasma":
      return plasmaApprox(v);
    case "magma":
      return magmaApprox(v);
    case "inferno":
      return infernoApprox(v);
    case "cividis":
      return cividisApprox(v);
    case "cubehelix":
      return cubehelixmap(v);
    default:
      return [byte, byte, byte];
  }
}

function heatmap(v: number): [number, number, number] {
  return [
    Math.round(Math.min(1, v * 3) * 255),
    Math.round(Math.min(1, Math.max(0, v * 3 - 1)) * 255),
    Math.round(Math.min(1, Math.max(0, v * 3 - 2)) * 255),
  ];
}

function coolmap(v: number): [number, number, number] {
  return [Math.round((1 - v) * 255), Math.round(v * 255), 255];
}

function rainbowmap(v: number): [number, number, number] {
  const h = v * 300; // 0-300 degrees (red to blue)
  return hslToRgb(h / 360, 1, 0.5);
}

function viridisApprox(v: number): [number, number, number] {
  return [
    Math.round((0.267 + v * (0.993 - 0.267 * v)) * 255 * v),
    Math.round((0.004 + v * (0.906 - 0.159 * v)) * 255),
    Math.round((0.329 + v * (0.141 + 0.53 * (1 - v))) * 255),
  ];
}

function thermalmap(v: number): [number, number, number] {
  // Black → Blue → Magenta → Red → Yellow → White
  if (v < 0.25) {
    const t = v / 0.25;
    return [0, 0, Math.round(t * 255)];
  } else if (v < 0.5) {
    const t = (v - 0.25) / 0.25;
    return [Math.round(t * 255), 0, 255];
  } else if (v < 0.75) {
    const t = (v - 0.5) / 0.25;
    return [255, 0, Math.round((1 - t) * 255)];
  } else {
    const t = (v - 0.75) / 0.25;
    return [255, Math.round(t * 255), Math.round(t * 255)];
  }
}

function jetmap(v: number): [number, number, number] {
  // Blue → Cyan → Green → Yellow → Red
  let r: number, g: number, b: number;
  if (v < 0.125) {
    r = 0;
    g = 0;
    b = 0.5 + v * 4;
  } else if (v < 0.375) {
    r = 0;
    g = (v - 0.125) * 4;
    b = 1;
  } else if (v < 0.625) {
    r = (v - 0.375) * 4;
    g = 1;
    b = 1 - (v - 0.375) * 4;
  } else if (v < 0.875) {
    r = 1;
    g = 1 - (v - 0.625) * 4;
    b = 0;
  } else {
    r = 1 - (v - 0.875) * 4 * 0.5;
    g = 0;
    b = 0;
  }
  return [
    Math.round(Math.min(1, Math.max(0, r)) * 255),
    Math.round(Math.min(1, Math.max(0, g)) * 255),
    Math.round(Math.min(1, Math.max(0, b)) * 255),
  ];
}

function plasmaApprox(v: number): [number, number, number] {
  // Approximation of matplotlib plasma colormap
  const r = Math.min(1, Math.max(0, 0.05 + v * (2.74 - v * 2.81 + v * v * 0.99)));
  const g = Math.min(1, Math.max(0, v < 0.4 ? 0.03 + v * 0.25 : -0.4 + v * 1.8 - v * v * 0.6));
  const b = Math.min(1, Math.max(0, 0.53 + v * (0.65 - v * 2.5 + v * v * 1.8)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function magmaApprox(v: number): [number, number, number] {
  // Approximation of matplotlib magma colormap
  const r = Math.min(1, Math.max(0, v < 0.5 ? v * 1.8 : 0.55 + (v - 0.5) * 0.9));
  const g = Math.min(1, Math.max(0, v < 0.4 ? v * 0.15 : -0.22 + v * 1.3 - v * v * 0.2));
  const b = Math.min(1, Math.max(0, v < 0.6 ? 0.02 + v * 1.3 : 0.8 - (v - 0.6) * 1.5));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function infernoApprox(v: number): [number, number, number] {
  // Approximation of matplotlib inferno colormap
  const r = Math.min(1, Math.max(0, v < 0.45 ? v * 2.0 : 0.5 + (v - 0.45) * 0.91));
  const g = Math.min(1, Math.max(0, v < 0.5 ? v * 0.3 : -0.35 + v * 1.6 - v * v * 0.35));
  const b = Math.min(1, Math.max(0, v < 0.5 ? 0.01 + v * 1.2 : 0.61 - (v - 0.5) * 1.22));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function cividisApprox(v: number): [number, number, number] {
  // Approximation of matplotlib cividis colormap (colorblind-friendly)
  const r = Math.min(1, Math.max(0, 0.0 + v * 0.93));
  const g = Math.min(1, Math.max(0, 0.13 + v * 0.63));
  const b = Math.min(1, Math.max(0, 0.34 + v * (0.2 - v * 0.4)));
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function cubehelixmap(v: number): [number, number, number] {
  // Green's cubehelix color scheme
  const start = 0.5;
  const rotations = -1.5;
  const hue = 1.0;
  const gamma = 1.0;
  const vg = Math.pow(v, gamma);
  const a = (hue * vg * (1 - vg)) / 2;
  const phi = 2 * Math.PI * (start / 3 + rotations * v);
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const r = vg + a * (-0.14861 * cosPhi + 1.78277 * sinPhi);
  const g = vg + a * (-0.29227 * cosPhi - 0.90649 * sinPhi);
  const b = vg + a * (1.97294 * cosPhi);
  return [
    Math.round(Math.min(1, Math.max(0, r)) * 255),
    Math.round(Math.min(1, Math.max(0, g)) * 255),
    Math.round(Math.min(1, Math.max(0, b)) * 255),
  ];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h * 6) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  const hue = h * 6;
  if (hue < 1) {
    r = c;
    g = x;
  } else if (hue < 2) {
    r = x;
    g = c;
  } else if (hue < 3) {
    g = c;
    b = x;
  } else if (hue < 4) {
    g = x;
    b = c;
  } else if (hue < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

// ===== 转换管线 =====

/**
 * 将 FITS 像素数据转换为 RGBA 图像数据
 */
export function fitsToRGBA(
  pixels: Float32Array,
  width: number,
  height: number,
  options: Pick<ConvertOptions, "stretch" | "colormap" | "blackPoint" | "whitePoint" | "gamma">,
): Uint8ClampedArray {
  const stretched = applyStretch(
    pixels,
    options.stretch,
    options.blackPoint,
    options.whitePoint,
    options.gamma ?? 1,
  );
  return applyColormap(stretched, options.colormap, width, height);
}

/**
 * 估算转换后文件大小 (bytes)
 */
export function estimateFileSize(width: number, height: number, options: ConvertOptions): number {
  const totalPixels = width * height;

  switch (options.format) {
    case "png":
      return Math.round(totalPixels * 3 * 0.5); // PNG ~ 50% of raw
    case "jpeg":
      return Math.round(totalPixels * 3 * (options.quality / 100) * 0.15);
    case "webp":
      return Math.round(totalPixels * 3 * (options.quality / 100) * 0.1);
    case "tiff": {
      const bytesPerPixel = options.bitDepth / 8;
      return totalPixels * bytesPerPixel;
    }
    case "bmp":
      return totalPixels * 3 + 54; // 24-bit BMP + header
    default:
      return totalPixels * 3;
  }
}

// ===== Helpers =====

function getExtent(pixels: Float32Array): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [min, max];
}
