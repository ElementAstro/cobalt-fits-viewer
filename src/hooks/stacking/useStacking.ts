/**
 * 图像叠加工作流 Hook
 * 管理多帧 FITS 文件的加载、校准、对齐、叠加和结果预览
 */

import { useState, useCallback, useRef } from "react";
import { loadScientificImageFromPath } from "../../lib/image/scientificImageLoader";
import { computeAutoStretch } from "../../lib/utils/pixelMath";
import { fitsToRGBA } from "../../lib/converter/formatConverter";
import {
  integrateFrames,
  averageStrategy,
  medianStrategy,
  sigmaClipStrategy,
  winsorizedSigmaClipStrategy,
  minStrategy,
  maxStrategy,
  weightedAverageStrategy,
  percentileClipStrategy,
  linearFitClipStrategy,
  esdStrategy,
  averagedSigmaClipStrategy,
  type PixelRejectionStrategy,
} from "../../lib/stacking/integration";
import { normalizeFrames, type NormalizationMode } from "../../lib/stacking/normalization";
import {
  calibrateFrame,
  createMasterDark,
  createMasterFlat,
  computeMedianExposure,
  scaleFrameByExposure,
} from "../../lib/stacking/calibration";
import {
  alignFrameAsync,
  type AlignmentMode,
  type AlignmentOptions,
} from "../../lib/stacking/alignment";
import {
  evaluateFrameQualityAsync,
  qualityToWeights,
  type FrameQualityMetrics,
  type FrameQualityOptions,
} from "../../lib/stacking/frameQuality";
import type { StarDetectionOptions } from "../../lib/stacking/starDetection";
import { LOG_TAGS, Logger } from "../../lib/logger";
import type { StarAnnotationBundle } from "../../lib/fits/types";
import {
  buildAnchorPairs,
  evaluateStarAnnotationUsability,
  pickAnchorPoints,
  resolveRegistrationMode,
  sanitizeStarAnnotations,
  toDetectedStars,
} from "../../lib/stacking/starAnnotationLinkage";

export type StackMethod =
  | "average"
  | "median"
  | "sigma"
  | "min"
  | "max"
  | "winsorized"
  | "weighted"
  | "percentile"
  | "linearFit"
  | "esd"
  | "averagedSigma";

export type { AlignmentMode } from "../../lib/stacking/alignment";
export type { FrameQualityMetrics } from "../../lib/stacking/frameQuality";

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
  annotation?: {
    useAnnotatedForAlignment?: boolean;
    stalePolicy?: "auto-fallback-detect";
  };
  /** 非对称拒绝: 独立 low/high sigma */
  sigmaLow?: number;
  sigmaHigh?: number;
  /** Sigma clipping 迭代次数 (默认 3) */
  clippingIterations?: number;
  /** Range rejection 阈值 */
  rangeLow?: number;
  rangeHigh?: number;
  /** 归一化模式 */
  normalizationMode?: "none" | "additive" | "multiplicative" | "additive+multiplicative";
  /** 是否生成拒绝图 */
  generateRejectionMap?: boolean;
  /** Percentile clipping 参数 */
  percentileLow?: number;
  percentileHigh?: number;
  /** ESD 参数 */
  esdSignificance?: number;
  esdMaxOutliers?: number;
  esdRelaxation?: number;
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
  /** 拒绝图 (low/high 拒绝帧数) */
  rejectionMap?: { low: Uint16Array; high: Uint16Array };
  /** 拒绝统计 */
  rejectionStats?: { totalRejectedLow: number; totalRejectedHigh: number; pixelCount: number };
  /** 归一化结果 */
  normalizationResults?: Array<{ offset: number; scale: number }>;
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
  annotationDiagnostics?: Array<{
    filename: string;
    usable: boolean;
    usedForAlignment: boolean;
    usedForQuality: boolean;
    reason?: "missing" | "stale" | "dimension-mismatch" | "insufficient-points";
    warning?: string;
    stale: boolean;
    staleReason?: "geometry-changed" | "unsupported-transform" | "dimension-mismatch" | "manual";
    enabledPointCount: number;
    anchorCount: number;
  }>;
  calibrationWarnings: StackingWarning[];
}

export interface StackingWarning {
  code: "missing-dark-exptime" | "missing-light-exptime";
  filename: string;
  messageKey: "editor.missingDarkExposureWarning" | "editor.missingLightExposureWarning";
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

async function loadPixelsFromPath(filepath: string): Promise<{
  pixels: Float32Array;
  width: number;
  height: number;
  exposure: number | null;
} | null> {
  try {
    const loaded = await loadScientificImageFromPath(filepath, {
      filename: filenameFromPath(filepath),
    });
    return {
      pixels: loaded.pixels,
      width: loaded.width,
      height: loaded.height,
      exposure: loaded.exposure,
    };
  } catch {
    return null;
  }
}

function filenameFromPath(filepath: string): string {
  const normalized = filepath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  return parts[parts.length - 1] || filepath;
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
  const normalizeAdvanced = (
    value: StackingAdvancedOptions | undefined,
  ): StackingAdvancedOptions => ({
    ...value,
    annotation: {
      useAnnotatedForAlignment: true,
      stalePolicy: "auto-fallback-detect",
      ...value?.annotation,
    },
  });

  if (Array.isArray(filesOrRequest)) {
    return {
      files: filesOrRequest,
      method: method ?? "average",
      sigma,
      calibration,
      alignmentMode,
      enableQualityEval,
      advanced: normalizeAdvanced(advanced),
    };
  }
  const mergedAdvanced = normalizeAdvanced(filesOrRequest.advanced);
  return {
    sigma: 2.5,
    alignmentMode: "none",
    enableQualityEval: false,
    ...filesOrRequest,
    advanced: mergedAdvanced,
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
    ): Promise<StackResult | null> => {
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
        return null;
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
        let masterDarkExposure: number | null = null;
        const calibrationWarnings: StackingWarning[] = [];

        if (request.calibration?.darkFilepaths && request.calibration.darkFilepaths.length > 0) {
          setProgress({
            stage: "calibrating",
            current: 0,
            total: 3,
            message: `Building master dark from ${request.calibration.darkFilepaths.length} frames...`,
          });
          await yieldToUI();
          const darkFrames: Array<{
            pixels: Float32Array;
            exposure: number | null;
            filename: string;
          }> = [];
          for (const fp of request.calibration.darkFilepaths) {
            if (isCancelled()) return null;
            const d = await loadPixelsFromPath(fp);
            if (d) {
              darkFrames.push({
                pixels: d.pixels,
                exposure: d.exposure,
                filename: filenameFromPath(fp),
              });
            }
          }
          if (darkFrames.length > 0) {
            masterDarkExposure = computeMedianExposure(darkFrames.map((frame) => frame.exposure));
            const normalizedDarkFrames = darkFrames.map((frame) => {
              const scaled = scaleFrameByExposure(frame.pixels, frame.exposure, masterDarkExposure);
              if (scaled.usedFallbackScale) {
                calibrationWarnings.push({
                  code: "missing-dark-exptime",
                  filename: frame.filename,
                  messageKey: "editor.missingDarkExposureWarning",
                });
              }
              return scaled.pixels;
            });
            darkPixels = createMasterDark(normalizedDarkFrames);
          }
        } else if (request.calibration?.darkFilepath) {
          setProgress({
            stage: "calibrating",
            current: 0,
            total: 3,
            message: "Loading dark frame...",
          });
          await yieldToUI();
          const dark = await loadPixelsFromPath(request.calibration.darkFilepath);
          if (dark) {
            darkPixels = dark.pixels;
            masterDarkExposure = dark.exposure;
            if (!dark.exposure) {
              calibrationWarnings.push({
                code: "missing-dark-exptime",
                filename: filenameFromPath(request.calibration.darkFilepath),
                messageKey: "editor.missingDarkExposureWarning",
              });
            }
          }
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
            if (isCancelled()) return null;
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

        if (isCancelled()) return null;

        let frames: Float32Array[] = [];
        let refWidth = 0;
        let refHeight = 0;

        for (let i = 0; i < request.files.length; i++) {
          if (isCancelled()) return null;

          setProgress({
            stage: "loading",
            current: i + 1,
            total: request.files.length,
            message: `Loading frame ${i + 1}/${request.files.length}: ${request.files[i].filename}`,
          });
          await yieldToUI();

          const loaded = await loadScientificImageFromPath(request.files[i].filepath, {
            filename: request.files[i].filename,
          });
          const dims = { width: loaded.width, height: loaded.height };
          let pixels = loaded.pixels;
          const lightExposure = loaded.exposure;

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
            let darkPixelsForLight = darkPixels;
            if (darkPixels) {
              const scaledDark = scaleFrameByExposure(
                darkPixels,
                masterDarkExposure,
                lightExposure,
              );
              darkPixelsForLight = scaledDark.pixels;
              if (scaledDark.usedFallbackScale && !lightExposure) {
                calibrationWarnings.push({
                  code: "missing-light-exptime",
                  filename: request.files[i].filename,
                  messageKey: "editor.missingLightExposureWarning",
                });
              }
            }
            pixels = calibrateFrame(pixels, darkPixelsForLight, flatPixels, biasPixels);
          }

          frames.push(pixels);
        }

        if (isCancelled()) return null;

        const useAnnotatedForAlignment =
          request.advanced?.annotation?.useAnnotatedForAlignment ?? true;

        const frameAnnotationBundles = request.files.map((file) =>
          file.starAnnotations
            ? sanitizeStarAnnotations(file.starAnnotations, {
                width: refWidth,
                height: refHeight,
              })
            : null,
        );

        const frameAnnotationUsability = request.files.map((file) =>
          evaluateStarAnnotationUsability(file.starAnnotations, {
            width: refWidth,
            height: refHeight,
            minEnabledPoints: 3,
          }),
        );

        const frameAnnotatedStars = frameAnnotationBundles.map((bundle, index) => {
          const usable = useAnnotatedForAlignment && frameAnnotationUsability[index].usable;
          if (!bundle || !usable) return [];
          return toDetectedStars(bundle.points, undefined, { maxCount: 50 });
        });
        const frameAnchorPoints = frameAnnotationBundles.map((bundle, index) => {
          const usable = useAnnotatedForAlignment && frameAnnotationUsability[index].usable;
          if (!bundle || !usable) return [];
          return pickAnchorPoints(bundle.points);
        });

        const annotationDiagnostics: NonNullable<StackResult["annotationDiagnostics"]> =
          request.files.map((file, index) => {
            const usage = frameAnnotationUsability[index];
            const used = useAnnotatedForAlignment && usage.usable;
            let warning: string | undefined;
            if (useAnnotatedForAlignment && usage.reason === "stale") {
              warning = "annotation-stale-fallback-detect";
            } else if (useAnnotatedForAlignment && usage.reason === "dimension-mismatch") {
              warning = "annotation-dimension-mismatch-fallback-detect";
            } else if (useAnnotatedForAlignment && usage.reason === "insufficient-points") {
              warning = "annotation-insufficient-points-fallback-detect";
            }
            if (warning) {
              Logger.warn(LOG_TAGS.Stacking, "Annotation unavailable; fallback to detection", {
                filename: file.filename,
                reason: usage.reason,
                staleReason: usage.staleReason,
              });
            }
            return {
              filename: file.filename,
              usable: usage.usable,
              usedForAlignment: used,
              usedForQuality: used,
              reason: usage.reason,
              warning,
              stale: usage.stale,
              staleReason: usage.staleReason,
              enabledPointCount: usage.enabledPointCount,
              anchorCount: usage.anchorCount,
            };
          });

        let qualityMetrics: FrameQualityMetrics[] | undefined;
        let weights: number[] | undefined;

        if (request.enableQualityEval || request.method === "weighted") {
          qualityMetrics = [];
          for (let i = 0; i < frames.length; i++) {
            if (isCancelled()) return null;

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

        if (isCancelled()) return null;

        const alignmentResults: StackResult["alignmentResults"] = [];

        if (request.alignmentMode !== "none" && frames.length >= 2) {
          const refPixels = frames[0];
          for (let i = 1; i < frames.length; i++) {
            if (isCancelled()) return null;
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

        if (isCancelled()) return null;

        // ── Normalization ──
        const normMode = (request.advanced?.normalizationMode ?? "none") as NormalizationMode;
        let normalizationResults: Array<{ offset: number; scale: number }> | undefined;
        if (normMode !== "none" && frames.length >= 2) {
          setProgress({
            stage: "stacking",
            current: 0,
            total: 2,
            message: `Normalizing ${frames.length} frames (${normMode})...`,
          });
          await yieldToUI();
          const normResult = normalizeFrames(frames, 0, normMode);
          frames = normResult.normalized;
          normalizationResults = normResult.results.map((r) => ({
            offset: r.offset,
            scale: r.scale,
          }));
        }

        if (isCancelled()) return null;

        // ── Integration (stacking) ──
        setProgress({
          stage: "stacking",
          current: normMode !== "none" ? 1 : 0,
          total: normMode !== "none" ? 2 : 1,
          message: `Stacking ${frames.length} frames (${request.method})...`,
        });
        await yieldToUI();

        const adv = request.advanced ?? {};
        const sigma = request.sigma ?? 2.5;
        const sLow = adv.sigmaLow ?? sigma;
        const sHigh = adv.sigmaHigh ?? sigma;
        const iterations = adv.clippingIterations ?? 3;

        function resolveStrategy(): PixelRejectionStrategy {
          switch (request.method) {
            case "average":
              return averageStrategy();
            case "median":
              return medianStrategy();
            case "sigma":
              return sigmaClipStrategy(sLow, sHigh);
            case "min":
              return minStrategy();
            case "max":
              return maxStrategy();
            case "winsorized":
              return winsorizedSigmaClipStrategy(sLow, sHigh);
            case "weighted":
              return weightedAverageStrategy(weights ?? frames.map(() => 1));
            case "percentile":
              return percentileClipStrategy(adv.percentileLow ?? 10, adv.percentileHigh ?? 90);
            case "linearFit":
              return linearFitClipStrategy();
            case "esd":
              return esdStrategy();
            case "averagedSigma":
              return averagedSigmaClipStrategy(sLow, sHigh);
            default:
              return averageStrategy();
          }
        }

        const integrationResult = integrateFrames(frames, {
          strategy: resolveStrategy(),
          rangeLow: adv.rangeLow,
          rangeHigh: adv.rangeHigh,
          generateRejectionMap: adv.generateRejectionMap,
          context: {
            sigmaLow: sLow,
            sigmaHigh: sHigh,
            iterations,
            params: {
              significance: adv.esdSignificance ?? 0.05,
              maxOutliers: adv.esdMaxOutliers ?? 0.3,
              relaxation: adv.esdRelaxation ?? 1.5,
            },
          },
        });

        const stacked = integrationResult.pixels;
        frames.length = 0;

        if (isCancelled()) return null;

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
          rejectionMap: integrationResult.rejectionMap,
          rejectionStats: integrationResult.stats,
          normalizationResults,
          alignmentResults: alignmentResults.length > 0 ? alignmentResults : undefined,
          qualityMetrics,
          annotationDiagnostics,
          calibrationWarnings,
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
        return stackResult;
      } catch (e) {
        if (!isCancelled() && !isAbortError(e)) {
          const msg = e instanceof Error ? e.message : "Stacking failed";
          Logger.error(LOG_TAGS.Stacking, `Failed: ${msg}`, e);
          setError(msg);
        }
        return null;
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
