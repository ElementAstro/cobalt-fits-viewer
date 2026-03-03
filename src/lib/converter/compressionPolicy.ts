import type { ExportFormat } from "../fits/types";

export function isTargetSizeAllowed(format: ExportFormat, webpLossless?: boolean): boolean {
  if (format !== "jpeg" && format !== "webp") return false;
  if (format === "webp" && webpLossless) return false;
  return true;
}

export function normalizeTargetFileSize(
  format: ExportFormat,
  compressionMode: "quality" | "targetSize" | undefined,
  targetFileSize: number | undefined,
  webpLossless?: boolean,
): number | undefined {
  if (compressionMode !== "targetSize") return undefined;
  if (!isTargetSizeAllowed(format, webpLossless)) return undefined;
  if (typeof targetFileSize !== "number" || !Number.isFinite(targetFileSize)) return undefined;
  return targetFileSize > 0 ? targetFileSize : undefined;
}
