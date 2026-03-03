import { Directory, File, Paths } from "expo-file-system";
import { LOG_TAGS, Logger } from "../logger";

const RUNTIME_CACHE_SUBDIR = "runtime_image_cache";
const INDEX_FILENAME = "index.json";
const SCHEMA_VERSION = 1;

const DEFAULT_MAX_ENTRIES = 2;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024; // 512 MB

interface RuntimeDiskCacheIndexEntry {
  cacheKey: string;
  payloadFile: string;
  byteSize: number;
  createdAt: number;
  lastAccessAt: number;
}

interface RuntimeDiskCacheIndexFile {
  schemaVersion: number;
  entries: RuntimeDiskCacheIndexEntry[];
}

let maxEntries = DEFAULT_MAX_ENTRIES;
let maxBytes = DEFAULT_MAX_BYTES;
let loaded = false;
let loadingPromise: Promise<void> | null = null;
let indexEntries: RuntimeDiskCacheIndexEntry[] = [];

function getRuntimeCacheDir(): Directory {
  const dir = new Directory(Paths.cache, RUNTIME_CACHE_SUBDIR);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function getRuntimeCacheIndexFile(dir: Directory = getRuntimeCacheDir()): File {
  return new File(dir, INDEX_FILENAME);
}

function hasPayloadFiles(dir: Directory): boolean {
  try {
    for (const item of dir.list()) {
      if (!(item instanceof File)) continue;
      if (item.name === INDEX_FILENAME) continue;
      return true;
    }
  } catch {
    // best effort
  }
  return false;
}

function toPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.floor(value));
}

function toPositiveBytes(value: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1024 * 1024, Math.floor(value));
}

function fnv1a32(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function djb2_32(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function toPayloadFilename(cacheKey: string): string {
  return `${fnv1a32(cacheKey)}_${djb2_32(cacheKey)}.bin`;
}

function totalBytes(entries: RuntimeDiskCacheIndexEntry[] = indexEntries): number {
  let total = 0;
  for (const entry of entries) {
    total += entry.byteSize;
  }
  return total;
}

function isValidIndexEntry(value: unknown): value is RuntimeDiskCacheIndexEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Partial<RuntimeDiskCacheIndexEntry>;
  return (
    typeof entry.cacheKey === "string" &&
    entry.cacheKey.length > 0 &&
    typeof entry.payloadFile === "string" &&
    entry.payloadFile.length > 0 &&
    typeof entry.byteSize === "number" &&
    Number.isFinite(entry.byteSize) &&
    entry.byteSize >= 0 &&
    typeof entry.createdAt === "number" &&
    Number.isFinite(entry.createdAt) &&
    typeof entry.lastAccessAt === "number" &&
    Number.isFinite(entry.lastAccessAt)
  );
}

async function persistIndex(): Promise<void> {
  try {
    const file = getRuntimeCacheIndexFile();
    const payload: RuntimeDiskCacheIndexFile = {
      schemaVersion: SCHEMA_VERSION,
      entries: indexEntries,
    };
    file.write(JSON.stringify(payload));
  } catch (error) {
    Logger.warn(LOG_TAGS.Viewer, "Failed to persist runtime disk cache index", error);
  }
}

function resetRuntimeCacheDir(): void {
  const dir = getRuntimeCacheDir();
  if (dir.exists) {
    dir.delete();
  }
  dir.create();
}

async function evictIfNeeded(): Promise<void> {
  if (indexEntries.length === 0) return;

  const dir = getRuntimeCacheDir();
  while (indexEntries.length > maxEntries || totalBytes() > maxBytes) {
    let oldestIdx = 0;
    for (let i = 1; i < indexEntries.length; i++) {
      if (indexEntries[i].lastAccessAt < indexEntries[oldestIdx].lastAccessAt) {
        oldestIdx = i;
      }
    }

    const [oldest] = indexEntries.splice(oldestIdx, 1);
    try {
      const payload = new File(dir, oldest.payloadFile);
      if (payload.exists) {
        payload.delete();
      }
    } catch {
      // best effort
    }
  }
}

async function repairIndexEntries(): Promise<void> {
  if (indexEntries.length === 0) return;

  const dir = getRuntimeCacheDir();
  const repaired: RuntimeDiskCacheIndexEntry[] = [];
  for (const entry of indexEntries) {
    const payload = new File(dir, entry.payloadFile);
    if (!payload.exists) continue;
    const payloadSize = payload.size ?? entry.byteSize;
    repaired.push({
      ...entry,
      byteSize: payloadSize,
    });
  }
  indexEntries = repaired;
}

async function ensureLoaded(): Promise<void> {
  if (loaded) return;
  if (loadingPromise) {
    await loadingPromise;
    return;
  }

  loadingPromise = (async () => {
    try {
      const dir = getRuntimeCacheDir();
      const indexFile = getRuntimeCacheIndexFile(dir);
      if (!indexFile.exists) {
        if (hasPayloadFiles(dir)) {
          resetRuntimeCacheDir();
        }
        indexEntries = [];
        loaded = true;
        return;
      }

      const raw = await indexFile.text();
      const parsed = JSON.parse(raw) as Partial<RuntimeDiskCacheIndexFile>;
      if (parsed.schemaVersion !== SCHEMA_VERSION || !Array.isArray(parsed.entries)) {
        resetRuntimeCacheDir();
        indexEntries = [];
        loaded = true;
        return;
      }

      indexEntries = parsed.entries.filter(isValidIndexEntry);
      await repairIndexEntries();
      await evictIfNeeded();
      await persistIndex();
      loaded = true;
    } catch (error) {
      Logger.warn(LOG_TAGS.Viewer, "Failed to hydrate runtime disk cache index", error);
      resetRuntimeCacheDir();
      indexEntries = [];
      loaded = true;
    } finally {
      loadingPromise = null;
    }
  })();

  await loadingPromise;
}

export function configureRuntimeDiskCache(opts: { maxEntries?: number; maxBytes?: number }): void {
  if (opts.maxEntries != null) {
    maxEntries = toPositiveInt(opts.maxEntries, DEFAULT_MAX_ENTRIES);
  }
  if (opts.maxBytes != null) {
    maxBytes = toPositiveBytes(opts.maxBytes, DEFAULT_MAX_BYTES);
  }
  void ensureLoaded()
    .then(async () => {
      await evictIfNeeded();
      await persistIndex();
    })
    .catch((error) => {
      Logger.warn(LOG_TAGS.Viewer, "Failed to apply runtime disk cache configuration", error);
    });
}

export async function prepareRuntimeDiskCache(): Promise<void> {
  await ensureLoaded();
  await evictIfNeeded();
  await persistIndex();
}

export async function getRuntimeDiskCacheBuffer(cacheKey: string): Promise<ArrayBuffer | null> {
  if (!cacheKey) return null;
  await ensureLoaded();

  const idx = indexEntries.findIndex((entry) => entry.cacheKey === cacheKey);
  if (idx === -1) return null;

  const dir = getRuntimeCacheDir();
  const entry = indexEntries[idx];
  const payload = new File(dir, entry.payloadFile);
  if (!payload.exists) {
    indexEntries.splice(idx, 1);
    await persistIndex();
    return null;
  }

  try {
    const buffer = await payload.arrayBuffer();
    entry.lastAccessAt = Date.now();
    indexEntries[idx] = entry;
    await persistIndex();
    return buffer;
  } catch (error) {
    Logger.warn(LOG_TAGS.Viewer, `Failed to read runtime disk cache: ${cacheKey}`, error);
    indexEntries.splice(idx, 1);
    await persistIndex();
    return null;
  }
}

export async function setRuntimeDiskCacheBuffer(
  cacheKey: string,
  sourceBuffer: ArrayBuffer,
): Promise<void> {
  if (!cacheKey || sourceBuffer.byteLength <= 0) return;
  try {
    await ensureLoaded();

    const dir = getRuntimeCacheDir();
    const now = Date.now();
    const payloadFile = toPayloadFilename(cacheKey);
    const payload = new File(dir, payloadFile);
    payload.write(new Uint8Array(sourceBuffer.slice(0)));
    const payloadSize = payload.size ?? sourceBuffer.byteLength;

    const idx = indexEntries.findIndex((entry) => entry.cacheKey === cacheKey);
    if (idx === -1) {
      indexEntries.push({
        cacheKey,
        payloadFile,
        byteSize: payloadSize,
        createdAt: now,
        lastAccessAt: now,
      });
    } else {
      const prev = indexEntries[idx];
      if (prev.payloadFile !== payloadFile) {
        const prevFile = new File(dir, prev.payloadFile);
        if (prevFile.exists) {
          try {
            prevFile.delete();
          } catch {
            // best effort
          }
        }
      }
      indexEntries[idx] = {
        ...prev,
        payloadFile,
        byteSize: payloadSize,
        lastAccessAt: now,
      };
    }

    await evictIfNeeded();
    await persistIndex();
  } catch (error) {
    Logger.warn(LOG_TAGS.Viewer, `Failed to write runtime disk cache: ${cacheKey}`, error);
  }
}

export function clearRuntimeDiskCaches(): void {
  try {
    resetRuntimeCacheDir();
  } catch (error) {
    Logger.warn(LOG_TAGS.Viewer, "Failed to clear runtime disk cache directory", error);
  }
  indexEntries = [];
  loaded = true;
  loadingPromise = null;
  void persistIndex();
}

export function getRuntimeDiskCacheStats(): {
  entries: number;
  totalBytes: number;
  maxEntries: number;
  maxBytes: number;
} {
  const dir = getRuntimeCacheDir();
  let entries = 0;
  let totalBytes = 0;
  try {
    for (const item of dir.list()) {
      if (!(item instanceof File)) continue;
      if (item.name === INDEX_FILENAME) continue;
      entries += 1;
      totalBytes += item.size ?? 0;
    }
  } catch {
    // best effort
  }

  return {
    entries,
    totalBytes,
    maxEntries,
    maxBytes,
  };
}
