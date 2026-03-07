import {
  copyThumbnailToCache,
  generateAndSaveThumbnail,
  generateVideoThumbnailToCache,
  pruneThumbnailCache,
} from "./thumbnailCache";
import { useSettingsStore } from "../../stores/app/useSettingsStore";

const DEFAULT_PRUNE_THROTTLE_MS = 30_000;
const MB = 1024 * 1024;

let lastPruneTimestamp = 0;

export interface ThumbnailPolicy {
  thumbnailSize: number;
  thumbnailQuality: number;
  videoThumbnailTimeMs: number;
  thumbnailCacheMaxSizeMB: number;
  maxCacheBytes: number;
  pruneThrottleMs: number;
}

export interface ThumbnailPolicyOverrides {
  thumbnailSize?: number;
  thumbnailQuality?: number;
  videoThumbnailTimeMs?: number;
  thumbnailCacheMaxSizeMB?: number;
  pruneThrottleMs?: number;
}

function toPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.round(value));
}

function shouldPrune(now: number, throttleMs: number, force: boolean): boolean {
  if (force) return true;
  return now - lastPruneTimestamp >= throttleMs;
}

export function getThumbnailPolicy(overrides: ThumbnailPolicyOverrides = {}): ThumbnailPolicy {
  const settings = useSettingsStore.getState();
  const thumbnailSize = toPositiveInt(
    overrides.thumbnailSize ?? settings.thumbnailSize,
    settings.thumbnailSize,
  );
  const thumbnailQuality = Math.max(
    1,
    Math.min(100, toPositiveInt(overrides.thumbnailQuality ?? settings.thumbnailQuality, 80)),
  );
  const videoThumbnailTimeMs = Math.max(
    0,
    toPositiveInt(overrides.videoThumbnailTimeMs ?? settings.videoThumbnailTimeMs, 1000),
  );
  const thumbnailCacheMaxSizeMB = Math.max(
    1,
    toPositiveInt(
      overrides.thumbnailCacheMaxSizeMB ?? settings.thumbnailCacheMaxSizeMB,
      settings.thumbnailCacheMaxSizeMB,
    ),
  );
  const pruneThrottleMs = Math.max(
    0,
    toPositiveInt(
      overrides.pruneThrottleMs ?? DEFAULT_PRUNE_THROTTLE_MS,
      DEFAULT_PRUNE_THROTTLE_MS,
    ),
  );

  return {
    thumbnailSize,
    thumbnailQuality,
    videoThumbnailTimeMs,
    thumbnailCacheMaxSizeMB,
    maxCacheBytes: thumbnailCacheMaxSizeMB * MB,
    pruneThrottleMs,
  };
}

export function pruneThumbnailCacheWithPolicy(
  overrides: ThumbnailPolicyOverrides = {},
  options: { force?: boolean } = {},
): number {
  const policy = getThumbnailPolicy(overrides);
  const now = Date.now();
  if (!shouldPrune(now, policy.pruneThrottleMs, options.force === true)) return 0;
  lastPruneTimestamp = now;
  return pruneThumbnailCache(policy.maxCacheBytes);
}

export function saveThumbnailFromRGBA(
  fileId: string,
  rgba: Uint8ClampedArray,
  srcWidth: number,
  srcHeight: number,
  overrides: ThumbnailPolicyOverrides = {},
): string | null {
  const policy = getThumbnailPolicy(overrides);
  const uri = generateAndSaveThumbnail(
    fileId,
    rgba,
    srcWidth,
    srcHeight,
    policy.thumbnailSize,
    policy.thumbnailQuality,
  );
  if (uri) {
    pruneThumbnailCacheWithPolicy(overrides);
  }
  return uri;
}

export async function saveThumbnailFromVideo(
  fileId: string,
  filepath: string,
  timeMs?: number,
  overrides: ThumbnailPolicyOverrides = {},
): Promise<string | null> {
  const policy = getThumbnailPolicy(overrides);
  const uri = await generateVideoThumbnailToCache(
    fileId,
    filepath,
    timeMs ?? policy.videoThumbnailTimeMs,
    policy.thumbnailQuality,
  );
  if (uri) {
    pruneThumbnailCacheWithPolicy(overrides);
  }
  return uri;
}

export function saveThumbnailFromExternalUri(
  fileId: string,
  sourceUri: string,
  overrides: ThumbnailPolicyOverrides = {},
): string | null {
  const uri = copyThumbnailToCache(fileId, sourceUri);
  if (uri) {
    pruneThumbnailCacheWithPolicy(overrides);
  }
  return uri;
}
