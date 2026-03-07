/**
 * 缩略图生成/缓存 Hook
 */

import { useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import {
  getThumbnailPath,
  hasThumbnail,
  clearThumbnailCache,
  getThumbnailCacheSize,
} from "../../lib/gallery/thumbnailCache";
import { saveThumbnailFromRGBA, saveThumbnailFromVideo } from "../../lib/gallery/thumbnailWorkflow";
import { regenerateFileThumbnail } from "../../lib/gallery/thumbnailGenerator";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import type { FitsMetadata } from "../../lib/fits/types";

const REGENERATE_CONCURRENCY = 3;

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface RegenerateResult {
  success: number;
  skipped: number;
  results: Array<{ fileId: string; uri: string | null }>;
}

export interface RegenerateProgress {
  current: number;
  total: number;
}

export function useThumbnail() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [regenerateProgress, setRegenerateProgress] = useState<RegenerateProgress | null>(null);
  const activeTaskCountRef = useRef(0);
  const pendingThumbnailTasksRef = useRef<Map<string, Promise<string | null>>>(new Map());
  const videoThumbnailTimeMs = useSettingsStore((s) => s.videoThumbnailTimeMs);

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
        return saveThumbnailFromRGBA(fileId, rgba, srcWidth, srcHeight);
      } finally {
        endTask();
      }
    },
    [beginTask, endTask],
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
          return saveThumbnailFromRGBA(fileId, rgba, srcWidth, srcHeight);
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
    [beginTask, endTask],
  );

  const clearCache = useCallback(() => {
    clearThumbnailCache();
  }, []);

  const getCacheSize = useCallback(() => {
    return getThumbnailCacheSize();
  }, []);

  const regenerateOneThumbnail = useCallback(
    (file: FitsMetadata) => regenerateFileThumbnail(file),
    [],
  );

  const generateVideoThumbnailAsync = useCallback(
    async (fileId: string, filepath: string, timeMs: number = videoThumbnailTimeMs) => {
      if (Platform.OS === "web") return null;
      const existingTask = pendingThumbnailTasksRef.current.get(`${fileId}:video`);
      if (existingTask) return existingTask;

      const task = (async () => {
        beginTask();
        try {
          return await saveThumbnailFromVideo(fileId, filepath, timeMs);
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
    [beginTask, endTask, videoThumbnailTimeMs],
  );

  const regenerateThumbnails = useCallback(
    async (files: FitsMetadata[]): Promise<RegenerateResult> => {
      beginTask();
      const results = new Array<{ fileId: string; uri: string | null }>(files.length);
      let completed = 0;
      setRegenerateProgress({ current: 0, total: files.length });

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
            completed += 1;
            setRegenerateProgress({ current: completed, total: files.length });
            await yieldToMain();
          }
        });

        await Promise.all(workers);
      } finally {
        endTask();
        setRegenerateProgress(null);
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
    regenerateProgress,
    getThumbnailUri,
    generateThumbnail,
    generateThumbnailAsync,
    generateVideoThumbnailAsync,
    clearCache,
    getCacheSize,
    regenerateThumbnails,
    regenerateOneThumbnail,
  };
}
