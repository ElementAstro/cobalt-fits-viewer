import type { FITS } from "fitsjs-ng";
import { getHDUList } from "../fits/parser";
import type { FitsMetadata, HeaderKeyword } from "../fits/types";
import type { RasterFrameProvider } from "../image/tiff/decoder";
import type { ImageParseResult } from "../import/imageParsePipeline";

export interface ImageLoadCacheEntry {
  sourceType: Extract<ImageParseResult["sourceType"], "fits" | "raster">;
  sourceFormat: NonNullable<FitsMetadata["sourceFormat"]>;
  fits: FITS | null;
  rasterFrameProvider: RasterFrameProvider | null;
  headers: HeaderKeyword[];
  comments: string[];
  history: string[];
  dimensions: ImageParseResult["dimensions"];
  hduList: Array<{ index: number; type: string | null; hasData: boolean }>;
  metadataBase: ImageParseResult["metadataBase"];
  decodeStatus: FitsMetadata["decodeStatus"];
  decodeError?: string;
  serInfo?: FitsMetadata["serInfo"];
  sourceBuffer: ArrayBuffer;
}

interface CacheSlot {
  key: string;
  entry: ImageLoadCacheEntry;
  byteSize: number;
}

const DEFAULT_MAX_ENTRIES = 2;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024; // 512 MB

let maxEntries = DEFAULT_MAX_ENTRIES;
let maxBytes = DEFAULT_MAX_BYTES;
const slots: CacheSlot[] = [];

function estimateByteSize(entry: ImageLoadCacheEntry): number {
  return entry.sourceBuffer.byteLength;
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
    slots.shift();
  }
}

export function createImageLoadCacheEntry(
  parsed: ImageParseResult,
  sourceBuffer: ArrayBuffer,
): ImageLoadCacheEntry {
  return {
    sourceType: parsed.sourceType,
    sourceFormat: parsed.sourceFormat,
    fits: parsed.fits,
    rasterFrameProvider: parsed.rasterFrameProvider,
    headers: parsed.headers,
    comments: parsed.comments,
    history: parsed.history,
    dimensions: parsed.dimensions,
    hduList: parsed.fits
      ? getHDUList(parsed.fits).map((item) => ({
          index: item.index,
          type: item.type ?? null,
          hasData: item.hasData,
        }))
      : [],
    metadataBase: parsed.metadataBase,
    decodeStatus: parsed.decodeStatus,
    decodeError: parsed.decodeError,
    serInfo: parsed.serInfo,
    sourceBuffer,
  };
}

export function getImageLoadCache(key: string): ImageLoadCacheEntry | null {
  const idx = slots.findIndex((slot) => slot.key === key);
  if (idx === -1) return null;

  const [slot] = slots.splice(idx, 1);
  slots.push(slot);
  return slot.entry;
}

export function setImageLoadCache(key: string, entry: ImageLoadCacheEntry): void {
  const idx = slots.findIndex((slot) => slot.key === key);
  if (idx !== -1) {
    slots.splice(idx, 1);
  }
  slots.push({
    key,
    entry,
    byteSize: estimateByteSize(entry),
  });
  evictIfNeeded();
}

export function clearImageLoadCache(): void {
  slots.length = 0;
}

export function configureImageLoadCache(opts: { maxEntries?: number; maxBytes?: number }): void {
  if (opts.maxEntries != null) maxEntries = Math.max(1, opts.maxEntries);
  if (opts.maxBytes != null) maxBytes = Math.max(1024 * 1024, opts.maxBytes);
  evictIfNeeded();
}

export function getImageLoadCacheStats(): {
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
