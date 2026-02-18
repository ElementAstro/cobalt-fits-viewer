/**
 * 批量格式转换处理器
 */

import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import { File as FSFile } from "expo-file-system";
import type { BatchTask, ConvertOptions } from "../fits/types";
import { DEFAULT_FITS_TARGET_OPTIONS } from "../fits/types";
import {
  extractMetadata,
  getCommentsAndHistory,
  getHeaderKeywords,
  getImageChannels,
  getImageDimensions,
  getImagePixels,
  isRgbCube,
  loadFitsFromBufferAuto,
} from "../fits/parser";
import { writeFitsImage } from "../fits/writer";
import { gzipFitsBytes, normalizeFitsCompression } from "../fits/compression";
import {
  detectPreferredSupportedImageFormat,
  splitFilenameExtension,
  toImageSourceFormat,
} from "../import/fileFormat";
import { extractRasterMetadata, parseRasterFromBuffer } from "../image/rasterParser";
import { encodeTiff } from "../image/encoders/tiff";
import { encodeBmp24 } from "../image/encoders/bmp";
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

function rgbaToLuma(rgba: Uint8ClampedArray): Float32Array {
  const totalPixels = Math.floor(rgba.length / 4);
  const output = new Float32Array(totalPixels);
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    output[p] = (rgba[i] * 0.2126 + rgba[i + 1] * 0.7152 + rgba[i + 2] * 0.0722) / 255;
  }
  return output;
}

function rgbaToChannels(rgba: Uint8ClampedArray): {
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

function encodeSkia(
  rgbaData: Uint8ClampedArray,
  width: number,
  height: number,
  format: ConvertOptions["format"],
  quality: number,
): Uint8Array {
  const data = Skia.Data.fromBytes(new Uint8Array(rgbaData.buffer));
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
  if (!skImage) throw new Error("Failed to create Skia image");

  const bytes = skImage.encodeToBytes(resolveSkiaFormat(format), resolveQuality(format, quality));
  if (!bytes || bytes.length === 0) throw new Error("Failed to encode image");
  return bytes;
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
  const baseExt = getExtension(options.format);

  for (let i = 0; i < files.length; i++) {
    if (signal?.aborted) {
      onProgress(taskId, { status: "cancelled", finishedAt: Date.now() });
      return;
    }

    const file = files[i];
    try {
      const buffer = await readFileAsArrayBuffer(file.filepath);
      const detected = detectPreferredSupportedImageFormat({
        filename: file.filename,
        payload: buffer,
      });
      if (!detected) throw new Error("Unsupported input format");

      let width = 0;
      let height = 0;
      let rgbaData: Uint8ClampedArray | null = null;
      let scientificPixels: Float32Array | null = null;
      let channels: { r: Float32Array; g: Float32Array; b: Float32Array } | null = null;
      let headerKeywords = undefined as ReturnType<typeof getHeaderKeywords> | undefined;
      let comments: string[] = [];
      let history: string[] = [];
      let metadata: ReturnType<typeof extractMetadata> | undefined;

      if (detected.sourceType === "fits") {
        const fitsObj = loadFitsFromBufferAuto(buffer);
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
        });
      } else {
        const decoded = parseRasterFromBuffer(buffer);
        width = decoded.width;
        height = decoded.height;
        rgbaData = new Uint8ClampedArray(decoded.rgba);
        scientificPixels = decoded.pixels;
        channels = decoded.channels;
        metadata = {
          ...extractRasterMetadata(
            {
              filename: file.filename,
              filepath: file.filepath,
              fileSize: buffer.byteLength,
            },
            { width, height },
          ),
        };
      }

      let bytes: Uint8Array;
      let ext = baseExt;

      if (options.format === "fits") {
        const fitsOptions = options.fits ?? DEFAULT_FITS_TARGET_OPTIONS;
        const fastPathAllowed =
          fitsOptions.mode === "scientific" &&
          detected.sourceType === "fits" &&
          fitsOptions.preserveOriginalHeader &&
          fitsOptions.preserveWcs;

        if (fastPathAllowed) {
          bytes = normalizeFitsCompression(
            buffer,
            fitsOptions.compression === "gzip" ? "gzip" : "none",
          );
        } else {
          const needsRgbCube = fitsOptions.colorLayout === "rgbCube3d";
          const useScientific = fitsOptions.mode === "scientific" && detected.sourceType === "fits";

          const image = needsRgbCube
            ? {
                kind: "rgbCube3d" as const,
                width,
                height,
                ...(useScientific && channels
                  ? channels
                  : rgbaToChannels(
                      rgbaData ??
                        fitsToRGBA(
                          scientificPixels ?? new Float32Array(width * height),
                          width,
                          height,
                          {
                            stretch: options.stretch,
                            colormap: options.colormap,
                            blackPoint: options.blackPoint,
                            whitePoint: options.whitePoint,
                            gamma: options.gamma,
                          },
                        ),
                    )),
              }
            : {
                kind: "mono2d" as const,
                width,
                height,
                pixels:
                  useScientific && scientificPixels
                    ? scientificPixels
                    : rgbaToLuma(
                        rgbaData ??
                          fitsToRGBA(new Float32Array(width * height), width, height, {
                            stretch: options.stretch,
                            colormap: options.colormap,
                            blackPoint: options.blackPoint,
                            whitePoint: options.whitePoint,
                            gamma: options.gamma,
                          }),
                      ),
              };

          bytes = writeFitsImage({
            image,
            bitpix: fitsOptions.bitpix,
            preserveOriginalHeader: fitsOptions.preserveOriginalHeader,
            preserveWcs: fitsOptions.preserveWcs,
            originalHeaderKeywords: headerKeywords,
            comments,
            history,
            metadata,
            exportMode: fitsOptions.mode,
            sourceFormat: toImageSourceFormat(detected),
            targetFormat: fitsOptions.compression === "gzip" ? "fits.gz" : "fits",
          });

          if (fitsOptions.compression === "gzip") {
            bytes = gzipFitsBytes(bytes);
          }
        }

        ext = fitsOptions.compression === "gzip" ? "fits.gz" : "fits";
      } else {
        if (!rgbaData) throw new Error("Failed to produce RGBA data");
        switch (options.format) {
          case "png":
          case "jpeg":
          case "webp":
            bytes = encodeSkia(rgbaData, width, height, options.format, options.quality);
            break;
          case "tiff":
            bytes = encodeTiff(rgbaData, width, height, {
              bitDepth: options.bitDepth,
              colorMode: "auto",
            });
            break;
          case "bmp":
            bytes = encodeBmp24(rgbaData, width, height);
            break;
          default:
            throw new Error(`Unsupported output format: ${options.format}`);
        }
      }

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
 * 计算批量任务进度
 */
export function calculateProgress(task: BatchTask): number {
  if (task.total === 0) return 0;
  return Math.round(((task.completed + task.failed) / task.total) * 100);
}
