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
const FAILURE_COOLDOWN_MS = 60_000;

export function useThumbnailOnDemand() {
  const updateFile = useFitsStore((s) => s.updateFile);

  const queueRef = useRef<FitsMetadata[]>([]);
  const activeCountRef = useRef(0);
  const enqueuedIdsRef = useRef<Set<string>>(new Set());
  const failedAtRef = useRef<Map<string, number>>(new Map());

  const processQueue = useCallback(async () => {
    while (queueRef.current.length > 0 && activeCountRef.current < ON_DEMAND_CONCURRENCY) {
      const file = queueRef.current.shift();
      if (!file) break;

      activeCountRef.current += 1;
      try {
        const result = await regenerateFileThumbnail(file);
        if (result.uri) {
          updateFile(result.fileId, { thumbnailUri: result.uri });
          failedAtRef.current.delete(result.fileId);
        } else {
          failedAtRef.current.set(result.fileId, Date.now());
        }
      } catch {
        failedAtRef.current.set(file.id, Date.now());
      } finally {
        activeCountRef.current -= 1;
        enqueuedIdsRef.current.delete(file.id);
      }
    }
  }, [updateFile]);

  const requestThumbnail = useCallback(
    (file: FitsMetadata) => {
      const now = Date.now();
      if (hasThumbnail(file.id)) return;
      if (enqueuedIdsRef.current.has(file.id)) return;
      const failedAt = failedAtRef.current.get(file.id);
      if (typeof failedAt === "number") {
        if (now - failedAt < FAILURE_COOLDOWN_MS) return;
        failedAtRef.current.delete(file.id);
      }
      if (file.sourceType === "audio") return;

      enqueuedIdsRef.current.add(file.id);
      queueRef.current.push(file);
      void processQueue();
    },
    [processQueue],
  );

  const resetFailed = useCallback(() => {
    failedAtRef.current.clear();
  }, []);

  return { requestThumbnail, resetFailed };
}
