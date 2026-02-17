/**
 * 批量格式转换处理器
 */

import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import { File as FSFile } from "expo-file-system";
import type { BatchTask, ConvertOptions } from "../fits/types";
import { loadFitsFromBuffer, getImagePixels, getImageDimensions } from "../fits/parser";
import { readFileAsArrayBuffer } from "../utils/fileManager";
import { fitsToRGBA } from "./formatConverter";
import { getExportDir, getExtension } from "../utils/imageExport";

/**
 * 创建批量转换任务
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
    createdAt: Date.now(),
  };
}

interface BatchFileInfo {
  filepath: string;
  filename: string;
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

function resolveSkiaFormat(
  format: ConvertOptions["format"],
): (typeof ImageFormat)[keyof typeof ImageFormat] {
  switch (format) {
    case "jpeg":
      return ImageFormat.JPEG;
    case "webp":
      return ImageFormat.WEBP;
    default:
      return ImageFormat.PNG;
  }
}

function resolveQuality(format: ConvertOptions["format"], quality: number): number {
  if (format === "jpeg" || format === "webp") return quality;
  return 100;
}

/**
 * 执行批量转换
 */
export async function executeBatchConvert(
  taskId: string,
  files: BatchFileInfo[],
  options: ConvertOptions,
  onProgress: BatchProgressCallback,
  signal?: AbortSignal,
  naming?: BatchNamingOptions,
): Promise<void> {
  onProgress(taskId, { status: "running", startedAt: Date.now() });

  let completed = 0;
  let failed = 0;
  const errors: string[] = [];
  const exportDir = getExportDir();
  const ext = getExtension(options.format);
  const skiaFmt = resolveSkiaFormat(options.format);
  const quality = resolveQuality(options.format, options.quality);

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) {
      onProgress(taskId, { status: "cancelled", finishedAt: Date.now() });
      return;
    }

    const file = files[i];
    try {
      const buffer = await readFileAsArrayBuffer(file.filepath);
      const fitsObj = loadFitsFromBuffer(buffer);
      const dims = getImageDimensions(fitsObj);
      if (!dims) throw new Error("No image data");

      const pixels = await getImagePixels(fitsObj);
      if (!pixels) throw new Error("No pixel data");
      const rgbaData = fitsToRGBA(pixels, dims.width, dims.height, {
        stretch: options.stretch,
        colormap: options.colormap,
        blackPoint: options.blackPoint,
        whitePoint: options.whitePoint,
        gamma: options.gamma,
      });

      const data = Skia.Data.fromBytes(new Uint8Array(rgbaData.buffer));
      const skImage = Skia.Image.MakeImage(
        {
          width: dims.width,
          height: dims.height,
          alphaType: AlphaType.Unpremul,
          colorType: ColorType.RGBA_8888,
        },
        data,
        dims.width * 4,
      );
      if (!skImage) throw new Error("Failed to create Skia image");

      const bytes = skImage.encodeToBytes(skiaFmt, quality);
      if (!bytes || bytes.length === 0) throw new Error("Failed to encode image");

      const outputFilename = generateOutputFilename(
        file.filename,
        ext,
        naming?.rule ?? "original",
        {
          prefix: naming?.prefix,
          suffix: naming?.suffix,
          index: (naming?.sequenceStart ?? 1) + i,
        },
      );
      const outFile = new FSFile(exportDir, outputFilename);
      outFile.write(bytes);

      completed++;
    } catch (e) {
      failed++;
      errors.push(`${file.filename}: ${e instanceof Error ? e.message : "Unknown error"}`);
    }

    const progress = Math.round(((completed + failed) / files.length) * 100);
    onProgress(taskId, { completed, failed, progress });
  }

  onProgress(taskId, {
    status: failed === files.length ? "failed" : "completed",
    progress: 100,
    completed,
    failed,
    finishedAt: Date.now(),
    error: errors.length > 0 ? errors.join("\n") : undefined,
  });
}

/**
 * 生成批量输出文件名
 */
export function generateOutputFilename(
  originalFilename: string,
  format: string,
  rule: "original" | "prefix" | "suffix" | "sequence",
  options?: { prefix?: string; suffix?: string; index?: number },
): string {
  const baseName = originalFilename.replace(/\.[^.]+$/, "");

  switch (rule) {
    case "original":
      return `${baseName}.${format}`;
    case "prefix":
      return `${options?.prefix ?? "converted"}_${baseName}.${format}`;
    case "suffix":
      return `${baseName}_${options?.suffix ?? "converted"}.${format}`;
    case "sequence":
      return `${baseName}_${String(options?.index ?? 0).padStart(4, "0")}.${format}`;
    default:
      return `${baseName}.${format}`;
  }
}

/**
 * 计算批量任务进度
 */
export function calculateProgress(task: BatchTask): number {
  if (task.total === 0) return 0;
  return Math.round(((task.completed + task.failed) / task.total) * 100);
}
