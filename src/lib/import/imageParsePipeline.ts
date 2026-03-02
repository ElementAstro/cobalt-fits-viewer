import { FITS } from "fitsjs-ng";
import type { FitsMetadata, FrameClassificationConfig, HeaderKeyword } from "../fits/types";
import {
  extractMetadata,
  getCommentsAndHistory,
  getHeaderKeywords,
  getImageChannels,
  getImageDimensions,
  getImagePixels,
  getSerMetadata,
  isRgbCube,
  loadScientificFitsFromBuffer,
} from "../fits/parser";
import { readFileAsArrayBuffer } from "../utils/fileManager";
import type { RasterFrameProvider } from "../image/tiff/decoder";
import { extractRasterMetadata, parseRasterFromBufferAsync } from "../image/rasterParser";
import {
  detectPreferredSupportedImageFormat,
  detectSupportedMediaFormat,
  isRawRasterFormatId,
  isDistributedXisfFilename,
  toImageSourceFormat,
  type ImageSourceType,
  type SupportedMediaFormat,
} from "./fileFormat";

type ImageMetadataBase = Omit<
  FitsMetadata,
  "id" | "importDate" | "isFavorite" | "tags" | "albumIds"
>;

export interface ImageParseResult {
  detectedFormat: SupportedMediaFormat;
  sourceType: Extract<ImageSourceType, "fits" | "raster">;
  sourceFormat: NonNullable<FitsMetadata["sourceFormat"]>;
  fits: FITS | null;
  rasterFrameProvider: RasterFrameProvider | null;
  pixels: Float32Array | null;
  rgbChannels: { r: Float32Array; g: Float32Array; b: Float32Array } | null;
  dimensions: { width: number; height: number; depth: number; isDataCube: boolean } | null;
  headers: HeaderKeyword[];
  comments: string[];
  history: string[];
  metadataBase: ImageMetadataBase;
  decodeStatus: FitsMetadata["decodeStatus"];
  decodeError?: string;
  rgba?: Uint8Array;
  serInfo?: FitsMetadata["serInfo"];
}

export interface ParseImageBufferOptions {
  buffer: ArrayBuffer;
  filename: string;
  filepath?: string;
  fileSize?: number;
  mimeType?: string | null;
  frameClassificationConfig?: FrameClassificationConfig;
  allowDecodeFailureMetadata?: boolean;
  detectedFormat?: SupportedMediaFormat | null;
}

export interface ParseImageFileOptions {
  filepath: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string | null;
  frameClassificationConfig?: FrameClassificationConfig;
  allowDecodeFailureMetadata?: boolean;
  detectedFormat?: SupportedMediaFormat | null;
}

export interface ImageLikeMediaRecord {
  filename?: string | null;
  sourceType?: FitsMetadata["sourceType"];
  mediaKind?: FitsMetadata["mediaKind"];
}

function resolveImageFormat(options: ParseImageBufferOptions): SupportedMediaFormat {
  const detected =
    options.detectedFormat ??
    detectPreferredSupportedImageFormat({
      filename: options.filename,
      mimeType: options.mimeType,
      payload: options.buffer,
    });

  if (!detected) {
    if (isDistributedXisfFilename(options.filename)) {
      throw new Error(
        "Distributed XISF (.xish + .xisb) is not supported. Please import a monolithic .xisf file.",
      );
    }
    throw new Error("Unsupported image format");
  }

  if (detected.sourceType === "video" || detected.sourceType === "audio") {
    throw new Error("Unsupported image format");
  }

  return detected;
}

export async function parseImageBuffer(
  options: ParseImageBufferOptions,
): Promise<ImageParseResult> {
  const detectedFormat = resolveImageFormat(options);
  const sourceType = detectedFormat.sourceType as Extract<ImageSourceType, "fits" | "raster">;
  const sourceFormat = toImageSourceFormat(detectedFormat);
  const fileInfo = {
    filename: options.filename,
    filepath: options.filepath ?? `memory://${options.filename}`,
    fileSize: options.fileSize ?? options.buffer.byteLength,
  };

  if (sourceType === "fits") {
    const fits = await loadScientificFitsFromBuffer(options.buffer, {
      filename: options.filename,
      mimeType: options.mimeType ?? undefined,
      detectedFormat,
    });
    const dimensions = getImageDimensions(fits);
    const pixels = await getImagePixels(fits);
    let rgbChannels: { r: Float32Array; g: Float32Array; b: Float32Array } | null = null;
    if (isRgbCube(fits).isRgb) {
      const channels = await getImageChannels(fits);
      rgbChannels = channels ? { r: channels.r, g: channels.g, b: channels.b } : null;
    }
    const commentsHistory = getCommentsAndHistory(fits);

    return {
      detectedFormat,
      sourceType,
      sourceFormat,
      fits,
      rasterFrameProvider: null,
      pixels,
      rgbChannels,
      dimensions,
      headers: getHeaderKeywords(fits),
      comments: commentsHistory.comments,
      history: commentsHistory.history,
      metadataBase: extractMetadata(fits, fileInfo, options.frameClassificationConfig),
      decodeStatus: "ready",
      decodeError: undefined,
      serInfo: getSerMetadata(fits),
    };
  }

  try {
    const decoded = await parseRasterFromBufferAsync(options.buffer, {
      frameIndex: 0,
      cacheSize: 3,
      preferTiffDecoder: true,
      sourceUri: options.filepath,
      filename: options.filename,
      mimeType: options.mimeType ?? undefined,
      formatHint: detectedFormat.id,
    });

    return {
      detectedFormat,
      sourceType: "raster",
      sourceFormat,
      fits: null,
      rasterFrameProvider: decoded.frameProvider ?? null,
      pixels: decoded.pixels,
      rgbChannels: decoded.channels,
      dimensions: {
        width: decoded.width,
        height: decoded.height,
        depth: Math.max(1, decoded.depth ?? 1),
        isDataCube: (decoded.depth ?? 1) > 1,
      },
      headers: decoded.headers ?? [],
      comments: [],
      history: [],
      metadataBase: extractRasterMetadata(
        fileInfo,
        {
          width: decoded.width,
          height: decoded.height,
          depth: decoded.depth,
          bitDepth: decoded.bitDepth,
        },
        options.frameClassificationConfig,
        {
          decodeStatus: decoded.decodeStatus ?? "ready",
          decodeError: decoded.decodeError,
        },
      ),
      decodeStatus: decoded.decodeStatus ?? "ready",
      decodeError: decoded.decodeError,
      rgba: decoded.rgba,
    };
  } catch (error) {
    const canPersistDecodeFailure =
      options.allowDecodeFailureMetadata &&
      (detectedFormat.id === "tiff" || isRawRasterFormatId(detectedFormat.id));
    if (!canPersistDecodeFailure) {
      throw error;
    }

    const decodeError =
      error instanceof Error ? error.message : `${detectedFormat.id.toUpperCase()} decode failed`;
    return {
      detectedFormat,
      sourceType: "raster",
      sourceFormat,
      fits: null,
      rasterFrameProvider: null,
      pixels: null,
      rgbChannels: null,
      dimensions: {
        width: 0,
        height: 0,
        depth: 1,
        isDataCube: false,
      },
      headers: [],
      comments: [],
      history: [],
      metadataBase: extractRasterMetadata(
        fileInfo,
        {
          width: 0,
          height: 0,
          depth: 1,
          bitDepth: 8,
        },
        options.frameClassificationConfig,
        {
          decodeStatus: "failed",
          decodeError,
        },
      ),
      decodeStatus: "failed",
      decodeError,
    };
  }
}

function inferFilenameFromPath(filepath: string): string {
  const normalized = filepath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  return segments[segments.length - 1] || "image";
}

export async function parseImageFile(options: ParseImageFileOptions): Promise<ImageParseResult> {
  const buffer = await readFileAsArrayBuffer(options.filepath);
  const filename = options.filename ?? inferFilenameFromPath(options.filepath);
  return parseImageBuffer({
    buffer,
    filename,
    filepath: options.filepath,
    fileSize: options.fileSize ?? buffer.byteLength,
    mimeType: options.mimeType,
    frameClassificationConfig: options.frameClassificationConfig,
    allowDecodeFailureMetadata: options.allowDecodeFailureMetadata,
    detectedFormat: options.detectedFormat,
  });
}

export function isImageLikeMedia(file: ImageLikeMediaRecord | null | undefined): boolean {
  if (!file) return false;
  if (file.mediaKind) return file.mediaKind === "image";
  if (file.sourceType) {
    return file.sourceType === "fits" || file.sourceType === "raster";
  }
  if (file.filename) {
    const detected = detectSupportedMediaFormat(file.filename);
    if (!detected) return false;
    return detected.sourceType === "fits" || detected.sourceType === "raster";
  }
  return false;
}
