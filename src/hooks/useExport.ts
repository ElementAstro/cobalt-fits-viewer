/**
 * 统一图像导出 Hook
 * 支持 PNG/JPEG/WebP/TIFF/BMP/FITS(.fits/.fits.gz)
 */

import { useState, useCallback } from "react";
import { Platform } from "react-native";
import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import { File as FSFile } from "expo-file-system";
import * as Print from "expo-print";
import { LOG_TAGS, Logger } from "../lib/logger";
import type { FitsMetadata, HeaderKeyword } from "../lib/fits/types";
import {
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
  type ExportFormat,
  type FitsTargetOptions,
  type TiffTargetOptions,
} from "../lib/fits/types";
import { writeFitsImage } from "../lib/fits/writer";
import {
  getImageChannels,
  getImageDimensions,
  getImagePixels,
  isRgbCube,
  loadFitsFromBufferAuto,
} from "../lib/fits/parser";
import { gzipFitsBytes, normalizeFitsCompression } from "../lib/fits/compression";
import { encodeTiff, encodeTiffDocument, type TiffEncodePage } from "../lib/image/encoders/tiff";
import { createTiffFrameProvider } from "../lib/image/tiff/decoder";
import { encodeBmp24 } from "../lib/image/encoders/bmp";
import { splitFilenameExtension } from "../lib/import/fileFormat";
import {
  shareFile,
  saveToMediaLibrary,
  getExportDir,
  getExtension as getExtUtil,
  type ShareFileOptions,
} from "../lib/utils/imageExport";

function resolveSkiaFormat(format: ExportFormat): {
  fmt: (typeof ImageFormat)[keyof typeof ImageFormat];
  fallbackExt: string;
} {
  switch (format) {
    case "jpeg":
      return { fmt: ImageFormat.JPEG, fallbackExt: "jpg" };
    case "webp":
      return { fmt: ImageFormat.WEBP, fallbackExt: "webp" };
    case "png":
    default:
      return { fmt: ImageFormat.PNG, fallbackExt: "png" };
  }
}

function resolveQuality(format: ExportFormat, quality?: number): number {
  switch (format) {
    case "jpeg":
      return quality ?? 85;
    case "webp":
      return quality ?? 80;
    default:
      return 100;
  }
}

function buildPrintHtml(base64: string, filename: string, width: number, height: number): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    @page { margin: 15mm; }
    body { text-align: center; margin: 0; padding: 0; font-family: -apple-system, sans-serif; }
    h2 { font-size: 16px; color: #333; margin-bottom: 8px; }
    img { max-width: 100%; height: auto; }
    .meta { font-size: 11px; color: #888; margin-top: 8px; }
  </style>
</head>
<body>
  <h2>${filename}</h2>
  <img src="data:image/png;base64,${base64}" />
  <p class="meta">${width} &times; ${height} px</p>
</body>
</html>`;
}

function encodeToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function rgbaToLuma(rgba: Uint8ClampedArray): Float32Array {
  const totalPixels = Math.floor(rgba.length / 4);
  const output = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    output[p] = (rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722) / 255;
  }
  return output;
}

function rgbaToRgbChannels(rgba: Uint8ClampedArray): {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
} {
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

function normalizeToByte(values: Float32Array): Uint8Array {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return new Uint8Array(values.length).fill(128);
  }
  const output = new Uint8Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const normalized = Math.max(0, Math.min(1, (values[i] - min) / (max - min)));
    output[i] = Math.round(normalized * 255);
  }
  return output;
}

function monoPixelsToRgba(pixels: Float32Array): Uint8ClampedArray {
  const mono = normalizeToByte(pixels);
  const rgba = new Uint8ClampedArray(mono.length * 4);
  for (let i = 0; i < mono.length; i++) {
    const offset = i * 4;
    rgba[offset] = mono[i];
    rgba[offset + 1] = mono[i];
    rgba[offset + 2] = mono[i];
    rgba[offset + 3] = 255;
  }
  return rgba;
}

function rgbChannelsToRgba(channels: {
  r: Float32Array;
  g: Float32Array;
  b: Float32Array;
}): Uint8ClampedArray {
  const r = normalizeToByte(channels.r);
  const g = normalizeToByte(channels.g);
  const b = normalizeToByte(channels.b);
  const rgba = new Uint8ClampedArray(r.length * 4);
  for (let i = 0; i < r.length; i++) {
    const offset = i * 4;
    rgba[offset] = r[i];
    rgba[offset + 1] = g[i];
    rgba[offset + 2] = b[i];
    rgba[offset + 3] = 255;
  }
  return rgba;
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) return value;
  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return copy.buffer;
}

function normalizeTiffBitDepth(value: number | undefined, fallback: 8 | 16 | 32): 8 | 16 | 32 {
  if (value === 8 || value === 16 || value === 32) return value;
  return fallback;
}

export interface ExportSourceContext {
  sourceType?: FitsMetadata["sourceType"];
  sourceFormat?: string;
  originalBuffer?: ArrayBuffer | Uint8Array | null;
  scientificPixels?: Float32Array | null;
  rgbChannels?: { r: Float32Array; g: Float32Array; b: Float32Array } | null;
  metadata?: Partial<FitsMetadata> | null;
  headerKeywords?: HeaderKeyword[] | null;
  comments?: string[] | null;
  history?: string[] | null;
}

export interface ExportRequest {
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  filename: string;
  format: ExportFormat;
  quality?: number;
  bitDepth?: 8 | 16 | 32;
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  source?: ExportSourceContext;
}

type LegacyExportArgs = [
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  filename: string,
  format: ExportFormat,
  quality?: number,
];

type ExportInput = ExportRequest | LegacyExportArgs;

function isExportRequest(value: ExportInput): value is ExportRequest {
  return (
    !Array.isArray(value) && typeof value === "object" && value !== null && "rgbaData" in value
  );
}

type ExportInvokeArgs = [ExportRequest] | LegacyExportArgs;

function normalizeRequest(input: ExportInput): ExportRequest {
  if (isExportRequest(input)) return input;
  const [rgbaData, width, height, filename, format, quality] = input;
  return {
    rgbaData,
    width,
    height,
    filename,
    format,
    quality,
  };
}

function shouldUseScientificFastPath(request: ExportRequest): boolean {
  const source = request.source;
  if (!source || source.sourceType !== "fits" || !source.originalBuffer) return false;

  const mode = request.fits?.mode ?? DEFAULT_FITS_TARGET_OPTIONS.mode;
  if (mode !== "scientific") return false;

  const preserveHeader =
    request.fits?.preserveOriginalHeader ?? DEFAULT_FITS_TARGET_OPTIONS.preserveOriginalHeader;
  const preserveWcs = request.fits?.preserveWcs ?? DEFAULT_FITS_TARGET_OPTIONS.preserveWcs;
  if (!preserveHeader || !preserveWcs) return false;

  const requestedBitpix = request.fits?.bitpix;
  const sourceBitpix =
    typeof source.metadata?.bitpix === "number"
      ? (source.metadata.bitpix as FitsTargetOptions["bitpix"])
      : undefined;
  if (
    requestedBitpix !== undefined &&
    sourceBitpix !== undefined &&
    requestedBitpix !== sourceBitpix
  ) {
    return false;
  }

  return true;
}

function encodeSkiaImage(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  format: ExportFormat,
  quality?: number,
): Uint8Array | null {
  const data = Skia.Data.fromBytes(
    new Uint8Array(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength),
  );
  const skImage = Skia.Image.MakeImage(
    {
      width,
      height,
      alphaType: AlphaType.Unpremul,
      colorType: ColorType.RGBA_8888,
    },
    data,
    width * 4,
  );
  if (!skImage) return null;

  const { fmt } = resolveSkiaFormat(format);
  const q = resolveQuality(format, quality);
  const bytes = skImage.encodeToBytes(fmt, q);
  if (!bytes || bytes.length === 0) return null;
  return bytes;
}

async function buildPreservedTiffPages(request: ExportRequest): Promise<TiffEncodePage[] | null> {
  const source = request.source;
  const sourceBuffer = source?.originalBuffer;
  if (!source || !sourceBuffer) return null;
  const tiffOptions: TiffTargetOptions = {
    ...DEFAULT_TIFF_TARGET_OPTIONS,
    ...(request.tiff ?? {}),
  };
  if (tiffOptions.multipage !== "preserve") return null;

  if (source.sourceType === "fits") {
    const fitsObj = loadFitsFromBufferAuto(toArrayBuffer(sourceBuffer));
    const dims = getImageDimensions(fitsObj);
    if (!dims) return null;

    if (isRgbCube(fitsObj).isRgb) {
      const rgb = await getImageChannels(fitsObj);
      if (!rgb) return null;
      return [
        {
          width: rgb.width,
          height: rgb.height,
          channels: { r: rgb.r, g: rgb.g, b: rgb.b },
          rgba: rgbChannelsToRgba({ r: rgb.r, g: rgb.g, b: rgb.b }),
          bitDepth: request.bitDepth ?? 32,
          sampleFormat: "float",
          colorMode: "rgb",
        },
      ];
    }

    if (!dims.isDataCube || dims.depth <= 1) return null;
    const pages: TiffEncodePage[] = [];
    for (let frame = 0; frame < dims.depth; frame++) {
      const pixels = await getImagePixels(fitsObj, undefined, frame);
      if (!pixels) continue;
      pages.push({
        width: dims.width,
        height: dims.height,
        pixels,
        rgba: monoPixelsToRgba(pixels),
        bitDepth: request.bitDepth ?? 32,
        sampleFormat: "float",
        colorMode: "mono",
      });
    }
    return pages.length > 1 ? pages : null;
  }

  if (source.sourceType === "raster" && source.sourceFormat === "tiff") {
    const provider = await createTiffFrameProvider(toArrayBuffer(sourceBuffer), 3);
    if (provider.pageCount <= 1) return null;
    const pages: TiffEncodePage[] = [];
    for (let index = 0; index < provider.pageCount; index++) {
      const frame = await provider.getFrame(index);
      pages.push({
        width: frame.width,
        height: frame.height,
        rgba: new Uint8ClampedArray(frame.rgba),
        pixels: frame.channels ? undefined : frame.pixels,
        channels: frame.channels ?? undefined,
        bitDepth: normalizeTiffBitDepth(frame.bitDepth, request.bitDepth ?? 8),
        sampleFormat: frame.sampleFormat === "float" ? "float" : "uint",
        colorMode: frame.channels ? "rgb" : "mono",
      });
    }
    return pages.length > 1 ? pages : null;
  }

  return null;
}

async function encodeFits(request: ExportRequest): Promise<Uint8Array> {
  const source = request.source;
  const fitsOptions: FitsTargetOptions = {
    ...DEFAULT_FITS_TARGET_OPTIONS,
    ...(request.fits ?? {}),
  };
  const tiffOptions: TiffTargetOptions = {
    ...DEFAULT_TIFF_TARGET_OPTIONS,
    ...(request.tiff ?? {}),
  };
  const canScientific =
    !!source &&
    (source.sourceType === "fits"
      ? !!source.originalBuffer || !!source.scientificPixels || !!source.rgbChannels
      : source.sourceType === "raster" && source.sourceFormat === "tiff"
        ? !!source.originalBuffer || !!source.scientificPixels || !!source.rgbChannels
        : false);
  const effectiveMode =
    fitsOptions.mode === "scientific" && !canScientific ? "rendered" : fitsOptions.mode;

  if (shouldUseScientificFastPath(request)) {
    const normalized = normalizeFitsCompression(
      source!.originalBuffer as ArrayBuffer | Uint8Array,
      fitsOptions.compression,
    );
    return normalized;
  }

  const sourceFormat = source?.sourceFormat ?? "unknown";
  const targetFormat = fitsOptions.compression === "gzip" ? "fits.gz" : "fits";
  const history = [...(source?.history ?? [])];

  let image: Parameters<typeof writeFitsImage>[0]["image"];
  const preferRgbCube = fitsOptions.colorLayout === "rgbCube3d";
  const useScientificData = effectiveMode === "scientific";

  if (
    useScientificData &&
    source?.sourceType === "raster" &&
    source.sourceFormat === "tiff" &&
    source.originalBuffer &&
    tiffOptions.multipage === "preserve"
  ) {
    const provider = await createTiffFrameProvider(toArrayBuffer(source.originalBuffer), 3);
    if (provider.pageCount > 1) {
      const first = await provider.getFrame(0);
      const width = first.width;
      const height = first.height;
      let monoOnly = !first.channels;
      const cube = new Float32Array(width * height * provider.pageCount);
      cube.set(first.pixels, 0);
      for (let frame = 1; frame < provider.pageCount; frame++) {
        const current = await provider.getFrame(frame);
        if (current.width !== width || current.height !== height || current.channels) {
          monoOnly = false;
          break;
        }
        cube.set(current.pixels, frame * width * height);
      }
      if (monoOnly) {
        image = {
          kind: "monoCube3d",
          width,
          height,
          depth: provider.pageCount,
          pixels: cube,
        };
      } else {
        const warning =
          "TIFF multipage structure is not fully representable in FITS, exported first frame.";
        history.push(warning);
        Logger.warn(LOG_TAGS.Export, warning);
        image = {
          kind: "mono2d",
          width,
          height,
          pixels: first.pixels,
        };
      }
    } else {
      image = {
        kind: "mono2d",
        width: request.width,
        height: request.height,
        pixels:
          useScientificData && source?.scientificPixels
            ? source.scientificPixels
            : rgbaToLuma(request.rgbaData),
      };
    }
  } else if (preferRgbCube) {
    const channels =
      useScientificData && source?.rgbChannels
        ? source.rgbChannels
        : rgbaToRgbChannels(request.rgbaData);
    image = {
      kind: "rgbCube3d",
      width: request.width,
      height: request.height,
      r: channels.r,
      g: channels.g,
      b: channels.b,
    };
  } else {
    const mono =
      useScientificData && source?.scientificPixels
        ? source.scientificPixels
        : rgbaToLuma(request.rgbaData);
    image = {
      kind: "mono2d",
      width: request.width,
      height: request.height,
      pixels: mono,
    };
  }

  const fitsBytes = writeFitsImage({
    image,
    bitpix: fitsOptions.bitpix,
    preserveOriginalHeader: fitsOptions.preserveOriginalHeader,
    preserveWcs: fitsOptions.preserveWcs,
    originalHeaderKeywords: source?.headerKeywords ?? undefined,
    comments: source?.comments ?? undefined,
    history,
    metadata: source?.metadata ?? undefined,
    exportMode: effectiveMode,
    sourceFormat,
    targetFormat,
  });

  if (fitsOptions.compression === "gzip") {
    return gzipFitsBytes(fitsBytes);
  }
  return fitsBytes;
}

function getOutputExtension(request: ExportRequest): string {
  if (request.format !== "fits") {
    return getExtUtil(request.format);
  }
  const fitsCompression = request.fits?.compression ?? DEFAULT_FITS_TARGET_OPTIONS.compression;
  return fitsCompression === "gzip" ? "fits.gz" : "fits";
}

async function encodeRequestBytes(request: ExportRequest): Promise<Uint8Array | null> {
  switch (request.format) {
    case "png":
    case "jpeg":
    case "webp":
      return encodeSkiaImage(
        request.rgbaData,
        request.width,
        request.height,
        request.format,
        request.quality,
      );
    case "tiff": {
      const tiffOptions: TiffTargetOptions = {
        ...DEFAULT_TIFF_TARGET_OPTIONS,
        ...(request.tiff ?? {}),
      };
      const preservedPages = await buildPreservedTiffPages(request);
      if (preservedPages && preservedPages.length > 1) {
        return encodeTiffDocument(preservedPages, {
          bitDepth: request.bitDepth ?? 8,
          colorMode: "auto",
          compression: tiffOptions.compression,
        });
      }
      return encodeTiff(request.rgbaData, request.width, request.height, {
        bitDepth: request.bitDepth ?? 8,
        colorMode: "auto",
        compression: tiffOptions.compression,
      });
    }
    case "bmp":
      return encodeBmp24(request.rgbaData, request.width, request.height);
    case "fits":
      return encodeFits(request);
    default:
      return null;
  }
}

interface ExportImageFn {
  (request: ExportRequest): Promise<string | null>;
  (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ): Promise<string | null>;
}

interface ShareImageFn {
  (request: ExportRequest): Promise<void>;
  (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ): Promise<void>;
}

interface SaveImageFn {
  (request: ExportRequest): Promise<string | null>;
  (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
    format: ExportFormat,
    quality?: number,
  ): Promise<string | null>;
}

interface UseExportReturn {
  isExporting: boolean;
  exportImage: ExportImageFn;
  shareImage: ShareImageFn;
  saveImage: SaveImageFn;
  printImage: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
  ) => Promise<void>;
  printToPdf: (
    rgbaData: Uint8ClampedArray,
    width: number,
    height: number,
    filename: string,
  ) => Promise<void>;
}

export function useExport(): UseExportReturn {
  const [isExporting, setIsExporting] = useState(false);

  const createExportFile = useCallback(async (request: ExportRequest): Promise<string | null> => {
    try {
      const bytes = await encodeRequestBytes(request);
      if (!bytes || bytes.length === 0) {
        return null;
      }

      const extension = getOutputExtension(request);
      const { baseName } = splitFilenameExtension(request.filename);
      const exportDir = getExportDir();
      const outFile = new FSFile(
        exportDir,
        `${(baseName || request.filename).trim()}_export.${extension}`,
      );
      outFile.write(bytes);
      return outFile.uri;
    } catch (error) {
      Logger.warn(LOG_TAGS.Export, "Export failed", error);
      return null;
    }
  }, []);

  const exportImage = useCallback(
    async (...args: ExportInvokeArgs) => {
      setIsExporting(true);
      try {
        const request = normalizeRequest(args.length === 1 ? args[0] : args);
        return await createExportFile(request);
      } finally {
        setIsExporting(false);
      }
    },
    [createExportFile],
  ) as ExportImageFn;

  const shareImage = useCallback(
    async (...args: ExportInvokeArgs) => {
      setIsExporting(true);
      try {
        const request = normalizeRequest(args.length === 1 ? args[0] : args);
        const path = await createExportFile(request);
        if (!path) throw new Error("Failed to create image");
        const shareOptions: ShareFileOptions = {
          format: request.format,
          filename: request.filename,
        };
        await shareFile(path, shareOptions);
      } finally {
        setIsExporting(false);
      }
    },
    [createExportFile],
  ) as ShareImageFn;

  const saveImage = useCallback(
    async (...args: ExportInvokeArgs) => {
      setIsExporting(true);
      try {
        const request = normalizeRequest(args.length === 1 ? args[0] : args);
        const path = await createExportFile(request);
        if (!path) return null;
        return await saveToMediaLibrary(path);
      } finally {
        setIsExporting(false);
      }
    },
    [createExportFile],
  ) as SaveImageFn;

  const createBase64Png = useCallback(
    (rgbaData: Uint8ClampedArray, width: number, height: number): string | null => {
      const bytes = encodeSkiaImage(rgbaData, width, height, "png", 100);
      if (!bytes || bytes.length === 0) return null;
      return encodeToBase64(bytes);
    },
    [],
  );

  const printImage = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
    ): Promise<void> => {
      setIsExporting(true);
      try {
        const base64 = createBase64Png(rgbaData, width, height);
        if (!base64) throw new Error("Failed to encode image");
        const html = buildPrintHtml(base64, filename, width, height);
        const orientation =
          width > height ? Print.Orientation.landscape : Print.Orientation.portrait;
        await Print.printAsync({
          html,
          ...(Platform.OS === "ios" ? { orientation } : {}),
        });
      } finally {
        setIsExporting(false);
      }
    },
    [createBase64Png],
  );

  const printToPdf = useCallback(
    async (
      rgbaData: Uint8ClampedArray,
      width: number,
      height: number,
      filename: string,
    ): Promise<void> => {
      setIsExporting(true);
      try {
        const base64 = createBase64Png(rgbaData, width, height);
        if (!base64) throw new Error("Failed to encode image");
        const html = buildPrintHtml(base64, filename, width, height);
        const { uri } = await Print.printToFileAsync({
          html,
          width: 612,
          height: 792,
        });
        await shareFile(uri);
      } finally {
        setIsExporting(false);
      }
    },
    [createBase64Png],
  );

  return {
    isExporting,
    exportImage,
    shareImage,
    saveImage,
    printImage,
    printToPdf,
  };
}
