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
import { readFileAsArrayBuffer } from "../lib/utils/fileManager";
import { generateFileId } from "../lib/utils/fileManager";
import { LOG_TAGS, Logger } from "../lib/logger";
import type { RasterFrameProvider } from "../lib/image/tiff/decoder";
import { parseImageBuffer, type ImageParseResult } from "../lib/import/imageParsePipeline";
import { useSettingsStore } from "../stores/useSettingsStore";
import { buildPixelCacheKey, getPixelCache, setPixelCache } from "../lib/cache/pixelCache";

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

  const toFullMetadata = useCallback((parsed: ImageParseResult): FitsMetadata => {
    return {
      ...parsed.metadataBase,
      id: generateFileId(),
      importDate: Date.now(),
      isFavorite: false,
      tags: [],
      albumIds: [],
      sourceType: parsed.sourceType,
      sourceFormat: parsed.sourceFormat,
      mediaKind: "image",
      decodeStatus: parsed.decodeStatus,
      decodeError: parsed.decodeError,
      ...(parsed.serInfo ? { serInfo: parsed.serInfo } : {}),
    };
  }, []);

  const applyParsedResult = useCallback(
    (parsed: ImageParseResult, sourceBuffer: ArrayBuffer) => {
      const fullMeta = toFullMetadata(parsed);

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

  const loadFromPath = useCallback(
    async (filepath: string, filename: string, fileSize: number) => {
      dispatch({ type: "LOAD_START" });
      try {
        await yieldToMain();
        const cacheKey = buildPixelCacheKey(filepath, fileSize);
        const cached = getPixelCache(cacheKey);

        const buffer = await readFileAsArrayBuffer(filepath);
        const parsed = await parseImageBuffer({
          buffer,
          filename,
          filepath,
          fileSize,
          frameClassificationConfig,
        });
        applyParsedResult(parsed, buffer);

        if (parsed.sourceType === "fits") {
          let pixels = parsed.pixels;
          let channels = parsed.rgbChannels;
          if (cached) {
            pixels = cached.pixels;
            channels = cached.rgbChannels;
            Logger.info(LOG_TAGS.FitsFile, `Pixel cache hit: ${filename}`, { fileSize });
          } else if (pixels) {
            setPixelCache(cacheKey, {
              pixels,
              width: parsed.dimensions?.width ?? 0,
              height: parsed.dimensions?.height ?? 0,
              depth: parsed.dimensions?.depth ?? 1,
              rgbChannels: channels,
              timestamp: Date.now(),
            });
          }
          dispatch({ type: "SET_PIXELS", pixels, rgbChannels: channels });
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
    [applyParsedResult, frameClassificationConfig],
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
