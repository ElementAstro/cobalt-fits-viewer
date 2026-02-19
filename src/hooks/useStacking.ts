/**
 * 图像叠加工作流 Hook
 * 管理多帧 FITS 文件的加载、校准、对齐、叠加和结果预览
 */

import { useState, useCallback, useRef } from "react";
import { readFileAsArrayBuffer } from "../lib/utils/fileManager";
import { loadFitsFromBufferAuto, getImagePixels, getImageDimensions } from "../lib/fits/parser";
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
import {
  alignFrameAsync,
  type AlignmentMode,
  type AlignmentOptions,
} from "../lib/stacking/alignment";
import {
  evaluateFrameQualityAsync,
  qualityToWeights,
  type FrameQualityMetrics,
  type FrameQualityOptions,
} from "../lib/stacking/frameQuality";
import type { StarDetectionOptions } from "../lib/stacking/starDetection";
import { LOG_TAGS, Logger } from "../lib/logger";
import type { StarAnnotationBundle } from "../lib/fits/types";
import {
  buildAnchorPairs,
  pickAnchorPoints,
  resolveRegistrationMode,
  toDetectedStars,
} from "../lib/stacking/starAnnotationLinkage";

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

export interface StackingAdvancedOptions {
  detection?: StarDetectionOptions;
  alignment?: Omit<AlignmentOptions, "detectionOptions" | "detectionRuntime">;
  quality?: FrameQualityOptions;
}

export interface StackFilesRequest {
  files: Array<{
    id?: string;
    filepath: string;
    filename: string;
    starAnnotations?: StarAnnotationBundle;
  }>;
  method: StackMethod;
  sigma?: number;
  calibration?: CalibrationFrames;
  alignmentMode?: AlignmentMode;
  enableQualityEval?: boolean;
  advanced?: StackingAdvancedOptions;
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
    detectedRefStars?: number;
    detectedTargetStars?: number;
    fallbackUsed?:
      | "none"
      | "translation"
      | "identity"
      | "manual-1star"
      | "manual-2star"
      | "manual-3star"
      | "annotated-stars";
  }>;
  qualityMetrics?: FrameQualityMetrics[];
}

export interface StackProgress {
  stage: "loading" | "calibrating" | "evaluating" | "aligning" | "stacking" | "rendering" | "done";
  current: number;
  total: number;
  message: string;
}

function yieldToUI(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function isAbortError(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function loadPixelsFromPath(
  filepath: string,
): Promise<{ pixels: Float32Array; width: number; height: number } | null> {
  try {
    const buffer = await readFileAsArrayBuffer(filepath);
    const fits = loadFitsFromBufferAuto(buffer);
    const dims = getImageDimensions(fits);
    const pixels = await getImagePixels(fits);
    if (!dims || !pixels) return null;
    return { pixels, width: dims.width, height: dims.height };
  } catch {
    return null;
  }
}

function normalizeRequest(
  filesOrRequest: StackFilesRequest | StackFilesRequest["files"],
  method?: StackMethod,
  sigma: number = 2.5,
  calibration?: CalibrationFrames,
  alignmentMode: AlignmentMode = "none",
  enableQualityEval: boolean = false,
  advanced?: StackingAdvancedOptions,
): StackFilesRequest {
  if (Array.isArray(filesOrRequest)) {
    return {
      files: filesOrRequest,
      method: method ?? "average",
      sigma,
      calibration,
      alignmentMode,
      enableQualityEval,
      advanced,
    };
  }
  return {
    sigma: 2.5,
    alignmentMode: "none",
    enableQualityEval: false,
    ...filesOrRequest,
  };
}

export function useStacking() {
  const [isStacking, setIsStacking] = useState(false);
  const [progress, setProgress] = useState<StackProgress | null>(null);
  const [result, setResult] = useState<StackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const isCancelled = useCallback(
    () => cancelledRef.current || abortRef.current?.signal.aborted === true,
    [],
  );

  const stackFiles = useCallback(
    async (
      filesOrRequest: StackFilesRequest | StackFilesRequest["files"],
      method?: StackMethod,
      sigma: number = 2.5,
      calibration?: CalibrationFrames,
      alignmentMode: AlignmentMode = "none",
      enableQualityEval: boolean = false,
      advanced?: StackingAdvancedOptions,
    ) => {
      const request = normalizeRequest(
        filesOrRequest,
        method,
        sigma,
        calibration,
        alignmentMode,
        enableQualityEval,
        advanced,
      );

      if (request.files.length < 2) {
        setError("At least 2 frames are required for stacking");
        Logger.warn(LOG_TAGS.Stacking, "Insufficient frames for stacking", {
          count: request.files.length,
        });
        return;
      }

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      const signal = abortRef.current.signal;

      Logger.info(
        LOG_TAGS.Stacking,
        `Starting: ${request.files.length} frames, method=${request.method}, align=${request.alignmentMode}`,
      );

      cancelledRef.current = false;
      setIsStacking(true);
      setError(null);
      setResult(null);

      const startTime = Date.now();

      try {
        let darkPixels: Float32Array | null = null;
        let flatPixels: Float32Array | null = null;
        let biasPixels: Float32Array | null = null;

        if (request.calibration?.darkFilepaths && request.calibration.darkFilepaths.length > 0) {
          setProgress({
            stage: "calibrating",
            current: 0,
            total: 3,
            message: `Building master dark from ${request.calibration.darkFilepaths.length} frames...`,
          });
          await yieldToUI();
          const darkFrames: Float32Array[] = [];
          for (const fp of request.calibration.darkFilepaths) {
            if (isCancelled()) return;
            const d = await loadPixelsFromPath(fp);
            if (d) darkFrames.push(d.pixels);
          }
          if (darkFrames.length > 0) darkPixels = createMasterDark(darkFrames);
        } else if (request.calibration?.darkFilepath) {
          setProgress({
            stage: "calibrating",
            current: 0,
            total: 3,
            message: "Loading dark frame...",
          });
          await yieldToUI();
          const dark = await loadPixelsFromPath(request.calibration.darkFilepath);
          if (dark) darkPixels = dark.pixels;
        }

        if (request.calibration?.flatFilepaths && request.calibration.flatFilepaths.length > 0) {
          setProgress({
            stage: "calibrating",
            current: 1,
            total: 3,
            message: `Building master flat from ${request.calibration.flatFilepaths.length} frames...`,
          });
          await yieldToUI();
          const flatFrames: Float32Array[] = [];
          for (const fp of request.calibration.flatFilepaths) {
            if (isCancelled()) return;
            const f = await loadPixelsFromPath(fp);
            if (f) flatFrames.push(f.pixels);
          }
          if (flatFrames.length > 0) flatPixels = createMasterFlat(flatFrames);
        } else if (request.calibration?.flatFilepath) {
          setProgress({
            stage: "calibrating",
            current: 1,
            total: 3,
            message: "Loading flat frame...",
          });
          await yieldToUI();
          const flat = await loadPixelsFromPath(request.calibration.flatFilepath);
          if (flat) flatPixels = flat.pixels;
        }

        if (request.calibration?.biasFilepath) {
          setProgress({
            stage: "calibrating",
            current: 2,
            total: 3,
            message: "Loading bias frame...",
          });
          await yieldToUI();
          const bias = await loadPixelsFromPath(request.calibration.biasFilepath);
          if (bias) biasPixels = bias.pixels;
        }

        if (isCancelled()) return;

        const frames: Float32Array[] = [];
        let refWidth = 0;
        let refHeight = 0;

        for (let i = 0; i < request.files.length; i++) {
          if (isCancelled()) return;

          setProgress({
            stage: "loading",
            current: i + 1,
            total: request.files.length,
            message: `Loading frame ${i + 1}/${request.files.length}: ${request.files[i].filename}`,
          });
          await yieldToUI();

          const buffer = await readFileAsArrayBuffer(request.files[i].filepath);
          const fits = loadFitsFromBufferAuto(buffer);
          const dims = getImageDimensions(fits);
          let pixels = await getImagePixels(fits);

          if (!dims || !pixels) {
            throw new Error(`Failed to read image data from ${request.files[i].filename}`);
          }

          if (i === 0) {
            refWidth = dims.width;
            refHeight = dims.height;
          } else if (dims.width !== refWidth || dims.height !== refHeight) {
            throw new Error(
              `Dimension mismatch: ${request.files[i].filename} is ${dims.width}×${dims.height}, expected ${refWidth}×${refHeight}`,
            );
          }

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

        if (isCancelled()) return;

        const frameAnnotatedStars = request.files.map((file) =>
          toDetectedStars(file.starAnnotations?.points ?? [], undefined, { maxCount: 50 }),
        );
        const frameAnchorPoints = request.files.map((file) =>
          pickAnchorPoints(file.starAnnotations?.points ?? []),
        );

        let qualityMetrics: FrameQualityMetrics[] | undefined;
        let weights: number[] | undefined;

        if (request.enableQualityEval || request.method === "weighted") {
          qualityMetrics = [];
          for (let i = 0; i < frames.length; i++) {
            if (isCancelled()) return;

            setProgress({
              stage: "evaluating",
              current: i + 1,
              total: frames.length,
              message: `Evaluating frame ${i + 1}/${frames.length}: ${request.files[i].filename}`,
            });
            await yieldToUI();

            const metrics = await evaluateFrameQualityAsync(
              frames[i],
              refWidth,
              refHeight,
              {
                ...(request.advanced?.quality ?? {}),
                starsOverride:
                  frameAnnotatedStars[i] && frameAnnotatedStars[i].length >= 3
                    ? frameAnnotatedStars[i]
                    : undefined,
                detectionOptions: {
                  profile: "balanced",
                  ...(request.advanced?.quality?.detectionOptions ?? {}),
                  ...(request.advanced?.detection ?? {}),
                },
              },
              {
                signal,
                detectionRuntime: {
                  signal,
                  onProgress: (p) => {
                    if (!isCancelled()) {
                      setProgress({
                        stage: "evaluating",
                        current: i + p,
                        total: frames.length,
                        message: `Evaluating frame ${i + 1}/${frames.length}: ${request.files[i].filename}`,
                      });
                    }
                  },
                },
              },
            );
            qualityMetrics.push(metrics);
          }
          weights = qualityToWeights(qualityMetrics);
        }

        if (isCancelled()) return;

        const alignmentResults: StackResult["alignmentResults"] = [];

        if (request.alignmentMode !== "none" && frames.length >= 2) {
          const refPixels = frames[0];
          for (let i = 1; i < frames.length; i++) {
            if (isCancelled()) return;
            setProgress({
              stage: "aligning",
              current: i,
              total: frames.length - 1,
              message: `Aligning frame ${i + 1}/${frames.length}: ${request.files[i].filename}`,
            });
            await yieldToUI();

            const { aligned, transform } = await alignFrameAsync(
              refPixels,
              frames[i],
              refWidth,
              refHeight,
              request.alignmentMode ?? "none",
              {
                manualControlPoints: (() => {
                  const mode = resolveRegistrationMode(frameAnchorPoints[0], frameAnchorPoints[i]);
                  if (!mode) return undefined;
                  const pairs = buildAnchorPairs(frameAnchorPoints[0], frameAnchorPoints[i]);
                  if (pairs.length === 0) return undefined;
                  return {
                    mode,
                    ref: pairs.map((pair) => ({ x: pair.ref.x, y: pair.ref.y })),
                    target: pairs.map((pair) => ({ x: pair.target.x, y: pair.target.y })),
                  };
                })(),
                refStarsOverride:
                  frameAnnotatedStars[0] && frameAnnotatedStars[0].length >= 3
                    ? frameAnnotatedStars[0]
                    : undefined,
                targetStarsOverride:
                  frameAnnotatedStars[i] && frameAnnotatedStars[i].length >= 3
                    ? frameAnnotatedStars[i]
                    : undefined,
                ...(request.advanced?.alignment ?? {}),
                detectionOptions: {
                  profile: "balanced",
                  ...(request.advanced?.detection ?? {}),
                },
                detectionRuntime: {
                  signal,
                  onProgress: (p, stage) => {
                    if (!isCancelled()) {
                      setProgress({
                        stage: "aligning",
                        current: i - 1 + p,
                        total: frames.length - 1,
                        message: `Aligning frame ${i + 1}/${frames.length}: ${stage}`,
                      });
                    }
                  },
                },
              },
            );

            frames[i] = aligned;
            alignmentResults.push({
              filename: request.files[i].filename,
              matchedStars: transform.matchedStars,
              rmsError: transform.rmsError,
              detectedRefStars: transform.detectionCounts?.ref,
              detectedTargetStars: transform.detectionCounts?.target,
              fallbackUsed: transform.fallbackUsed,
            });
          }

          alignmentResults.unshift({
            filename: request.files[0].filename,
            matchedStars: -1,
            rmsError: 0,
            fallbackUsed: "none",
          });
        }

        if (isCancelled()) return;

        setProgress({
          stage: "stacking",
          current: 0,
          total: 1,
          message: `Stacking ${frames.length} frames (${request.method})...`,
        });
        await yieldToUI();

        let stacked: Float32Array;
        switch (request.method) {
          case "average":
            stacked = stackAverage(frames);
            break;
          case "median":
            stacked = stackMedian(frames);
            break;
          case "sigma":
            stacked = stackSigmaClip(frames, request.sigma ?? 2.5);
            break;
          case "min":
            stacked = stackMin(frames);
            break;
          case "max":
            stacked = stackMax(frames);
            break;
          case "winsorized":
            stacked = stackWinsorizedSigmaClip(frames, request.sigma ?? 2.5);
            break;
          case "weighted":
            stacked = stackWeightedAverage(frames, weights ?? frames.map(() => 1));
            break;
          default:
            stacked = stackAverage(frames);
            break;
        }

        frames.length = 0;

        if (isCancelled()) return;

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
          frameCount: request.files.length,
          method: request.method,
          duration,
          alignmentMode: request.alignmentMode ?? "none",
          alignmentResults: alignmentResults.length > 0 ? alignmentResults : undefined,
          qualityMetrics,
        };

        setResult(stackResult);
        Logger.info(
          LOG_TAGS.Stacking,
          `Completed: ${request.files.length} frames in ${(duration / 1000).toFixed(1)}s`,
          {
            method: request.method,
            alignmentMode: request.alignmentMode,
            width: refWidth,
            height: refHeight,
          },
        );
        setProgress({
          stage: "done",
          current: request.files.length,
          total: request.files.length,
          message: `Done - ${request.files.length} frames in ${(duration / 1000).toFixed(1)}s`,
        });
      } catch (e) {
        if (!isCancelled() && !isAbortError(e)) {
          const msg = e instanceof Error ? e.message : "Stacking failed";
          Logger.error(LOG_TAGS.Stacking, `Failed: ${msg}`, e);
          setError(msg);
        }
      } finally {
        setIsStacking(false);
      }
    },
    [isCancelled],
  );

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    abortRef.current?.abort();
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
