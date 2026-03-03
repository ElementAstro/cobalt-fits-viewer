import { useEffect } from "react";
import type { FitsMetadata, FrameClassificationConfig } from "../lib/fits/types";
import { isProcessableImageMedia } from "../lib/import/imageParsePipeline";
import { warmImageCachesFromFile } from "../lib/cache/imageLoadWorkflow";

const RECENT_WARMUP_WINDOW_MS = 15_000;
const globalInFlightWarmups = new Set<string>();
const globalRecentWarmups = new Map<string, number>();

function shouldSkipRecentWarmup(dedupeKey: string): boolean {
  const now = Date.now();
  for (const [key, ts] of globalRecentWarmups) {
    if (now - ts > RECENT_WARMUP_WINDOW_MS) {
      globalRecentWarmups.delete(key);
    }
  }
  const lastWarmAt = globalRecentWarmups.get(dedupeKey);
  return lastWarmAt != null && now - lastWarmAt < RECENT_WARMUP_WINDOW_MS;
}

interface UseImageCacheWarmupOptions {
  enabled: boolean;
  currentFile: FitsMetadata | null | undefined;
  allFiles: FitsMetadata[];
  radius: number;
  frameClassificationConfig?: FrameClassificationConfig;
  startWhen?: boolean;
}

export function useImageCacheWarmup({
  enabled,
  currentFile,
  allFiles,
  radius,
  frameClassificationConfig,
  startWhen = true,
}: UseImageCacheWarmupOptions): void {
  useEffect(() => {
    if (!enabled || !startWhen || !currentFile) return;
    if (!isProcessableImageMedia(currentFile)) return;

    const currentIndex = allFiles.findIndex((file) => file.id === currentFile.id);
    if (currentIndex < 0) return;

    const candidates: FitsMetadata[] = [];
    const normalizedRadius = Math.max(1, Math.floor(radius));
    for (let offset = 1; offset <= normalizedRadius; offset++) {
      const prev = allFiles[currentIndex - offset];
      const next = allFiles[currentIndex + offset];
      if (prev && isProcessableImageMedia(prev)) candidates.push(prev);
      if (next && isProcessableImageMedia(next)) candidates.push(next);
    }
    if (candidates.length === 0) return;

    let cancelled = false;
    const isCancelled = () => cancelled;

    for (const candidate of candidates) {
      const dedupeKey = `${candidate.filepath}::${candidate.fileSize}`;
      if (globalInFlightWarmups.has(dedupeKey)) continue;
      if (shouldSkipRecentWarmup(dedupeKey)) continue;
      globalInFlightWarmups.add(dedupeKey);
      globalRecentWarmups.set(dedupeKey, Date.now());

      void warmImageCachesFromFile(candidate, frameClassificationConfig, { isCancelled })
        .catch(() => {
          // best effort warm-up
        })
        .finally(() => {
          globalInFlightWarmups.delete(dedupeKey);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [allFiles, currentFile, enabled, frameClassificationConfig, radius, startWhen]);
}
