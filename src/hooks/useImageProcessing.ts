/**
 * 图像处理 Hook
 */

import { useState, useCallback } from "react";
import { fitsToRGBA } from "../lib/converter/formatConverter";
import { calculateStats, calculateHistogram } from "../lib/utils/pixelMath";
import type { StretchType, ColormapType } from "../lib/fits/types";

interface UseImageProcessingReturn {
  rgbaData: Uint8ClampedArray | null;
  stats: ReturnType<typeof calculateStats> | null;
  histogram: ReturnType<typeof calculateHistogram> | null;
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
  ) => void;
  getHistogram: (pixels: Float32Array, bins?: number) => void;
  getStats: (pixels: Float32Array) => void;
}

export function useImageProcessing(): UseImageProcessingReturn {
  const [rgbaData, setRgbaData] = useState<Uint8ClampedArray | null>(null);
  const [stats, setStats] = useState<ReturnType<typeof calculateStats> | null>(null);
  const [histogram, setHistogram] = useState<ReturnType<typeof calculateHistogram> | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);

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
    ) => {
      setIsProcessing(true);
      setProcessingError(null);
      try {
        const rgba = fitsToRGBA(pixels, width, height, {
          stretch,
          colormap,
          blackPoint,
          whitePoint,
          gamma,
        });
        setRgbaData(rgba);
      } catch (e) {
        setProcessingError(e instanceof Error ? e.message : "Image processing failed");
        setRgbaData(null);
      } finally {
        setIsProcessing(false);
      }
    },
    [],
  );

  const getHistogram = useCallback((pixels: Float32Array, bins: number = 256) => {
    setHistogram(calculateHistogram(pixels, bins));
  }, []);

  const getStats = useCallback((pixels: Float32Array) => {
    setStats(calculateStats(pixels));
  }, []);

  return {
    rgbaData,
    stats,
    histogram,
    isProcessing,
    processingError,
    processImage,
    getHistogram,
    getStats,
  };
}
