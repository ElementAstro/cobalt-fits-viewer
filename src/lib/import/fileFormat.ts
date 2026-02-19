/**
 * 导入格式识别工具
 * 统一管理支持的媒体格式与扩展名匹配逻辑
 */

import type { ImageSourceFormat } from "../fits/types";

export type ImageSourceType = "fits" | "raster" | "video";

export type SupportedMediaFormatId =
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
  | "bmp"
  | "gif"
  | "heic"
  | "avif"
  | "mp4"
  | "mov"
  | "m4v"
  | "webm"
  | "mkv"
  | "avi"
  | "3gp";

export type SupportedImageFormatId = Exclude<
  SupportedMediaFormatId,
  "mp4" | "mov" | "m4v" | "webm" | "mkv" | "avi" | "3gp"
>;

export interface SupportedMediaFormat {
  id: SupportedMediaFormatId;
  sourceType: ImageSourceType;
  label: string;
  extensions: string[];
}

// Legacy alias kept for compatibility.
export type SupportedImageFormat = SupportedMediaFormat;

const SUPPORTED_FORMATS: SupportedMediaFormat[] = [
  { id: "fits", sourceType: "fits", label: "FITS", extensions: [".fits"] },
  { id: "fit", sourceType: "fits", label: "FIT", extensions: [".fit"] },
  { id: "fts", sourceType: "fits", label: "FTS", extensions: [".fts"] },
  { id: "fz", sourceType: "fits", label: "FZ", extensions: [".fz"] },
  { id: "fits_gz", sourceType: "fits", label: "FITS.GZ", extensions: [".fits.gz"] },
  { id: "fit_gz", sourceType: "fits", label: "FIT.GZ", extensions: [".fit.gz"] },
  { id: "png", sourceType: "raster", label: "PNG", extensions: [".png"] },
  {
    id: "jpeg",
    sourceType: "raster",
    label: "JPEG",
    extensions: [".jpg", ".jpeg", ".jfif", ".jpe"],
  },
  { id: "webp", sourceType: "raster", label: "WebP", extensions: [".webp"] },
  { id: "tiff", sourceType: "raster", label: "TIFF", extensions: [".tif", ".tiff"] },
  { id: "bmp", sourceType: "raster", label: "BMP", extensions: [".bmp"] },
  { id: "gif", sourceType: "raster", label: "GIF", extensions: [".gif"] },
  { id: "heic", sourceType: "raster", label: "HEIC/HEIF", extensions: [".heic", ".heif"] },
  { id: "avif", sourceType: "raster", label: "AVIF", extensions: [".avif"] },
  { id: "mp4", sourceType: "video", label: "MP4", extensions: [".mp4"] },
  { id: "mov", sourceType: "video", label: "MOV", extensions: [".mov"] },
  { id: "m4v", sourceType: "video", label: "M4V", extensions: [".m4v"] },
  { id: "webm", sourceType: "video", label: "WebM", extensions: [".webm"] },
  { id: "mkv", sourceType: "video", label: "MKV", extensions: [".mkv"] },
  { id: "avi", sourceType: "video", label: "AVI", extensions: [".avi"] },
  { id: "3gp", sourceType: "video", label: "3GP", extensions: [".3gp"] },
];

const FORMAT_LOOKUP = new Map<string, SupportedMediaFormat>();
for (const format of SUPPORTED_FORMATS) {
  for (const ext of format.extensions) {
    FORMAT_LOOKUP.set(ext, format);
  }
}

const FORMAT_ID_LOOKUP = new Map<SupportedMediaFormatId, SupportedMediaFormat>();
for (const format of SUPPORTED_FORMATS) {
  FORMAT_ID_LOOKUP.set(format.id, format);
}

const MIME_LOOKUP = new Map<string, SupportedMediaFormatId>([
  ["image/png", "png"],
  ["image/jpeg", "jpeg"],
  ["image/jpg", "jpeg"],
  ["image/pjpeg", "jpeg"],
  ["image/webp", "webp"],
  ["image/tiff", "tiff"],
  ["image/x-tiff", "tiff"],
  ["image/bmp", "bmp"],
  ["image/x-ms-bmp", "bmp"],
  ["image/gif", "gif"],
  ["image/heic", "heic"],
  ["image/heif", "heic"],
  ["image/avif", "avif"],
  ["application/fits", "fits"],
  ["image/fits", "fits"],
  ["application/x-fits", "fits"],
  ["video/mp4", "mp4"],
  ["video/quicktime", "mov"],
  ["video/x-m4v", "m4v"],
  ["video/webm", "webm"],
  ["video/x-matroska", "mkv"],
  ["video/x-msvideo", "avi"],
  ["video/3gpp", "3gp"],
]);

export interface SupportedMediaFormatDetectionInput {
  filename?: string | null;
  mimeType?: string | null;
  payload?: ArrayBuffer | Uint8Array | null;
}

// Legacy alias kept for compatibility.
export type SupportedImageFormatDetectionInput = SupportedMediaFormatDetectionInput;

const KNOWN_MULTIPART_EXTENSIONS = [".fits.gz", ".fit.gz"] as const;

const SUPPORTED_EXTENSIONS_SORTED = Array.from(
  new Set(SUPPORTED_FORMATS.flatMap((f) => f.extensions)),
)
  .map((ext) => ext.toLowerCase())
  .sort((a, b) => b.length - a.length);

function normalizeFilename(filename: string): string {
  const lower = filename.toLowerCase().trim();
  const withoutQuery = lower.split("?")[0];
  return withoutQuery.split("#")[0];
}

export function getKnownMultipartExtensions(): readonly string[] {
  return KNOWN_MULTIPART_EXTENSIONS;
}

export function splitFilenameExtension(filename: string): { baseName: string; extension: string } {
  const trimmed = filename.trim();
  if (!trimmed) return { baseName: "", extension: "" };

  const withoutQuery = trimmed.split("?")[0];
  const clean = withoutQuery.split("#")[0];
  const normalized = normalizeFilename(clean);
  for (const ext of SUPPORTED_EXTENSIONS_SORTED) {
    if (normalized.endsWith(ext)) {
      return {
        baseName: clean.slice(0, clean.length - ext.length),
        extension: clean.slice(clean.length - ext.length),
      };
    }
  }

  const lastDot = clean.lastIndexOf(".");
  if (lastDot <= 0) {
    return { baseName: clean, extension: "" };
  }
  return {
    baseName: clean.slice(0, lastDot),
    extension: clean.slice(lastDot),
  };
}

export function replaceFilenameExtension(filename: string, nextExtension: string): string {
  const ext = nextExtension.startsWith(".") ? nextExtension : `.${nextExtension}`;
  const { baseName } = splitFilenameExtension(filename);
  return `${baseName || filename}${ext}`;
}

export function detectSupportedMediaFormat(filename: string): SupportedMediaFormat | null {
  const normalized = normalizeFilename(filename);
  for (const ext of KNOWN_MULTIPART_EXTENSIONS) {
    if (normalized.endsWith(ext)) {
      return FORMAT_LOOKUP.get(ext) ?? null;
    }
  }

  const lastDot = normalized.lastIndexOf(".");
  if (lastDot < 0) return null;
  const ext = normalized.slice(lastDot);
  return FORMAT_LOOKUP.get(ext) ?? null;
}

export function detectSupportedImageFormat(filename: string): SupportedMediaFormat | null {
  return detectSupportedMediaFormat(filename);
}

export function detectPreferredSupportedMediaFormat(
  input: SupportedMediaFormatDetectionInput,
): SupportedMediaFormat | null {
  const byContent = detectSupportedMediaFormatByContent(input.payload);
  if (byContent) return byContent;

  const byMimeType = detectSupportedMediaFormatByMimeType(input.mimeType);
  if (byMimeType) return byMimeType;

  if (input.filename) {
    return detectSupportedMediaFormat(input.filename);
  }

  return null;
}

export function detectPreferredSupportedImageFormat(
  input: SupportedImageFormatDetectionInput,
): SupportedMediaFormat | null {
  return detectPreferredSupportedMediaFormat(input);
}

export function detectSupportedMediaFormatByMimeType(
  mimeType: string | null | undefined,
): SupportedMediaFormat | null {
  if (!mimeType) return null;
  const normalized = mimeType.toLowerCase().split(";")[0].trim();
  const formatId = MIME_LOOKUP.get(normalized);
  if (!formatId) return null;
  return FORMAT_ID_LOOKUP.get(formatId) ?? null;
}

export function detectSupportedImageFormatByMimeType(
  mimeType: string | null | undefined,
): SupportedMediaFormat | null {
  return detectSupportedMediaFormatByMimeType(mimeType);
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  const end = Math.min(bytes.length, start + length);
  let out = "";
  for (let i = start; i < end; i++) {
    out += String.fromCharCode(bytes[i]);
  }
  return out;
}

function equalsBytes(bytes: Uint8Array, offset: number, expected: number[]): boolean {
  if (bytes.length < offset + expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (bytes[offset + i] !== expected[i]) return false;
  }
  return true;
}

function detectIsoBmff(bytes: Uint8Array): SupportedMediaFormat | null {
  if (ascii(bytes, 4, 4) !== "ftyp") return null;
  const brands = ascii(bytes, 8, Math.min(64, bytes.length - 8)).toLowerCase();

  if (brands.includes("avif") || brands.includes("avis")) {
    return FORMAT_ID_LOOKUP.get("avif") ?? null;
  }
  if (
    brands.includes("heic") ||
    brands.includes("heif") ||
    brands.includes("heix") ||
    brands.includes("hevc") ||
    brands.includes("hevx") ||
    brands.includes("mif1") ||
    brands.includes("msf1")
  ) {
    return FORMAT_ID_LOOKUP.get("heic") ?? null;
  }
  if (brands.includes("qt")) {
    return FORMAT_ID_LOOKUP.get("mov") ?? null;
  }
  if (brands.includes("m4v")) {
    return FORMAT_ID_LOOKUP.get("m4v") ?? null;
  }
  if (brands.includes("3gp") || brands.includes("3g2")) {
    return FORMAT_ID_LOOKUP.get("3gp") ?? null;
  }
  if (
    brands.includes("mp4") ||
    brands.includes("isom") ||
    brands.includes("iso2") ||
    brands.includes("avc1") ||
    brands.includes("mp41") ||
    brands.includes("mp42")
  ) {
    return FORMAT_ID_LOOKUP.get("mp4") ?? null;
  }

  return null;
}

export function detectSupportedMediaFormatByContent(
  payload: ArrayBuffer | Uint8Array | null | undefined,
): SupportedMediaFormat | null {
  if (!payload) return null;
  const bytes = payload instanceof Uint8Array ? payload : new Uint8Array(payload);
  if (bytes.length < 4) return null;

  // PNG
  if (equalsBytes(bytes, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return FORMAT_ID_LOOKUP.get("png") ?? null;
  }

  // JPEG
  if (equalsBytes(bytes, 0, [0xff, 0xd8, 0xff])) {
    return FORMAT_ID_LOOKUP.get("jpeg") ?? null;
  }

  // GIF
  const gif = ascii(bytes, 0, 6);
  if (gif === "GIF87a" || gif === "GIF89a") {
    return FORMAT_ID_LOOKUP.get("gif") ?? null;
  }

  // WEBP (RIFF....WEBP)
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
    return FORMAT_ID_LOOKUP.get("webp") ?? null;
  }

  // AVI (RIFF....AVI )
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "AVI ") {
    return FORMAT_ID_LOOKUP.get("avi") ?? null;
  }

  // TIFF
  if (
    equalsBytes(bytes, 0, [0x49, 0x49, 0x2a, 0x00]) ||
    equalsBytes(bytes, 0, [0x4d, 0x4d, 0x00, 0x2a]) ||
    equalsBytes(bytes, 0, [0x49, 0x49, 0x2b, 0x00]) ||
    equalsBytes(bytes, 0, [0x4d, 0x4d, 0x00, 0x2b])
  ) {
    return FORMAT_ID_LOOKUP.get("tiff") ?? null;
  }

  // BMP
  if (ascii(bytes, 0, 2) === "BM") {
    return FORMAT_ID_LOOKUP.get("bmp") ?? null;
  }

  // FITS (starts with "SIMPLE  =")
  if (ascii(bytes, 0, 9) === "SIMPLE  =") {
    return FORMAT_ID_LOOKUP.get("fits") ?? null;
  }

  // GZIP (heuristic: commonly used for fits.gz)
  if (equalsBytes(bytes, 0, [0x1f, 0x8b])) {
    return FORMAT_ID_LOOKUP.get("fits_gz") ?? null;
  }

  // ISO BMFF (HEIC/AVIF/MP4/MOV/M4V/3GP)
  const iso = detectIsoBmff(bytes);
  if (iso) return iso;

  // Matroska/WebM: EBML header 0x1A45DFA3
  if (equalsBytes(bytes, 0, [0x1a, 0x45, 0xdf, 0xa3])) {
    const ebml = ascii(bytes, 0, Math.min(128, bytes.length)).toLowerCase();
    if (ebml.includes("webm")) {
      return FORMAT_ID_LOOKUP.get("webm") ?? null;
    }
    return FORMAT_ID_LOOKUP.get("mkv") ?? null;
  }

  return null;
}

export function detectSupportedImageFormatByContent(
  payload: ArrayBuffer | Uint8Array | null | undefined,
): SupportedMediaFormat | null {
  return detectSupportedMediaFormatByContent(payload);
}

export function getPrimaryExtensionForFormat(
  format: SupportedMediaFormat | SupportedMediaFormatId | null | undefined,
): string {
  if (!format) return "";
  const id = typeof format === "string" ? format : format.id;
  return FORMAT_ID_LOOKUP.get(id)?.extensions[0] ?? "";
}

export function isSupportedMediaFilename(filename: string): boolean {
  return detectSupportedMediaFormat(filename) !== null;
}

export function isSupportedImageFilename(filename: string): boolean {
  return isSupportedMediaFilename(filename);
}

export function isFitsFamilyFilename(filename: string): boolean {
  const format = detectSupportedMediaFormat(filename);
  return format?.sourceType === "fits";
}

export function isVideoFilename(filename: string): boolean {
  const format = detectSupportedMediaFormat(filename);
  return format?.sourceType === "video";
}

const FORMAT_TO_SOURCE_FORMAT: Record<
  SupportedMediaFormatId,
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
  gif: "gif",
  heic: "heic",
  avif: "avif",
  mp4: "mp4",
  mov: "mov",
  m4v: "m4v",
  webm: "webm",
  mkv: "mkv",
  avi: "avi",
  "3gp": "3gp",
};

export function toImageSourceFormat(
  format: SupportedMediaFormat | SupportedMediaFormatId | null | undefined,
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
