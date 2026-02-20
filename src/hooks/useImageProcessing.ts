/**
 * 图像处理 Hook
 * 支持双阶段处理（scientific + color）与 legacy/standard profile。
 */

import { useState, useCallback, useRef } from "react";
import { InteractionManager } from "react-native";
import { fitsToRGBA, fitsToRGBAChunked, downsamplePixels } from "../lib/converter/formatConverter";
import {
  calculateStats,
  calculateHistogram,
  calculateRegionHistogram,
} from "../lib/utils/pixelMath";
import type {
  ColormapType,
  ProcessingAlgorithmProfile,
  ProcessingPipelineSnapshot,
  StretchType,
  ViewerCurvePreset,
} from "../lib/fits/types";
import { executeProcessingPipeline } from "../lib/processing/executor";
import { normalizeProcessingPipelineSnapshot } from "../lib/processing/recipe";

const PREVIEW_MAX_DIM = 512;
const LARGE_IMAGE_THRESHOLD = 1_000_000;

interface PipelineProcessingOptions {
  profile?: ProcessingAlgorithmProfile;
  recipe?: ProcessingPipelineSnapshot | null;
}

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
    pipelineOptions?: PipelineProcessingOptions,
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
    pipelineOptions?: PipelineProcessingOptions,
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

function hasRecipeNodes(recipe: ProcessingPipelineSnapshot | null | undefined) {
  return !!recipe && (recipe.scientificNodes.length > 0 || recipe.colorNodes.length > 0);
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
      pipelineOptions?: PipelineProcessingOptions,
    ) => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const normalizedRecipe = normalizeProcessingPipelineSnapshot(
        pipelineOptions?.recipe,
        pipelineOptions?.profile ?? "standard",
      );
      const recipeEnabled = hasRecipeNodes(normalizedRecipe);
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
        profile: pipelineOptions?.profile ?? normalizedRecipe.profile,
      };

      if (recipeEnabled) {
        setIsProcessing(true);
        setProcessingError(null);
        try {
          const result = executeProcessingPipeline({
            input: { pixels, width, height },
            snapshot: normalizedRecipe,
            renderOptions: opts,
            options: { mode: "full" },
          });
          setRgbaData(result.colorOutput.rgbaData);
          setDisplayWidth(result.colorOutput.width);
          setDisplayHeight(result.colorOutput.height);
        } catch (e) {
          setProcessingError(e instanceof Error ? e.message : "Image processing failed");
          setRgbaData(null);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      if (totalPixels <= LARGE_IMAGE_THRESHOLD) {
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
      pipelineOptions?: PipelineProcessingOptions,
    ) => {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }

      const normalizedRecipe = normalizeProcessingPipelineSnapshot(
        pipelineOptions?.recipe,
        pipelineOptions?.profile ?? "standard",
      );
      const recipeEnabled = hasRecipeNodes(normalizedRecipe);
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
        profile: pipelineOptions?.profile ?? normalizedRecipe.profile,
      };

      if (recipeEnabled) {
        setIsProcessing(true);
        setProcessingError(null);
        try {
          const previewResult = executeProcessingPipeline({
            input: { pixels, width, height },
            snapshot: normalizedRecipe,
            renderOptions: opts,
            options: { mode: "preview", previewMaxDimension: PREVIEW_MAX_DIM },
          });
          setRgbaData(previewResult.colorOutput.rgbaData);
          setDisplayWidth(previewResult.colorOutput.width);
          setDisplayHeight(previewResult.colorOutput.height);

          const fullResult = executeProcessingPipeline({
            input: { pixels, width, height },
            snapshot: normalizedRecipe,
            renderOptions: opts,
            options: { mode: "full" },
          });
          setRgbaData(fullResult.colorOutput.rgbaData);
          setDisplayWidth(fullResult.colorOutput.width);
          setDisplayHeight(fullResult.colorOutput.height);
        } catch (e) {
          setProcessingError(e instanceof Error ? e.message : "Image processing failed");
          setRgbaData(null);
        } finally {
          setIsProcessing(false);
        }
        return;
      }

      if (totalPixels <= LARGE_IMAGE_THRESHOLD) {
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

      setIsProcessing(true);
      setProcessingError(null);

      try {
        const preview = downsamplePixels(pixels, width, height, PREVIEW_MAX_DIM);
        const previewRgba = fitsToRGBA(preview.pixels, preview.width, preview.height, opts);
        setRgbaData(previewRgba);
        setDisplayWidth(preview.width);
        setDisplayHeight(preview.height);
      } catch {
        // continue
      }

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
    if (pendingTask.current) {
      pendingTask.current.cancel();
    }
    pendingTask.current = InteractionManager.runAfterInteractions(() => {
      const s = calculateStats(pixels);
      setStats(s);
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
