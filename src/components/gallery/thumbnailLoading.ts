import type { FitsMetadata } from "../../lib/fits/types";

export type ThumbnailLoadStage = "idle" | "loading" | "decoding" | "ready" | "error";

export interface ThumbnailLoadSnapshot {
  fileId: string;
  stage: ThumbnailLoadStage;
  progress: number;
  loadedBytes: number;
  totalBytes: number;
  hasByteProgress: boolean;
}

export interface ThumbnailLoadingSummary {
  totalCount: number;
  loadingCount: number;
  completedCount: number;
  errorCount: number;
  progress: number;
  loadedBytes: number;
  totalBytes: number;
}

const FALLBACK_STAGE_PROGRESS: Record<ThumbnailLoadStage, number> = {
  idle: 0,
  loading: 0.25,
  decoding: 0.8,
  ready: 1,
  error: 1,
};

export function clampProgress(progress: number): number {
  if (!Number.isFinite(progress)) return 0;
  return Math.max(0, Math.min(1, progress));
}

export function buildInitialSnapshot(fileId: string): ThumbnailLoadSnapshot {
  return {
    fileId,
    stage: "idle",
    progress: 0,
    loadedBytes: 0,
    totalBytes: 0,
    hasByteProgress: false,
  };
}

export function withStage(
  snapshot: ThumbnailLoadSnapshot,
  stage: ThumbnailLoadStage,
): ThumbnailLoadSnapshot {
  const stageProgress = FALLBACK_STAGE_PROGRESS[stage];
  return {
    ...snapshot,
    stage,
    progress: Math.max(snapshot.progress, stageProgress),
  };
}

export function withByteProgress(
  snapshot: ThumbnailLoadSnapshot,
  loadedBytes: number,
  totalBytes: number,
): ThumbnailLoadSnapshot {
  const hasByteProgress = totalBytes > 0 && loadedBytes >= 0;
  if (!hasByteProgress) {
    return snapshot;
  }

  return {
    ...snapshot,
    stage: snapshot.stage === "idle" ? "loading" : snapshot.stage,
    loadedBytes,
    totalBytes,
    hasByteProgress: true,
    progress: Math.max(snapshot.progress, clampProgress(loadedBytes / totalBytes)),
  };
}

export function buildLoadingSummary(
  files: FitsMetadata[],
  snapshots: Record<string, ThumbnailLoadSnapshot>,
): ThumbnailLoadingSummary {
  if (files.length === 0) {
    return {
      totalCount: 0,
      loadingCount: 0,
      completedCount: 0,
      errorCount: 0,
      progress: 1,
      loadedBytes: 0,
      totalBytes: 0,
    };
  }

  let completedCount = 0;
  let errorCount = 0;
  let aggregateProgress = 0;
  let loadedBytes = 0;
  let totalBytes = 0;

  for (const file of files) {
    const snapshot = snapshots[file.id] ?? buildInitialSnapshot(file.id);
    if (snapshot.stage === "ready") {
      completedCount += 1;
    } else if (snapshot.stage === "error") {
      errorCount += 1;
    }

    aggregateProgress += clampProgress(snapshot.progress);
    if (snapshot.hasByteProgress && snapshot.totalBytes > 0) {
      loadedBytes += Math.max(0, snapshot.loadedBytes);
      totalBytes += snapshot.totalBytes;
    }
  }

  const totalCount = files.length;
  const loadingCount = Math.max(totalCount - completedCount - errorCount, 0);
  const progress =
    loadingCount === 0
      ? 1
      : totalBytes > 0
        ? clampProgress(loadedBytes / totalBytes)
        : clampProgress(aggregateProgress / Math.max(totalCount, 1));

  return {
    totalCount,
    loadingCount,
    completedCount,
    errorCount,
    progress,
    loadedBytes,
    totalBytes,
  };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value >= 10 || unitIndex === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
}
