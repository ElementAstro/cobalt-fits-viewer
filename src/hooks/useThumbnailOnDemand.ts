/**
 * 按需缩略图生成 Hook
 * 当缩略图缺失时自动触发生成，使用并发队列避免过载
 */

import { useCallback, useRef } from "react";
import { hasThumbnail } from "../lib/gallery/thumbnailCache";
import { regenerateFileThumbnail } from "../lib/gallery/thumbnailGenerator";
import { useFitsStore } from "../stores/useFitsStore";
import type { FitsMetadata } from "../lib/fits/types";

const ON_DEMAND_CONCURRENCY = 2;

export function useThumbnailOnDemand() {
  const updateFile = useFitsStore((s) => s.updateFile);

  const queueRef = useRef<FitsMetadata[]>([]);
  const activeCountRef = useRef(0);
  const enqueuedIdsRef = useRef<Set<string>>(new Set());
  const failedIdsRef = useRef<Set<string>>(new Set());

  const processQueue = useCallback(async () => {
    while (queueRef.current.length > 0 && activeCountRef.current < ON_DEMAND_CONCURRENCY) {
      const file = queueRef.current.shift();
      if (!file) break;

      activeCountRef.current += 1;
      try {
        const result = await regenerateFileThumbnail(file);
        if (result.uri) {
          updateFile(result.fileId, { thumbnailUri: result.uri });
        } else {
          failedIdsRef.current.add(result.fileId);
        }
      } catch {
        failedIdsRef.current.add(file.id);
      } finally {
        activeCountRef.current -= 1;
        enqueuedIdsRef.current.delete(file.id);
      }
    }
  }, [updateFile]);

  const requestThumbnail = useCallback(
    (file: FitsMetadata) => {
      if (hasThumbnail(file.id)) return;
      if (enqueuedIdsRef.current.has(file.id)) return;
      if (failedIdsRef.current.has(file.id)) return;
      if (file.sourceType === "audio") return;

      enqueuedIdsRef.current.add(file.id);
      queueRef.current.push(file);
      void processQueue();
    },
    [processQueue],
  );

  const resetFailed = useCallback(() => {
    failedIdsRef.current.clear();
  }, []);

  return { requestThumbnail, resetFailed };
}
