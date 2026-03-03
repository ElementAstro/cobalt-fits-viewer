import type { FITS } from "fitsjs-ng";
import type { FrameClassificationConfig } from "../fits/types";
import type { ImageLoadCacheEntry } from "./imageLoadCache";
import { hydratePixelCacheFromImageSnapshot, warmImageCachesFromFile } from "./imageLoadWorkflow";
import type { PixelCacheEntry } from "./pixelCache";

type DimensionsLike = { width: number; height: number; depth: number } | null | undefined;

export interface HydratePixelCacheFromCachedFitsOptions {
  cacheKey: string;
  fits: FITS;
  dimensions?: DimensionsLike;
  isCancelled?: () => boolean;
}

export async function hydratePixelCacheFromCachedFits(
  options: HydratePixelCacheFromCachedFitsOptions,
): Promise<PixelCacheEntry | null> {
  const snapshot = {
    sourceType: "fits",
    sourceFormat: "fits",
    fits: options.fits,
    rasterFrameProvider: null,
    headers: [],
    comments: [],
    history: [],
    dimensions: options.dimensions
      ? {
          width: options.dimensions.width,
          height: options.dimensions.height,
          depth: options.dimensions.depth,
          isDataCube: options.dimensions.depth > 1,
        }
      : null,
    hduList: [],
    metadataBase: {
      filename: "",
      filepath: "",
      fileSize: 0,
      frameType: "light",
      frameTypeSource: "filename",
    },
    decodeStatus: "ready",
    sourceBuffer: new ArrayBuffer(0),
  } as ImageLoadCacheEntry;

  return hydratePixelCacheFromImageSnapshot(options.cacheKey, snapshot, {
    isCancelled: options.isCancelled,
  });
}

export interface WarmImageCachesForFileOptions {
  filepath: string;
  filename: string;
  fileSize: number;
  frameClassificationConfig?: FrameClassificationConfig;
  isCancelled?: () => boolean;
}

export async function warmImageCachesForFile(
  options: WarmImageCachesForFileOptions,
): Promise<string | null> {
  return warmImageCachesFromFile(
    {
      filepath: options.filepath,
      filename: options.filename,
      fileSize: options.fileSize,
    },
    options.frameClassificationConfig,
    {
      isCancelled: options.isCancelled,
    },
  );
}
