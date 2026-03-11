import { LOG_TAGS, Logger } from "../logger";
import type { FitsMetadata } from "../fits/types";
import { resolveThumbnailUri } from "./thumbnailCache";
import { regenerateFileThumbnail } from "./thumbnailGenerator";

export type ThumbnailRequestPriority = "visible" | "nearby" | "background";

export interface ThumbnailSchedulerConfig {
  maxConcurrent: number;
  maxHeavyConcurrent: number;
  failureCooldownMs: number;
}

export interface EnqueueThumbnailRequestOptions {
  priority?: ThumbnailRequestPriority;
  reason?: string;
  bypassCooldown?: boolean;
}

export interface ThumbnailSchedulerMetrics {
  activeCount: number;
  inFlightCount: number;
  queuedCount: number;
  queuedVisible: number;
  queuedNearby: number;
  queuedBackground: number;
  dedupeHitCount: number;
  enqueueCount: number;
  startCount: number;
  completeCount: number;
  failureCount: number;
  cooldownSkipCount: number;
}

type ThumbnailGenerationResult = { fileId: string; uri: string | null };
type ThumbnailGenerationExecutor = (file: FitsMetadata) => Promise<ThumbnailGenerationResult>;
type RequestStatus = "queued" | "running";

interface QueuedThumbnailRequest {
  file: FitsMetadata;
  priority: ThumbnailRequestPriority;
  reason?: string;
  status: RequestStatus;
  promise: Promise<ThumbnailGenerationResult>;
  resolve: (result: ThumbnailGenerationResult) => void;
}

interface MutableMetrics {
  dedupeHitCount: number;
  enqueueCount: number;
  startCount: number;
  completeCount: number;
  failureCount: number;
  cooldownSkipCount: number;
}

const PRIORITY_ORDER: ThumbnailRequestPriority[] = ["visible", "nearby", "background"];
const PRIORITY_RANK: Record<ThumbnailRequestPriority, number> = {
  visible: 0,
  nearby: 1,
  background: 2,
};

const DEFAULT_CONFIG: ThumbnailSchedulerConfig = {
  maxConcurrent: 3,
  maxHeavyConcurrent: 2,
  failureCooldownMs: 60_000,
};

let config: ThumbnailSchedulerConfig = { ...DEFAULT_CONFIG };
let executor: ThumbnailGenerationExecutor = regenerateFileThumbnail;

const queues: Record<ThumbnailRequestPriority, string[]> = {
  visible: [],
  nearby: [],
  background: [],
};
const requests = new Map<string, QueuedThumbnailRequest>();
const inFlight = new Map<string, Promise<ThumbnailGenerationResult>>();
const failedAt = new Map<string, number>();

let activeCount = 0;
let activeHeavyCount = 0;
let isDispatching = false;

const metrics: MutableMetrics = {
  dedupeHitCount: 0,
  enqueueCount: 0,
  startCount: 0,
  completeCount: 0,
  failureCount: 0,
  cooldownSkipCount: 0,
};

function clampInt(value: number, fallback: number, min: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.floor(value));
}

function normalizeConfig(next: Partial<ThumbnailSchedulerConfig>): ThumbnailSchedulerConfig {
  const maxConcurrent = clampInt(
    next.maxConcurrent ?? config.maxConcurrent,
    DEFAULT_CONFIG.maxConcurrent,
    1,
  );
  const heavyFallback = Math.max(1, maxConcurrent - 1);
  const maxHeavyConcurrent = Math.min(
    maxConcurrent,
    clampInt(next.maxHeavyConcurrent ?? config.maxHeavyConcurrent, heavyFallback, 1),
  );
  const failureCooldownMs = clampInt(
    next.failureCooldownMs ?? config.failureCooldownMs,
    DEFAULT_CONFIG.failureCooldownMs,
    0,
  );
  return {
    maxConcurrent,
    maxHeavyConcurrent,
    failureCooldownMs,
  };
}

function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function isHeavyFile(file: FitsMetadata): boolean {
  return file.sourceType === "fits" || file.sourceType === "video";
}

function countQueued(priority: ThumbnailRequestPriority): number {
  let count = 0;
  for (const req of requests.values()) {
    if (req.status === "queued" && req.priority === priority) {
      count++;
    }
  }
  return count;
}

function getQueuedCount(): number {
  let count = 0;
  for (const req of requests.values()) {
    if (req.status === "queued") count++;
  }
  return count;
}

function updatePriorityIfNeeded(
  request: QueuedThumbnailRequest,
  nextPriority: ThumbnailRequestPriority,
): void {
  if (request.status !== "queued") return;
  if (PRIORITY_RANK[nextPriority] >= PRIORITY_RANK[request.priority]) return;
  request.priority = nextPriority;
  queues[nextPriority].push(request.file.id);
}

function shouldSkipByCooldown(
  fileId: string,
  bypassCooldown: boolean | undefined,
  now: number,
): boolean {
  if (bypassCooldown) return false;
  const lastFailedAt = failedAt.get(fileId);
  if (typeof lastFailedAt !== "number") return false;
  return now - lastFailedAt < config.failureCooldownMs;
}

function takeNextRequest(): QueuedThumbnailRequest | null {
  for (const priority of PRIORITY_ORDER) {
    const queue = queues[priority];
    const scanned = queue.length;
    for (let i = 0; i < scanned; i++) {
      const fileId = queue.shift();
      if (!fileId) continue;

      const request = requests.get(fileId);
      if (!request || request.status !== "queued") continue;

      if (request.priority !== priority) {
        queues[request.priority].push(fileId);
        continue;
      }

      if (isHeavyFile(request.file) && activeHeavyCount >= config.maxHeavyConcurrent) {
        queue.push(fileId);
        continue;
      }

      return request;
    }
  }
  return null;
}

function dispatchQueue(): void {
  if (isDispatching) return;
  isDispatching = true;
  try {
    while (activeCount < config.maxConcurrent) {
      const request = takeNextRequest();
      if (!request) break;
      startRequest(request);
    }
  } finally {
    isDispatching = false;
  }
}

function finalizeRequest(
  request: QueuedThumbnailRequest,
  result: ThumbnailGenerationResult,
  opts: { failed: boolean; error?: unknown },
): void {
  metrics.completeCount += 1;
  if (opts.failed) {
    metrics.failureCount += 1;
    failedAt.set(request.file.id, Date.now());
  } else if (result.uri) {
    failedAt.delete(request.file.id);
  } else {
    failedAt.set(request.file.id, Date.now());
  }

  if (opts.failed) {
    Logger.warn(LOG_TAGS.Thumbnail, "Thumbnail queue task failed", {
      fileId: request.file.id,
      priority: request.priority,
      reason: request.reason,
      error: opts.error,
      metrics: getThumbnailSchedulerMetrics(),
    });
  } else {
    Logger.debug(LOG_TAGS.Thumbnail, "Thumbnail queue task finished", {
      fileId: request.file.id,
      priority: request.priority,
      reason: request.reason,
      hasUri: !!result.uri,
      metrics: getThumbnailSchedulerMetrics(),
    });
  }

  request.resolve(result);
  requests.delete(request.file.id);
}

function startRequest(request: QueuedThumbnailRequest): void {
  request.status = "running";
  activeCount += 1;
  metrics.startCount += 1;

  const heavy = isHeavyFile(request.file);
  if (heavy) {
    activeHeavyCount += 1;
  }

  Logger.debug(LOG_TAGS.Thumbnail, "Thumbnail queue task started", {
    fileId: request.file.id,
    priority: request.priority,
    reason: request.reason,
    sourceType: request.file.sourceType ?? "unknown",
    activeCount,
    activeHeavyCount,
    queuedCount: getQueuedCount(),
  });

  inFlight.set(request.file.id, request.promise);

  void executor(request.file)
    .then((result) => {
      finalizeRequest(request, result, { failed: false });
    })
    .catch((error: unknown) => {
      finalizeRequest(
        request,
        {
          fileId: request.file.id,
          uri: null,
        },
        { failed: true, error },
      );
    })
    .finally(() => {
      activeCount = Math.max(0, activeCount - 1);
      if (heavy) {
        activeHeavyCount = Math.max(0, activeHeavyCount - 1);
      }
      inFlight.delete(request.file.id);
      dispatchQueue();
    });
}

export function setThumbnailSchedulerConfig(next: Partial<ThumbnailSchedulerConfig>): void {
  config = normalizeConfig(next);
  dispatchQueue();
}

export function clearThumbnailSchedulerFailures(fileId?: string): void {
  if (fileId) {
    failedAt.delete(fileId);
    return;
  }
  failedAt.clear();
}

export function enqueueThumbnailRegeneration(
  file: FitsMetadata,
  options: EnqueueThumbnailRequestOptions = {},
): Promise<ThumbnailGenerationResult> {
  const priority = options.priority ?? "background";
  const existingUri = resolveThumbnailUri(file.id, file.thumbnailUri);
  if (existingUri) {
    return Promise.resolve({
      fileId: file.id,
      uri: existingUri,
    });
  }

  const byRequest = requests.get(file.id);
  if (byRequest) {
    metrics.dedupeHitCount += 1;
    updatePriorityIfNeeded(byRequest, priority);
    Logger.debug(LOG_TAGS.Thumbnail, "Thumbnail queue dedupe hit (queued/running)", {
      fileId: file.id,
      nextPriority: priority,
      currentPriority: byRequest.priority,
      reason: options.reason,
    });
    return byRequest.promise;
  }

  const byInFlight = inFlight.get(file.id);
  if (byInFlight) {
    metrics.dedupeHitCount += 1;
    Logger.debug(LOG_TAGS.Thumbnail, "Thumbnail queue dedupe hit (in-flight)", {
      fileId: file.id,
      nextPriority: priority,
      reason: options.reason,
    });
    return byInFlight;
  }

  const now = Date.now();
  if (shouldSkipByCooldown(file.id, options.bypassCooldown, now)) {
    metrics.cooldownSkipCount += 1;
    Logger.debug(LOG_TAGS.Thumbnail, "Thumbnail queue skipped by cooldown", {
      fileId: file.id,
      priority,
      reason: options.reason,
      cooldownMs: config.failureCooldownMs,
    });
    return Promise.resolve({
      fileId: file.id,
      uri: null,
    });
  }

  const deferred = createDeferred<ThumbnailGenerationResult>();
  const request: QueuedThumbnailRequest = {
    file,
    priority,
    reason: options.reason,
    status: "queued",
    promise: deferred.promise,
    resolve: deferred.resolve,
  };

  metrics.enqueueCount += 1;
  requests.set(file.id, request);
  queues[priority].push(file.id);

  Logger.debug(LOG_TAGS.Thumbnail, "Thumbnail queue enqueued", {
    fileId: file.id,
    priority,
    reason: options.reason,
    sourceType: file.sourceType ?? "unknown",
    metrics: getThumbnailSchedulerMetrics(),
  });

  dispatchQueue();
  return request.promise;
}

export function getThumbnailSchedulerMetrics(): ThumbnailSchedulerMetrics {
  return {
    activeCount,
    inFlightCount: inFlight.size,
    queuedCount: getQueuedCount(),
    queuedVisible: countQueued("visible"),
    queuedNearby: countQueued("nearby"),
    queuedBackground: countQueued("background"),
    dedupeHitCount: metrics.dedupeHitCount,
    enqueueCount: metrics.enqueueCount,
    startCount: metrics.startCount,
    completeCount: metrics.completeCount,
    failureCount: metrics.failureCount,
    cooldownSkipCount: metrics.cooldownSkipCount,
  };
}

export function resetThumbnailSchedulerForTests(): void {
  config = { ...DEFAULT_CONFIG };
  executor = regenerateFileThumbnail;
  queues.visible.length = 0;
  queues.nearby.length = 0;
  queues.background.length = 0;
  requests.clear();
  inFlight.clear();
  failedAt.clear();
  activeCount = 0;
  activeHeavyCount = 0;
  isDispatching = false;
  metrics.dedupeHitCount = 0;
  metrics.enqueueCount = 0;
  metrics.startCount = 0;
  metrics.completeCount = 0;
  metrics.failureCount = 0;
  metrics.cooldownSkipCount = 0;
}

export function setThumbnailSchedulerExecutorForTests(next: ThumbnailGenerationExecutor): void {
  executor = next;
}
