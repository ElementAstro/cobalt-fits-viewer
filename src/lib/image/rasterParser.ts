/**
 * 通用栅格图像解析
 * 将常见栅格图像解码为灰度 Float32 像素，复用现有处理管线
 *
 * 说明：
 * - 首选 Skia 编解码（同步）以获得最佳性能与一致性
 * - TIFF 使用专用解码器（支持多页/高位深）
 * - HEIC/AVIF/GIF 等在部分平台/构建中可能无法被 Skia 直接解码时，
 *   会在异步路径中使用平台能力（expo-image-manipulator）或 Web 端 Canvas/libheif-js 作为回退
 */

import { Skia, AlphaType, ColorType } from "@shopify/react-native-skia";
import { Platform } from "react-native";
import { classifyWithDetail } from "../gallery/frameClassifier";
import type { FitsMetadata, FrameClassificationConfig, HeaderKeyword } from "../fits/types";
import {
  createTiffFrameProvider,
  isTiffLikeBuffer,
  type RasterFrameProvider,
} from "./tiff/decoder";
import {
  detectPreferredSupportedImageFormat,
  type SupportedMediaFormatId,
} from "../import/fileFormat";

export interface RasterDecodeResult {
  width: number;
  height: number;
  depth: number;
  isMultiFrame: boolean;
  frameIndex: number;
  bitDepth: number;
  sampleFormat?: string;
  photometric?: number;
  compression?: number;
  orientation?: number;
  rgba: Uint8Array;
  pixels: Float32Array;
  channels: {
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
  } | null;
  headers: HeaderKeyword[];
  frameProvider?: RasterFrameProvider;
  decodeStatus?: "ready" | "failed";
  decodeError?: string;
}

interface ParseRasterAsyncOptions {
  frameIndex?: number;
  cacheSize?: number;
  preferTiffDecoder?: boolean;
  sourceUri?: string;
  filename?: string;
  mimeType?: string | null;
  formatHint?: SupportedMediaFormatId;
}

interface WebDocumentLike {
  createElement: (tag: "canvas") => WebCanvasLike;
}

interface WebCanvasLike {
  width: number;
  height: number;
  getContext: (
    type: "2d",
    options?: { willReadFrequently?: boolean },
  ) => WebCanvas2DContextLike | null;
}

interface WebCanvas2DContextLike {
  drawImage: (image: unknown, dx: number, dy: number) => void;
  getImageData: (sx: number, sy: number, sw: number, sh: number) => { data: Uint8ClampedArray };
}

interface UrlLike {
  createObjectURL: (blob: unknown) => string;
  revokeObjectURL: (url: string) => void;
}

interface BlobConstructorLike {
  new (parts: unknown[], options?: { type?: string }): unknown;
}

interface ImageLike {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
}

interface ImageConstructorLike {
  new (): ImageLike;
}

interface ImageBitmapLike {
  width: number;
  height: number;
  close?: () => void;
}

type CreateImageBitmapLike = (blob: unknown) => Promise<ImageBitmapLike>;

interface LibHeifImageLike {
  get_width?: () => number;
  get_height?: () => number;
  display: (
    target: { data: Uint8ClampedArray; width: number; height: number },
    cb: (data: unknown) => void,
  ) => void;
}

interface LibHeifDecoderLike {
  decode: (bytes: Uint8Array) => LibHeifImageLike[];
}

interface LibHeifModuleLike {
  HeifDecoder: new () => LibHeifDecoderLike;
}

interface ImageManipulatorRenderedLike {
  saveAsync: (options: { format: unknown; compress?: number }) => Promise<{ uri: string }>;
}

interface ImageManipulatorContextLike {
  renderAsync: () => Promise<ImageManipulatorRenderedLike>;
}

interface ImageManipulatorModuleLike {
  SaveFormat: { PNG: unknown };
  manipulate: (uri: string) => ImageManipulatorContextLike;
}

interface ExpoFileLike {
  uri: string;
  write: (data: Uint8Array) => void;
  delete: () => void;
  arrayBuffer: () => Promise<ArrayBuffer>;
}

interface ExpoFileConstructorLike {
  new (pathOrDir: string | { uri: string }, name?: string): ExpoFileLike;
}

interface ExpoFileSystemModuleLike {
  File: ExpoFileConstructorLike;
  Paths: { cache: string };
}

interface ImageJsRawImageLike {
  data: Uint8Array | Uint8ClampedArray | Uint16Array;
  channels: number;
  bitDepth: number;
}

interface ImageJsImageLike {
  width: number;
  height: number;
  channels: number;
  maxValue?: number;
  getRawImage?: () => ImageJsRawImageLike;
  getValueByIndex?: (index: number, channel: number) => number;
}

interface ImageJsModuleLike {
  decode: (input: ArrayBufferView) => ImageJsImageLike;
}

function clampToByte(value: number): number {
  if (!isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

function floatArrayToRgbaBytes(raw: Float32Array): Uint8Array {
  const result = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    const value = raw[i];
    result[i] = clampToByte(value <= 1 ? value * 255 : value);
  }
  return result;
}

function rgbaToLuma(rgba: Uint8Array): Float32Array {
  const totalPixels = Math.floor(rgba.length / 4);
  const luma = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    const r = rgba[i] / 255;
    const g = rgba[i + 1] / 255;
    const b = rgba[i + 2] / 255;
    luma[p] = r * 0.2126 + g * 0.7152 + b * 0.0722;
  }
  return luma;
}

function rgbaToChannels(rgba: Uint8Array): { r: Float32Array; g: Float32Array; b: Float32Array } {
  const totalPixels = Math.floor(rgba.length / 4);
  const r = new Float32Array(totalPixels);
  const g = new Float32Array(totalPixels);
  const b = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    r[p] = rgba[i] / 255;
    g[p] = rgba[i + 1] / 255;
    b[p] = rgba[i + 2] / 255;
  }
  return { r, g, b };
}

function normalizeToByte(value: number, maxValue: number): number {
  if (!isFinite(value)) return 0;
  if (maxValue > 1) {
    return clampToByte((value / maxValue) * 255);
  }
  if (value >= 0 && value <= 1) {
    return clampToByte(value * 255);
  }
  return clampToByte(value);
}

function convertImageJsToRgba(image: ImageJsImageLike): Uint8Array {
  const width = Number(image.width) || 0;
  const height = Number(image.height) || 0;
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid image-js dimensions");
  }

  const channels = Number(image.channels) || 0;
  if (channels < 1) {
    throw new Error("Invalid image-js channel layout");
  }

  const totalPixels = width * height;
  const rgba = new Uint8Array(totalPixels * 4);
  const maxValue = typeof image.maxValue === "number" && image.maxValue > 0 ? image.maxValue : 255;

  const rawImage = image.getRawImage?.();
  const rawData = rawImage?.data;
  const rawChannels = rawImage?.channels ?? channels;
  if (rawData && rawChannels >= 1) {
    for (let i = 0; i < totalPixels; i++) {
      const source = i * rawChannels;
      const target = i * 4;
      const c0 = normalizeToByte(rawData[source] ?? 0, maxValue);
      const c1 = normalizeToByte(rawData[source + 1] ?? c0, maxValue);
      const c2 = normalizeToByte(rawData[source + 2] ?? c0, maxValue);
      const alpha =
        rawChannels >= 2 && (rawChannels === 2 || rawChannels >= 4)
          ? normalizeToByte(rawData[source + (rawChannels === 2 ? 1 : 3)] ?? maxValue, maxValue)
          : 255;

      rgba[target] = c0;
      rgba[target + 1] = rawChannels === 1 ? c0 : c1;
      rgba[target + 2] = rawChannels === 1 ? c0 : rawChannels === 2 ? c0 : c2;
      rgba[target + 3] = alpha;
    }
    return rgba;
  }

  if (typeof image.getValueByIndex !== "function") {
    throw new Error("image-js decode result has no readable pixel API");
  }

  for (let i = 0; i < totalPixels; i++) {
    const target = i * 4;
    const c0 = normalizeToByte(image.getValueByIndex(i, 0), maxValue);
    const c1 = normalizeToByte(image.getValueByIndex(i, Math.min(1, channels - 1)), maxValue);
    const c2 = normalizeToByte(image.getValueByIndex(i, Math.min(2, channels - 1)), maxValue);
    const alpha =
      channels >= 2 && (channels === 2 || channels >= 4)
        ? normalizeToByte(image.getValueByIndex(i, channels === 2 ? 1 : 3), maxValue)
        : 255;

    rgba[target] = c0;
    rgba[target + 1] = channels === 1 ? c0 : c1;
    rgba[target + 2] = channels === 1 ? c0 : channels === 2 ? c0 : c2;
    rgba[target + 3] = alpha;
  }

  return rgba;
}

async function decodeViaImageJs(
  buffer: ArrayBuffer,
): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  // Use require() for compatibility with Metro bundling and Jest mocks while keeping lazy loading.
  const moduleUnknown: unknown = require("image-js");
  const moduleObject = moduleUnknown as { decode?: unknown; default?: unknown };
  const maybeDefault = moduleObject.default as { decode?: unknown } | undefined;
  const decodeFn =
    typeof moduleObject.decode === "function"
      ? (moduleObject.decode as ImageJsModuleLike["decode"])
      : typeof maybeDefault?.decode === "function"
        ? (maybeDefault.decode as ImageJsModuleLike["decode"])
        : null;

  if (!decodeFn) {
    throw new Error("image-js decode API is unavailable");
  }

  const image = decodeFn(new Uint8Array(buffer));
  const rgba = convertImageJsToRgba(image);
  return {
    width: image.width,
    height: image.height,
    rgba,
  };
}

export function parseRasterFromBuffer(buffer: ArrayBuffer): RasterDecodeResult {
  const encoded = Skia.Data.fromBytes(new Uint8Array(buffer));
  const image = Skia.Image.MakeImageFromEncoded(encoded);
  if (!image) {
    throw new Error("Unsupported raster image format");
  }

  const source = image.makeNonTextureImage();
  const width = source.width();
  const height = source.height();
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid raster image dimensions");
  }

  const pixels = source.readPixels(0, 0, {
    width,
    height,
    alphaType: AlphaType.Unpremul,
    colorType: ColorType.RGBA_8888,
  });

  if (!pixels) {
    throw new Error("Failed to read raster image pixels");
  }

  const rgba = pixels instanceof Uint8Array ? pixels : floatArrayToRgbaBytes(pixels);
  return {
    width,
    height,
    depth: 1,
    isMultiFrame: false,
    frameIndex: 0,
    bitDepth: 8,
    rgba,
    pixels: rgbaToLuma(rgba),
    channels: rgbaToChannels(rgba),
    headers: [],
    decodeStatus: "ready",
  };
}

function guessMimeType(formatHint?: SupportedMediaFormatId): string | null {
  switch (formatHint) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "bmp":
      return "image/bmp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    case "avif":
      return "image/avif";
    case "tiff":
      return "image/tiff";
    default:
      return null;
  }
}

async function decodeViaWebCanvas(
  buffer: ArrayBuffer,
  mimeType: string | null,
): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  const globalObj = globalThis as unknown as {
    document?: unknown;
    URL?: unknown;
    Blob?: unknown;
    createImageBitmap?: unknown;
    Image?: unknown;
  };

  const doc = globalObj.document as WebDocumentLike | undefined;
  const urlApi = globalObj.URL as UrlLike | undefined;
  const blobCtor = globalObj.Blob as BlobConstructorLike | undefined;
  const createImageBitmapFn = globalObj.createImageBitmap as CreateImageBitmapLike | undefined;
  const ImageCtor = globalObj.Image as ImageConstructorLike | undefined;

  if (!doc || !urlApi || !blobCtor) {
    throw new Error("Web canvas decoder is not available in this environment");
  }

  const blob = new blobCtor([buffer], { type: mimeType || "application/octet-stream" });

  // Prefer createImageBitmap when available.
  if (typeof createImageBitmapFn === "function") {
    const bitmap = await createImageBitmapFn(blob);
    try {
      const width = Number(bitmap.width) || 0;
      const height = Number(bitmap.height) || 0;
      if (width <= 0 || height <= 0) throw new Error("Invalid raster image dimensions");

      const canvas = doc.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("Canvas 2D context is not available");
      ctx.drawImage(bitmap, 0, 0);
      const imageData = ctx.getImageData(0, 0, width, height);
      const rgba = new Uint8Array(
        imageData.data.buffer,
        imageData.data.byteOffset,
        imageData.data.byteLength,
      );
      return { width, height, rgba: new Uint8Array(rgba) };
    } finally {
      if (typeof bitmap?.close === "function") {
        try {
          bitmap.close();
        } catch {
          // ignore bitmap close failure
        }
      }
    }
  }

  // Fallback to HTMLImageElement decoding.
  if (!ImageCtor) {
    throw new Error("HTMLImageElement decoder is not available");
  }

  const objectUrl = urlApi.createObjectURL(blob);
  try {
    const img = await new Promise<ImageLike>((resolve, reject) => {
      const image = new ImageCtor();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to decode image via HTMLImageElement"));
      image.src = objectUrl;
    });

    const width = Number(img.naturalWidth ?? img.width) || 0;
    const height = Number(img.naturalHeight ?? img.height) || 0;
    if (width <= 0 || height <= 0) throw new Error("Invalid raster image dimensions");

    const canvas = doc.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Canvas 2D context is not available");
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const rgba = new Uint8Array(
      imageData.data.buffer,
      imageData.data.byteOffset,
      imageData.data.byteLength,
    );
    return { width, height, rgba: new Uint8Array(rgba) };
  } finally {
    urlApi.revokeObjectURL(objectUrl);
  }
}

async function decodeViaLibHeif(
  buffer: ArrayBuffer,
): Promise<{ width: number; height: number; rgba: Uint8Array }> {
  const moduleUnknown: unknown = await import("libheif-js/wasm-bundle");
  const moduleObj = moduleUnknown as { default?: unknown };
  const libheifUnknown = moduleObj.default ?? moduleUnknown;
  const libheif = libheifUnknown as Partial<LibHeifModuleLike>;
  if (typeof libheif.HeifDecoder !== "function") {
    throw new Error("libheif-js is not available");
  }

  const decoder = new (libheif.HeifDecoder as LibHeifModuleLike["HeifDecoder"])();
  const images = decoder.decode(new Uint8Array(buffer));
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("No image frames decoded from HEIF/AVIF container");
  }

  const image = images[0];
  const width = Number(image.get_width?.()) || 0;
  const height = Number(image.get_height?.()) || 0;
  if (width <= 0 || height <= 0) {
    throw new Error("Invalid HEIF/AVIF image dimensions");
  }

  const data = new Uint8ClampedArray(width * height * 4);
  await new Promise<void>((resolve, reject) => {
    image.display({ data, width, height }, (displayData: unknown) => {
      if (!displayData) {
        reject(new Error("HEIF/AVIF display returned no data"));
        return;
      }
      resolve();
    });
  });

  return { width, height, rgba: new Uint8Array(data.buffer, data.byteOffset, data.byteLength) };
}

async function transcodeViaImageManipulatorToPngBuffer(
  buffer: ArrayBuffer,
  options: { sourceUri?: string; filename?: string },
): Promise<{ pngBuffer: ArrayBuffer; cleanup?: () => void }> {
  // Use require() here (instead of dynamic import) to play nicely with Metro bundling
  // and Jest module mocking while still keeping it lazy (executed only on fallback path).
  const imageManipulatorModuleUnknown: unknown = require("expo-image-manipulator");
  const imageManipulatorAnyUnknown =
    (imageManipulatorModuleUnknown as { default?: unknown }).default ??
    imageManipulatorModuleUnknown;
  const ImageManipulatorAny = imageManipulatorAnyUnknown as ImageManipulatorModuleLike;

  const fsModuleUnknown: unknown = require("expo-file-system");
  const fsAnyUnknown = (fsModuleUnknown as { default?: unknown }).default ?? fsModuleUnknown;
  const { File, Paths } = fsAnyUnknown as ExpoFileSystemModuleLike;

  const sourceUri = options.sourceUri;
  let tempFile: ExpoFileLike | null = null;
  const cleanup = () => {
    try {
      tempFile?.delete?.();
    } catch {
      // ignore cleanup failures
    }
  };

  const isUsableUri =
    typeof sourceUri === "string" &&
    (sourceUri.startsWith("file://") ||
      sourceUri.startsWith("content://") ||
      sourceUri.startsWith("ph://") ||
      sourceUri.startsWith("asset://") ||
      sourceUri.startsWith("http://") ||
      sourceUri.startsWith("https://"));

  let inputUri = isUsableUri ? sourceUri : undefined;
  if (!inputUri) {
    const normalizedExt =
      typeof options.filename === "string" && /\.[a-z0-9]+$/i.test(options.filename)
        ? options.filename.slice(options.filename.lastIndexOf("."))
        : ".bin";
    tempFile = new File(Paths.cache, `raster_decode_${Date.now()}${normalizedExt}`);
    tempFile.write(new Uint8Array(buffer));
    inputUri = tempFile.uri;
  }

  if (!inputUri) {
    cleanup();
    throw new Error("ImageManipulator fallback requires a valid source URI");
  }

  const context = ImageManipulatorAny.manipulate(inputUri);
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({
    format: ImageManipulatorAny.SaveFormat.PNG,
    compress: 1,
  });

  const outFile = new File(saved.uri);
  const pngBuffer = await outFile.arrayBuffer();
  try {
    outFile.delete();
  } catch {
    // ignore
  }

  return {
    pngBuffer,
    cleanup,
  };
}

export async function parseRasterFromBufferAsync(
  buffer: ArrayBuffer,
  options?: ParseRasterAsyncOptions,
): Promise<RasterDecodeResult> {
  const bytes = new Uint8Array(buffer);
  const frameIndex = options?.frameIndex ?? 0;
  const shouldUseTiffDecoder = options?.preferTiffDecoder !== false && isTiffLikeBuffer(bytes);
  if (!shouldUseTiffDecoder) {
    try {
      return parseRasterFromBuffer(buffer);
    } catch (error) {
      const detected =
        options?.formatHint ||
        detectPreferredSupportedImageFormat({
          filename: options?.filename,
          mimeType: options?.mimeType ?? undefined,
          payload: buffer,
        })?.id;

      try {
        const decoded = await decodeViaImageJs(buffer);
        return {
          width: decoded.width,
          height: decoded.height,
          depth: 1,
          isMultiFrame: false,
          frameIndex: 0,
          bitDepth: 8,
          rgba: decoded.rgba,
          pixels: rgbaToLuma(decoded.rgba),
          channels: rgbaToChannels(decoded.rgba),
          headers: [],
          decodeStatus: "ready",
        };
      } catch {
        // ignore image-js fallback errors and continue with platform-specific fallbacks.
      }

      // Web fallback: use browser decoders first, then libheif-js for HEIC/AVIF containers.
      if (Platform.OS === "web") {
        const mime = options?.mimeType ?? guessMimeType(detected);
        try {
          const decoded = await decodeViaWebCanvas(buffer, mime);
          return {
            width: decoded.width,
            height: decoded.height,
            depth: 1,
            isMultiFrame: false,
            frameIndex: 0,
            bitDepth: 8,
            rgba: decoded.rgba,
            pixels: rgbaToLuma(decoded.rgba),
            channels: rgbaToChannels(decoded.rgba),
            headers: [],
            decodeStatus: "ready",
          };
        } catch (webError) {
          if (detected === "heic" || detected === "avif") {
            const decoded = await decodeViaLibHeif(buffer);
            return {
              width: decoded.width,
              height: decoded.height,
              depth: 1,
              isMultiFrame: false,
              frameIndex: 0,
              bitDepth: 8,
              rgba: decoded.rgba,
              pixels: rgbaToLuma(decoded.rgba),
              channels: rgbaToChannels(decoded.rgba),
              headers: [],
              decodeStatus: "ready",
            };
          }
          throw webError;
        }
      }

      // Native fallback: transcode via ImageManipulator when Skia cannot decode the container.
      try {
        const transcoded = await transcodeViaImageManipulatorToPngBuffer(buffer, {
          sourceUri: options?.sourceUri,
          filename: options?.filename,
        });
        try {
          return parseRasterFromBuffer(transcoded.pngBuffer);
        } finally {
          transcoded.cleanup?.();
        }
      } catch {
        throw error;
      }
    }
  }

  const frameProvider = await createTiffFrameProvider(buffer, options?.cacheSize ?? 3);
  const safeFrameIndex = Math.max(0, Math.min(frameProvider.pageCount - 1, frameIndex));
  const frame = await frameProvider.getFrame(safeFrameIndex);
  return {
    width: frame.width,
    height: frame.height,
    depth: frameProvider.pageCount,
    isMultiFrame: frameProvider.pageCount > 1,
    frameIndex: safeFrameIndex,
    bitDepth: frame.bitDepth,
    sampleFormat: frame.sampleFormat,
    photometric: frame.photometric,
    compression: frame.compression,
    orientation: frame.orientation,
    rgba: frame.rgba,
    pixels: frame.pixels,
    channels: frame.channels,
    headers: frame.headers,
    frameProvider,
    decodeStatus: "ready",
  };
}

export function extractRasterMetadata(
  fileInfo: { filename: string; filepath: string; fileSize: number },
  dims: { width: number; height: number; depth?: number; bitDepth?: number },
  classificationConfig?: FrameClassificationConfig,
  options?: {
    decodeStatus?: FitsMetadata["decodeStatus"];
    decodeError?: string;
  },
): Omit<FitsMetadata, "id" | "importDate" | "isFavorite" | "tags" | "albumIds"> {
  const frameClassified = classifyWithDetail(
    undefined,
    undefined,
    fileInfo.filename,
    classificationConfig,
  );
  return {
    filename: fileInfo.filename,
    filepath: fileInfo.filepath,
    fileSize: fileInfo.fileSize,
    bitpix: dims.bitDepth ?? 8,
    naxis: 2,
    naxis1: dims.width,
    naxis2: dims.height,
    naxis3: dims.depth ?? 1,
    frameType: frameClassified.type,
    frameTypeSource: frameClassified.source,
    decodeStatus: options?.decodeStatus ?? "ready",
    decodeError: options?.decodeError,
  };
}
