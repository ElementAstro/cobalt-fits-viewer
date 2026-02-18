/**
 * 通用栅格图像解析
 * 将 PNG/JPEG/WebP/TIFF/BMP 解码为灰度 Float32 像素，复用现有处理管线
 */

import { Skia, AlphaType, ColorType } from "@shopify/react-native-skia";
import { classifyWithDetail } from "../gallery/frameClassifier";
import type { FitsMetadata, FrameClassificationConfig } from "../fits/types";

export interface RasterDecodeResult {
  width: number;
  height: number;
  rgba: Uint8Array;
  pixels: Float32Array;
  channels: {
    r: Float32Array;
    g: Float32Array;
    b: Float32Array;
  };
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
    rgba,
    pixels: rgbaToLuma(rgba),
    channels: rgbaToChannels(rgba),
  };
}

export function extractRasterMetadata(
  fileInfo: { filename: string; filepath: string; fileSize: number },
  dims: { width: number; height: number },
  classificationConfig?: FrameClassificationConfig,
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
    bitpix: 8,
    naxis: 2,
    naxis1: dims.width,
    naxis2: dims.height,
    naxis3: 1,
    frameType: frameClassified.type,
    frameTypeSource: frameClassified.source,
  };
}
