import type { ImageSourceFormat, ImageSourceType } from "../fits/types";
import { getImageLoadCache, type ImageLoadCacheEntry } from "../cache/imageLoadCache";
import {
  hydratePixelCacheFromImageSnapshot,
  warmImageCachesFromFile,
} from "../cache/imageLoadWorkflow";
import { type SupportedMediaFormat, type SupportedMediaFormatId } from "../import/fileFormat";
import { parseImageBuffer, parseImageFile } from "../import/imageParsePipeline";
import { File } from "expo-file-system";

type ScientificImageSourceType = Extract<ImageSourceType, "fits" | "raster">;

export interface ScientificImageLoadResult {
  pixels: Float32Array;
  width: number;
  height: number;
  exposure: number | null;
  sourceType: ScientificImageSourceType;
  sourceFormat: ImageSourceFormat;
}

export interface LoadScientificImageFromBufferOptions {
  filename?: string;
  filepath?: string;
  mimeType?: string | null;
  detectedFormat?: SupportedMediaFormat | null;
  formatHint?: SupportedMediaFormatId;
  preferTiffDecoder?: boolean;
  cacheSize?: number;
  frameIndex?: number;
}

export interface LoadScientificImageFromPathOptions extends Omit<
  LoadScientificImageFromBufferOptions,
  "filename" | "filepath"
> {
  filename?: string;
}

function toPositiveExposure(value: unknown): number | null {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function filenameFromPath(filepath: string): string {
  const normalized = filepath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || filepath;
}

function normalizeFrameIndex(frameIndex: number | undefined): number {
  if (frameIndex == null || !Number.isFinite(frameIndex)) return 0;
  return Math.max(0, Math.floor(frameIndex));
}

function toScientificResultFromParsed(
  parsed: Awaited<ReturnType<typeof parseImageBuffer>>,
  filename: string,
): ScientificImageLoadResult {
  if (
    (parsed.sourceType !== "fits" && parsed.sourceType !== "raster") ||
    !parsed.pixels ||
    !parsed.dimensions
  ) {
    throw new Error(`Failed to read image data from ${filename}`);
  }

  return {
    pixels: parsed.pixels,
    width: parsed.dimensions.width,
    height: parsed.dimensions.height,
    exposure: toPositiveExposure(parsed.metadataBase.exptime),
    sourceType: parsed.sourceType,
    sourceFormat: parsed.sourceFormat,
  };
}

function resolveFileSize(filepath: string): number | null {
  try {
    const file = new File(filepath);
    if (!file.exists) return null;
    const size = file.size;
    if (typeof size !== "number" || !Number.isFinite(size) || size <= 0) return null;
    return size;
  } catch {
    return null;
  }
}

async function tryLoadScientificFromSnapshot(
  cacheKey: string,
  snapshot: ImageLoadCacheEntry | null,
  options: {
    filename: string;
    filepath: string;
    fileSize: number;
    mimeType?: string | null;
    detectedFormat?: SupportedMediaFormat | null;
    frameIndex?: number;
  },
): Promise<ScientificImageLoadResult | null> {
  if (!snapshot) return null;

  if (snapshot.sourceType === "fits") {
    const hydrated = await hydratePixelCacheFromImageSnapshot(cacheKey, snapshot);
    if (!hydrated) return null;
    return {
      pixels: hydrated.pixels,
      width: hydrated.width,
      height: hydrated.height,
      exposure: toPositiveExposure(snapshot.metadataBase.exptime),
      sourceType: snapshot.sourceType,
      sourceFormat: snapshot.sourceFormat,
    };
  }

  const frameIndex = normalizeFrameIndex(options.frameIndex);
  if (snapshot.rasterFrameProvider) {
    const frame = await snapshot.rasterFrameProvider.getFrame(frameIndex);
    return {
      pixels: frame.pixels,
      width: frame.width,
      height: frame.height,
      exposure: toPositiveExposure(snapshot.metadataBase.exptime),
      sourceType: snapshot.sourceType,
      sourceFormat: snapshot.sourceFormat,
    };
  }

  if (!snapshot.sourceBuffer.byteLength) return null;
  const reparsed = await parseImageBuffer({
    buffer: snapshot.sourceBuffer,
    filename: options.filename,
    filepath: options.filepath,
    fileSize: options.fileSize,
    mimeType: options.mimeType,
    detectedFormat: options.detectedFormat,
  });
  return toScientificResultFromParsed(reparsed, options.filename);
}

export async function loadScientificImageFromBuffer(
  buffer: ArrayBuffer,
  options: LoadScientificImageFromBufferOptions = {},
): Promise<ScientificImageLoadResult> {
  const filename = options.filename ?? options.filepath ?? "image";
  const parsed = await parseImageBuffer({
    buffer,
    filename,
    filepath: options.filepath,
    mimeType: options.mimeType,
    detectedFormat: options.detectedFormat,
  });
  return toScientificResultFromParsed(parsed, filename);
}

export async function loadScientificImageFromPath(
  filepath: string,
  options: LoadScientificImageFromPathOptions = {},
): Promise<ScientificImageLoadResult> {
  const filename = options.filename ?? filenameFromPath(filepath);
  const fileSize = resolveFileSize(filepath);

  if (fileSize != null) {
    try {
      const cacheKey = await warmImageCachesFromFile({
        filepath,
        filename,
        fileSize,
      });
      if (cacheKey) {
        const snapshot = getImageLoadCache(cacheKey);
        const fromSnapshot = await tryLoadScientificFromSnapshot(cacheKey, snapshot, {
          filename,
          filepath,
          fileSize,
          mimeType: options.mimeType,
          detectedFormat: options.detectedFormat,
          frameIndex: options.frameIndex,
        });
        if (fromSnapshot) return fromSnapshot;
      }
    } catch {
      // fall back to direct parse path
    }
  }

  const parsed = await parseImageFile({
    filepath,
    filename,
    mimeType: options.mimeType,
    detectedFormat: options.detectedFormat,
  });
  return toScientificResultFromParsed(parsed, filename);
}
