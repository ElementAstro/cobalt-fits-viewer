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
  type ExportFormat,
  type FitsTargetOptions,
} from "../lib/fits/types";
import { writeFitsImage } from "../lib/fits/writer";
import { gzipFitsBytes, normalizeFitsCompression } from "../lib/fits/compression";
import { encodeTiff } from "../lib/image/encoders/tiff";
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

function encodeFits(request: ExportRequest): Uint8Array {
  const source = request.source;
  const fitsOptions: FitsTargetOptions = {
    ...DEFAULT_FITS_TARGET_OPTIONS,
    ...(request.fits ?? {}),
  };
  const canScientific =
    source?.sourceType === "fits" &&
    (!!source.originalBuffer || !!source.scientificPixels || !!source.rgbChannels);
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

  let image: Parameters<typeof writeFitsImage>[0]["image"];
  const preferRgbCube = fitsOptions.colorLayout === "rgbCube3d";
  const useScientificData = effectiveMode === "scientific";

  if (preferRgbCube) {
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
    history: source?.history ?? undefined,
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

function encodeRequestBytes(request: ExportRequest): Uint8Array | null {
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
    case "tiff":
      return encodeTiff(request.rgbaData, request.width, request.height, {
        bitDepth: request.bitDepth ?? 8,
        colorMode: "auto",
      });
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
      const bytes = encodeRequestBytes(request);
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
