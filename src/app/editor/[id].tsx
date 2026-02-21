import { View, Text, Alert } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button, Spinner, useThemeColor, useToast } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n, type TranslationKey } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageEditor } from "../../hooks/useImageEditor";
import { useExport } from "../../hooks/useExport";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useEditorToolState } from "../../hooks/useEditorToolState";
import { FitsCanvas, type CanvasTransform } from "../../components/fits/FitsCanvas";
import { CropOverlay } from "../../components/fits/CropOverlay";
import { StarAnnotationOverlay } from "../../components/fits/StarAnnotationOverlay";
import { EditorHeader } from "../../components/editor/EditorHeader";
import { EditorToolBar } from "../../components/editor/EditorToolBar";
import { EditorToolParamPanel } from "../../components/editor/EditorToolParamPanel";
import { StarAnnotationPanel } from "../../components/editor/StarAnnotationPanel";
import { ExportDialog } from "../../components/common/ExportDialog";
import type { ExportRenderOptions } from "../../lib/converter/exportDecorations";
import type {
  ExportFormat,
  FitsTargetOptions,
  TiffTargetOptions,
  ProcessingPipelineSnapshot,
  StarAnnotationBundleV2,
  StarAnnotationDetectionSnapshot,
  StarAnnotationPoint,
  StarAnnotationStaleReason,
} from "../../lib/fits/types";
import type { ImageEditOperation } from "../../lib/utils/imageOperations";
import { detectStarsAsync, type DetectedStar } from "../../lib/stacking/starDetection";
import {
  createManualStarAnnotationPoint,
  mergeDetectedWithManual,
  sanitizeStarAnnotations,
} from "../../lib/stacking/starAnnotationLinkage";
import { transformStarAnnotationPoints } from "../../lib/stacking/starAnnotationGeometry";
import type { EditorOperationEvent } from "../../hooks/useImageEditor";

type EditorExportOptions = {
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  render?: ExportRenderOptions;
};

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
const NON_GEOMETRY_OPS = new Set([
  "invert",
  "blur",
  "sharpen",
  "denoise",
  "histogramEq",
  "brightness",
  "contrast",
  "gamma",
  "levels",
  "backgroundExtract",
  "mtf",
  "curves",
  "clahe",
  "hdr",
  "morphology",
  "starMask",
  "rangeMask",
  "binarize",
  "rescale",
  "deconvolution",
  "dbe",
  "multiscaleDenoise",
  "localContrast",
  "starReduction",
  "deconvolutionAuto",
  "scnr",
  "colorCalibration",
  "saturation",
  "colorBalance",
  "pixelMath",
]);
const EMPTY_TRANSFORM: CanvasTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  canvasWidth: 0,
  canvasHeight: 0,
};

function computeDetectionChunkRows(width: number, height: number) {
  const megaPixels = (width * height) / 1_000_000;
  if (megaPixels >= 12) return 8;
  if (megaPixels >= 8) return 10;
  if (megaPixels >= 4) return 14;
  return 24;
}

export default function EditorDetailScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { toast } = useToast();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const updateFile = useFitsStore((s) => s.updateFile);
  const isVideoFile = file?.mediaKind === "video" || file?.sourceType === "video";
  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const defaultBlurSigma = useSettingsStore((s) => s.defaultBlurSigma);
  const defaultSharpenAmount = useSettingsStore((s) => s.defaultSharpenAmount);
  const defaultDenoiseRadius = useSettingsStore((s) => s.defaultDenoiseRadius);
  const editorMaxUndo = useSettingsStore((s) => s.editorMaxUndo);
  const imageProcessingProfile = useSettingsStore((s) => s.imageProcessingProfile);
  const settingsMinScale = useSettingsStore((s) => s.canvasMinScale);
  const settingsMaxScale = useSettingsStore((s) => s.canvasMaxScale);
  const settingsDoubleTapScale = useSettingsStore((s) => s.canvasDoubleTapScale);
  const settingsPinchSensitivity = useSettingsStore((s) => s.canvasPinchSensitivity);
  const settingsPinchOverzoomFactor = useSettingsStore((s) => s.canvasPinchOverzoomFactor);
  const settingsPanRubberBandFactor = useSettingsStore((s) => s.canvasPanRubberBandFactor);
  const settingsWheelZoomSensitivity = useSettingsStore((s) => s.canvasWheelZoomSensitivity);
  const settingsDetectionProfile = useSettingsStore((s) => s.stackingDetectionProfile);
  const settingsDetectSigmaThreshold = useSettingsStore((s) => s.stackingDetectSigmaThreshold);
  const settingsDetectMaxStars = useSettingsStore((s) => s.stackingDetectMaxStars);
  const settingsDetectMinArea = useSettingsStore((s) => s.stackingDetectMinArea);
  const settingsDetectMaxArea = useSettingsStore((s) => s.stackingDetectMaxArea);
  const settingsDetectBorderMargin = useSettingsStore((s) => s.stackingDetectBorderMargin);
  const settingsDetectSigmaClipIters = useSettingsStore((s) => s.stackingDetectSigmaClipIters);
  const settingsDetectApplyMatchedFilter = useSettingsStore(
    (s) => s.stackingDetectApplyMatchedFilter,
  );
  const settingsDetectConnectivity = useSettingsStore((s) => s.stackingDetectConnectivity);
  const settingsBackgroundMeshSize = useSettingsStore((s) => s.stackingBackgroundMeshSize);
  const settingsDeblendNLevels = useSettingsStore((s) => s.stackingDeblendNLevels);
  const settingsDeblendMinContrast = useSettingsStore((s) => s.stackingDeblendMinContrast);
  const settingsFilterFwhm = useSettingsStore((s) => s.stackingFilterFwhm);
  const settingsDetectMinFwhm = useSettingsStore((s) => s.stackingDetectMinFwhm);
  const settingsMaxFwhm = useSettingsStore((s) => s.stackingMaxFwhm);
  const settingsMaxEllipticity = useSettingsStore((s) => s.stackingMaxEllipticity);
  const settingsDetectMinSharpness = useSettingsStore((s) => s.stackingDetectMinSharpness);
  const settingsDetectMaxSharpness = useSettingsStore((s) => s.stackingDetectMaxSharpness);
  const settingsDetectPeakMax = useSettingsStore((s) => s.stackingDetectPeakMax);
  const settingsDetectSnrMin = useSettingsStore((s) => s.stackingDetectSnrMin);
  const {
    pixels,
    dimensions,
    isLoading: fitsLoading,
    error: fitsError,
    loadFromPath,
  } = useFitsFile();
  const annotationHistoryRef = useRef<Map<number, StarAnnotationBundleV2>>(new Map());
  const activeAnnotationRef = useRef<StarAnnotationBundleV2 | null>(null);
  const loadedFileIdRef = useRef<string | null>(null);
  const detectAbortRef = useRef<AbortController | null>(null);
  const handleEditorOperationRef = useRef<((event: EditorOperationEvent) => void) | null>(null);
  const handleRecipeChange = useCallback(
    (nextRecipe: ProcessingPipelineSnapshot) => {
      if (!file?.id) return;
      updateFile(file.id, { editorRecipe: nextRecipe });
    },
    [file?.id, updateFile],
  );
  const editor = useImageEditor({
    maxHistory: editorMaxUndo,
    profile: imageProcessingProfile,
    onRecipeChange: handleRecipeChange,
    onOperation: (event) => {
      handleEditorOperationRef.current?.(event);
    },
  });
  const haptics = useHapticFeedback();
  const { isExporting, exportImageDetailed, shareImage, saveImage } = useExport();

  const [showOriginal, setShowOriginal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExportFormat);
  const toolState = useEditorToolState({
    blurSigma: defaultBlurSigma,
    sharpenAmount: defaultSharpenAmount,
    denoiseRadius: defaultDenoiseRadius,
  });
  const {
    activeTool,
    setActiveTool,
    showCrop,
    setShowCrop,
    params: toolParams,
    buildOperation,
    activeToolGroup,
    setActiveToolGroup,
  } = toolState;
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });
  const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>(EMPTY_TRANSFORM);
  const [detectedStars, setDetectedStars] = useState<DetectedStar[]>([]);
  const [isStarAnnotationMode, setIsStarAnnotationMode] = useState(false);
  const [starPoints, setStarPoints] = useState<StarAnnotationPoint[]>([]);
  const currentDetectionSnapshot = useMemo(
    (): StarAnnotationDetectionSnapshot => ({
      profile: settingsDetectionProfile,
      sigmaThreshold: settingsDetectSigmaThreshold,
      maxStars: settingsDetectMaxStars,
      minArea: settingsDetectMinArea,
      maxArea: settingsDetectMaxArea,
      borderMargin: settingsDetectBorderMargin,
      sigmaClipIters: settingsDetectSigmaClipIters,
      applyMatchedFilter: settingsDetectApplyMatchedFilter,
      connectivity: settingsDetectConnectivity,
      meshSize: settingsBackgroundMeshSize,
      deblendNLevels: settingsDeblendNLevels,
      deblendMinContrast: settingsDeblendMinContrast,
      filterFwhm: settingsFilterFwhm,
      minFwhm: settingsDetectMinFwhm,
      maxFwhm: settingsMaxFwhm,
      minSharpness: settingsDetectMinSharpness,
      maxSharpness: settingsDetectMaxSharpness,
      peakMax: settingsDetectPeakMax > 0 ? settingsDetectPeakMax : undefined,
      snrMin: settingsDetectSnrMin,
      maxEllipticity: settingsMaxEllipticity,
    }),
    [
      settingsDetectionProfile,
      settingsDetectSigmaThreshold,
      settingsDetectMaxStars,
      settingsDetectMinArea,
      settingsDetectMaxArea,
      settingsDetectBorderMargin,
      settingsDetectSigmaClipIters,
      settingsDetectApplyMatchedFilter,
      settingsDetectConnectivity,
      settingsBackgroundMeshSize,
      settingsDeblendNLevels,
      settingsDeblendMinContrast,
      settingsFilterFwhm,
      settingsDetectMinFwhm,
      settingsMaxFwhm,
      settingsDetectMinSharpness,
      settingsDetectMaxSharpness,
      settingsDetectPeakMax,
      settingsDetectSnrMin,
      settingsMaxEllipticity,
    ],
  );
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

  // Load FITS file
  useEffect(() => {
    if (file?.filepath) {
      loadFromPath(file.filepath, file.filename, file.fileSize ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.filepath]);

  useEffect(() => {
    if (!id || !isVideoFile) return;
    router.replace(`/video/${id}`);
  }, [id, isVideoFile, router]);

  // Initialize editor when pixels are ready
  useEffect(() => {
    if (pixels && dimensions) {
      editor.initialize(
        pixels,
        dimensions.width,
        dimensions.height,
        "linear",
        "grayscale",
        file?.editorRecipe ?? null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixels, dimensions, file?.editorRecipe]);

  useEffect(() => {
    editor.setProfile(imageProcessingProfile);
  }, [editor, imageProcessingProfile]);

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
          snr: point.metrics?.snr,
          roundness: point.metrics?.roundness,
          ellipticity: point.metrics?.ellipticity,
          sharpness: point.metrics?.sharpness,
          theta: point.metrics?.theta,
          flags: point.metrics?.flags,
        }),
      );
    setDetectedStars(derived);
  }, []);

  const persistStarAnnotations = useCallback(
    (bundle: StarAnnotationBundleV2) => {
      if (!file?.id) return;
      updateFile(file.id, { starAnnotations: bundle });
    },
    [file?.id, updateFile],
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
      const targetWidth = options?.width ?? editor.current?.width ?? dimensions?.width;
      const targetHeight = options?.height ?? editor.current?.height ?? dimensions?.height;
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
          : editor.historyIndex >= 0
            ? editor.historyIndex
            : undefined;
      if (historyIndex != null && historyIndex >= 0) {
        annotationHistoryRef.current.set(historyIndex, sanitized);
      }

      if (options?.persist !== false) {
        persistStarAnnotations(sanitized);
      }
    },
    [
      dimensions?.height,
      dimensions?.width,
      editor,
      persistStarAnnotations,
      updateDetectedStarsFromPoints,
    ],
  );

  useEffect(() => {
    if (loadedFileIdRef.current !== (file?.id ?? null)) {
      annotationHistoryRef.current.clear();
      loadedFileIdRef.current = file?.id ?? null;
    }
  }, [file?.id]);

  useEffect(() => {
    if (!file?.id) return;
    const currentWidth = editor.current?.width ?? dimensions?.width;
    const currentHeight = editor.current?.height ?? dimensions?.height;
    const historyIndex = editor.historyIndex >= 0 ? editor.historyIndex : 0;
    if (file.starAnnotations) {
      const sanitized = sanitizeStarAnnotations(file.starAnnotations, {
        width: currentWidth,
        height: currentHeight,
      });
      setStarPoints(sanitized.points);
      setStarSnapshot(sanitized.detectionSnapshot);
      setStarAnnotationsStale(!!sanitized.stale);
      setStarAnnotationsStaleReason(sanitized.staleReason);
      updateDetectedStarsFromPoints(sanitized.points);
      activeAnnotationRef.current = sanitized;
      annotationHistoryRef.current.set(historyIndex, sanitized);
      return;
    }
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
    dimensions?.height,
    dimensions?.width,
    editor,
    file?.id,
    file?.starAnnotations,
    updateDetectedStarsFromPoints,
  ]);

  const detectAndMergeStars = useCallback(async () => {
    if (!editor.current || isDetectingStars) return;
    detectAbortRef.current?.abort();
    const controller = new AbortController();
    detectAbortRef.current = controller;
    const snapshot = currentDetectionSnapshot;
    const width = editor.current.width;
    const height = editor.current.height;
    setIsDetectingStars(true);
    setStarDetectionProgress(0);
    setStarDetectionStage("start");

    try {
      const stars = await detectStarsAsync(
        editor.current.pixels,
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
  }, [applyStarAnnotationState, currentDetectionSnapshot, editor, isDetectingStars, starPoints, t]);

  const cancelStarDetection = useCallback(() => {
    detectAbortRef.current?.abort();
  }, []);

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
        if (event.op && GEOMETRY_OPS.has(event.op.type)) {
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
        } else if (event.op && !NON_GEOMETRY_OPS.has(event.op.type)) {
          nextStale = true;
          nextStaleReason = "unsupported-transform";
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

  useEffect(() => {
    handleEditorOperationRef.current = handleEditorOperation;
    return () => {
      handleEditorOperationRef.current = null;
    };
  }, [handleEditorOperation]);

  useEffect(
    () => () => {
      detectAbortRef.current?.abort();
    },
    [],
  );

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

  const handleToolPress = useCallback(
    (tool: string) => {
      haptics.selection();
      setActiveTool(activeTool === tool ? null : (tool as typeof activeTool));
    },
    [haptics, activeTool, setActiveTool],
  );

  const handleApply = useCallback(() => {
    if (!activeTool) return;
    if (activeTool === "crop") {
      setShowCrop(true);
      return;
    }
    const op = buildOperation();
    if (op) {
      haptics.impact();
      editor.applyEdit(op);
    }
    setActiveTool(null);
  }, [activeTool, buildOperation, editor, haptics, setActiveTool, setShowCrop]);

  const handleQuickAction = useCallback(
    (op: ImageEditOperation) => {
      editor.applyEdit(op);
    },
    [editor],
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
      !editor.current ||
      starPoints.length === 0 ||
      starAnnotationsStale ||
      detectedStars.length === 0
    ) {
      detectAndMergeStars();
    }
  }, [
    isStarAnnotationMode,
    cancelStarDetection,
    editor,
    starPoints.length,
    starAnnotationsStale,
    detectedStars.length,
    detectAndMergeStars,
  ]);

  const buildExportPayload = useCallback(
    (quality: number, options?: EditorExportOptions) => {
      if (!editor.rgbaData || !editor.current) return null;
      return {
        rgbaData: editor.rgbaData,
        width: editor.current.width,
        height: editor.current.height,
        filename: file?.filename ?? "edited",
        format: exportFormat,
        quality,
        fits: { ...options?.fits, mode: "rendered" as const },
        tiff: options?.tiff,
        renderOptions: options?.render,
        source: {
          sourceType: file?.sourceType,
          sourceFormat: file?.sourceFormat,
          sourceFileId: file?.id,
          starAnnotations: starPoints,
        },
      };
    },
    [
      editor,
      file?.filename,
      file?.id,
      file?.sourceFormat,
      file?.sourceType,
      exportFormat,
      starPoints,
    ],
  );

  const handleEditorExport = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      const payload = buildExportPayload(quality, options);
      if (!payload) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      const detailed = await exportImageDetailed(payload);
      if (detailed.path) {
        const fallbackDesc =
          detailed.diagnostics.fallbackApplied && detailed.diagnostics.fallbackReasonMessageKey
            ? t(detailed.diagnostics.fallbackReasonMessageKey)
            : undefined;
        toast.show({
          variant: "success",
          label: t("viewer.exportSuccess"),
          description: fallbackDesc,
        });
      } else {
        toast.show({ variant: "danger", label: t("viewer.exportFailed") });
      }
      setShowExport(false);
    },
    [buildExportPayload, exportImageDetailed, toast, t],
  );

  const handleEditorShare = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      const payload = buildExportPayload(quality, options);
      if (!payload) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      try {
        await shareImage(payload);
      } catch {
        toast.show({ variant: "danger", label: t("share.failed") });
      }
      setShowExport(false);
    },
    [buildExportPayload, shareImage, toast, t],
  );

  const handleEditorSave = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      const payload = buildExportPayload(quality, options);
      if (!payload) {
        toast.show({ variant: "warning", label: t("viewer.noImageData") });
        return;
      }
      const uri = await saveImage(payload);
      if (uri) {
        toast.show({ variant: "success", label: t("viewer.savedToDevice") });
      } else {
        toast.show({ variant: "danger", label: t("viewer.exportFailed") });
      }
      setShowExport(false);
    },
    [buildExportPayload, saveImage, toast, t],
  );

  if (!file) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Ionicons name="alert-circle-outline" size={48} color={mutedColor} />
        <Text className="mt-4 text-sm text-muted">{t("common.noData")}</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("common.goHome")}</Button.Label>
        </Button>
      </View>
    );
  }

  if (isVideoFile) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="videocam-outline" size={48} color={mutedColor} />
        <Text className="mt-4 text-center text-sm text-muted">
          Video files are edited in the video workspace.
        </Text>
        <Button variant="primary" className="mt-4" onPress={() => router.replace(`/video/${id}`)}>
          <Button.Label>Open Video Workspace</Button.Label>
        </Button>
      </View>
    );
  }

  const isLoading = fitsLoading || editor.isProcessing;
  const detectedStarCount = starPoints.filter((point) => point.source === "detected").length;
  const manualStarCount = starPoints.filter((point) => point.source === "manual").length;
  const enabledStarCount = starPoints.filter((point) => point.enabled).length;

  return (
    <View testID="e2e-screen-editor__param_id" className="flex-1 bg-background">
      {/* Top Bar */}
      <EditorHeader
        filename={file.filename}
        successColor={successColor}
        mutedColor={mutedColor}
        contentPaddingTop={contentPaddingTop}
        horizontalPadding={horizontalPadding}
        canUndo={editor.canUndo}
        canRedo={editor.canRedo}
        hasData={!!editor.rgbaData}
        showOriginal={showOriginal}
        historyIndex={editor.historyIndex}
        historyLength={editor.historyLength}
        editorError={editor.error}
        fitsError={fitsError}
        onBack={() => router.back()}
        onUndo={editor.undo}
        onRedo={editor.redo}
        onExport={() => setShowExport(true)}
        onToggleOriginal={() => setShowOriginal((prev) => !prev)}
        onClearError={editor.clearError}
      />
      {/* Canvas Area */}
      <View className="flex-1 bg-black">
        {isLoading && !editor.rgbaData ? (
          <View className="flex-1 items-center justify-center">
            <Spinner size="lg" color={successColor} />
            <Text className="mt-4 text-sm text-neutral-500">
              {fitsLoading
                ? t("editor.loadingFits" as TranslationKey)
                : t("editor.processing" as TranslationKey)}
            </Text>
          </View>
        ) : editor.rgbaData && editor.current ? (
          <View
            className="flex-1"
            onLayout={(e) =>
              setCanvasLayout({
                width: e.nativeEvent.layout.width,
                height: e.nativeEvent.layout.height,
              })
            }
          >
            <FitsCanvas
              rgbaData={
                showOriginal && editor.originalRgbaData ? editor.originalRgbaData : editor.rgbaData
              }
              width={editor.current.width}
              height={editor.current.height}
              sourceWidth={editor.current.width}
              sourceHeight={editor.current.height}
              showGrid={false}
              showCrosshair={false}
              cursorX={-1}
              cursorY={-1}
              onPixelTap={handleStarPointTap}
              onPixelLongPress={handleStarPointLongPress}
              onTransformChange={setCanvasTransform}
              minScale={settingsMinScale}
              maxScale={settingsMaxScale}
              doubleTapScale={settingsDoubleTapScale}
              gestureConfig={{
                pinchSensitivity: settingsPinchSensitivity,
                pinchOverzoomFactor: settingsPinchOverzoomFactor,
                panRubberBandFactor: settingsPanRubberBandFactor,
                wheelZoomSensitivity: settingsWheelZoomSensitivity,
              }}
              interactionEnabled={!showCrop}
              wheelZoomEnabled
            />
            {isStarAnnotationMode && (
              <StarAnnotationOverlay
                points={starPoints}
                renderWidth={editor.current.width}
                renderHeight={editor.current.height}
                sourceWidth={editor.current.width}
                sourceHeight={editor.current.height}
                transform={canvasTransform}
                visible={isStarAnnotationMode}
              />
            )}
            {showCrop && canvasLayout.width > 0 && (
              <CropOverlay
                imageWidth={editor.current.width}
                imageHeight={editor.current.height}
                containerWidth={canvasLayout.width}
                containerHeight={canvasLayout.height}
                onCropConfirm={(x, y, w, h) => {
                  editor.applyEdit({ type: "crop", x, y, width: w, height: h });
                  setShowCrop(false);
                  setActiveTool(null);
                }}
                onCropCancel={() => {
                  setShowCrop(false);
                  setActiveTool(null);
                }}
              />
            )}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="image-outline" size={80} color="#333" />
            <Text className="mt-4 text-sm text-neutral-500">{file.filename}</Text>
          </View>
        )}

        {/* Active tool overlay with parameters */}
        <EditorToolParamPanel
          activeTool={activeTool}
          params={toolParams}
          successColor={successColor}
          onApply={handleApply}
          onCancel={() => setActiveTool(null)}
          onQuickAction={handleQuickAction}
        />
        {isStarAnnotationMode && (
          <StarAnnotationPanel
            successColor={successColor}
            detectedStarCount={detectedStarCount}
            manualStarCount={manualStarCount}
            enabledStarCount={enabledStarCount}
            starAnnotationsStale={starAnnotationsStale}
            starAnnotationsStaleReason={starAnnotationsStaleReason}
            isDetectingStars={isDetectingStars}
            starDetectionStage={starDetectionStage}
            starDetectionProgress={starDetectionProgress}
            pendingAnchorIndex={pendingAnchorIndex}
            onClose={() => {
              cancelStarDetection();
              setIsStarAnnotationMode(false);
              setPendingAnchorIndex(null);
            }}
            onReDetect={detectAndMergeStars}
            onCancelDetection={cancelStarDetection}
            onSetAnchor={setPendingAnchorIndex}
            onClearAnchors={() => {
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
            }}
          />
        )}

        {/* Processing indicator overlay */}
        {editor.isProcessing && editor.rgbaData && editor.current && (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <Spinner size="sm" color={successColor} />
            <Text className="mt-2 text-xs text-white">
              {t("editor.processing" as TranslationKey)}
            </Text>
          </View>
        )}
      </View>

      <EditorToolBar
        activeTool={activeTool}
        activeToolGroup={activeToolGroup}
        onToolPress={handleToolPress}
        onToolGroupChange={setActiveToolGroup}
        successColor={successColor}
        mutedColor={mutedColor}
        fileId={id}
        detectedStarsCount={detectedStars.length}
        isStarAnnotationMode={isStarAnnotationMode}
        onStarDetectToggle={handleStarDetectToggle}
      />
      {/* Export Dialog */}
      <ExportDialog
        visible={showExport}
        filename={file.filename}
        format={exportFormat}
        width={editor.current?.width}
        height={editor.current?.height}
        onFormatChange={setExportFormat}
        onExport={handleEditorExport}
        onShare={handleEditorShare}
        onSaveToDevice={handleEditorSave}
        fitsScientificAvailable={false}
        onClose={() => setShowExport(false)}
      />

      {/* Export Loading Overlay */}
      {isExporting && (
        <View className="absolute inset-0 items-center justify-center bg-black/50 z-50">
          <Spinner size="lg" color={successColor} />
          <Text className="mt-2 text-sm text-white">{t("common.loading")}</Text>
        </View>
      )}
    </View>
  );
}
