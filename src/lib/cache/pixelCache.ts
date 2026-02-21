/**
 * LRU 缓存：已解析的像素数据
 * 避免重复打开同一文件时重新执行 I/O + FITS 解析
 */

export interface PixelCacheEntry {
  pixels: Float32Array;
  width: number;
  height: number;
  depth: number;
  rgbChannels: { r: Float32Array; g: Float32Array; b: Float32Array } | null;
  timestamp: number;
}

interface CacheSlot {
  key: string;
  entry: PixelCacheEntry;
  byteSize: number;
}

const DEFAULT_MAX_ENTRIES = 3;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024; // 512 MB

let maxEntries = DEFAULT_MAX_ENTRIES;
let maxBytes = DEFAULT_MAX_BYTES;
const slots: CacheSlot[] = [];

function estimateByteSize(entry: PixelCacheEntry): number {
  let size = entry.pixels.byteLength;
  if (entry.rgbChannels) {
    size += entry.rgbChannels.r.byteLength;
    size += entry.rgbChannels.g.byteLength;
    size += entry.rgbChannels.b.byteLength;
  }
  return size;
}

function totalBytes(): number {
  let total = 0;
  for (const slot of slots) {
    total += slot.byteSize;
  }
  return total;
}

function evictIfNeeded(): void {
  while (slots.length > maxEntries || totalBytes() > maxBytes) {
    if (slots.length === 0) break;
    slots.shift(); // remove oldest (least recently used)
  }
}

/**
 * Build a cache key from filepath.
 * Callers may include fileSize or mtime for extra safety.
 */
export function buildPixelCacheKey(filepath: string, fileSize?: number): string {
  return fileSize != null ? `${filepath}::${fileSize}` : filepath;
}

export function getPixelCache(key: string): PixelCacheEntry | null {
  const idx = slots.findIndex((s) => s.key === key);
  if (idx === -1) return null;

  // Move to end (most recently used)
  const [slot] = slots.splice(idx, 1);
  slot.entry.timestamp = Date.now();
  slots.push(slot);
  return slot.entry;
}

export function setPixelCache(key: string, entry: PixelCacheEntry): void {
  // Remove existing entry with same key
  const idx = slots.findIndex((s) => s.key === key);
  if (idx !== -1) {
    slots.splice(idx, 1);
  }

  const byteSize = estimateByteSize(entry);
  slots.push({ key, entry, byteSize });
  evictIfNeeded();
}

export function clearPixelCache(): void {
  slots.length = 0;
}

export function getPixelCacheStats(): {
  entries: number;
  totalBytes: number;
  maxEntries: number;
  maxBytes: number;
} {
  return {
    entries: slots.length,
    totalBytes: totalBytes(),
    maxEntries,
    maxBytes,
  };
}

export function configurePixelCache(opts: { maxEntries?: number; maxBytes?: number }): void {
  if (opts.maxEntries != null) maxEntries = Math.max(1, opts.maxEntries);
  if (opts.maxBytes != null) maxBytes = Math.max(1024 * 1024, opts.maxBytes);
  evictIfNeeded();
}
