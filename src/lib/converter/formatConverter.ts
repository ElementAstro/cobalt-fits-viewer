/**
 * 格式转换核心引擎
 * FITS → PNG/JPEG/WebP/TIFF/BMP 及反向转换
 */

import type { ConvertOptions, ProcessingAlgorithmProfile, ViewerCurvePreset } from "../fits/types";
import {
  getExtent,
  getStretchFn,
  resolveBlackWhitePoints,
  applyViewerTone,
} from "./stretchAlgorithms";
import { getColormapLUT, LUT_SIZE } from "./colormaps";

// Re-exports to preserve existing consumer imports
export { applyStretch, applyViewerTone, getExtent } from "./stretchAlgorithms";
export { applyColormap } from "./colormaps";

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
  precomputedExtent?: [number, number];
};

export function fitsToRGBA(
  pixels: Float32Array,
  width: number,
  height: number,
  options: RenderConvertOptions,
): Uint8ClampedArray {
  const n = pixels.length;
  const [rawMin, rawMax] = options.precomputedExtent ?? getExtent(pixels);
  const range = rawMax - rawMin;

  const lut = getColormapLUT(options.colormap, options.profile ?? "standard");
  const lutMax = LUT_SIZE - 1;

  if (range === 0) {
    const rgba = new Uint8ClampedArray(n * 4);
    const mid = Math.floor(lutMax / 2) * 3;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      rgba[off] = lut[mid];
      rgba[off + 1] = lut[mid + 1];
      rgba[off + 2] = lut[mid + 2];
      rgba[off + 3] = 255;
    }
    return rgba;
  }

  const stretchType = options.stretch;
  const { bp, wp } = resolveBlackWhitePoints(
    pixels,
    stretchType,
    rawMin,
    rawMax,
    options.blackPoint ?? 0,
    options.whitePoint ?? 1,
  );
  const span = wp - bp;
  if (!Number.isFinite(span) || Math.abs(span) < 1e-12) {
    const rgba = new Uint8ClampedArray(n * 4);
    const mid = Math.floor(lutMax / 2) * 3;
    for (let i = 0; i < n; i++) {
      const off = i * 4;
      rgba[off] = lut[mid];
      rgba[off + 1] = lut[mid + 1];
      rgba[off + 2] = lut[mid + 2];
      rgba[off + 3] = 255;
    }
    return rgba;
  }
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

  const limit = Math.min(n, width * height);
  const rgba = new Uint8ClampedArray(limit * 4);
  const stretchFn = getStretchFn(stretchType);

  for (let i = 0; i < limit; i++) {
    let v = (pixels[i] - bp) / span;
    if (v < 0) v = 0;
    else if (v > 1) v = 1;

    v = stretchFn(v);

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

  return rgba;
}

/**
 * 估算转换后文件大小 (bytes)
 */
export function estimateFileSize(width: number, height: number, options: ConvertOptions): number {
  let effectiveW = width;
  let effectiveH = height;

  if (options.outputSize) {
    const { maxWidth, maxHeight, scale } = options.outputSize;
    if (maxWidth || maxHeight) {
      const mw = maxWidth ?? Infinity;
      const mh = maxHeight ?? Infinity;
      const ratio = Math.min(mw / width, mh / height, 1);
      effectiveW = Math.max(1, Math.round(width * ratio));
      effectiveH = Math.max(1, Math.round(height * ratio));
    } else if (scale != null && scale > 0 && scale < 1) {
      effectiveW = Math.max(1, Math.round(width * scale));
      effectiveH = Math.max(1, Math.round(height * scale));
    }
  }

  const totalPixels = effectiveW * effectiveH;

  switch (options.format) {
    case "png":
      return Math.round(totalPixels * 3 * 0.6); // PNG ~ 60% of raw (astro images compress well)
    case "jpeg":
      return Math.round(totalPixels * 3 * (options.quality / 100) * 0.12);
    case "webp":
      return Math.round(totalPixels * 3 * (options.quality / 100) * 0.08);
    case "tiff": {
      const bytesPerSample = options.bitDepth / 8;
      const samplesPerPixel = 3;
      const compressionRatio =
        options.tiff.compression === "lzw"
          ? 0.65
          : options.tiff.compression === "deflate"
            ? 0.55
            : 1.0;
      return Math.round(totalPixels * bytesPerSample * samplesPerPixel * compressionRatio) + 512;
    }
    case "bmp":
      return totalPixels * 3 + 54; // 24-bit BMP + header
    case "fits":
      return totalPixels * (options.bitDepth / 8) + 2880; // data + header block
    case "xisf":
      return Math.round(totalPixels * (options.bitDepth / 8) * 1.1) + 4096; // ~FITS + XISF overhead
    case "ser":
      return totalPixels * (options.bitDepth / 8) + 178; // raw pixels + SER header
    default:
      return totalPixels * 3;
  }
}

// ===== 非阻塞分块处理 =====

const CHUNK_SIZE = 1_000_000;

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

  // --- Phase 1: Compute extent (chunked, skipped if precomputed) ---
  let rawMin: number;
  let rawMax: number;
  if (options.precomputedExtent) {
    [rawMin, rawMax] = options.precomputedExtent;
  } else {
    rawMin = Infinity;
    rawMax = -Infinity;
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
  const { bp, wp } = resolveBlackWhitePoints(
    pixels,
    options.stretch,
    rawMin,
    rawMax,
    options.blackPoint ?? 0,
    options.whitePoint ?? 1,
  );
  const span = wp - bp;
  if (!Number.isFinite(span) || Math.abs(span) < 1e-12) {
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
  const limit = Math.min(n, width * height);
  const rgba = new Uint8ClampedArray(limit * 4);
  const lut = getColormapLUT(options.colormap, options.profile ?? "standard");
  const lutMax = LUT_SIZE - 1;
  const stretchFn = getStretchFn(stretchType);

  for (let start = 0; start < limit; start += CHUNK_SIZE) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const end = Math.min(start + CHUNK_SIZE, limit);
    for (let i = start; i < end; i++) {
      let v = (pixels[i] - bp) / span;
      if (v < 0) v = 0;
      else if (v > 1) v = 1;

      v = stretchFn(v);

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
 * 使用 box-filter (area averaging) 提供比最近邻更平滑的结果
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

  const xRatio = srcWidth / dstW;
  const yRatio = srcHeight / dstH;

  for (let dy = 0; dy < dstH; dy++) {
    const srcY0 = Math.floor(dy * yRatio);
    const srcY1 = Math.min(Math.floor((dy + 1) * yRatio), srcHeight);
    for (let dx = 0; dx < dstW; dx++) {
      const srcX0 = Math.floor(dx * xRatio);
      const srcX1 = Math.min(Math.floor((dx + 1) * xRatio), srcWidth);

      let sum = 0;
      let count = 0;
      for (let sy = srcY0; sy < srcY1; sy++) {
        const rowOff = sy * srcWidth;
        for (let sx = srcX0; sx < srcX1; sx++) {
          const v = pixels[rowOff + sx];
          if (!isNaN(v)) {
            sum += v;
            count++;
          }
        }
      }
      result[dy * dstW + dx] = count > 0 ? sum / count : 0;
    }
  }

  return { pixels: result, width: dstW, height: dstH };
}
