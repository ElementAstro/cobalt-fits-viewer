/**
 * 图像导出逻辑
 */

import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Paths, Directory, File as FSFile } from "expo-file-system";
import { Platform } from "react-native";
import type { ConvertOptions } from "../fits/types";

const EXPORT_SUBDIR = "fits_exports";
export type MediaExportFormat =
  | ConvertOptions["format"]
  | "mp4"
  | "mov"
  | "m4v"
  | "webm"
  | "mkv"
  | "avi"
  | "3gp"
  | "mp3"
  | "aac"
  | "m4a"
  | "wav";

/**
 * 自定义错误类型
 */
export class ShareNotAvailableError extends Error {
  constructor() {
    super("SHARE_NOT_AVAILABLE");
    this.name = "ShareNotAvailableError";
  }
}

export class MediaPermissionDeniedError extends Error {
  constructor() {
    super("MEDIA_PERMISSION_DENIED");
    this.name = "MediaPermissionDeniedError";
  }
}

/**
 * 获取导出目录
 */
export function getExportDir(): Directory {
  const dir = new Directory(Paths.cache, EXPORT_SUBDIR);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

/**
 * 生成导出文件名
 */
export function generateExportFilename(
  originalName: string,
  format: ConvertOptions["format"],
): string {
  const baseName = originalName.replace(/\.[^.]+$/, "");
  return `${baseName}_export.${format}`;
}

/**
 * 分享文件选项
 */
export interface ShareFileOptions {
  format?: MediaExportFormat;
  filename?: string;
  anchor?: { x: number; y: number; width: number; height: number };
}

/**
 * 分享文件到其他应用
 */
export async function shareFile(fileUri: string, options?: ShareFileOptions): Promise<void> {
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new ShareNotAvailableError();
  }

  const sharingOptions: Sharing.SharingOptions = {};

  if (options?.format) {
    sharingOptions.mimeType = getMimeType(options.format);
    sharingOptions.UTI = getUTI(options.format);
  }

  if (options?.filename) {
    sharingOptions.dialogTitle = options.filename;
  }

  if (Platform.OS === "ios" && options?.anchor) {
    sharingOptions.anchor = options.anchor;
  }

  await Sharing.shareAsync(fileUri, sharingOptions);
}

/**
 * 保存到设备相册
 */
export async function saveToMediaLibrary(fileUri: string): Promise<string> {
  const { status } = await MediaLibrary.requestPermissionsAsync();
  if (status !== "granted") {
    throw new MediaPermissionDeniedError();
  }
  const asset = await MediaLibrary.createAssetAsync(fileUri);
  return asset.uri;
}

/**
 * 获取 MIME 类型
 */
export function getMimeType(format: MediaExportFormat): string {
  switch (format) {
    case "png":
      return "image/png";
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "tiff":
      return "image/tiff";
    case "bmp":
      return "image/bmp";
    case "fits":
      return "application/fits";
    case "mp4":
      return "video/mp4";
    case "mov":
      return "video/quicktime";
    case "m4v":
      return "video/x-m4v";
    case "webm":
      return "video/webm";
    case "mkv":
      return "video/x-matroska";
    case "avi":
      return "video/x-msvideo";
    case "3gp":
      return "video/3gpp";
    case "mp3":
      return "audio/mpeg";
    case "aac":
      return "audio/aac";
    case "m4a":
      return "audio/mp4";
    case "wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}

/**
 * 获取格式的文件扩展名
 */
export function getExtension(format: MediaExportFormat): string {
  switch (format) {
    case "jpeg":
      return "jpg";
    case "fits":
      return "fits";
    default:
      return format;
  }
}

/**
 * 获取 iOS Uniform Type Identifier
 */
export function getUTI(format: MediaExportFormat): string {
  switch (format) {
    case "png":
      return "public.png";
    case "jpeg":
      return "public.jpeg";
    case "webp":
      return "org.webmproject.webp";
    case "tiff":
      return "public.tiff";
    case "bmp":
      return "com.microsoft.bmp";
    case "fits":
      return "public.data";
    case "mp4":
    case "m4v":
      return "public.mpeg-4";
    case "mov":
      return "com.apple.quicktime-movie";
    case "webm":
      return "org.webmproject.webm";
    case "mkv":
      return "public.movie";
    case "avi":
      return "public.avi";
    case "3gp":
      return "public.3gpp";
    case "mp3":
      return "public.mp3";
    case "aac":
      return "public.aac-audio";
    case "m4a":
      return "public.mpeg-4-audio";
    case "wav":
      return "com.microsoft.waveform-audio";
    default:
      return "public.data";
  }
}

/**
 * 清理导出目录
 */
export function cleanExportDir(): void {
  const dir = new Directory(Paths.cache, EXPORT_SUBDIR);
  if (dir.exists) {
    dir.delete();
  }
}

/**
 * 清理缓存的导出文件
 */
export function cleanOldExports(): void {
  const dir = new Directory(Paths.cache, EXPORT_SUBDIR);
  if (!dir.exists) return;

  try {
    for (const item of dir.list()) {
      if (item instanceof FSFile) {
        try {
          (item as FSFile).delete();
        } catch {
          // ignore individual file deletion errors
        }
      }
    }
  } catch {
    try {
      dir.delete();
    } catch {
      // ignore
    }
  }
}
