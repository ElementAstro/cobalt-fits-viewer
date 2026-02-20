/**
 * Batch format conversion processor.
 */

import { File as FSFile } from "expo-file-system";
import type { BatchTask, ConvertOptions } from "../fits/types";
import {
  extractMetadata,
  getCommentsAndHistory,
  getHeaderKeywords,
  getImageChannels,
  getImageDimensions,
  getImagePixels,
  isRgbCube,
  loadScientificFitsFromBuffer,
} from "../fits/parser";
import {
  detectPreferredSupportedImageFormat,
  splitFilenameExtension,
  toImageSourceFormat,
} from "../import/fileFormat";
import { extractRasterMetadata, parseRasterFromBufferAsync } from "../image/rasterParser";
import { readFileAsArrayBuffer } from "../utils/fileManager";
import { fitsToRGBA } from "./formatConverter";
import { getExportDir } from "../utils/imageExport";
import { LOG_TAGS, Logger } from "../logger";
import { encodeExportRequest, type ExportRequest } from "./exportCore";

/**
 * Create batch conversion task.
 */
export function createBatchTask(fileIds: string[], _options: ConvertOptions): BatchTask {
  return {
    id: `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    type: "convert",
    status: "pending",
    progress: 0,
    total: fileIds.length,
    completed: 0,
    failed: 0,
    skipped: 0,
    warnings: [],
    createdAt: Date.now(),
  };
}

export interface BatchFileInfo {
  id?: string;
  filepath: string;
  filename: string;
  sourceType?: "fits" | "raster" | "video" | "audio";
  mediaKind?: "image" | "video" | "audio";
}

interface BatchProgressCallback {
  (taskId: string, updates: Partial<BatchTask>): void;
}

export interface BatchNamingOptions {
  rule: "original" | "prefix" | "suffix" | "sequence";
  prefix?: string;
  suffix?: string;
  sequenceStart?: number;
}

function isNonImageInput(file: BatchFileInfo): boolean {
  if (file.mediaKind && file.mediaKind !== "image") return true;
  if (file.sourceType === "video" || file.sourceType === "audio") return true;
  return false;
}

function formatFinalError(errors: string[], skippedReasons: string[]): string | undefined {
  if (errors.length === 0 && skippedReasons.length === 0) return undefined;
  const lines: string[] = [];
  if (errors.length > 0) {
    lines.push(`Failed (${errors.length}):`);
    lines.push(...errors);
  }
  if (skippedReasons.length > 0) {
    lines.push(`Skipped (${skippedReasons.length}):`);
    lines.push(...skippedReasons);
  }
  return lines.join("\n");
}

function toProgress(total: number, completed: number, failed: number, skipped: number): number {
  if (total <= 0) return 0;
  return Math.round(((completed + failed + skipped) / total) * 100);
}

async function buildExportRequest(
  file: BatchFileInfo,
  options: ConvertOptions,
): Promise<ExportRequest> {
  const buffer = await readFileAsArrayBuffer(file.filepath);
  const detected = detectPreferredSupportedImageFormat({
    filename: file.filename,
    payload: buffer,
  });
  if (!detected) {
    throw new Error("Unsupported input format");
  }
  if (detected.sourceType === "video" || detected.sourceType === "audio") {
    throw new Error("non-image-source");
  }

  let width = 0;
  let height = 0;
  let rgbaData: Uint8ClampedArray | null = null;
  let scientificPixels: Float32Array | null = null;
  let channels: { r: Float32Array; g: Float32Array; b: Float32Array } | null = null;
  let headerKeywords: ReturnType<typeof getHeaderKeywords> | undefined;
  let comments: string[] = [];
  let history: string[] = [];
  let metadata:
    | ReturnType<typeof extractMetadata>
    | ReturnType<typeof extractRasterMetadata>
    | undefined;

  if (detected.sourceType === "fits") {
    const fitsObj = await loadScientificFitsFromBuffer(buffer, {
      filename: file.filename,
      detectedFormat: detected,
    });
    const dims = getImageDimensions(fitsObj);
    if (!dims) throw new Error("No image data");

    width = dims.width;
    height = dims.height;
    scientificPixels = await getImagePixels(fitsObj);
    if (!scientificPixels) throw new Error("No pixel data");

    if (isRgbCube(fitsObj).isRgb) {
      const rgb = await getImageChannels(fitsObj);
      channels = rgb ? { r: rgb.r, g: rgb.g, b: rgb.b } : null;
    }

    headerKeywords = getHeaderKeywords(fitsObj);
    const ch = getCommentsAndHistory(fitsObj);
    comments = ch.comments;
    history = ch.history;
    metadata = extractMetadata(fitsObj, {
      filename: file.filename,
      filepath: file.filepath,
      fileSize: buffer.byteLength,
    });

    rgbaData = fitsToRGBA(scientificPixels, width, height, {
      stretch: options.stretch,
      colormap: options.colormap,
      blackPoint: options.blackPoint,
      whitePoint: options.whitePoint,
      gamma: options.gamma,
      outputBlack: options.outputBlack,
      outputWhite: options.outputWhite,
      brightness: options.brightness,
      contrast: options.contrast,
      mtfMidtone: options.mtfMidtone,
      curvePreset: options.curvePreset,
    });
  } else {
    const decoded = await parseRasterFromBufferAsync(buffer, {
      frameIndex: 0,
      cacheSize: 3,
      preferTiffDecoder: true,
    });
    width = decoded.width;
    height = decoded.height;
    rgbaData = new Uint8ClampedArray(decoded.rgba);
    scientificPixels = decoded.pixels;
    channels = decoded.channels;
    metadata = extractRasterMetadata(
      {
        filename: file.filename,
        filepath: file.filepath,
        fileSize: buffer.byteLength,
      },
      {
        width,
        height,
        depth: decoded.depth,
        bitDepth: decoded.bitDepth,
      },
    );
  }

  if (!rgbaData) {
    throw new Error("Failed to produce RGBA data");
  }

  return {
    rgbaData,
    width,
    height,
    filename: file.filename,
    format: options.format,
    quality: options.quality,
    bitDepth: options.bitDepth,
    fits: options.fits,
    tiff: options.tiff,
    source: {
      sourceFileId: file.id,
      sourceType: detected.sourceType,
      sourceFormat: toImageSourceFormat(detected),
      originalBuffer: buffer,
      scientificPixels,
      rgbChannels: channels,
      metadata,
      headerKeywords,
      comments,
      history,
    },
    renderOptions: {
      includeAnnotations: options.includeAnnotations,
      includeWatermark: options.includeWatermark,
    },
  };
}

/**
 * Execute batch conversion.
 */
export async function executeBatchConvert(
  taskId: string,
  files: BatchFileInfo[],
  options: ConvertOptions,
  onProgress: BatchProgressCallback,
  signal?: AbortSignal,
  naming?: BatchNamingOptions,
): Promise<void> {
  onProgress(taskId, { status: "running", startedAt: Date.now(), warnings: [] });

  let completed = 0;
  let failed = 0;
  let skipped = 0;
  const errors: string[] = [];
  const skippedReasons: string[] = [];
  const warnings: string[] = [];
  const exportDir = getExportDir();

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) {
      onProgress(taskId, { status: "cancelled", finishedAt: Date.now() });
      return;
    }

    const file = files[i];
    if (isNonImageInput(file)) {
      skipped++;
      skippedReasons.push(`${file.filename}: non-image source`);
      onProgress(taskId, {
        completed,
        failed,
        skipped,
        progress: toProgress(files.length, completed, failed, skipped),
      });
      continue;
    }

    try {
      const request = await buildExportRequest(file, options);
      const encoded = await encodeExportRequest(request);
      if (!encoded.bytes || encoded.bytes.length === 0 || !encoded.extension) {
        throw new Error("Failed to encode output");
      }

      if (encoded.diagnostics.warnings.length > 0) {
        warnings.push(...encoded.diagnostics.warnings.map((item) => `${file.filename}: ${item}`));
      }
      if (encoded.diagnostics.fallbackApplied && encoded.diagnostics.fallbackReasonCode) {
        warnings.push(
          `${file.filename}: FITS fallback ${encoded.diagnostics.fallbackReasonCode} (requested=${encoded.diagnostics.requestedFitsMode ?? "unknown"}, effective=${encoded.diagnostics.effectiveFitsMode ?? "unknown"})`,
        );
      }

      const outputFilename = generateOutputFilename(
        file.filename,
        encoded.extension,
        naming?.rule ?? "original",
        {
          prefix: naming?.prefix,
          suffix: naming?.suffix,
          index: (naming?.sequenceStart ?? 1) + i,
        },
      );
      const outFile = new FSFile(exportDir, outputFilename);
      outFile.write(encoded.bytes);

      completed++;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      if (message === "Unsupported input format" || message === "non-image-source") {
        skipped++;
        skippedReasons.push(`${file.filename}: ${message}`);
      } else {
        failed++;
        errors.push(`${file.filename}: ${message}`);
        Logger.warn(LOG_TAGS.Export, "Batch export failed", {
          file: file.filename,
          message,
        });
      }
    }

    onProgress(taskId, {
      completed,
      failed,
      skipped,
      warnings,
      progress: toProgress(files.length, completed, failed, skipped),
    });
  }

  const finalStatus =
    failed === files.length && completed === 0 && skipped === 0 ? "failed" : "completed";
  onProgress(taskId, {
    status: finalStatus,
    progress: 100,
    completed,
    failed,
    skipped,
    warnings,
    finishedAt: Date.now(),
    error: formatFinalError(errors, skippedReasons),
  });
}

/**
 * Generate batch output filename.
 */
export function generateOutputFilename(
  originalFilename: string,
  format: string,
  rule: "original" | "prefix" | "suffix" | "sequence",
  options?: { prefix?: string; suffix?: string; index?: number },
): string {
  const normalizedOriginal = originalFilename.toLowerCase();
  const normalizedFormat = `.${format.toLowerCase()}`;
  if (rule === "original" && normalizedOriginal.endsWith(normalizedFormat)) {
    return originalFilename;
  }

  const { baseName } = splitFilenameExtension(originalFilename);
  const safeBaseName = baseName || originalFilename;

  switch (rule) {
    case "original":
      return `${safeBaseName}.${format}`;
    case "prefix":
      return `${options?.prefix ?? "converted"}_${safeBaseName}.${format}`;
    case "suffix":
      return `${safeBaseName}_${options?.suffix ?? "converted"}.${format}`;
    case "sequence":
      return `${safeBaseName}_${String(options?.index ?? 0).padStart(4, "0")}.${format}`;
    default:
      return `${safeBaseName}.${format}`;
  }
}

/**
 * Calculate batch task progress.
 */
export function calculateProgress(task: BatchTask): number {
  if (task.total === 0) return 0;
  return Math.round(((task.completed + task.failed + (task.skipped ?? 0)) / task.total) * 100);
}
