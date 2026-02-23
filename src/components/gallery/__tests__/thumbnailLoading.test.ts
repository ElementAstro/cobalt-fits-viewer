import {
  clampProgress,
  buildInitialSnapshot,
  withStage,
  withByteProgress,
  buildLoadingSummary,
  formatBytes,
} from "../thumbnailLoading";
import type { FitsMetadata } from "../../../lib/fits/types";

const makeFile = (id: string): FitsMetadata => ({
  id,
  filename: `${id}.fits`,
  filepath: `file:///tmp/${id}.fits`,
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
});

describe("clampProgress", () => {
  it("clamps values to 0-1 range", () => {
    expect(clampProgress(-0.5)).toBe(0);
    expect(clampProgress(0)).toBe(0);
    expect(clampProgress(0.5)).toBe(0.5);
    expect(clampProgress(1)).toBe(1);
    expect(clampProgress(1.5)).toBe(1);
  });

  it("returns 0 for non-finite values", () => {
    expect(clampProgress(NaN)).toBe(0);
    expect(clampProgress(Infinity)).toBe(0);
    expect(clampProgress(-Infinity)).toBe(0);
  });
});

describe("buildInitialSnapshot", () => {
  it("returns an idle snapshot with zero progress", () => {
    const snap = buildInitialSnapshot("f1");
    expect(snap.fileId).toBe("f1");
    expect(snap.stage).toBe("idle");
    expect(snap.progress).toBe(0);
    expect(snap.loadedBytes).toBe(0);
    expect(snap.totalBytes).toBe(0);
    expect(snap.hasByteProgress).toBe(false);
  });
});

describe("withStage", () => {
  it("transitions to loading stage with fallback progress", () => {
    const snap = buildInitialSnapshot("f1");
    const loading = withStage(snap, "loading");
    expect(loading.stage).toBe("loading");
    expect(loading.progress).toBe(0.25);
  });

  it("transitions to decoding stage", () => {
    const snap = buildInitialSnapshot("f1");
    const decoding = withStage(snap, "decoding");
    expect(decoding.stage).toBe("decoding");
    expect(decoding.progress).toBe(0.8);
  });

  it("transitions to ready stage with progress 1", () => {
    const snap = buildInitialSnapshot("f1");
    const ready = withStage(snap, "ready");
    expect(ready.stage).toBe("ready");
    expect(ready.progress).toBe(1);
  });

  it("transitions to error stage with progress 1", () => {
    const snap = buildInitialSnapshot("f1");
    const error = withStage(snap, "error");
    expect(error.stage).toBe("error");
    expect(error.progress).toBe(1);
  });

  it("does not decrease progress when moving to earlier stage", () => {
    const snap = withStage(buildInitialSnapshot("f1"), "decoding");
    const back = withStage(snap, "loading");
    expect(back.progress).toBe(0.8); // keeps higher progress
  });
});

describe("withByteProgress", () => {
  it("updates byte progress when totalBytes > 0", () => {
    const snap = buildInitialSnapshot("f1");
    const updated = withByteProgress(snap, 500, 1000);
    expect(updated.hasByteProgress).toBe(true);
    expect(updated.loadedBytes).toBe(500);
    expect(updated.totalBytes).toBe(1000);
    expect(updated.progress).toBe(0.5);
  });

  it("returns same snapshot when totalBytes is 0", () => {
    const snap = buildInitialSnapshot("f1");
    const updated = withByteProgress(snap, 0, 0);
    expect(updated).toBe(snap);
  });

  it("returns same snapshot when loadedBytes is negative", () => {
    const snap = buildInitialSnapshot("f1");
    const updated = withByteProgress(snap, -1, 0);
    expect(updated).toBe(snap);
  });

  it("transitions idle stage to loading when byte progress arrives", () => {
    const snap = buildInitialSnapshot("f1");
    const updated = withByteProgress(snap, 100, 1000);
    expect(updated.stage).toBe("loading");
  });

  it("does not change stage if already past idle", () => {
    const snap = withStage(buildInitialSnapshot("f1"), "decoding");
    const updated = withByteProgress(snap, 100, 1000);
    expect(updated.stage).toBe("decoding");
  });

  it("does not decrease progress", () => {
    const snap = withStage(buildInitialSnapshot("f1"), "decoding"); // progress = 0.8
    const updated = withByteProgress(snap, 100, 1000); // byte progress = 0.1
    expect(updated.progress).toBe(0.8);
  });
});

describe("buildLoadingSummary", () => {
  it("returns default summary for empty file list", () => {
    const summary = buildLoadingSummary([], {});
    expect(summary.totalCount).toBe(0);
    expect(summary.loadingCount).toBe(0);
    expect(summary.completedCount).toBe(0);
    expect(summary.errorCount).toBe(0);
    expect(summary.progress).toBe(1);
  });

  it("counts completed files", () => {
    const files = [makeFile("f1"), makeFile("f2")];
    const snapshots = {
      f1: { ...buildInitialSnapshot("f1"), stage: "ready" as const, progress: 1 },
      f2: { ...buildInitialSnapshot("f2"), stage: "loading" as const, progress: 0.5 },
    };
    const summary = buildLoadingSummary(files, snapshots);
    expect(summary.totalCount).toBe(2);
    expect(summary.completedCount).toBe(1);
    expect(summary.loadingCount).toBe(1);
  });

  it("counts error files", () => {
    const files = [makeFile("f1"), makeFile("f2")];
    const snapshots = {
      f1: { ...buildInitialSnapshot("f1"), stage: "error" as const, progress: 1 },
      f2: { ...buildInitialSnapshot("f2"), stage: "ready" as const, progress: 1 },
    };
    const summary = buildLoadingSummary(files, snapshots);
    expect(summary.errorCount).toBe(1);
    expect(summary.completedCount).toBe(1);
    expect(summary.loadingCount).toBe(0);
  });

  it("returns progress 1 when all files are done", () => {
    const files = [makeFile("f1")];
    const snapshots = {
      f1: { ...buildInitialSnapshot("f1"), stage: "ready" as const, progress: 1 },
    };
    const summary = buildLoadingSummary(files, snapshots);
    expect(summary.progress).toBe(1);
  });

  it("uses byte-based progress when available", () => {
    const files = [makeFile("f1"), makeFile("f2")];
    const snapshots = {
      f1: {
        ...buildInitialSnapshot("f1"),
        stage: "loading" as const,
        progress: 0.5,
        loadedBytes: 500,
        totalBytes: 1000,
        hasByteProgress: true,
      },
      f2: {
        ...buildInitialSnapshot("f2"),
        stage: "loading" as const,
        progress: 0.25,
        loadedBytes: 250,
        totalBytes: 1000,
        hasByteProgress: true,
      },
    };
    const summary = buildLoadingSummary(files, snapshots);
    expect(summary.loadedBytes).toBe(750);
    expect(summary.totalBytes).toBe(2000);
    expect(summary.progress).toBeCloseTo(0.375);
  });

  it("falls back to stage-based progress when no byte progress", () => {
    const files = [makeFile("f1"), makeFile("f2")];
    const snapshots = {
      f1: { ...buildInitialSnapshot("f1"), stage: "loading" as const, progress: 0.25 },
      f2: { ...buildInitialSnapshot("f2"), stage: "decoding" as const, progress: 0.8 },
    };
    const summary = buildLoadingSummary(files, snapshots);
    expect(summary.totalBytes).toBe(0);
    // fallback: aggregateProgress / totalCount = (0.25 + 0.8) / 2 = 0.525
    expect(summary.progress).toBeCloseTo(0.525);
  });

  it("treats missing snapshots as idle", () => {
    const files = [makeFile("f1")];
    const summary = buildLoadingSummary(files, {});
    expect(summary.totalCount).toBe(1);
    expect(summary.loadingCount).toBe(1);
    expect(summary.completedCount).toBe(0);
  });
});

describe("formatBytes", () => {
  it("formats bytes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(10240)).toBe("10 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
    expect(formatBytes(1073741824)).toBe("1.0 GB");
  });

  it("returns 0 B for non-finite values", () => {
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Infinity)).toBe("0 B");
  });
});
