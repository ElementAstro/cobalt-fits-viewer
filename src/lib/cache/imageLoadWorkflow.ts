import { getImageChannels, getImagePixels, isRgbCube } from "../fits/parser";
import { parseImageBuffer, type ImageParseResult } from "../import/imageParsePipeline";
import type { FrameClassificationConfig } from "../fits/types";
import { getFileCacheFingerprint, readFileAsArrayBuffer } from "../utils/fileManager";
import {
  createImageLoadCacheEntry,
  getImageLoadCache,
  type ImageLoadCacheEntry,
  setImageLoadCache,
} from "./imageLoadCache";
import { getPixelCache, setPixelCache, type PixelCacheEntry } from "./pixelCache";
import { getRuntimeDiskCacheBuffer, setRuntimeDiskCacheBuffer } from "./runtimeDiskCache";

const inFlightWarmups = new Map<string, Promise<string | null>>();

function getCancelledFn(isCancelled?: () => boolean): () => boolean {
  return isCancelled ?? (() => false);
}

function isCacheableSourceType(sourceType: unknown): sourceType is "fits" | "raster" {
  return sourceType === "fits" || sourceType === "raster";
}

export function writeImageCachesFromParsed(
  cacheKey: string,
  parsed: ImageParseResult,
  sourceBuffer: ArrayBuffer,
  strictUsable: boolean,
): void {
  if (!strictUsable || !isCacheableSourceType(parsed.sourceType)) {
    return;
  }

  setImageLoadCache(cacheKey, createImageLoadCacheEntry(parsed, sourceBuffer));
  void setRuntimeDiskCacheBuffer(cacheKey, sourceBuffer);

  if (parsed.sourceType !== "fits" || !parsed.pixels) {
    return;
  }

  setPixelCache(cacheKey, {
    pixels: parsed.pixels,
    width: parsed.dimensions?.width ?? 0,
    height: parsed.dimensions?.height ?? 0,
    depth: parsed.dimensions?.depth ?? 1,
    rgbChannels: parsed.rgbChannels,
    timestamp: Date.now(),
  });
}

export interface HydratePixelCacheFromImageSnapshotOptions {
  isCancelled?: () => boolean;
}

export async function hydratePixelCacheFromImageSnapshot(
  cacheKey: string,
  snapshot: ImageLoadCacheEntry,
  options: HydratePixelCacheFromImageSnapshotOptions = {},
): Promise<PixelCacheEntry | null> {
  if (snapshot.sourceType !== "fits" || !snapshot.fits) {
    return null;
  }

  const isCancelled = getCancelledFn(options.isCancelled);
  if (isCancelled()) return null;

  const existing = getPixelCache(cacheKey);
  if (existing) return existing;

  const pixels = await getImagePixels(snapshot.fits);
  if (isCancelled() || !pixels) return null;

  let channels: { r: Float32Array; g: Float32Array; b: Float32Array } | null = null;
  if (isRgbCube(snapshot.fits).isRgb) {
    const parsedChannels = await getImageChannels(snapshot.fits);
    channels = parsedChannels
      ? { r: parsedChannels.r, g: parsedChannels.g, b: parsedChannels.b }
      : null;
  }
  if (isCancelled()) return null;

  const hydrated: PixelCacheEntry = {
    pixels,
    width: snapshot.dimensions?.width ?? 0,
    height: snapshot.dimensions?.height ?? 0,
    depth: snapshot.dimensions?.depth ?? 1,
    rgbChannels: channels,
    timestamp: Date.now(),
  };
  setPixelCache(cacheKey, hydrated);
  return hydrated;
}

export interface WarmImageCachesTargetFile {
  filepath: string;
  filename: string;
  fileSize: number;
}

export interface WarmImageCachesFromFileOptions {
  isCancelled?: () => boolean;
}

export async function hydrateImageLoadCacheFromDisk(
  cacheKey: string,
  targetFile: WarmImageCachesTargetFile,
  frameClassificationConfig?: FrameClassificationConfig,
  options: WarmImageCachesFromFileOptions = {},
): Promise<ImageLoadCacheEntry | null> {
  const isCancelled = getCancelledFn(options.isCancelled);
  if (isCancelled()) return null;

  const buffer = await getRuntimeDiskCacheBuffer(cacheKey);
  if (!buffer || isCancelled()) return null;

  const parsed = await parseImageBuffer({
    buffer,
    filename: targetFile.filename,
    filepath: targetFile.filepath,
    fileSize: targetFile.fileSize,
    frameClassificationConfig,
  });
  if (isCancelled()) return null;
  if (!isCacheableSourceType(parsed.sourceType)) return null;

  writeImageCachesFromParsed(cacheKey, parsed, buffer, true);
  return getImageLoadCache(cacheKey);
}

export async function warmImageCachesFromFile(
  targetFile: WarmImageCachesTargetFile,
  frameClassificationConfig?: FrameClassificationConfig,
  options: WarmImageCachesFromFileOptions = {},
): Promise<string | null> {
  const isCancelled = getCancelledFn(options.isCancelled);
  const fingerprint = getFileCacheFingerprint(targetFile.filepath, targetFile.fileSize);
  if (!fingerprint.strictUsable) return null;
  if (isCancelled()) return null;

  const cacheKey = fingerprint.cacheKey;
  const inFlight = inFlightWarmups.get(cacheKey);
  if (inFlight) {
    const result = await inFlight;
    return isCancelled() ? null : result;
  }

  const warmupPromise = (async () => {
    const cachedSnapshot = getImageLoadCache(cacheKey);
    if (cachedSnapshot) {
      await hydratePixelCacheFromImageSnapshot(cacheKey, cachedSnapshot, { isCancelled });
      return cacheKey;
    }

    const diskSnapshot = await hydrateImageLoadCacheFromDisk(
      cacheKey,
      targetFile,
      frameClassificationConfig,
      { isCancelled },
    );
    if (diskSnapshot) {
      await hydratePixelCacheFromImageSnapshot(cacheKey, diskSnapshot, { isCancelled });
      return cacheKey;
    }

    const buffer = await readFileAsArrayBuffer(targetFile.filepath);
    if (isCancelled()) return null;

    const parsed = await parseImageBuffer({
      buffer,
      filename: targetFile.filename,
      filepath: targetFile.filepath,
      fileSize: fingerprint.fileSize || targetFile.fileSize,
      frameClassificationConfig,
    });
    if (isCancelled()) return null;
    if (!isCacheableSourceType(parsed.sourceType)) return null;
    if (isCancelled()) return null;

    writeImageCachesFromParsed(cacheKey, parsed, buffer, fingerprint.strictUsable);
    return cacheKey;
  })();
  inFlightWarmups.set(cacheKey, warmupPromise);

  try {
    const result = await warmupPromise;
    return isCancelled() ? null : result;
  } finally {
    inFlightWarmups.delete(cacheKey);
  }
}
