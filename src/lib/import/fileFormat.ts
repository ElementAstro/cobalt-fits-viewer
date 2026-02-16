/**
 * 导入格式识别工具
 * 统一管理支持的图像格式与扩展名匹配逻辑
 */

import type { ImageSourceFormat } from "../fits/types";

export type ImageSourceType = "fits" | "raster";

export type SupportedImageFormatId =
  | "fits"
  | "fit"
  | "fts"
  | "fz"
  | "fits_gz"
  | "fit_gz"
  | "png"
  | "jpeg"
  | "webp"
  | "tiff"
  | "bmp";

export interface SupportedImageFormat {
  id: SupportedImageFormatId;
  sourceType: ImageSourceType;
  label: string;
  extensions: string[];
}

const SUPPORTED_FORMATS: SupportedImageFormat[] = [
  { id: "fits", sourceType: "fits", label: "FITS", extensions: [".fits"] },
  { id: "fit", sourceType: "fits", label: "FIT", extensions: [".fit"] },
  { id: "fts", sourceType: "fits", label: "FTS", extensions: [".fts"] },
  { id: "fz", sourceType: "fits", label: "FZ", extensions: [".fz"] },
  { id: "fits_gz", sourceType: "fits", label: "FITS.GZ", extensions: [".fits.gz"] },
  { id: "fit_gz", sourceType: "fits", label: "FIT.GZ", extensions: [".fit.gz"] },
  { id: "png", sourceType: "raster", label: "PNG", extensions: [".png"] },
  { id: "jpeg", sourceType: "raster", label: "JPEG", extensions: [".jpg", ".jpeg"] },
  { id: "webp", sourceType: "raster", label: "WebP", extensions: [".webp"] },
  { id: "tiff", sourceType: "raster", label: "TIFF", extensions: [".tif", ".tiff"] },
  { id: "bmp", sourceType: "raster", label: "BMP", extensions: [".bmp"] },
];

const FORMAT_LOOKUP = new Map<string, SupportedImageFormat>();
for (const format of SUPPORTED_FORMATS) {
  for (const ext of format.extensions) {
    FORMAT_LOOKUP.set(ext, format);
  }
}

function normalizeFilename(filename: string): string {
  const lower = filename.toLowerCase().trim();
  const withoutQuery = lower.split("?")[0];
  return withoutQuery.split("#")[0];
}

export function detectSupportedImageFormat(filename: string): SupportedImageFormat | null {
  const normalized = normalizeFilename(filename);
  const doubleExtCandidates = [".fits.gz", ".fit.gz"];
  for (const ext of doubleExtCandidates) {
    if (normalized.endsWith(ext)) {
      return FORMAT_LOOKUP.get(ext) ?? null;
    }
  }

  const lastDot = normalized.lastIndexOf(".");
  if (lastDot < 0) return null;
  const ext = normalized.slice(lastDot);
  return FORMAT_LOOKUP.get(ext) ?? null;
}

export function isSupportedImageFilename(filename: string): boolean {
  return detectSupportedImageFormat(filename) !== null;
}

export function isFitsFamilyFilename(filename: string): boolean {
  const format = detectSupportedImageFormat(filename);
  return format?.sourceType === "fits";
}

const FORMAT_TO_SOURCE_FORMAT: Record<
  SupportedImageFormatId,
  Exclude<ImageSourceFormat, "unknown">
> = {
  fits: "fits",
  fit: "fit",
  fts: "fts",
  fz: "fz",
  fits_gz: "fits.gz",
  fit_gz: "fit.gz",
  png: "png",
  jpeg: "jpeg",
  webp: "webp",
  tiff: "tiff",
  bmp: "bmp",
};

export function toImageSourceFormat(
  format: SupportedImageFormat | SupportedImageFormatId | null | undefined,
): ImageSourceFormat {
  if (!format) return "unknown";
  const id = typeof format === "string" ? format : format.id;
  return FORMAT_TO_SOURCE_FORMAT[id] ?? "unknown";
}

export function getSupportedImportLabels(): string[] {
  return Array.from(new Set(SUPPORTED_FORMATS.map((f) => f.label)));
}

export function getSupportedImportExtensions(): string[] {
  return Array.from(new Set(SUPPORTED_FORMATS.flatMap((f) => f.extensions)));
}
