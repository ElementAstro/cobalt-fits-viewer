import type { ImageSourceFormat, ImageSourceType } from "../fits/types";
import { type SupportedMediaFormat, type SupportedMediaFormatId } from "../import/fileFormat";
import { parseImageBuffer, parseImageFile } from "../import/imageParsePipeline";

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
  if (!parsed.pixels || !parsed.dimensions) {
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

export async function loadScientificImageFromPath(
  filepath: string,
  options: LoadScientificImageFromPathOptions = {},
): Promise<ScientificImageLoadResult> {
  const parsed = await parseImageFile({
    filepath,
    filename: options.filename ?? filenameFromPath(filepath),
    mimeType: options.mimeType,
    detectedFormat: options.detectedFormat,
  });
  if (!parsed.pixels || !parsed.dimensions) {
    throw new Error(
      `Failed to read image data from ${options.filename ?? filenameFromPath(filepath)}`,
    );
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
