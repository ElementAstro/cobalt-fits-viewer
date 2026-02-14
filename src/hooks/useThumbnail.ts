/**
 * 缩略图生成/缓存 Hook
 */

import { useState, useCallback } from "react";
import { Skia, AlphaType, ColorType, ImageFormat } from "@shopify/react-native-skia";
import { File as FSFile } from "expo-file-system";
import {
  ensureThumbnailDir,
  getThumbnailPath,
  hasThumbnail,
  clearThumbnailCache,
  getThumbnailCacheSize,
  downsampleRGBA,
} from "../lib/gallery/thumbnailCache";
import { useSettingsStore } from "../stores/useSettingsStore";

export function useThumbnail() {
  const [isGenerating, setIsGenerating] = useState(false);
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);

  const getThumbnailUri = useCallback((fileId: string): string | null => {
    if (hasThumbnail(fileId)) {
      return getThumbnailPath(fileId);
    }
    return null;
  }, []);

  const generateThumbnail = useCallback(
    async (
      fileId: string,
      rgba: Uint8ClampedArray,
      srcWidth: number,
      srcHeight: number,
    ): Promise<string> => {
      setIsGenerating(true);
      try {
        ensureThumbnailDir();
        const downsampled = downsampleRGBA(rgba, srcWidth, srcHeight, thumbnailSize);

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

        const thumbPath = getThumbnailPath(fileId);

        if (skImage) {
          const bytes = skImage.encodeToBytes(ImageFormat.JPEG, 80);
          if (bytes && bytes.length > 0) {
            const thumbFile = new FSFile(thumbPath);
            thumbFile.write(bytes);
          }
        }

        return thumbPath;
      } finally {
        setIsGenerating(false);
      }
    },
    [thumbnailSize],
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
