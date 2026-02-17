/**
 * 缩略图生成与缓存管理
 * 使用 expo-file-system v19 新 API (Paths, File, Directory)
 */

import { Paths, File, Directory } from "expo-file-system";
import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import { Logger } from "../logger";

const THUMBNAIL_SUBDIR = "thumbnails";

/**
 * 获取缩略图目录
 */
function getThumbnailDir(): Directory {
  return new Directory(Paths.cache, THUMBNAIL_SUBDIR);
}

/**
 * 确保缩略图目录存在
 */
export function ensureThumbnailDir(): void {
  const dir = getThumbnailDir();
  if (!dir.exists) {
    dir.create();
  }
}

/**
 * 获取缩略图文件路径
 */
export function getThumbnailPath(fileId: string): string {
  const file = new File(getThumbnailDir(), `${fileId}.jpg`);
  return file.uri;
}

/**
 * 检查缩略图是否已缓存
 */
export function hasThumbnail(fileId: string): boolean {
  const file = new File(getThumbnailDir(), `${fileId}.jpg`);
  return file.exists;
}

/**
 * 清除所有缩略图缓存
 */
export function clearThumbnailCache(): void {
  const dir = getThumbnailDir();
  if (dir.exists) {
    dir.delete();
    dir.create();
  }
}

/**
 * 获取缩略图缓存大小 (bytes)
 */
export function getThumbnailCacheSize(): number {
  const dir = getThumbnailDir();
  if (!dir.exists) return 0;

  let totalSize = 0;
  const items = dir.list();
  for (const item of items) {
    if (item instanceof File) {
      totalSize += item.size ?? 0;
    }
  }
  return totalSize;
}

/**
 * 删除指定文件的缩略图缓存
 */
export function deleteThumbnail(fileId: string): void {
  const file = new File(getThumbnailDir(), `${fileId}.jpg`);
  if (file.exists) {
    file.delete();
  }
}

/**
 * 批量删除缩略图缓存
 */
export function deleteThumbnails(fileIds: string[]): void {
  for (const id of fileIds) {
    deleteThumbnail(id);
  }
}

/**
 * 纯函数：从 RGBA 数据生成缩略图并保存到缓存
 * 可在非组件上下文中调用（如导入流程）
 * @returns 缩略图 URI，失败返回 null
 */
export function generateAndSaveThumbnail(
  fileId: string,
  rgba: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  targetSize: number = 256,
  quality: number = 80,
): string | null {
  try {
    ensureThumbnailDir();
    const downsampled = downsampleRGBA(rgba, srcWidth, srcHeight, targetSize);

    const data = Skia.Data.fromBytes(
      new Uint8Array(
        downsampled.data.buffer,
        downsampled.data.byteOffset,
        downsampled.data.byteLength,
      ),
    );
    const skImage = Skia.Image.MakeImage(
      {
        width: downsampled.width,
        height: downsampled.height,
        alphaType: AlphaType.Unpremul,
        colorType: ColorType.RGBA_8888,
      },
      data,
      downsampled.width * 4,
    );

    if (!skImage) {
      Logger.warn("Thumbnail", `Failed to create Skia image for ${fileId}`);
      return null;
    }

    const bytes = skImage.encodeToBytes(ImageFormat.JPEG, quality);
    if (!bytes || bytes.length === 0) {
      Logger.warn("Thumbnail", `Failed to encode thumbnail for ${fileId}`);
      return null;
    }

    const thumbPath = getThumbnailPath(fileId);
    const thumbFile = new File(thumbPath);
    thumbFile.write(bytes);

    Logger.debug("Thumbnail", `Generated thumbnail for ${fileId} (${bytes.length} bytes)`);
    return thumbPath;
  } catch (err) {
    Logger.warn("Thumbnail", `Thumbnail generation failed for ${fileId}`, err);
    return null;
  }
}

/**
 * 将 RGBA 数据降采样为缩略图尺寸
 */
export function downsampleRGBA(
  rgba: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  targetSize: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  const scale = Math.min(targetSize / srcWidth, targetSize / srcHeight, 1);
  const dstWidth = Math.max(1, Math.round(srcWidth * scale));
  const dstHeight = Math.max(1, Math.round(srcHeight * scale));
  const result = new Uint8ClampedArray(dstWidth * dstHeight * 4);

  for (let dy = 0; dy < dstHeight; dy++) {
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx = Math.floor(dx / scale);
      const sy = Math.floor(dy / scale);
      const srcIdx = (sy * srcWidth + sx) * 4;
      const dstIdx = (dy * dstWidth + dx) * 4;
      result[dstIdx] = rgba[srcIdx];
      result[dstIdx + 1] = rgba[srcIdx + 1];
      result[dstIdx + 2] = rgba[srcIdx + 2];
      result[dstIdx + 3] = rgba[srcIdx + 3];
    }
  }

  return { data: result, width: dstWidth, height: dstHeight };
}
