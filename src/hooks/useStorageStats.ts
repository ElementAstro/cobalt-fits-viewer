/**
 * 存储统计聚合 Hook
 * 汇总各子系统的存储占用信息
 */

import { useState, useCallback, useEffect } from "react";
import { getStorageStats } from "../lib/utils/fileManager";
import { getFreeDiskBytes } from "../lib/utils/diskSpace";
import { getThumbnailCacheSize } from "../lib/gallery/thumbnailCache";
import { getExportCacheSize, cleanExpiredExports } from "../lib/utils/imageExport";
import {
  getVideoProcessingCacheSize,
  clearVideoProcessingCache,
} from "../lib/video/engine/ffmpegAdapter";
import { getPixelCacheStats } from "../lib/cache/pixelCache";
import { getImageLoadCacheStats } from "../lib/cache/imageLoadCache";
import { clearRuntimeCaches } from "../lib/cache/runtimeCaches";
import { getRuntimeDiskCacheStats } from "../lib/cache/runtimeDiskCache";
import { useTrashStore } from "../stores/useTrashStore";
import { useFitsStore } from "../stores/useFitsStore";

export interface StorageBreakdown {
  filesCount: number;
  filesTotalBytes: number;
  trashCount: number;
  trashTotalBytes: number;
  thumbnailCacheBytes: number;
  videoCacheBytes: number;
  exportCacheBytes: number;
  exportCacheFileCount: number;
  pixelCacheBytes: number;
  pixelCacheEntries: number;
  imageLoadCacheBytes: number;
  imageLoadCacheEntries: number;
  runtimeDiskCacheBytes: number;
  runtimeDiskCacheEntries: number;
  freeDiskBytes: number | null;
}

export function useStorageStats() {
  const files = useFitsStore((s) => s.files);
  const filesCount = files.length;
  const trashItems = useTrashStore((s) => s.items);

  const [breakdown, setBreakdown] = useState<StorageBreakdown>({
    filesCount: 0,
    filesTotalBytes: 0,
    trashCount: 0,
    trashTotalBytes: 0,
    thumbnailCacheBytes: 0,
    videoCacheBytes: 0,
    exportCacheBytes: 0,
    exportCacheFileCount: 0,
    pixelCacheBytes: 0,
    pixelCacheEntries: 0,
    imageLoadCacheBytes: 0,
    imageLoadCacheEntries: 0,
    runtimeDiskCacheBytes: 0,
    runtimeDiskCacheEntries: 0,
    freeDiskBytes: null,
  });

  const refresh = useCallback(async () => {
    const stats = getStorageStats();
    const trashTotalBytes = trashItems.reduce((sum, item) => sum + item.file.fileSize, 0);
    const thumbnailCacheBytes = getThumbnailCacheSize();
    const exportCache = getExportCacheSize();
    const pixelStats = getPixelCacheStats();
    const imageLoadStats = getImageLoadCacheStats();
    const runtimeDiskStats = getRuntimeDiskCacheStats();

    let videoCacheBytes = 0;
    try {
      videoCacheBytes = await getVideoProcessingCacheSize();
    } catch {
      // best effort
    }

    let freeDiskBytes: number | null = null;
    try {
      freeDiskBytes = await getFreeDiskBytes();
    } catch {
      // best effort
    }

    setBreakdown({
      filesCount: stats.fitsCount,
      filesTotalBytes: stats.fitsSize,
      trashCount: trashItems.length,
      trashTotalBytes,
      thumbnailCacheBytes,
      videoCacheBytes,
      exportCacheBytes: exportCache.totalBytes,
      exportCacheFileCount: exportCache.fileCount,
      pixelCacheBytes: pixelStats.totalBytes,
      pixelCacheEntries: pixelStats.entries,
      imageLoadCacheBytes: imageLoadStats.totalBytes,
      imageLoadCacheEntries: imageLoadStats.entries,
      runtimeDiskCacheBytes: runtimeDiskStats.totalBytes,
      runtimeDiskCacheEntries: runtimeDiskStats.entries,
      freeDiskBytes,
    });
  }, [trashItems]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearExportCache = useCallback(() => {
    cleanExpiredExports();
    void refresh();
  }, [refresh]);

  const clearVideoCache = useCallback(() => {
    clearVideoProcessingCache();
    void refresh();
  }, [refresh]);

  const clearPixelCacheAndRefresh = useCallback(() => {
    clearRuntimeCaches();
    void refresh();
  }, [refresh]);

  return {
    breakdown,
    filesCount,
    refresh,
    clearExportCache,
    clearVideoCache,
    clearPixelCache: clearPixelCacheAndRefresh,
  };
}
