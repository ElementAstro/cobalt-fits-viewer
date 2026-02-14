/**
 * 图像导出逻辑
 */

import * as Sharing from "expo-sharing";
import * as MediaLibrary from "expo-media-library";
import { Paths, Directory, File as FSFile } from "expo-file-system";
import { Platform } from "react-native";
import type { ConvertOptions } from "../fits/types";

const EXPORT_SUBDIR = "fits_exports";

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
  format?: ConvertOptions["format"];
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
export function getMimeType(format: ConvertOptions["format"]): string {
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
    default:
      return "application/octet-stream";
  }
}

/**
 * 获取格式的文件扩展名
 */
export function getExtension(format: ConvertOptions["format"]): string {
  switch (format) {
    case "jpeg":
      return "jpg";
    default:
      return format;
  }
}

/**
 * 获取 iOS Uniform Type Identifier
 */
export function getUTI(format: ConvertOptions["format"]): string {
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
