/**
 * FITS 文件加载 Hook
 */

import { useReducer, useCallback } from "react";
import { FITS } from "fitsjs-ng";
import {
  getImagePixels,
  getImageDimensions,
  getHDUList,
  getImageChannels,
  isRgbCube,
} from "../lib/fits/parser";
import type { FitsMetadata, HeaderKeyword } from "../lib/fits/types";
import {
  readFileAsArrayBuffer,
  generateFileId,
  getFileCacheFingerprint,
} from "../lib/utils/fileManager";
import { LOG_TAGS, Logger } from "../lib/logger";
import type { RasterFrameProvider } from "../lib/image/tiff/decoder";
import { parseImageBuffer, type ImageParseResult } from "../lib/import/imageParsePipeline";
import { useSettingsStore } from "../stores/useSettingsStore";
import { getPixelCache } from "../lib/cache/pixelCache";
import { getImageLoadCache, type ImageLoadCacheEntry } from "../lib/cache/imageLoadCache";
import {
  hydratePixelCacheFromImageSnapshot,
  warmImageCachesFromFile,
  writeImageCachesFromParsed,
} from "../lib/cache/imageLoadWorkflow";

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

interface UseFitsFileReturn {
  fits: FITS | null;
  metadata: FitsMetadata | null;
  headers: HeaderKeyword[];
  comments: string[];
  history: string[];
  pixels: Float32Array | null;
  rgbChannels: { r: Float32Array; g: Float32Array; b: Float32Array } | null;
  sourceBuffer: ArrayBuffer | null;
  dimensions: { width: number; height: number; depth: number; isDataCube: boolean } | null;
  hduList: Array<{ index: number; type: string | null; hasData: boolean }>;
  isLoading: boolean;
  error: string | null;
  loadFromPath: (filepath: string, filename: string, fileSize: number) => Promise<void>;
  loadFromBuffer: (buffer: ArrayBuffer, filename: string, fileSize: number) => Promise<void>;
  loadFrame: (frame: number, hduIndex?: number) => Promise<void>;
  reset: () => void;
}

interface FitsFileState {
  fits: FITS | null;
  metadata: FitsMetadata | null;
  headers: HeaderKeyword[];
  comments: string[];
  history: string[];
  pixels: Float32Array | null;
  rgbChannels: { r: Float32Array; g: Float32Array; b: Float32Array } | null;
  sourceBuffer: ArrayBuffer | null;
  dimensions: { width: number; height: number; depth: number; isDataCube: boolean } | null;
  hduList: Array<{ index: number; type: string | null; hasData: boolean }>;
  rasterFrameProvider: RasterFrameProvider | null;
  isLoading: boolean;
  error: string | null;
}

type FitsFileAction =
  | { type: "LOAD_START" }
  | {
      type: "LOAD_FITS";
      payload: Omit<
        FitsFileState,
        "isLoading" | "error" | "pixels" | "rgbChannels" | "rasterFrameProvider"
      > & { rasterFrameProvider?: RasterFrameProvider | null };
    }
  | { type: "SET_PIXELS"; pixels: Float32Array | null; rgbChannels?: FitsFileState["rgbChannels"] }
  | { type: "LOAD_RASTER"; payload: Omit<FitsFileState, "isLoading" | "error" | "fits"> }
  | {
      type: "LOAD_FRAME";
      payload: Partial<
        Pick<FitsFileState, "pixels" | "rgbChannels" | "dimensions" | "headers" | "metadata">
      >;
    }
  | { type: "LOAD_ERROR"; error: string }
  | { type: "LOAD_END" }
  | { type: "RESET" };

const initialFitsState: FitsFileState = {
  fits: null,
  metadata: null,
  headers: [],
  comments: [],
  history: [],
  pixels: null,
  rgbChannels: null,
  sourceBuffer: null,
  dimensions: null,
  hduList: [],
  rasterFrameProvider: null,
  isLoading: false,
  error: null,
};

function fitsFileReducer(state: FitsFileState, action: FitsFileAction): FitsFileState {
  switch (action.type) {
    case "LOAD_START":
      return { ...state, isLoading: true, error: null };
    case "LOAD_FITS":
      return {
        ...state,
        fits: action.payload.fits,
        metadata: action.payload.metadata,
        headers: action.payload.headers,
        comments: action.payload.comments,
        history: action.payload.history,
        sourceBuffer: action.payload.sourceBuffer,
        dimensions: action.payload.dimensions,
        hduList: action.payload.hduList,
        rasterFrameProvider: action.payload.rasterFrameProvider ?? null,
        rgbChannels: null,
      };
    case "SET_PIXELS":
      return {
        ...state,
        pixels: action.pixels,
        rgbChannels: action.rgbChannels !== undefined ? action.rgbChannels : state.rgbChannels,
      };
    case "LOAD_RASTER":
      return {
        ...state,
        fits: null,
        metadata: action.payload.metadata,
        headers: action.payload.headers,
        comments: action.payload.comments,
        history: action.payload.history,
        pixels: action.payload.pixels,
        rgbChannels: action.payload.rgbChannels,
        sourceBuffer: action.payload.sourceBuffer,
        dimensions: action.payload.dimensions,
        hduList: action.payload.hduList,
        rasterFrameProvider: action.payload.rasterFrameProvider,
      };
    case "LOAD_FRAME":
      return { ...state, ...action.payload };
    case "LOAD_ERROR":
      return { ...initialFitsState, error: action.error };
    case "LOAD_END":
      return { ...state, isLoading: false };
    case "RESET":
      return initialFitsState;
    default:
      return state;
  }
}

export function useFitsFile(): UseFitsFileReturn {
  const [state, dispatch] = useReducer(fitsFileReducer, initialFitsState);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);

  const toFullMetadata = useCallback(
    (source: {
      metadataBase: ImageParseResult["metadataBase"];
      sourceType: ImageParseResult["sourceType"];
      sourceFormat: ImageParseResult["sourceFormat"];
      decodeStatus: FitsMetadata["decodeStatus"];
      decodeError?: string;
      serInfo?: FitsMetadata["serInfo"];
    }): FitsMetadata => {
      return {
        ...source.metadataBase,
        id: generateFileId(),
        importDate: Date.now(),
        isFavorite: false,
        tags: [],
        albumIds: [],
        sourceType: source.sourceType,
        sourceFormat: source.sourceFormat,
        mediaKind: "image",
        decodeStatus: source.decodeStatus,
        decodeError: source.decodeError,
        ...(source.serInfo ? { serInfo: source.serInfo } : {}),
      };
    },
    [],
  );

  const applyParsedResult = useCallback(
    (parsed: ImageParseResult, sourceBuffer: ArrayBuffer) => {
      const fullMeta = toFullMetadata({
        metadataBase: parsed.metadataBase,
        sourceType: parsed.sourceType,
        sourceFormat: parsed.sourceFormat,
        decodeStatus: parsed.decodeStatus,
        decodeError: parsed.decodeError,
        serInfo: parsed.serInfo,
      });

      if (parsed.sourceType === "fits") {
        if (!parsed.fits) {
          throw new Error("Failed to decode image data");
        }
        dispatch({
          type: "LOAD_FITS",
          payload: {
            fits: parsed.fits,
            metadata: fullMeta,
            headers: parsed.headers,
            comments: parsed.comments,
            history: parsed.history,
            sourceBuffer,
            dimensions: parsed.dimensions,
            hduList: getHDUList(parsed.fits),
            rasterFrameProvider: null,
          },
        });
        return;
      }

      dispatch({
        type: "LOAD_RASTER",
        payload: {
          metadata: fullMeta,
          headers: parsed.headers,
          comments: parsed.comments,
          history: parsed.history,
          pixels: parsed.pixels,
          rgbChannels: parsed.rgbChannels,
          sourceBuffer,
          dimensions: parsed.dimensions,
          hduList: [],
          rasterFrameProvider: parsed.rasterFrameProvider,
        },
      });
    },
    [toFullMetadata],
  );

  const applyImageLoadCacheSnapshot = useCallback(
    async (snapshot: ImageLoadCacheEntry, cacheKey: string, filename: string, fileSize: number) => {
      const fullMeta = toFullMetadata({
        metadataBase: snapshot.metadataBase,
        sourceType: snapshot.sourceType,
        sourceFormat: snapshot.sourceFormat,
        decodeStatus: snapshot.decodeStatus,
        decodeError: snapshot.decodeError,
        serInfo: snapshot.serInfo,
      });

      if (snapshot.sourceType === "fits") {
        if (!snapshot.fits) {
          throw new Error("Failed to decode image data");
        }

        dispatch({
          type: "LOAD_FITS",
          payload: {
            fits: snapshot.fits,
            metadata: fullMeta,
            headers: snapshot.headers,
            comments: snapshot.comments,
            history: snapshot.history,
            sourceBuffer: snapshot.sourceBuffer,
            dimensions: snapshot.dimensions,
            hduList: snapshot.hduList,
            rasterFrameProvider: null,
          },
        });

        const pixelCached = getPixelCache(cacheKey);
        if (pixelCached) {
          Logger.info(LOG_TAGS.FitsFile, `Pixel cache hit: ${filename}`, { fileSize });
          dispatch({
            type: "SET_PIXELS",
            pixels: pixelCached.pixels,
            rgbChannels: pixelCached.rgbChannels,
          });
          return;
        }

        const hydrated = await hydratePixelCacheFromImageSnapshot(cacheKey, snapshot);
        dispatch({
          type: "SET_PIXELS",
          pixels: hydrated?.pixels ?? null,
          rgbChannels: hydrated?.rgbChannels ?? null,
        });
        return;
      }

      let pixels: Float32Array | null = null;
      let rgbChannels: { r: Float32Array; g: Float32Array; b: Float32Array } | null = null;
      let headers = snapshot.headers;
      let dimensions = snapshot.dimensions;
      let metadata = fullMeta;

      if (snapshot.rasterFrameProvider) {
        const loaded = await snapshot.rasterFrameProvider.getFrame(0);
        pixels = loaded.pixels;
        rgbChannels = loaded.channels;
        headers = loaded.headers;
        dimensions = {
          width: loaded.width,
          height: loaded.height,
          depth: snapshot.rasterFrameProvider.pageCount,
          isDataCube: snapshot.rasterFrameProvider.pageCount > 1,
        };
        metadata = {
          ...fullMeta,
          naxis1: loaded.width,
          naxis2: loaded.height,
          naxis3: snapshot.rasterFrameProvider.pageCount,
          bitpix: loaded.bitDepth,
          decodeStatus: "ready",
          decodeError: undefined,
        };
      }

      dispatch({
        type: "LOAD_RASTER",
        payload: {
          metadata,
          headers,
          comments: snapshot.comments,
          history: snapshot.history,
          pixels,
          rgbChannels,
          sourceBuffer: snapshot.sourceBuffer,
          dimensions,
          hduList: snapshot.hduList,
          rasterFrameProvider: snapshot.rasterFrameProvider,
        },
      });
    },
    [toFullMetadata],
  );

  const loadFromPath = useCallback(
    async (filepath: string, filename: string, fileSize: number) => {
      dispatch({ type: "LOAD_START" });
      try {
        await yieldToMain();
        const fingerprint = getFileCacheFingerprint(filepath, fileSize);
        const cacheKey = fingerprint.cacheKey;
        if (fingerprint.strictUsable) {
          const warmedKey = await warmImageCachesFromFile(
            {
              filepath,
              filename,
              fileSize: fingerprint.fileSize || fileSize,
            },
            frameClassificationConfig,
          );
          const imageLoadCached = warmedKey
            ? getImageLoadCache(warmedKey)
            : getImageLoadCache(cacheKey);
          if (imageLoadCached) {
            await applyImageLoadCacheSnapshot(imageLoadCached, cacheKey, filename, fileSize);
            Logger.info(LOG_TAGS.FitsFile, `Loaded from image cache: ${filename}`, { fileSize });
            return;
          }
        }

        const resolvedFileSize = fingerprint.fileSize || fileSize;
        const buffer = await readFileAsArrayBuffer(filepath);
        const parsed = await parseImageBuffer({
          buffer,
          filename,
          filepath,
          fileSize: resolvedFileSize,
          frameClassificationConfig,
        });
        applyParsedResult(parsed, buffer);

        writeImageCachesFromParsed(cacheKey, parsed, buffer, fingerprint.strictUsable);

        if (parsed.sourceType === "fits") {
          const pixels = parsed.pixels;
          dispatch({ type: "SET_PIXELS", pixels, rgbChannels: parsed.rgbChannels });
        }

        Logger.info(LOG_TAGS.FitsFile, `Loaded: ${filename}`, {
          fileSize,
          format: parsed.detectedFormat.id,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load image file";
        Logger.error(LOG_TAGS.FitsFile, `Load failed: ${filename}`, e);
        dispatch({ type: "LOAD_ERROR", error: msg });
      } finally {
        dispatch({ type: "LOAD_END" });
      }
    },
    [applyImageLoadCacheSnapshot, applyParsedResult, frameClassificationConfig],
  );

  const loadFromBuffer = useCallback(
    async (buffer: ArrayBuffer, filename: string, fileSize: number) => {
      dispatch({ type: "LOAD_START" });
      try {
        await yieldToMain();
        const parsed = await parseImageBuffer({
          buffer,
          filename,
          filepath: `memory://${filename}`,
          fileSize,
          frameClassificationConfig,
        });
        applyParsedResult(parsed, buffer);
        if (parsed.sourceType === "fits") {
          dispatch({
            type: "SET_PIXELS",
            pixels: parsed.pixels,
            rgbChannels: parsed.rgbChannels,
          });
        }
        Logger.info(LOG_TAGS.FitsFile, `Loaded from buffer: ${filename}`, {
          format: parsed.detectedFormat.id,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to parse image data";
        Logger.error(LOG_TAGS.FitsFile, `Buffer load failed: ${filename}`, e);
        dispatch({ type: "LOAD_ERROR", error: msg });
      } finally {
        dispatch({ type: "LOAD_END" });
      }
    },
    [applyParsedResult, frameClassificationConfig],
  );

  const loadFrame = useCallback(
    async (frame: number, hduIndex?: number) => {
      if (!state.fits && !state.rasterFrameProvider) return;
      dispatch({ type: "LOAD_START" });
      try {
        await yieldToMain();
        if (state.fits) {
          const dims = getImageDimensions(state.fits, hduIndex);
          const px = await getImagePixels(state.fits, hduIndex, frame);
          const rgb = isRgbCube(state.fits, hduIndex);
          let channels: { r: Float32Array; g: Float32Array; b: Float32Array } | null = null;
          if (rgb.isRgb) {
            const ch = await getImageChannels(state.fits, hduIndex);
            channels = ch ? { r: ch.r, g: ch.g, b: ch.b } : null;
          }
          dispatch({
            type: "LOAD_FRAME",
            payload: {
              pixels: px,
              rgbChannels: channels,
              ...(dims ? { dimensions: dims } : {}),
            },
          });
          Logger.debug(LOG_TAGS.FitsFile, `Frame loaded: ${frame}`, { hduIndex });
          return;
        }

        if (state.rasterFrameProvider) {
          const loaded = await state.rasterFrameProvider.getFrame(frame);
          const updatedMeta: Partial<FitsMetadata> | undefined = state.metadata
            ? {
                naxis1: loaded.width,
                naxis2: loaded.height,
                naxis3: state.rasterFrameProvider.pageCount,
                bitpix: loaded.bitDepth,
                decodeStatus: "ready" as const,
                decodeError: undefined,
              }
            : undefined;
          dispatch({
            type: "LOAD_FRAME",
            payload: {
              pixels: loaded.pixels,
              rgbChannels: loaded.channels,
              headers: loaded.headers,
              dimensions: {
                width: loaded.width,
                height: loaded.height,
                depth: state.rasterFrameProvider.pageCount,
                isDataCube: state.rasterFrameProvider.pageCount > 1,
              },
              ...(updatedMeta && state.metadata
                ? { metadata: { ...state.metadata, ...updatedMeta } }
                : {}),
            },
          });
          Logger.debug(LOG_TAGS.FitsFile, `Raster frame loaded: ${frame}`);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load frame";
        Logger.error(LOG_TAGS.FitsFile, `Frame load failed: ${frame}`, e);
        dispatch({ type: "LOAD_ERROR", error: msg });
      } finally {
        dispatch({ type: "LOAD_END" });
      }
    },
    [state.fits, state.rasterFrameProvider, state.metadata],
  );

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
  }, []);

  return {
    fits: state.fits,
    metadata: state.metadata,
    headers: state.headers,
    comments: state.comments,
    history: state.history,
    pixels: state.pixels,
    rgbChannels: state.rgbChannels,
    sourceBuffer: state.sourceBuffer,
    dimensions: state.dimensions,
    hduList: state.hduList,
    isLoading: state.isLoading,
    error: state.error,
    loadFromPath,
    loadFromBuffer,
    loadFrame,
    reset,
  };
}
