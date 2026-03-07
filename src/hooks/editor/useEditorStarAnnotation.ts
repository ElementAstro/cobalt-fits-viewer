/**
 * 编辑器星点标注逻辑 Hook
 * 从 editor/[id].tsx 提取，管理星点检测、标注、锚点等状态
 */

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Alert } from "react-native";
import { useI18n } from "../../i18n/useI18n";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { useShallow } from "zustand/shallow";
import { detectStarsAsync, type DetectedStar } from "../../lib/stacking/starDetection";
import { computeStarStats, type StarFwhmStats } from "../../lib/stacking/starStats";
import {
  createManualStarAnnotationPoint,
  mergeDetectedWithManual,
  sanitizeStarAnnotations,
} from "../../lib/stacking/starAnnotationLinkage";
import { transformStarAnnotationPoints } from "../../lib/stacking/starAnnotationGeometry";
import { getProcessingOperation } from "../../lib/processing/registry";
import type {
  ProcessingOperationId,
  StarAnnotationBundle,
  StarAnnotationBundleV2,
  StarAnnotationDetectionSnapshot,
  StarAnnotationPoint,
  StarAnnotationStaleReason,
} from "../../lib/fits/types";
import type { EditorOperationEvent } from "./useImageEditor";

const STAR_POINT_TAP_RADIUS = 12;

const GEOMETRY_OPS = new Set([
  "rotate90cw",
  "rotate90ccw",
  "rotate180",
  "flipH",
  "flipV",
  "crop",
  "rotateArbitrary",
]);

function computeDetectionChunkRows(width: number, height: number) {
  const megaPixels = (width * height) / 1_000_000;
  if (megaPixels >= 12) return 8;
  if (megaPixels >= 8) return 10;
  if (megaPixels >= 4) return 14;
  return 24;
}

function stableEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function toComparableAnnotationState(bundle: StarAnnotationBundleV2 | null | undefined) {
  if (!bundle) return null;
  return {
    detectionSnapshot: bundle.detectionSnapshot,
    points: bundle.points,
    stale: !!bundle.stale,
    staleReason: bundle.staleReason,
    imageGeometry: bundle.imageGeometry,
  };
}

function getAnnotationStateSignature(
  bundle: StarAnnotationBundleV2 | null | undefined,
): string | null {
  const comparable = toComparableAnnotationState(bundle);
  return comparable ? JSON.stringify(comparable) : null;
}

interface EditorImageState {
  pixels: Float32Array;
  width: number;
  height: number;
}

interface UseEditorStarAnnotationOptions {
  fileId: string | undefined;
  editorCurrent: EditorImageState | null;
  editorHistoryIndex: number;
  dimensions: { width: number; height: number } | null;
  updateFile: (id: string, data: Record<string, unknown>) => void;
  starAnnotations: StarAnnotationBundle | undefined;
}

export interface UseEditorStarAnnotationReturn {
  detectedStars: DetectedStar[];
  isStarAnnotationMode: boolean;
  starPoints: StarAnnotationPoint[];
  isDetectingStars: boolean;
  starDetectionProgress: number;
  starDetectionStage: string;
  pendingAnchorIndex: 1 | 2 | 3 | null;
  starAnnotationsStale: boolean;
  starAnnotationsStaleReason: StarAnnotationStaleReason | undefined;
  detectedStarCount: number;
  manualStarCount: number;
  enabledStarCount: number;
  handleStarPointTap: (x: number, y: number) => void;
  handleStarPointLongPress: (x: number, y: number) => void;
  handleStarDetectToggle: () => void;
  cancelStarDetection: () => void;
  detectAndMergeStars: () => Promise<void>;
  setPendingAnchorIndex: (idx: 1 | 2 | 3 | null) => void;
  clearAnchors: () => void;
  setIsStarAnnotationMode: (v: boolean) => void;
  handleEditorOperation: (event: EditorOperationEvent) => void;
  fwhmStats: StarFwhmStats | null;
}

export function useEditorStarAnnotation({
  fileId,
  editorCurrent,
  editorHistoryIndex,
  dimensions,
  updateFile,
  starAnnotations,
}: UseEditorStarAnnotationOptions): UseEditorStarAnnotationReturn {
  const { t } = useI18n();

  // Detection settings from store (consolidated selector)
  const detectionSettings = useSettingsStore(
    useShallow((s) => ({
      profile: s.stackingDetectionProfile,
      sigmaThreshold: s.stackingDetectSigmaThreshold,
      maxStars: s.stackingDetectMaxStars,
      minArea: s.stackingDetectMinArea,
      maxArea: s.stackingDetectMaxArea,
      borderMargin: s.stackingDetectBorderMargin,
      sigmaClipIters: s.stackingDetectSigmaClipIters,
      applyMatchedFilter: s.stackingDetectApplyMatchedFilter,
      connectivity: s.stackingDetectConnectivity,
      meshSize: s.stackingBackgroundMeshSize,
      deblendNLevels: s.stackingDeblendNLevels,
      deblendMinContrast: s.stackingDeblendMinContrast,
      filterFwhm: s.stackingFilterFwhm,
      minFwhm: s.stackingDetectMinFwhm,
      maxFwhm: s.stackingMaxFwhm,
      maxEllipticity: s.stackingMaxEllipticity,
      minSharpness: s.stackingDetectMinSharpness,
      maxSharpness: s.stackingDetectMaxSharpness,
      peakMax: s.stackingDetectPeakMax,
      snrMin: s.stackingDetectSnrMin,
    })),
  );
  const {
    profile,
    sigmaThreshold,
    maxStars,
    minArea,
    maxArea,
    borderMargin,
    sigmaClipIters,
    applyMatchedFilter,
    connectivity,
    meshSize,
    deblendNLevels,
    deblendMinContrast,
    filterFwhm,
    minFwhm,
    maxFwhm,
    maxEllipticity,
    minSharpness,
    maxSharpness,
    peakMax,
    snrMin,
  } = detectionSettings;

  const currentDetectionSnapshot = useMemo(
    (): StarAnnotationDetectionSnapshot => ({
      profile,
      sigmaThreshold,
      maxStars,
      minArea,
      maxArea,
      borderMargin,
      sigmaClipIters,
      applyMatchedFilter,
      connectivity,
      meshSize,
      deblendNLevels,
      deblendMinContrast,
      filterFwhm,
      minFwhm,
      maxFwhm,
      maxEllipticity,
      minSharpness,
      maxSharpness,
      peakMax: peakMax > 0 ? peakMax : undefined,
      snrMin,
    }),
    [
      applyMatchedFilter,
      borderMargin,
      connectivity,
      deblendMinContrast,
      deblendNLevels,
      filterFwhm,
      maxArea,
      maxEllipticity,
      maxFwhm,
      maxSharpness,
      maxStars,
      meshSize,
      minArea,
      minFwhm,
      minSharpness,
      peakMax,
      profile,
      sigmaClipIters,
      sigmaThreshold,
      snrMin,
    ],
  );
  const currentWidth = editorCurrent?.width ?? dimensions?.width;
  const currentHeight = editorCurrent?.height ?? dimensions?.height;

  // Refs
  const annotationHistoryRef = useRef<Map<number, StarAnnotationBundleV2>>(new Map());
  const activeAnnotationRef = useRef<StarAnnotationBundleV2 | null>(null);
  const loadedFileIdRef = useRef<string | null>(null);
  const loadedAnnotationSignatureRef = useRef<string | null>(null);
  const detectAbortRef = useRef<AbortController | null>(null);

  // State
  const [detectedStars, setDetectedStars] = useState<DetectedStar[]>([]);
  const [isStarAnnotationMode, setIsStarAnnotationMode] = useState(false);
  const [starPoints, setStarPoints] = useState<StarAnnotationPoint[]>([]);
  const [starSnapshot, setStarSnapshot] =
    useState<StarAnnotationDetectionSnapshot>(currentDetectionSnapshot);
  const [starAnnotationsStale, setStarAnnotationsStale] = useState(false);
  const [starAnnotationsStaleReason, setStarAnnotationsStaleReason] = useState<
    StarAnnotationStaleReason | undefined
  >(undefined);
  const [isDetectingStars, setIsDetectingStars] = useState(false);
  const [starDetectionProgress, setStarDetectionProgress] = useState(0);
  const [starDetectionStage, setStarDetectionStage] = useState("idle");
  const [pendingAnchorIndex, setPendingAnchorIndex] = useState<1 | 2 | 3 | null>(null);

  // Memoized counts (single traversal)
  const { detectedStarCount, manualStarCount, enabledStarCount } = useMemo(() => {
    let detected = 0;
    let manual = 0;
    let enabled = 0;
    for (const p of starPoints) {
      if (p.source === "detected") detected++;
      else if (p.source === "manual") manual++;
      if (p.enabled) enabled++;
    }
    return { detectedStarCount: detected, manualStarCount: manual, enabledStarCount: enabled };
  }, [starPoints]);

  // Helpers
  const updateDetectedStarsFromPoints = useCallback((points: StarAnnotationPoint[]) => {
    const derived = points
      .filter((point) => point.source === "detected" && point.enabled)
      .map(
        (point): DetectedStar => ({
          cx: point.x,
          cy: point.y,
          flux: point.metrics?.flux ?? 1,
          peak: point.metrics?.peak ?? 0,
          area: point.metrics?.area ?? 3,
          fwhm: point.metrics?.fwhm ?? 2.5,
          snr: point.metrics?.snr ?? 0,
          roundness: point.metrics?.roundness ?? 1,
          ellipticity: point.metrics?.ellipticity ?? 0,
          sharpness: point.metrics?.sharpness ?? 0,
          theta: point.metrics?.theta ?? 0,
          flags: point.metrics?.flags ?? 0,
        }),
      );
    setDetectedStars(derived);
  }, []);

  const persistStarAnnotations = useCallback(
    (bundle: StarAnnotationBundleV2) => {
      if (!fileId) return;
      updateFile(fileId, { starAnnotations: bundle });
    },
    [fileId, updateFile],
  );

  const applyStarAnnotationState = useCallback(
    (
      nextPoints: StarAnnotationPoint[],
      nextSnapshot: StarAnnotationDetectionSnapshot,
      nextStale: boolean,
      nextStaleReason?: StarAnnotationStaleReason,
      options?: {
        width?: number;
        height?: number;
        historyIndex?: number;
        persist?: boolean;
      },
    ) => {
      const targetWidth = options?.width ?? currentWidth;
      const targetHeight = options?.height ?? currentHeight;
      const sanitized = sanitizeStarAnnotations(
        {
          version: 2,
          updatedAt: Date.now(),
          detectionSnapshot: nextSnapshot,
          points: nextPoints,
          stale: nextStale,
          staleReason: nextStale ? nextStaleReason : undefined,
        },
        {
          width: targetWidth,
          height: targetHeight,
        },
      );
      setStarPoints(sanitized.points);
      setStarSnapshot(sanitized.detectionSnapshot);
      setStarAnnotationsStale(!!sanitized.stale);
      setStarAnnotationsStaleReason(sanitized.staleReason);
      updateDetectedStarsFromPoints(sanitized.points);
      activeAnnotationRef.current = sanitized;

      const historyIndex =
        options?.historyIndex != null
          ? options.historyIndex
          : editorHistoryIndex >= 0
            ? editorHistoryIndex
            : undefined;
      if (historyIndex != null && historyIndex >= 0) {
        annotationHistoryRef.current.set(historyIndex, sanitized);
      }

      if (options?.persist !== false) {
        persistStarAnnotations(sanitized);
      }
    },
    [
      currentHeight,
      currentWidth,
      editorHistoryIndex,
      persistStarAnnotations,
      updateDetectedStarsFromPoints,
    ],
  );

  // Reset annotation history when file changes
  useEffect(() => {
    if (loadedFileIdRef.current !== (fileId ?? null)) {
      annotationHistoryRef.current.clear();
      activeAnnotationRef.current = null;
      loadedFileIdRef.current = fileId ?? null;
      loadedAnnotationSignatureRef.current = null;
    }
  }, [fileId]);

  // Load star annotations from file
  useEffect(() => {
    if (!fileId) return;
    const historyIndex = editorHistoryIndex >= 0 ? editorHistoryIndex : 0;
    if (starAnnotations) {
      const sanitized = sanitizeStarAnnotations(starAnnotations, {
        width: currentWidth,
        height: currentHeight,
      });
      const incomingSignature = getAnnotationStateSignature(sanitized);
      if (loadedAnnotationSignatureRef.current === incomingSignature) {
        return;
      }
      loadedAnnotationSignatureRef.current = incomingSignature;
      const isSameAnnotationState = stableEquals(
        toComparableAnnotationState(activeAnnotationRef.current),
        toComparableAnnotationState(sanitized),
      );
      activeAnnotationRef.current = sanitized;
      annotationHistoryRef.current.set(historyIndex, sanitized);
      if (isSameAnnotationState) {
        return;
      }
      setStarPoints(sanitized.points);
      setStarSnapshot(sanitized.detectionSnapshot);
      setStarAnnotationsStale(!!sanitized.stale);
      setStarAnnotationsStaleReason(sanitized.staleReason);
      updateDetectedStarsFromPoints(sanitized.points);
      return;
    }
    if (loadedAnnotationSignatureRef.current === null && activeAnnotationRef.current) {
      return;
    }
    loadedAnnotationSignatureRef.current = null;
    applyStarAnnotationState([], currentDetectionSnapshot, false, undefined, {
      width: currentWidth,
      height: currentHeight,
      historyIndex,
      persist: false,
    });
    setDetectedStars([]);
  }, [
    applyStarAnnotationState,
    currentDetectionSnapshot,
    currentHeight,
    currentWidth,
    editorHistoryIndex,
    fileId,
    starAnnotations,
    updateDetectedStarsFromPoints,
  ]);

  // Detect stars
  const detectAndMergeStars = useCallback(async () => {
    if (!editorCurrent || isDetectingStars) return;
    detectAbortRef.current?.abort();
    const controller = new AbortController();
    detectAbortRef.current = controller;
    const snapshot = currentDetectionSnapshot;
    const width = editorCurrent.width;
    const height = editorCurrent.height;
    setIsDetectingStars(true);
    setStarDetectionProgress(0);
    setStarDetectionStage("start");

    try {
      const stars = await detectStarsAsync(
        editorCurrent.pixels,
        width,
        height,
        {
          profile: snapshot.profile,
          sigmaThreshold: snapshot.sigmaThreshold,
          maxStars: snapshot.maxStars,
          minArea: snapshot.minArea,
          maxArea: snapshot.maxArea,
          borderMargin: snapshot.borderMargin,
          sigmaClipIters: snapshot.sigmaClipIters,
          applyMatchedFilter: snapshot.applyMatchedFilter,
          connectivity: snapshot.connectivity,
          meshSize: snapshot.meshSize,
          deblendNLevels: snapshot.deblendNLevels,
          deblendMinContrast: snapshot.deblendMinContrast,
          filterFwhm: snapshot.filterFwhm,
          minFwhm: snapshot.minFwhm,
          maxFwhm: snapshot.maxFwhm,
          maxEllipticity: snapshot.maxEllipticity,
          minSharpness: snapshot.minSharpness,
          maxSharpness: snapshot.maxSharpness,
          peakMax: snapshot.peakMax,
          snrMin: snapshot.snrMin,
        },
        {
          signal: controller.signal,
          chunkRows: computeDetectionChunkRows(width, height),
          onProgress: (progress, stage) => {
            setStarDetectionProgress(Math.round(Math.max(0, Math.min(1, progress)) * 100));
            setStarDetectionStage(stage);
          },
        },
      );

      if (controller.signal.aborted) return;
      const merged = mergeDetectedWithManual(starPoints, stars, {
        maxDetectedPoints: snapshot.maxStars,
        preserveDetectedDisabled: true,
        matchRadiusPx: 4,
      });
      applyStarAnnotationState(merged, snapshot, false, undefined, {
        width,
        height,
      });
      setPendingAnchorIndex(null);
      setIsStarAnnotationMode(true);
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        Alert.alert(t("common.error"), t("editor.reDetectStars"));
      }
    } finally {
      if (detectAbortRef.current === controller) {
        detectAbortRef.current = null;
      }
      setIsDetectingStars(false);
      setStarDetectionProgress(0);
      setStarDetectionStage("idle");
    }
  }, [
    applyStarAnnotationState,
    currentDetectionSnapshot,
    editorCurrent,
    isDetectingStars,
    starPoints,
    t,
  ]);

  const cancelStarDetection = useCallback(() => {
    detectAbortRef.current?.abort();
  }, []);

  // Handle editor operations (apply/undo/redo) to sync star annotations
  const handleEditorOperation = useCallback(
    (event: EditorOperationEvent) => {
      const timeline = annotationHistoryRef.current;
      const source =
        timeline.get(event.previousHistoryIndex) ??
        activeAnnotationRef.current ??
        timeline.get(event.historyIndex);
      if (!source) return;

      if (event.type === "apply") {
        let nextPoints = source.points;
        let nextStale = !!source.stale;
        let nextStaleReason = source.staleReason;
        if (event.op) {
          const schema = getProcessingOperation(event.op.type as ProcessingOperationId);
          if (schema?.category === "geometry") {
            if (!GEOMETRY_OPS.has(event.op.type)) {
              nextStale = true;
              nextStaleReason = "unsupported-transform";
            } else {
              const transformed = transformStarAnnotationPoints(
                source.points,
                event.before.width,
                event.before.height,
                event.op,
              );
              nextPoints = transformed.points;
              if (!transformed.transformed) {
                nextStale = true;
                nextStaleReason = transformed.staleReason ?? "unsupported-transform";
              }
            }
          } else if (!schema) {
            nextStale = true;
            nextStaleReason = "unsupported-transform";
          }
        }

        applyStarAnnotationState(nextPoints, source.detectionSnapshot, nextStale, nextStaleReason, {
          width: event.after.width,
          height: event.after.height,
          historyIndex: event.historyIndex,
        });
        return;
      }

      const restore = timeline.get(event.historyIndex);
      if (!restore) return;
      applyStarAnnotationState(
        restore.points,
        restore.detectionSnapshot,
        !!restore.stale,
        restore.staleReason,
        {
          width: event.after.width,
          height: event.after.height,
          historyIndex: event.historyIndex,
        },
      );
    },
    [applyStarAnnotationState],
  );

  // Cleanup abort on unmount
  useEffect(
    () => () => {
      detectAbortRef.current?.abort();
    },
    [],
  );

  // Star point interaction
  const findNearestPoint = useCallback(
    (x: number, y: number) => {
      let nearest: StarAnnotationPoint | null = null;
      let bestDist2 = STAR_POINT_TAP_RADIUS * STAR_POINT_TAP_RADIUS;
      for (const point of starPoints) {
        const dx = point.x - x;
        const dy = point.y - y;
        const dist2 = dx * dx + dy * dy;
        if (dist2 <= bestDist2) {
          nearest = point;
          bestDist2 = dist2;
        }
      }
      return nearest;
    },
    [starPoints],
  );

  const upsertAnchor = useCallback(
    (points: StarAnnotationPoint[], pointId: string, anchor: 1 | 2 | 3) => {
      return points.map((point) => {
        if (point.id === pointId) return { ...point, anchorIndex: anchor };
        if (point.anchorIndex === anchor) return { ...point, anchorIndex: undefined };
        return point;
      });
    },
    [],
  );

  const handleStarPointTap = useCallback(
    (x: number, y: number) => {
      if (!isStarAnnotationMode) return;
      const nearest = findNearestPoint(x, y);
      if (nearest) {
        const nextPoints =
          pendingAnchorIndex != null
            ? upsertAnchor(
                starPoints.map((point) =>
                  point.id === nearest.id ? { ...point, enabled: true } : point,
                ),
                nearest.id,
                pendingAnchorIndex,
              )
            : starPoints.map((point) =>
                point.id === nearest.id ? { ...point, enabled: !point.enabled } : point,
              );
        applyStarAnnotationState(
          nextPoints,
          starSnapshot,
          starAnnotationsStale,
          starAnnotationsStaleReason,
        );
        setPendingAnchorIndex(null);
        return;
      }

      const manualPoint = createManualStarAnnotationPoint(x, y, pendingAnchorIndex ?? undefined);
      const nextPoints =
        pendingAnchorIndex != null
          ? upsertAnchor([...starPoints, manualPoint], manualPoint.id, pendingAnchorIndex)
          : [...starPoints, manualPoint];
      applyStarAnnotationState(
        nextPoints,
        starSnapshot,
        starAnnotationsStale,
        starAnnotationsStaleReason,
      );
      setPendingAnchorIndex(null);
    },
    [
      applyStarAnnotationState,
      findNearestPoint,
      isStarAnnotationMode,
      pendingAnchorIndex,
      starAnnotationsStale,
      starAnnotationsStaleReason,
      starPoints,
      starSnapshot,
      upsertAnchor,
    ],
  );

  const handleStarPointLongPress = useCallback(
    (x: number, y: number) => {
      if (!isStarAnnotationMode) return;
      const nearest = findNearestPoint(x, y);
      if (!nearest || nearest.source !== "manual") return;
      const nextPoints = starPoints.filter((point) => point.id !== nearest.id);
      applyStarAnnotationState(
        nextPoints,
        starSnapshot,
        starAnnotationsStale,
        starAnnotationsStaleReason,
      );
      setPendingAnchorIndex(null);
    },
    [
      applyStarAnnotationState,
      findNearestPoint,
      isStarAnnotationMode,
      starAnnotationsStale,
      starAnnotationsStaleReason,
      starPoints,
      starSnapshot,
    ],
  );

  const handleStarDetectToggle = useCallback(() => {
    if (isStarAnnotationMode) {
      cancelStarDetection();
      setIsStarAnnotationMode(false);
      setPendingAnchorIndex(null);
      return;
    }
    setIsStarAnnotationMode(true);
    if (
      !editorCurrent ||
      starPoints.length === 0 ||
      starAnnotationsStale ||
      detectedStars.length === 0
    ) {
      detectAndMergeStars();
    }
  }, [
    isStarAnnotationMode,
    cancelStarDetection,
    editorCurrent,
    starPoints.length,
    starAnnotationsStale,
    detectedStars.length,
    detectAndMergeStars,
  ]);

  const clearAnchors = useCallback(() => {
    const cleared = starPoints.map((point) => ({
      ...point,
      anchorIndex: undefined,
    }));
    applyStarAnnotationState(
      cleared,
      starSnapshot,
      starAnnotationsStale,
      starAnnotationsStaleReason,
    );
    setPendingAnchorIndex(null);
  }, [
    applyStarAnnotationState,
    starAnnotationsStale,
    starAnnotationsStaleReason,
    starPoints,
    starSnapshot,
  ]);

  const fwhmStats = useMemo(() => computeStarStats(detectedStars), [detectedStars]);

  return {
    detectedStars,
    isStarAnnotationMode,
    starPoints,
    isDetectingStars,
    starDetectionProgress,
    starDetectionStage,
    pendingAnchorIndex,
    starAnnotationsStale,
    starAnnotationsStaleReason,
    detectedStarCount,
    manualStarCount,
    enabledStarCount,
    handleStarPointTap,
    handleStarPointLongPress,
    handleStarDetectToggle,
    cancelStarDetection,
    detectAndMergeStars,
    setPendingAnchorIndex,
    clearAnchors,
    setIsStarAnnotationMode,
    handleEditorOperation,
    fwhmStats,
  };
}
