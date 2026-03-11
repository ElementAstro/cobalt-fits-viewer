import type { FitsMetadata } from "../../fits/types";
import {
  enqueueThumbnailRegeneration,
  getThumbnailSchedulerMetrics,
  resetThumbnailSchedulerForTests,
  setThumbnailSchedulerConfig,
  setThumbnailSchedulerExecutorForTests,
} from "../thumbnailScheduler";

const mockResolveThumbnailUri = jest.fn(
  (_fileId: string, _thumbnailUri?: string) => null as string | null,
);

jest.mock("../thumbnailCache", () => ({
  resolveThumbnailUri: (fileId: string, thumbnailUri?: string) =>
    mockResolveThumbnailUri(fileId, thumbnailUri),
}));

function makeFile(id: string, sourceType: FitsMetadata["sourceType"] = "fits"): FitsMetadata {
  return {
    id,
    filename: `${id}.fits`,
    filepath: `file:///${id}.fits`,
    fileSize: 1,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    sourceType,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("thumbnailScheduler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetThumbnailSchedulerForTests();
    setThumbnailSchedulerConfig({
      maxConcurrent: 3,
      maxHeavyConcurrent: 2,
      failureCooldownMs: 1000,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    resetThumbnailSchedulerForTests();
  });

  it("dispatches visible tasks before pending background tasks", async () => {
    setThumbnailSchedulerConfig({
      maxConcurrent: 1,
      maxHeavyConcurrent: 1,
    });

    const started: string[] = [];
    const resolvers = new Map<string, (value: { fileId: string; uri: string | null }) => void>();
    setThumbnailSchedulerExecutorForTests(
      (file) =>
        new Promise((resolve) => {
          started.push(file.id);
          resolvers.set(file.id, resolve);
        }),
    );

    const running = enqueueThumbnailRegeneration(makeFile("running"), {
      priority: "background",
      reason: "test",
    });
    const background = enqueueThumbnailRegeneration(makeFile("background"), {
      priority: "background",
      reason: "test",
    });
    const visible = enqueueThumbnailRegeneration(makeFile("visible"), {
      priority: "visible",
      reason: "test",
    });

    expect(started).toEqual(["running"]);

    resolvers.get("running")?.({ fileId: "running", uri: "file:///running.jpg" });
    await running;
    await flushMicrotasks();

    expect(started).toEqual(["running", "visible"]);

    resolvers.get("visible")?.({ fileId: "visible", uri: "file:///visible.jpg" });
    await visible;
    await flushMicrotasks();

    expect(started).toEqual(["running", "visible", "background"]);

    resolvers.get("background")?.({ fileId: "background", uri: "file:///background.jpg" });
    await background;
  });

  it("deduplicates concurrent requests for the same file and upgrades queued priority", async () => {
    let runCount = 0;
    const resolvers = new Map<string, (value: { fileId: string; uri: string | null }) => void>();
    setThumbnailSchedulerExecutorForTests(
      (file) =>
        new Promise((resolve) => {
          runCount += 1;
          resolvers.set(file.id, resolve);
        }),
    );

    const file = makeFile("dup");
    const first = enqueueThumbnailRegeneration(file, {
      priority: "background",
      reason: "first",
    });
    const second = enqueueThumbnailRegeneration(file, {
      priority: "visible",
      reason: "second",
    });

    expect(first).toBe(second);
    expect(runCount).toBe(1);

    const resolveTask = resolvers.get("dup");
    if (!resolveTask) {
      throw new Error("Expected resolveTask to be available");
    }
    resolveTask({ fileId: "dup", uri: "file:///dup.jpg" });
    await first;

    const metrics = getThumbnailSchedulerMetrics();
    expect(metrics.dedupeHitCount).toBe(1);
  });

  it("respects max concurrent ceiling", async () => {
    setThumbnailSchedulerConfig({
      maxConcurrent: 2,
      maxHeavyConcurrent: 2,
    });

    const started: string[] = [];
    const resolvers = new Map<string, (value: { fileId: string; uri: string | null }) => void>();
    setThumbnailSchedulerExecutorForTests(
      (file) =>
        new Promise((resolve) => {
          started.push(file.id);
          resolvers.set(file.id, resolve);
        }),
    );

    const p1 = enqueueThumbnailRegeneration(makeFile("c1", "raster"), { priority: "background" });
    const p2 = enqueueThumbnailRegeneration(makeFile("c2", "raster"), { priority: "background" });
    const p3 = enqueueThumbnailRegeneration(makeFile("c3", "raster"), { priority: "background" });

    expect(started).toEqual(["c1", "c2"]);
    expect(getThumbnailSchedulerMetrics().activeCount).toBe(2);

    resolvers.get("c1")?.({ fileId: "c1", uri: "file:///c1.jpg" });
    await p1;
    await flushMicrotasks();

    expect(started).toEqual(["c1", "c2", "c3"]);

    resolvers.get("c2")?.({ fileId: "c2", uri: "file:///c2.jpg" });
    resolvers.get("c3")?.({ fileId: "c3", uri: "file:///c3.jpg" });
    await p2;
    await p3;
  });

  it("keeps capacity for non-heavy tasks when heavy quota is reached", async () => {
    setThumbnailSchedulerConfig({
      maxConcurrent: 3,
      maxHeavyConcurrent: 2,
    });

    const started: string[] = [];
    const resolvers = new Map<string, (value: { fileId: string; uri: string | null }) => void>();
    setThumbnailSchedulerExecutorForTests(
      (file) =>
        new Promise((resolve) => {
          started.push(file.id);
          resolvers.set(file.id, resolve);
        }),
    );

    const h1 = enqueueThumbnailRegeneration(makeFile("h1", "fits"), { priority: "background" });
    const h2 = enqueueThumbnailRegeneration(makeFile("h2", "video"), { priority: "background" });
    const h3 = enqueueThumbnailRegeneration(makeFile("h3", "fits"), { priority: "background" });
    const l1 = enqueueThumbnailRegeneration(makeFile("l1", "raster"), { priority: "background" });

    expect(started).toEqual(["h1", "h2", "l1"]);
    expect(started).not.toContain("h3");

    resolvers.get("h1")?.({ fileId: "h1", uri: "file:///h1.jpg" });
    await h1;
    await flushMicrotasks();

    expect(started).toContain("h3");

    resolvers.get("h2")?.({ fileId: "h2", uri: "file:///h2.jpg" });
    resolvers.get("h3")?.({ fileId: "h3", uri: "file:///h3.jpg" });
    resolvers.get("l1")?.({ fileId: "l1", uri: "file:///l1.jpg" });
    await h2;
    await h3;
    await l1;
  });

  it("suppresses retries during cooldown and allows retry after cooldown expiration", async () => {
    const now = { value: 1000 };
    jest.spyOn(Date, "now").mockImplementation(() => now.value);

    let runCount = 0;
    setThumbnailSchedulerExecutorForTests(async (file) => {
      runCount += 1;
      if (runCount === 1) {
        return { fileId: file.id, uri: null };
      }
      return { fileId: file.id, uri: "file:///retry.jpg" };
    });

    const file = makeFile("cooldown");
    const first = await enqueueThumbnailRegeneration(file, { priority: "visible" });
    expect(first.uri).toBeNull();
    expect(runCount).toBe(1);
    await flushMicrotasks();

    const second = await enqueueThumbnailRegeneration(file, { priority: "visible" });
    expect(second.uri).toBeNull();
    expect(runCount).toBe(1);
    expect(getThumbnailSchedulerMetrics().cooldownSkipCount).toBe(1);

    now.value += 1500;
    const third = await enqueueThumbnailRegeneration(file, { priority: "visible" });
    expect(third.uri).toBe("file:///retry.jpg");
    expect(runCount).toBe(2);
  });

  it("exposes queue and lifecycle metrics", async () => {
    setThumbnailSchedulerConfig({
      maxConcurrent: 1,
      maxHeavyConcurrent: 1,
    });

    const resolvers = new Map<string, (value: { fileId: string; uri: string | null }) => void>();
    setThumbnailSchedulerExecutorForTests(
      (file) =>
        new Promise((resolve) => {
          resolvers.set(file.id, resolve);
        }),
    );

    const p1 = enqueueThumbnailRegeneration(makeFile("m1", "fits"), { priority: "visible" });
    const p2 = enqueueThumbnailRegeneration(makeFile("m2", "raster"), { priority: "nearby" });

    const during = getThumbnailSchedulerMetrics();
    expect(during.activeCount).toBe(1);
    expect(during.queuedCount).toBe(1);
    expect(during.queuedNearby).toBe(1);
    expect(during.startCount).toBe(1);

    resolvers.get("m1")?.({ fileId: "m1", uri: "file:///m1.jpg" });
    await p1;
    await flushMicrotasks();

    resolvers.get("m2")?.({ fileId: "m2", uri: "file:///m2.jpg" });
    await p2;
    await flushMicrotasks();

    const after = getThumbnailSchedulerMetrics();
    expect(after.activeCount).toBe(0);
    expect(after.queuedCount).toBe(0);
    expect(after.completeCount).toBe(2);
  });
});
