/**
 * 格式转换核心引擎
 * FITS → PNG/JPEG/WebP/TIFF/BMP 及反向转换
 */

import type {
  ColormapType,
  ConvertOptions,
  ProcessingAlgorithmProfile,
  StretchType,
  ViewerCurvePreset,
} from "../fits/types";
import { computeZScale, computePercentile } from "../utils/pixelMath";
import {
  MATPLOTLIB_LISTED_COLORMAPS,
  type ListedMatplotlibColormapName,
} from "./mplListedColormaps";

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
  outputBlack: number = 0,
  outputWhite: number = 1,
  brightness: number = 0,
  contrast: number = 1,
  mtfMidtone: number = 0.5,
  curvePreset: ViewerCurvePreset = "linear",
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

    // Apply output levels mapping
    if (outputBlack !== 0 || outputWhite !== 1) {
      v = outputBlack + v * (outputWhite - outputBlack);
    }

    v = applyViewerTone(v, brightness, contrast, mtfMidtone, curvePreset);
    result[i] = Math.max(0, Math.min(1, v));
  }

  return result;
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function mtfTransfer(m: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (Math.abs(x - m) < 1e-6) return 0.5;
  return ((m - 1) * x) / ((2 * m - 1) * x - m);
}

function applyCurvePreset(v: number, preset: ViewerCurvePreset): number {
  switch (preset) {
    case "sCurve":
      return clamp01(v + 0.2 * (v - v * v) * (v - 0.5 > 0 ? 1 : -1));
    case "brighten":
      return clamp01(Math.pow(v, 0.82));
    case "darken":
      return clamp01(Math.pow(v, 1.2));
    case "highContrast":
      return clamp01((v - 0.5) * 1.35 + 0.5);
    case "linear":
    default:
      return v;
  }
}

function applyViewerTone(
  value: number,
  brightness: number,
  contrast: number,
  mtfMidtone: number,
  curvePreset: ViewerCurvePreset,
): number {
  let v = value;
  if (brightness !== 0) {
    v = clamp01(v + brightness);
  }
  if (contrast !== 1) {
    v = clamp01((v - 0.5) * contrast + 0.5);
  }
  if (Math.abs(mtfMidtone - 0.5) > 1e-6) {
    const m = clamp01(mtfMidtone);
    if (m > 0.001 && m < 0.999) {
      v = clamp01(mtfTransfer(m, v));
    }
  }
  return applyCurvePreset(v, curvePreset);
}

// ===== 色彩映射 =====

const LUT_SIZE = 4096;
const lutCache = new Map<string, Uint8Array>();
const MATPLOTLIB_LISTED_COLORMAP_SET = new Set<ListedMatplotlibColormapName>([
  "viridis",
  "plasma",
  "magma",
  "inferno",
  "cividis",
]);

/**
 * 构建或获取预计算 LUT（4096 档位，每档 3 字节 RGB）
 * 比原来的 256 档位精度提升 16 倍，消除色带效应
 */
function getColormapLUT(
  colormap: ColormapType,
  profile: ProcessingAlgorithmProfile = "standard",
): Uint8Array {
  const cacheKey = `${profile}:${colormap}`;
  let lut = lutCache.get(cacheKey);
  if (lut) return lut;

  lut = new Uint8Array(LUT_SIZE * 3);
  for (let i = 0; i < LUT_SIZE; i++) {
    const v = i / (LUT_SIZE - 1);
    const [r, g, b] = colormapLookup(v, colormap, profile);
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  lutCache.set(cacheKey, lut);
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
  profile: ProcessingAlgorithmProfile = "standard",
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4);
  const lut = getColormapLUT(colormap, profile);
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
function colormapLookup(
  v: number,
  colormap: ColormapType,
  profile: ProcessingAlgorithmProfile,
): [number, number, number] {
  if (
    profile === "standard" &&
    MATPLOTLIB_LISTED_COLORMAP_SET.has(colormap as ListedMatplotlibColormapName)
  ) {
    return sampleListedColormap(colormap as ListedMatplotlibColormapName, v);
  }

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

function sampleListedColormap(
  colormap: ListedMatplotlibColormapName,
  v: number,
): [number, number, number] {
  const table = MATPLOTLIB_LISTED_COLORMAPS[colormap];
  const points = table.length / 3;
  const clamped = Math.max(0, Math.min(1, v));
  const index = clamped * (points - 1);
  const i0 = Math.floor(index);
  const i1 = Math.min(points - 1, i0 + 1);
  const t = index - i0;
  const o0 = i0 * 3;
  const o1 = i1 * 3;

  const r = Math.round(table[o0] * (1 - t) + table[o1] * t);
  const g = Math.round(table[o0 + 1] * (1 - t) + table[o1 + 1] * t);
  const b = Math.round(table[o0 + 2] * (1 - t) + table[o1 + 2] * t);
  return [r, g, b];
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
type RenderConvertOptions = Pick<
  ConvertOptions,
  "stretch" | "colormap" | "blackPoint" | "whitePoint" | "gamma"
> & {
  outputBlack?: number;
  outputWhite?: number;
  brightness?: number;
  contrast?: number;
  mtfMidtone?: number;
  curvePreset?: ViewerCurvePreset;
  profile?: ProcessingAlgorithmProfile;
};

export function fitsToRGBA(
  pixels: Float32Array,
  width: number,
  height: number,
  options: RenderConvertOptions,
): Uint8ClampedArray {
  const stretched = applyStretch(
    pixels,
    options.stretch,
    options.blackPoint,
    options.whitePoint,
    options.gamma ?? 1,
    options.outputBlack ?? 0,
    options.outputWhite ?? 1,
    options.brightness ?? 0,
    options.contrast ?? 1,
    options.mtfMidtone ?? 0.5,
    options.curvePreset ?? "linear",
  );
  return applyColormap(stretched, options.colormap, width, height, options.profile ?? "standard");
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

// ===== 非阻塞分块处理 =====

const CHUNK_SIZE = 500_000;

/**
 * 让出主线程一帧，允许 UI 更新
 */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * 分块异步版 fitsToRGBA，不会长时间阻塞 JS 线程
 * 每处理 CHUNK_SIZE 个像素后让出主线程
 * 支持 AbortSignal 取消
 */
export async function fitsToRGBAChunked(
  pixels: Float32Array,
  width: number,
  height: number,
  options: RenderConvertOptions,
  signal?: AbortSignal,
): Promise<Uint8ClampedArray> {
  const n = pixels.length;

  // --- Phase 1: Compute extent (chunked) ---
  let rawMin = Infinity;
  let rawMax = -Infinity;
  for (let start = 0; start < n; start += CHUNK_SIZE) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(start + CHUNK_SIZE, n);
    for (let i = start; i < end; i++) {
      const v = pixels[i];
      if (!isNaN(v)) {
        if (v < rawMin) rawMin = v;
        if (v > rawMax) rawMax = v;
      }
    }
    if (start + CHUNK_SIZE < n) await yieldToMain();
  }

  const range = rawMax - rawMin;
  if (range === 0) {
    const rgba = new Uint8ClampedArray(n * 4);
    const lut = getColormapLUT(options.colormap, options.profile ?? "standard");
    const mid = Math.floor((LUT_SIZE - 1) / 2) * 3;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      rgba[off] = lut[mid];
      rgba[off + 1] = lut[mid + 1];
      rgba[off + 2] = lut[mid + 2];
      rgba[off + 3] = 255;
    }
    return rgba;
  }

  // --- Phase 2: Compute black/white points ---
  let bp: number, wp: number;
  if (options.stretch === "zscale") {
    const { z1, z2 } = computeZScale(pixels);
    bp = z1;
    wp = z2;
  } else if (options.stretch === "percentile") {
    const { z1, z2 } = computePercentile(pixels, 1, 99);
    bp = z1;
    wp = z2;
  } else {
    bp = rawMin + (options.blackPoint ?? 0) * range;
    wp = rawMin + (options.whitePoint ?? 1) * range;
  }
  const span = wp - bp;
  const stretchType = options.stretch;
  const gamma = options.gamma ?? 1;
  const invGamma = gamma !== 1 && gamma > 0 ? 1 / gamma : 1;
  const applyGamma = gamma !== 1 && gamma > 0;
  const outBlack = options.outputBlack ?? 0;
  const outWhite = options.outputWhite ?? 1;
  const hasOutputLevels = outBlack !== 0 || outWhite !== 1;
  const brightness = options.brightness ?? 0;
  const contrast = options.contrast ?? 1;
  const mtfMidtone = options.mtfMidtone ?? 0.5;
  const curvePreset = options.curvePreset ?? "linear";

  // --- Phase 3: Stretch + Colormap combined (chunked) ---
  const rgba = new Uint8ClampedArray(width * height * 4);
  const lut = getColormapLUT(options.colormap, options.profile ?? "standard");
  const lutMax = LUT_SIZE - 1;

  for (let start = 0; start < n; start += CHUNK_SIZE) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(start + CHUNK_SIZE, n);
    for (let i = start; i < end; i++) {
      let v = (pixels[i] - bp) / span;
      if (v < 0) v = 0;
      else if (v > 1) v = 1;

      switch (stretchType) {
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
      }

      if (applyGamma) v = Math.pow(v, invGamma);
      if (hasOutputLevels) v = outBlack + v * (outWhite - outBlack);
      v = applyViewerTone(v, brightness, contrast, mtfMidtone, curvePreset);
      if (v < 0) v = 0;
      else if (v > 1) v = 1;

      const idx = Math.round(v * lutMax) * 3;
      const off = i * 4;
      rgba[off] = lut[idx];
      rgba[off + 1] = lut[idx + 1];
      rgba[off + 2] = lut[idx + 2];
      rgba[off + 3] = 255;
    }
    if (start + CHUNK_SIZE < n) await yieldToMain();
  }

  return rgba;
}

// ===== 像素降采样 =====

/**
 * 将 Float32Array 像素数据降采样到目标尺寸
 * 用于渐进式加载：先显示低分辨率预览
 */
export function downsamplePixels(
  pixels: Float32Array,
  srcWidth: number,
  srcHeight: number,
  targetMaxDim: number,
): { pixels: Float32Array; width: number; height: number } {
  const scale = Math.min(targetMaxDim / srcWidth, targetMaxDim / srcHeight, 1);
  if (scale >= 1) return { pixels, width: srcWidth, height: srcHeight };

  const dstW = Math.max(1, Math.round(srcWidth * scale));
  const dstH = Math.max(1, Math.round(srcHeight * scale));
  const result = new Float32Array(dstW * dstH);

  for (let dy = 0; dy < dstH; dy++) {
    const sy = Math.floor(dy / scale);
    for (let dx = 0; dx < dstW; dx++) {
      const sx = Math.floor(dx / scale);
      result[dy * dstW + dx] = pixels[sy * srcWidth + sx];
    }
  }

  return { pixels: result, width: dstW, height: dstH };
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
