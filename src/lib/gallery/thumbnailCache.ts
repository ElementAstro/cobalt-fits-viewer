/**
 * 缩略图生成与缓存管理
 * 使用 expo-file-system v19 新 API (Paths, File, Directory)
 */

import { Platform } from "react-native";
import { Paths, File, Directory } from "expo-file-system";
import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import * as VideoThumbnails from "expo-video-thumbnails";
import { LOG_TAGS, Logger } from "../logger";

const THUMBNAIL_SUBDIR = "thumbnails";
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

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
 * 解析可显示的缩略图 URI。
 * 优先使用仍然存在的已保存 URI，若不可用则回退到统一缓存路径。
 */
export function resolveThumbnailUri(fileId: string, thumbnailUri?: string): string | null {
  if (thumbnailUri) {
    try {
      if (/^https?:\/\//i.test(thumbnailUri)) {
        return thumbnailUri;
      }
      const persistedThumb = new File(thumbnailUri);
      if (persistedThumb.exists) {
        return persistedThumb.uri;
      }
    } catch {
      // Ignore invalid persisted URI and fall back to canonical cache path.
    }
  }

  if (hasThumbnail(fileId)) {
    return getThumbnailPath(fileId);
  }
  return null;
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
 * 按文件大小淘汰最老的缩略图，使缓存总大小不超过 maxSizeBytes。
 * 按文件修改时间升序排列，优先淘汰最老的缩略图。
 * @returns 被淘汰的文件数量
 */
export function pruneThumbnailCache(maxSizeBytes: number): number {
  const dir = getThumbnailDir();
  if (!dir.exists) return 0;

  const items = dir.list();
  const files: Array<{ file: File; size: number }> = [];
  let totalSize = 0;

  for (const item of items) {
    if (item instanceof File) {
      const size = item.size ?? 0;
      files.push({ file: item, size });
      totalSize += size;
    }
  }

  if (totalSize <= maxSizeBytes) return 0;

  // Sort by name (stable proxy for age since fileIds are chronological UUIDs)
  files.sort((a, b) => a.file.uri.localeCompare(b.file.uri));

  let pruned = 0;
  for (const entry of files) {
    if (totalSize <= maxSizeBytes) break;
    try {
      entry.file.delete();
      totalSize -= entry.size;
      pruned++;
    } catch {
      // skip files that can't be deleted
    }
  }

  Logger.debug(LOG_TAGS.Thumbnail, `Pruned ${pruned} thumbnails, cache now ${totalSize} bytes`);
  return pruned;
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
      Logger.warn(LOG_TAGS.Thumbnail, `Failed to create Skia image for ${fileId}`);
      return null;
    }

    const bytes = skImage.encodeToBytes(ImageFormat.JPEG, quality);
    if (!bytes || bytes.length === 0) {
      Logger.warn(LOG_TAGS.Thumbnail, `Failed to encode thumbnail for ${fileId}`);
      return null;
    }

    const thumbPath = getThumbnailPath(fileId);
    const thumbFile = new File(thumbPath);
    thumbFile.write(bytes);

    Logger.debug(LOG_TAGS.Thumbnail, `Generated thumbnail for ${fileId} (${bytes.length} bytes)`);
    return thumbPath;
  } catch (err) {
    Logger.warn(LOG_TAGS.Thumbnail, `Thumbnail generation failed for ${fileId}`, err);
    return null;
  }
}

/**
 * 将外部生成的缩略图文件复制到统一缓存路径。
 * 主要用于视频缩略图（expo-video-thumbnails）。
 */
export function copyThumbnailToCache(fileId: string, sourceUri: string): string | null {
  try {
    ensureThumbnailDir();
    const targetPath = getThumbnailPath(fileId);
    const src = new File(sourceUri);
    if (!src.exists) return null;

    const target = new File(targetPath);
    if (target.exists) {
      target.delete();
    }

    src.copy(target);
    return targetPath;
  } catch (err) {
    Logger.warn(LOG_TAGS.Thumbnail, `Copy thumbnail failed for ${fileId}`, err);
    return null;
  }
}

/**
 * 从视频文件生成缩略图并保存到缓存（纯函数，不依赖 React 状态）
 * 包含自动重试：最多重试 MAX_RETRIES 次，间隔 RETRY_DELAY_MS 毫秒
 */
export async function generateVideoThumbnailToCache(
  fileId: string,
  filepath: string,
  timeMs: number,
  qualityPercent: number,
): Promise<string | null> {
  if (Platform.OS === "web") return null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const result = await VideoThumbnails.getThumbnailAsync(filepath, {
        time: Math.max(0, Math.round(timeMs)),
        quality: Math.min(1, Math.max(0.1, qualityPercent / 100)),
      });
      return copyThumbnailToCache(fileId, result.uri);
    } catch (error) {
      if (attempt < MAX_RETRIES) {
        Logger.debug(
          LOG_TAGS.Thumbnail,
          `Video thumbnail attempt ${attempt + 1} failed for ${fileId}, retrying...`,
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      } else {
        Logger.warn(LOG_TAGS.Thumbnail, `Video thumbnail generation failed for ${fileId}`, error);
      }
    }
  }
  return null;
}

/**
 * 将 RGBA 数据降采样为缩略图尺寸
 * 使用面积平均(area-average)算法：将源区域内所有像素取平均值，
 * 相比最近邻采样能保留更多细节，减少锯齿和摩尔纹。
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

  const xRatio = srcWidth / dstWidth;
  const yRatio = srcHeight / dstHeight;

  for (let dy = 0; dy < dstHeight; dy++) {
    const sy0 = Math.floor(dy * yRatio);
    const sy1 = Math.min(Math.ceil((dy + 1) * yRatio), srcHeight);
    for (let dx = 0; dx < dstWidth; dx++) {
      const sx0 = Math.floor(dx * xRatio);
      const sx1 = Math.min(Math.ceil((dx + 1) * xRatio), srcWidth);

      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      let count = 0;

      for (let sy = sy0; sy < sy1; sy++) {
        for (let sx = sx0; sx < sx1; sx++) {
          const srcIdx = (sy * srcWidth + sx) * 4;
          r += rgba[srcIdx];
          g += rgba[srcIdx + 1];
          b += rgba[srcIdx + 2];
          a += rgba[srcIdx + 3];
          count++;
        }
      }

      const dstIdx = (dy * dstWidth + dx) * 4;
      if (count > 0) {
        result[dstIdx] = Math.round(r / count);
        result[dstIdx + 1] = Math.round(g / count);
        result[dstIdx + 2] = Math.round(b / count);
        result[dstIdx + 3] = Math.round(a / count);
      }
    }
  }

  return { data: result, width: dstWidth, height: dstHeight };
}
