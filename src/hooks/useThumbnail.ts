/**
 * 缩略图生成/缓存 Hook
 */

import { useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { File } from "expo-file-system";
import {
  copyThumbnailToCache,
  getThumbnailPath,
  hasThumbnail,
  clearThumbnailCache,
  getThumbnailCacheSize,
  generateAndSaveThumbnail,
} from "../lib/gallery/thumbnailCache";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  loadScientificFitsFromBuffer,
  getImageDimensions,
  getImagePixels,
} from "../lib/fits/parser";
import { fitsToRGBA } from "../lib/converter/formatConverter";
import { parseRasterFromBuffer } from "../lib/image/rasterParser";
import type { FitsMetadata } from "../lib/fits/types";

const REGENERATE_CONCURRENCY = 3;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface RegenerateResult {
  success: number;
  skipped: number;
  results: Array<{ fileId: string; uri: string | null }>;
}

export function useThumbnail() {
  const [isGenerating, setIsGenerating] = useState(false);
  const activeTaskCountRef = useRef(0);
  const pendingThumbnailTasksRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const thumbnailSize = useSettingsStore((s) => s.thumbnailSize);
  const thumbnailQuality = useSettingsStore((s) => s.thumbnailQuality);
  const videoThumbnailTimeMs = useSettingsStore((s) => s.videoThumbnailTimeMs);
  const defaultStretch = useSettingsStore((s) => s.defaultStretch);
  const defaultColormap = useSettingsStore((s) => s.defaultColormap);
  const defaultBlackPoint = useSettingsStore((s) => s.defaultBlackPoint);
  const defaultWhitePoint = useSettingsStore((s) => s.defaultWhitePoint);
  const defaultGamma = useSettingsStore((s) => s.defaultGamma);

  const beginTask = useCallback(() => {
    activeTaskCountRef.current += 1;
    if (activeTaskCountRef.current === 1) {
      setIsGenerating(true);
    }
  }, []);

  const endTask = useCallback(() => {
    activeTaskCountRef.current = Math.max(0, activeTaskCountRef.current - 1);
    if (activeTaskCountRef.current === 0) {
      setIsGenerating(false);
    }
  }, []);

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
      beginTask();
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
        endTask();
      }
    },
    [beginTask, endTask, thumbnailSize, thumbnailQuality],
  );

  const generateThumbnailAsync = useCallback(
    (
      fileId: string,
      rgba: Uint8ClampedArray,
      srcWidth: number,
      srcHeight: number,
    ): Promise<string | null> => {
      const existingTask = pendingThumbnailTasksRef.current.get(fileId);
      if (existingTask) {
        return existingTask;
      }

      const task = (async () => {
        beginTask();
        try {
          await yieldToMain();
          return generateAndSaveThumbnail(
            fileId,
            rgba,
            srcWidth,
            srcHeight,
            thumbnailSize,
            thumbnailQuality,
          );
        } finally {
          endTask();
        }
      })();

      pendingThumbnailTasksRef.current.set(fileId, task);
      void task.finally(() => {
        const pending = pendingThumbnailTasksRef.current.get(fileId);
        if (pending === task) {
          pendingThumbnailTasksRef.current.delete(fileId);
        }
      });
      return task;
    },
    [beginTask, endTask, thumbnailSize, thumbnailQuality],
  );

  const clearCache = useCallback(() => {
    clearThumbnailCache();
  }, []);

  const getCacheSize = useCallback(() => {
    return getThumbnailCacheSize();
  }, []);

  const regenerateOneThumbnail = useCallback(
    async (file: FitsMetadata): Promise<{ fileId: string; uri: string | null }> => {
      try {
        const source = new File(file.filepath);
        if (!source.exists) {
          return { fileId: file.id, uri: null };
        }

        const buffer = await source.arrayBuffer();
        let uri: string | null = null;

        const tryFits = async () => {
          const fitsObj = await loadScientificFitsFromBuffer(buffer, {
            filename: file.filename,
          });
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

        const tryVideo = async () => {
          if (Platform.OS === "web") return null;
          const result = await VideoThumbnails.getThumbnailAsync(file.filepath, {
            time: Math.max(0, Math.round(file.thumbnailAtMs ?? videoThumbnailTimeMs)),
            quality: Math.min(1, Math.max(0.1, thumbnailQuality / 100)),
          });
          return copyThumbnailToCache(file.id, result.uri);
        };

        if (file.sourceType === "fits") {
          try {
            uri = await tryFits();
          } catch {
            uri = await tryRaster().catch(() => null);
          }
        } else if (file.sourceType === "video") {
          try {
            uri = await tryVideo();
          } catch {
            uri = null;
          }
        } else if (file.sourceType === "audio") {
          uri = null;
        } else {
          try {
            uri = await tryRaster();
          } catch {
            uri = await tryFits().catch(() => null);
          }
        }

        return { fileId: file.id, uri };
      } catch {
        return { fileId: file.id, uri: null };
      }
    },
    [
      defaultBlackPoint,
      defaultColormap,
      defaultGamma,
      defaultStretch,
      defaultWhitePoint,
      thumbnailQuality,
      thumbnailSize,
      videoThumbnailTimeMs,
    ],
  );

  const generateVideoThumbnailAsync = useCallback(
    async (fileId: string, filepath: string, timeMs: number = videoThumbnailTimeMs) => {
      if (Platform.OS === "web") return null;
      const existingTask = pendingThumbnailTasksRef.current.get(`${fileId}:video`);
      if (existingTask) return existingTask;

      const task = (async () => {
        beginTask();
        try {
          const result = await VideoThumbnails.getThumbnailAsync(filepath, {
            time: Math.max(0, Math.round(timeMs)),
            quality: Math.min(1, Math.max(0.1, thumbnailQuality / 100)),
          });
          return copyThumbnailToCache(fileId, result.uri);
        } finally {
          endTask();
        }
      })();

      pendingThumbnailTasksRef.current.set(`${fileId}:video`, task);
      void task.finally(() => {
        const key = `${fileId}:video`;
        const pending = pendingThumbnailTasksRef.current.get(key);
        if (pending === task) {
          pendingThumbnailTasksRef.current.delete(key);
        }
      });
      return task;
    },
    [beginTask, endTask, thumbnailQuality, videoThumbnailTimeMs],
  );

  const regenerateThumbnails = useCallback(
    async (files: FitsMetadata[]): Promise<RegenerateResult> => {
      beginTask();
      const results = new Array<{ fileId: string; uri: string | null }>(files.length);

      try {
        const workerCount = Math.max(1, Math.min(REGENERATE_CONCURRENCY, files.length));
        let cursor = 0;

        const workers = Array.from({ length: workerCount }, async () => {
          while (true) {
            const currentIndex = cursor;
            cursor += 1;
            if (currentIndex >= files.length) {
              return;
            }
            results[currentIndex] = await regenerateOneThumbnail(files[currentIndex]);
            await yieldToMain();
          }
        });

        await Promise.all(workers);
      } finally {
        endTask();
      }

      let success = 0;
      let skipped = 0;
      for (const item of results) {
        if (item?.uri) {
          success++;
        } else {
          skipped++;
        }
      }

      return { success, skipped, results };
    },
    [beginTask, endTask, regenerateOneThumbnail],
  );

  return {
    isGenerating,
    getThumbnailUri,
    generateThumbnail,
    generateThumbnailAsync,
    generateVideoThumbnailAsync,
    clearCache,
    getCacheSize,
    regenerateThumbnails,
  };
}
