/**
 * 缩略图生成/缓存 Hook
 */

import { useState, useCallback } from "react";
import { File } from "expo-file-system";
import {
  getThumbnailPath,
  hasThumbnail,
  clearThumbnailCache,
  getThumbnailCacheSize,
  generateAndSaveThumbnail,
} from "../lib/gallery/thumbnailCache";
import { useSettingsStore } from "../stores/useSettingsStore";
import { loadFitsFromBuffer, getImageDimensions, getImagePixels } from "../lib/fits/parser";
import { fitsToRGBA } from "../lib/converter/formatConverter";
import { parseRasterFromBuffer } from "../lib/image/rasterParser";
import type { FitsMetadata } from "../lib/fits/types";

interface RegenerateResult {
  success: number;
  skipped: number;
  results: Array<{ fileId: string; uri: string | null }>;
}

export function useThumbnail() {
  const [isGenerating, setIsGenerating] = useState(false);
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);
  const defaultStretch = useSettingsStore((s) => s.defaultStretch);
  const defaultColormap = useSettingsStore((s) => s.defaultColormap);
  const defaultBlackPoint = useSettingsStore((s) => s.defaultBlackPoint);
  const defaultWhitePoint = useSettingsStore((s) => s.defaultWhitePoint);
  const defaultGamma = useSettingsStore((s) => s.defaultGamma);

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

  const regenerateThumbnails = useCallback(
    async (files: FitsMetadata[]): Promise<RegenerateResult> => {
      setIsGenerating(true);
      let success = 0;
      let skipped = 0;
      const results: Array<{ fileId: string; uri: string | null }> = [];

      try {
        for (const file of files) {
          try {
            const source = new File(file.filepath);
            if (!source.exists) {
              skipped++;
              results.push({ fileId: file.id, uri: null });
              continue;
            }

            const buffer = await source.arrayBuffer();
            let uri: string | null = null;

            const tryFits = async () => {
              const fitsObj = loadFitsFromBuffer(buffer);
              const dims = getImageDimensions(fitsObj);
              const pixels = await getImagePixels(fitsObj);
              if (!dims || !pixels) return null;

              const rgba = fitsToRGBA(pixels, dims.width, dims.height, {
                stretch: defaultStretch,
                colormap: defaultColormap,
                blackPoint: defaultBlackPoint,
                whitePoint: defaultWhitePoint,
                gamma: defaultGamma,
              });

              return generateAndSaveThumbnail(
                file.id,
                rgba,
                dims.width,
                dims.height,
                thumbnailSize,
                thumbnailQuality,
              );
            };

            const tryRaster = async () => {
              const parsed = parseRasterFromBuffer(buffer);
              const rgba = new Uint8ClampedArray(
                parsed.rgba.buffer,
                parsed.rgba.byteOffset,
                parsed.rgba.byteLength,
              );

              return generateAndSaveThumbnail(
                file.id,
                rgba,
                parsed.width,
                parsed.height,
                thumbnailSize,
                thumbnailQuality,
              );
            };

            if (file.sourceType === "fits") {
              try {
                uri = await tryFits();
              } catch {
                uri = await tryRaster().catch(() => null);
              }
            } else {
              try {
                uri = await tryRaster();
              } catch {
                uri = await tryFits().catch(() => null);
              }
            }

            if (uri) {
              success++;
            } else {
              skipped++;
            }
            results.push({ fileId: file.id, uri });
          } catch {
            skipped++;
            results.push({ fileId: file.id, uri: null });
          }
        }
      } finally {
        setIsGenerating(false);
      }

      return { success, skipped, results };
    },
    [
      defaultBlackPoint,
      defaultColormap,
      defaultGamma,
      defaultStretch,
      defaultWhitePoint,
      thumbnailQuality,
      thumbnailSize,
    ],
  );

  return {
    isGenerating,
    getThumbnailUri,
    generateThumbnail,
    clearCache,
    getCacheSize,
    regenerateThumbnails,
  };
}
