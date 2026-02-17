/**
 * 图像叠加工作流 Hook
 * 管理多帧 FITS 文件的加载、校准、对齐、叠加和结果预览
 */

import { useState, useCallback, useRef } from "react";
import { readFileAsArrayBuffer } from "../lib/utils/fileManager";
import { loadFitsFromBuffer, getImagePixels, getImageDimensions } from "../lib/fits/parser";
import {
  stackAverage,
  stackMedian,
  stackSigmaClip,
  stackMin,
  stackMax,
  stackWinsorizedSigmaClip,
  stackWeightedAverage,
} from "../lib/utils/pixelMath";
import { fitsToRGBA } from "../lib/converter/formatConverter";
import { computeAutoStretch } from "../lib/utils/pixelMath";
import { calibrateFrame, createMasterDark, createMasterFlat } from "../lib/stacking/calibration";
import { alignFrame, type AlignmentMode } from "../lib/stacking/alignment";
import {
  evaluateFrameQuality,
  qualityToWeights,
  type FrameQualityMetrics,
} from "../lib/stacking/frameQuality";
import { LOG_TAGS, Logger } from "../lib/logger";

export type StackMethod =
  | "average"
  | "median"
  | "sigma"
  | "min"
  | "max"
  | "winsorized"
  | "weighted";

export type { AlignmentMode } from "../lib/stacking/alignment";
export type { FrameQualityMetrics } from "../lib/stacking/frameQuality";

export interface CalibrationFrames {
  darkFilepath?: string;
  flatFilepath?: string;
  biasFilepath?: string;
  darkFilepaths?: string[];
  flatFilepaths?: string[];
}

export interface StackResult {
  pixels: Float32Array;
  rgbaData: Uint8ClampedArray;
  width: number;
  height: number;
  frameCount: number;
  method: StackMethod;
  duration: number;
  alignmentMode: AlignmentMode;
  alignmentResults?: Array<{
    filename: string;
    matchedStars: number;
    rmsError: number;
  }>;
  qualityMetrics?: FrameQualityMetrics[];
}

export interface StackProgress {
  stage: "loading" | "calibrating" | "evaluating" | "aligning" | "stacking" | "rendering" | "done";
  current: number;
  total: number;
  message: string;
}

/**
 * Yield to the UI thread so React can flush state updates (progress bar, etc.)
 */
function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Load pixel data from a single FITS file path.
 * Returns null if the file cannot be read.
 */
async function loadPixelsFromPath(
  filepath: string,
): Promise<{ pixels: Float32Array; width: number; height: number } | null> {
  try {
    const buffer = await readFileAsArrayBuffer(filepath);
    const fits = loadFitsFromBuffer(buffer);
    const dims = getImageDimensions(fits);
    const pixels = await getImagePixels(fits);
    if (!dims || !pixels) return null;
    return { pixels, width: dims.width, height: dims.height };
  } catch {
    return null;
  }
}

export function useStacking() {
  const [isStacking, setIsStacking] = useState(false);
  const [progress, setProgress] = useState<StackProgress | null>(null);
  const [result, setResult] = useState<StackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const stackFiles = useCallback(
    async (
      files: Array<{ filepath: string; filename: string }>,
      method: StackMethod,
      sigma: number = 2.5,
      calibration?: CalibrationFrames,
      alignmentMode: AlignmentMode = "none",
      enableQualityEval: boolean = false,
    ) => {
      if (files.length < 2) {
        setError("At least 2 frames are required for stacking");
        Logger.warn(LOG_TAGS.Stacking, "Insufficient frames for stacking", { count: files.length });
        return;
      }

      Logger.info(
        "Stacking",
        `Starting: ${files.length} frames, method=${method}, align=${alignmentMode}`,
      );

      cancelledRef.current = false;
      setIsStacking(true);
      setError(null);
      setResult(null);

      const startTime = Date.now();

      try {
        // Phase 0: Load calibration frames (if provided)
        let darkPixels: Float32Array | null = null;
        let flatPixels: Float32Array | null = null;
        let biasPixels: Float32Array | null = null;

        // Master dark from multiple files
        if (calibration?.darkFilepaths && calibration.darkFilepaths.length > 0) {
          setProgress({
            stage: "calibrating",
            current: 0,
            total: 3,
            message: `Building master dark from ${calibration.darkFilepaths.length} frames...`,
          });
          await yieldToUI();
          const darkFrames: Float32Array[] = [];
          for (const fp of calibration.darkFilepaths) {
            const d = await loadPixelsFromPath(fp);
            if (d) darkFrames.push(d.pixels);
          }
          if (darkFrames.length > 0) darkPixels = createMasterDark(darkFrames);
        } else if (calibration?.darkFilepath) {
          setProgress({
            stage: "calibrating",
            current: 0,
            total: 3,
            message: "Loading dark frame...",
          });
          await yieldToUI();
          const dark = await loadPixelsFromPath(calibration.darkFilepath);
          if (dark) darkPixels = dark.pixels;
        }

        // Master flat from multiple files
        if (calibration?.flatFilepaths && calibration.flatFilepaths.length > 0) {
          setProgress({
            stage: "calibrating",
            current: 1,
            total: 3,
            message: `Building master flat from ${calibration.flatFilepaths.length} frames...`,
          });
          await yieldToUI();
          const flatFrames: Float32Array[] = [];
          for (const fp of calibration.flatFilepaths) {
            const f = await loadPixelsFromPath(fp);
            if (f) flatFrames.push(f.pixels);
          }
          if (flatFrames.length > 0) flatPixels = createMasterFlat(flatFrames);
        } else if (calibration?.flatFilepath) {
          setProgress({
            stage: "calibrating",
            current: 1,
            total: 3,
            message: "Loading flat frame...",
          });
          await yieldToUI();
          const flat = await loadPixelsFromPath(calibration.flatFilepath);
          if (flat) flatPixels = flat.pixels;
        }

        if (calibration?.biasFilepath) {
          setProgress({
            stage: "calibrating",
            current: 2,
            total: 3,
            message: "Loading bias frame...",
          });
          await yieldToUI();
          const bias = await loadPixelsFromPath(calibration.biasFilepath);
          if (bias) biasPixels = bias.pixels;
        }

        if (cancelledRef.current) return;

        // Phase 1: Load all light frames
        const frames: Float32Array[] = [];
        let refWidth = 0;
        let refHeight = 0;

        for (let i = 0; i < files.length; i++) {
          if (cancelledRef.current) return;

          setProgress({
            stage: "loading",
            current: i + 1,
            total: files.length,
            message: `Loading frame ${i + 1}/${files.length}: ${files[i].filename}`,
          });
          await yieldToUI();

          const buffer = await readFileAsArrayBuffer(files[i].filepath);
          const fits = loadFitsFromBuffer(buffer);
          const dims = getImageDimensions(fits);
          let pixels = await getImagePixels(fits);

          if (!dims || !pixels) {
            throw new Error(`Failed to read image data from ${files[i].filename}`);
          }

          // Validate dimensions match
          if (i === 0) {
            refWidth = dims.width;
            refHeight = dims.height;
          } else if (dims.width !== refWidth || dims.height !== refHeight) {
            throw new Error(
              `Dimension mismatch: ${files[i].filename} is ${dims.width}×${dims.height}, expected ${refWidth}×${refHeight}`,
            );
          }

          // Apply calibration
          if (darkPixels || flatPixels || biasPixels) {
            const pixelCount = refWidth * refHeight;
            if (darkPixels && darkPixels.length !== pixelCount) {
              throw new Error(
                `Dark frame size (${darkPixels.length}) does not match image size (${pixelCount})`,
              );
            }
            if (flatPixels && flatPixels.length !== pixelCount) {
              throw new Error(
                `Flat frame size (${flatPixels.length}) does not match image size (${pixelCount})`,
              );
            }
            if (biasPixels && biasPixels.length !== pixelCount) {
              throw new Error(
                `Bias frame size (${biasPixels.length}) does not match image size (${pixelCount})`,
              );
            }
            pixels = calibrateFrame(pixels, darkPixels, flatPixels, biasPixels);
          }

          frames.push(pixels);
        }

        if (cancelledRef.current) return;

        // Phase 1.5: Quality evaluation (optional)
        let qualityMetrics: FrameQualityMetrics[] | undefined;
        let weights: number[] | undefined;

        if (enableQualityEval || method === "weighted") {
          qualityMetrics = [];
          for (let i = 0; i < frames.length; i++) {
            if (cancelledRef.current) return;
            setProgress({
              stage: "evaluating",
              current: i + 1,
              total: frames.length,
              message: `Evaluating frame ${i + 1}/${frames.length}: ${files[i].filename}`,
            });
            await yieldToUI();
            qualityMetrics.push(evaluateFrameQuality(frames[i], refWidth, refHeight));
          }
          weights = qualityToWeights(qualityMetrics);
        }

        if (cancelledRef.current) return;

        // Phase 2: Alignment
        const alignmentResults: StackResult["alignmentResults"] = [];

        if (alignmentMode !== "none" && frames.length >= 2) {
          const refPixels = frames[0];

          for (let i = 1; i < frames.length; i++) {
            if (cancelledRef.current) return;
            setProgress({
              stage: "aligning",
              current: i,
              total: frames.length - 1,
              message: `Aligning frame ${i + 1}/${frames.length}: ${files[i].filename}`,
            });
            await yieldToUI();

            const { aligned, transform } = alignFrame(
              refPixels,
              frames[i],
              refWidth,
              refHeight,
              alignmentMode,
            );

            frames[i] = aligned;
            alignmentResults.push({
              filename: files[i].filename,
              matchedStars: transform.matchedStars,
              rmsError: transform.rmsError,
            });
          }

          // Reference frame: no alignment needed
          alignmentResults.unshift({
            filename: files[0].filename,
            matchedStars: -1, // reference
            rmsError: 0,
          });
        }

        if (cancelledRef.current) return;

        // Phase 3: Stack frames
        setProgress({
          stage: "stacking",
          current: 0,
          total: 1,
          message: `Stacking ${frames.length} frames (${method})...`,
        });
        await yieldToUI();

        let stacked: Float32Array;
        switch (method) {
          case "average":
            stacked = stackAverage(frames);
            break;
          case "median":
            stacked = stackMedian(frames);
            break;
          case "sigma":
            stacked = stackSigmaClip(frames, sigma);
            break;
          case "min":
            stacked = stackMin(frames);
            break;
          case "max":
            stacked = stackMax(frames);
            break;
          case "winsorized":
            stacked = stackWinsorizedSigmaClip(frames, sigma);
            break;
          case "weighted":
            stacked = stackWeightedAverage(frames, weights ?? frames.map(() => 1));
            break;
        }

        // Release frame memory as soon as stacking is done
        frames.length = 0;

        if (cancelledRef.current) return;

        // Phase 4: Render preview with auto-stretch
        setProgress({
          stage: "rendering",
          current: 0,
          total: 1,
          message: "Generating preview...",
        });
        await yieldToUI();

        const { blackPoint, whitePoint } = computeAutoStretch(stacked);

        const rgbaData = fitsToRGBA(stacked, refWidth, refHeight, {
          stretch: "asinh",
          colormap: "grayscale",
          blackPoint,
          whitePoint,
          gamma: 1,
        });

        const duration = Date.now() - startTime;

        const stackResult: StackResult = {
          pixels: stacked,
          rgbaData,
          width: refWidth,
          height: refHeight,
          frameCount: files.length,
          method,
          duration,
          alignmentMode,
          alignmentResults: alignmentResults.length > 0 ? alignmentResults : undefined,
          qualityMetrics,
        };

        setResult(stackResult);
        Logger.info(
          "Stacking",
          `Completed: ${files.length} frames in ${(duration / 1000).toFixed(1)}s`,
          {
            method,
            alignmentMode,
            width: refWidth,
            height: refHeight,
          },
        );
        setProgress({
          stage: "done",
          current: files.length,
          total: files.length,
          message: `Done — ${files.length} frames in ${(duration / 1000).toFixed(1)}s`,
        });
      } catch (e) {
        if (!cancelledRef.current) {
          const msg = e instanceof Error ? e.message : "Stacking failed";
          Logger.error(LOG_TAGS.Stacking, `Failed: ${msg}`, e);
          setError(msg);
        }
      } finally {
        setIsStacking(false);
      }
    },
    [],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    setIsStacking(false);
    setProgress(null);
    Logger.info(LOG_TAGS.Stacking, "Cancelled by user");
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setProgress(null);
    setError(null);
  }, []);

  return {
    isStacking,
    progress,
    result,
    error,
    stackFiles,
    cancel,
    reset,
  };
}
