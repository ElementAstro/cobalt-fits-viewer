/**
 * 缩略图生成/缓存 Hook
 */

import { useState, useCallback } from "react";
import {
  getThumbnailPath,
  hasThumbnail,
  clearThumbnailCache,
  getThumbnailCacheSize,
  generateAndSaveThumbnail,
} from "../lib/gallery/thumbnailCache";
import { useSettingsStore } from "../stores/useSettingsStore";

export function useThumbnail() {
  const [isGenerating, setIsGenerating] = useState(false);
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);

  const getThumbnailUri = useCallback((fileId: string): string | null => {
    if (hasThumbnail(fileId)) {
      return getThumbnailPath(fileId);
    }
    return null;
  }, []);

  const generateThumbnail = useCallback(
    (
      fileId: string,
      rgba: Uint8ClampedArray,
      srcWidth: number,
      srcHeight: number,
    ): string | null => {
      setIsGenerating(true);
      try {
        return generateAndSaveThumbnail(
          fileId,
          rgba,
          srcWidth,
          srcHeight,
          thumbnailSize,
          thumbnailQuality,
        );
      } finally {
        setIsGenerating(false);
      }
    },
    [thumbnailSize, thumbnailQuality],
  );

  const clearCache = useCallback(() => {
    clearThumbnailCache();
  }, []);

  const getCacheSize = useCallback(() => {
    return getThumbnailCacheSize();
  }, []);

  return {
    isGenerating,
    getThumbnailUri,
    generateThumbnail,
    clearCache,
    getCacheSize,
  };
}
