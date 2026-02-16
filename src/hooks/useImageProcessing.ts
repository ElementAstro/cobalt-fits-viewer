/**
 * 图像处理 Hook
 * 支持渐进式加载：先显示低分辨率预览，再异步处理全分辨率
 * 使用分块处理避免阻塞 JS 主线程
 */

import { useState, useCallback, useRef } from "react";
import { InteractionManager } from "react-native";
import { fitsToRGBA, fitsToRGBAChunked, downsamplePixels } from "../lib/converter/formatConverter";
import {
  calculateStats,
  calculateHistogram,
  calculateRegionHistogram,
} from "../lib/utils/pixelMath";
import type { StretchType, ColormapType, ViewerCurvePreset } from "../lib/fits/types";

const PREVIEW_MAX_DIM = 512;
const LARGE_IMAGE_THRESHOLD = 1_000_000;

interface UseImageProcessingReturn {
  rgbaData: Uint8ClampedArray | null;
  displayWidth: number;
  displayHeight: number;
  stats: ReturnType<typeof calculateStats> | null;
  histogram: ReturnType<typeof calculateHistogram> | null;
  regionHistogram: ReturnType<typeof calculateHistogram> | null;
  isProcessing: boolean;
  processingError: string | null;
  processImage: (
    pixels: Float32Array,
    width: number,
    height: number,
    stretch: StretchType,
    colormap: ColormapType,
    blackPoint?: number,
    whitePoint?: number,
    gamma?: number,
    outputBlack?: number,
    outputWhite?: number,
    brightness?: number,
    contrast?: number,
    mtfMidtone?: number,
    curvePreset?: ViewerCurvePreset,
  ) => void;
  processImagePreview: (
    pixels: Float32Array,
    width: number,
    height: number,
    stretch: StretchType,
    colormap: ColormapType,
    blackPoint?: number,
    whitePoint?: number,
    gamma?: number,
    outputBlack?: number,
    outputWhite?: number,
    brightness?: number,
    contrast?: number,
    mtfMidtone?: number,
    curvePreset?: ViewerCurvePreset,
  ) => void;
  getHistogram: (pixels: Float32Array, bins?: number) => void;
  getStats: (pixels: Float32Array) => void;
  getStatsAndHistogram: (pixels: Float32Array, bins?: number) => void;
  getRegionHistogram: (
    pixels: Float32Array,
    width: number,
    region: { x: number; y: number; w: number; h: number },
    bins?: number,
  ) => void;
  clearRegionHistogram: () => void;
}

export function useImageProcessing(): UseImageProcessingReturn {
  const [rgbaData, setRgbaData] = useState<Uint8ClampedArray | null>(null);
  const [displayWidth, setDisplayWidth] = useState(0);
  const [displayHeight, setDisplayHeight] = useState(0);
  const [stats, setStats] = useState<ReturnType<typeof calculateStats> | null>(null);
  const [histogram, setHistogram] = useState<ReturnType<typeof calculateHistogram> | null>(null);
  const [regionHistogram, setRegionHistogram] = useState<ReturnType<
    typeof calculateHistogram
  > | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const pendingTask = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(
    null,
  );
  const abortRef = useRef<AbortController | null>(null);

  const processImage = useCallback(
    (
      pixels: Float32Array,
      width: number,
      height: number,
      stretch: StretchType,
      colormap: ColormapType,
      blackPoint: number = 0,
      whitePoint: number = 1,
      gamma: number = 1,
      outputBlack: number = 0,
      outputWhite: number = 1,
      brightness: number = 0,
      contrast: number = 1,
      mtfMidtone: number = 0.5,
      curvePreset: ViewerCurvePreset = "linear",
    ) => {
      // Cancel any in-flight chunked processing
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const totalPixels = width * height;
      const opts = {
        stretch,
        colormap,
        blackPoint,
        whitePoint,
        gamma,
        outputBlack,
        outputWhite,
        brightness,
        contrast,
        mtfMidtone,
        curvePreset,
      };

      if (totalPixels <= LARGE_IMAGE_THRESHOLD) {
        // Small image: process synchronously (fast enough)
        setIsProcessing(true);
        setProcessingError(null);
        try {
          const rgba = fitsToRGBA(pixels, width, height, opts);
          setRgbaData(rgba);
          setDisplayWidth(width);
          setDisplayHeight(height);
        } catch (e) {
          setProcessingError(e instanceof Error ? e.message : "Image processing failed");
          setRgbaData(null);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Large image: use chunked async processing
      setIsProcessing(true);
      setProcessingError(null);
      const controller = new AbortController();
      abortRef.current = controller;

      fitsToRGBAChunked(pixels, width, height, opts, controller.signal)
        .then((rgba) => {
          if (!controller.signal.aborted) {
            setRgbaData(rgba);
            setDisplayWidth(width);
            setDisplayHeight(height);
            setIsProcessing(false);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            setProcessingError(e instanceof Error ? e.message : "Image processing failed");
            setRgbaData(null);
            setIsProcessing(false);
          }
        });
    },
    [],
  );

  const processImagePreview = useCallback(
    (
      pixels: Float32Array,
      width: number,
      height: number,
      stretch: StretchType,
      colormap: ColormapType,
      blackPoint: number = 0,
      whitePoint: number = 1,
      gamma: number = 1,
      outputBlack: number = 0,
      outputWhite: number = 1,
      brightness: number = 0,
      contrast: number = 1,
      mtfMidtone: number = 0.5,
      curvePreset: ViewerCurvePreset = "linear",
    ) => {
      // Cancel any in-flight chunked processing
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const totalPixels = width * height;
      const opts = {
        stretch,
        colormap,
        blackPoint,
        whitePoint,
        gamma,
        outputBlack,
        outputWhite,
        brightness,
        contrast,
        mtfMidtone,
        curvePreset,
      };

      if (totalPixels <= LARGE_IMAGE_THRESHOLD) {
        // Small enough: process directly (same as processImage)
        setIsProcessing(true);
        setProcessingError(null);
        try {
          const rgba = fitsToRGBA(pixels, width, height, opts);
          setRgbaData(rgba);
          setDisplayWidth(width);
          setDisplayHeight(height);
        } catch (e) {
          setProcessingError(e instanceof Error ? e.message : "Image processing failed");
          setRgbaData(null);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      // Large image: show preview first, then process full-res
      setIsProcessing(true);
      setProcessingError(null);

      // Phase 1: Instant low-res preview (synchronous, ~512×512 = fast)
      try {
        const preview = downsamplePixels(pixels, width, height, PREVIEW_MAX_DIM);
        const previewRgba = fitsToRGBA(preview.pixels, preview.width, preview.height, opts);
        setRgbaData(previewRgba);
        setDisplayWidth(preview.width);
        setDisplayHeight(preview.height);
      } catch {
        // Preview failed - continue to full-res anyway
      }

      // Phase 2: Full-res chunked processing (async, non-blocking)
      const controller = new AbortController();
      abortRef.current = controller;

      fitsToRGBAChunked(pixels, width, height, opts, controller.signal)
        .then((rgba) => {
          if (!controller.signal.aborted) {
            setRgbaData(rgba);
            setDisplayWidth(width);
            setDisplayHeight(height);
            setIsProcessing(false);
          }
        })
        .catch((e) => {
          if (!controller.signal.aborted) {
            // Preview is already displayed; only set error if it's not an abort
            setProcessingError(e instanceof Error ? e.message : "Image processing failed");
            setIsProcessing(false);
          }
        });
    },
    [],
  );

  const getHistogram = useCallback((pixels: Float32Array, bins: number = 256) => {
    setHistogram(calculateHistogram(pixels, bins));
  }, []);

  const getStats = useCallback((pixels: Float32Array) => {
    setStats(calculateStats(pixels));
  }, []);

  const getStatsAndHistogram = useCallback((pixels: Float32Array, bins: number = 256) => {
    // Cancel any pending deferred task
    if (pendingTask.current) {
      pendingTask.current.cancel();
    }
    // Defer heavy computation until animations/interactions complete
    pendingTask.current = InteractionManager.runAfterInteractions(() => {
      const s = calculateStats(pixels);
      setStats(s);
      // Reuse min/max from stats to avoid redundant scan
      setHistogram(calculateHistogram(pixels, bins, { min: s.min, max: s.max }));
      pendingTask.current = null;
    });
  }, []);

  const getRegionHistogram = useCallback(
    (
      pixels: Float32Array,
      width: number,
      region: { x: number; y: number; w: number; h: number },
      bins: number = 256,
    ) => {
      const globalRange = stats ? { min: stats.min, max: stats.max } : undefined;
      setRegionHistogram(
        calculateRegionHistogram(
          pixels,
          width,
          region.x,
          region.y,
          region.w,
          region.h,
          bins,
          globalRange,
        ),
      );
    },
    [stats],
  );

  const clearRegionHistogram = useCallback(() => {
    setRegionHistogram(null);
  }, []);

  return {
    rgbaData,
    displayWidth,
    displayHeight,
    stats,
    histogram,
    regionHistogram,
    isProcessing,
    processingError,
    processImage,
    processImagePreview,
    getHistogram,
    getStats,
    getStatsAndHistogram,
    getRegionHistogram,
    clearRegionHistogram,
  };
}
