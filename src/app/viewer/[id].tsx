import { View, Text, ScrollView, StatusBar } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Alert as HAlert, Button, Skeleton, Spinner, Surface, useToast } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import Animated, { FadeIn, FadeInDown, FadeInUp, FadeOut } from "react-native-reanimated";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useViewerStore } from "../../stores/useViewerStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageProcessing } from "../../hooks/useImageProcessing";
import { useViewerExport } from "../../hooks/useViewerExport";
import { useThumbnail } from "../../hooks/useThumbnail";
import { useViewerHotkeys } from "../../hooks/useViewerHotkeys";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useImageCacheWarmup } from "../../hooks/useImageCacheWarmup";
import { PixelInspector } from "../../components/fits/PixelInspector";
import { RegionSelectOverlay } from "../../components/fits/RegionSelectOverlay";
import {
  FitsCanvas,
  type CanvasTransform,
  type FitsCanvasHandle,
} from "../../components/fits/FitsCanvas";
import { Minimap } from "../../components/fits/Minimap";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { ViewerErrorBoundary } from "../../components/common/ViewerErrorBoundary";
import { ExportDialog } from "../../components/common/ExportDialog";
import type {
  ExportFormat,
  FitsMetadata,
  HistogramDiagnostics,
  ViewerPreset,
} from "../../lib/fits/types";
import {
  computeAutoStretch,
  computePercentile,
  computeZScale,
  getHistogramClipPercents,
  getHistogramPeakValue,
  getHistogramPercentile,
} from "../../lib/utils/pixelMath";
import { useAstrometry } from "../../hooks/useAstrometry";
import { useAstrometryStore } from "../../stores/useAstrometryStore";
import { AstrometryAnnotationOverlay } from "../../components/astrometry/AstrometryAnnotationOverlay";
import { CoordinateGridOverlay } from "../../components/astrometry/CoordinateGridOverlay";
import { ConstellationOverlay } from "../../components/astrometry/ConstellationOverlay";
import { AnnotationDetailSheet } from "../../components/astrometry/AnnotationDetailSheet";
import { CompassIndicator } from "../../components/astrometry/CompassIndicator";
import { ViewerControlPanel } from "../../components/fits/ViewerControlPanel";
import { ViewerBottomSheet } from "../../components/fits/ViewerBottomSheet";
import { ViewerToolbar } from "../../components/fits/ViewerToolbar";
import { StatsOverlay } from "../../components/fits/StatsOverlay";
import { ZoomControls } from "../../components/fits/ZoomControls";
import { AstrometryBadge } from "../../components/fits/AstrometryBadge";
import { shareWCS } from "../../lib/astrometry/wcsExport";
import {
  pixelToRaDec,
  formatRaFromDeg,
  formatDecFromDeg,
} from "../../lib/astrometry/wcsProjection";
import { zoomAroundCenter, computeOneToOneScale } from "../../lib/viewer/transform";
import {
  createDefaultLayerVisibility,
  getVisibleTypes,
} from "../../components/astrometry/AnnotationLayerControls";
import type { AstrometryAnnotationType, AstrometryAnnotation } from "../../lib/astrometry/types";
import { toViewerPreset } from "../../lib/viewer/model";
import { canUseScientificFitsExport } from "../../lib/converter/exportCore";
import { normalizeProcessingPipelineSnapshot } from "../../lib/processing/recipe";
import { isVideoFile } from "../../lib/media/routing";
import { resolveComparePair } from "../../lib/viewer/compareRouting";

export default function ViewerDetailScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { isLandscape, sidePanelWidth } = useResponsiveLayout();
  const insets = useSafeAreaInsets();

  const file = useFitsStore((s) => s.files.find((f) => f.id === (id ?? "")));
  const updateFile = useFitsStore((s) => s.updateFile);
  const allFiles = useFitsStore((s) => s.files);
  const { prevId, nextId } = useMemo(() => {
    if (!id) return { prevId: null, nextId: null };
    const idx = allFiles.findIndex((f) => f.id === id);
    if (idx === -1) return { prevId: null, nextId: null };
    return {
      prevId: idx > 0 ? allFiles[idx - 1].id : null,
      nextId: idx < allFiles.length - 1 ? allFiles[idx + 1].id : null,
    };
  }, [allFiles, id]);
  const compareIds = useMemo(() => {
    if (!id) return [];
    return resolveComparePair(id, allFiles, file?.derivedFromId);
  }, [allFiles, file?.derivedFromId, id]);
  const canCompare = compareIds.length >= 2;
  const isVideo = file ? isVideoFile(file) : false;

  // Display parameters — grouped to reduce re-renders
  const {
    stretch,
    colormap,
    blackPoint,
    whitePoint,
    gamma,
    midtone,
    outputBlack,
    outputWhite,
    brightness,
    contrast,
    mtfMidtone,
    curvePreset,
  } = useViewerStore(
    useShallow((s) => ({
      stretch: s.stretch,
      colormap: s.colormap,
      blackPoint: s.blackPoint,
      whitePoint: s.whitePoint,
      gamma: s.gamma,
      midtone: s.midtone,
      outputBlack: s.outputBlack,
      outputWhite: s.outputWhite,
      brightness: s.brightness,
      contrast: s.contrast,
      mtfMidtone: s.mtfMidtone,
      curvePreset: s.curvePreset,
    })),
  );

  // Display parameter setters (stable references)
  const setStretch = useViewerStore((s) => s.setStretch);
  const setColormap = useViewerStore((s) => s.setColormap);
  const setBlackPoint = useViewerStore((s) => s.setBlackPoint);
  const setWhitePoint = useViewerStore((s) => s.setWhitePoint);
  const setGamma = useViewerStore((s) => s.setGamma);
  const setBrightness = useViewerStore((s) => s.setBrightness);
  const setContrast = useViewerStore((s) => s.setContrast);
  const setMtfMidtone = useViewerStore((s) => s.setMtfMidtone);
  const setCurvePreset = useViewerStore((s) => s.setCurvePreset);
  const setMidtone = useViewerStore((s) => s.setMidtone);
  const setOutputBlack = useViewerStore((s) => s.setOutputBlack);
  const setOutputWhite = useViewerStore((s) => s.setOutputWhite);
  const resetLevels = useViewerStore((s) => s.resetLevels);
  const regionSelection = useViewerStore((s) => s.regionSelection);
  const setRegionSelection = useViewerStore((s) => s.setRegionSelection);

  // Overlay toggles — grouped
  const { showGrid, showCrosshair, showPixelInfo, showMinimap } = useViewerStore(
    useShallow((s) => ({
      showGrid: s.showGrid,
      showCrosshair: s.showCrosshair,
      showPixelInfo: s.showPixelInfo,
      showMinimap: s.showMiniMap,
    })),
  );
  const toggleGrid = useViewerStore((s) => s.toggleGrid);
  const toggleCrosshair = useViewerStore((s) => s.toggleCrosshair);
  const togglePixelInfo = useViewerStore((s) => s.togglePixelInfo);
  const toggleMinimap = useViewerStore((s) => s.toggleMiniMap);
  const initFromSettings = useViewerStore((s) => s.initFromSettings);

  const defaultHistogramMode = useSettingsStore((s) => s.defaultHistogramMode);
  const settingsHistogramHeight = useSettingsStore((s) => s.histogramHeight);
  const settingsDebounce = useSettingsStore((s) => s.imageProcessingDebounce);
  const viewerPreloadNeighbors = useSettingsStore((s) => s.viewerPreloadNeighbors);
  const viewerPreloadRadius = useSettingsStore((s) => s.viewerPreloadRadius);
  const frameClassificationConfig = useSettingsStore((s) => s.frameClassificationConfig);
  const pixelInfoDecimalPlaces = useSettingsStore((s) => s.pixelInfoDecimalPlaces);
  const settingsGridColor = useSettingsStore((s) => s.gridColor);
  const settingsGridOpacity = useSettingsStore((s) => s.gridOpacity);
  const settingsCrosshairColor = useSettingsStore((s) => s.crosshairColor);
  const settingsCrosshairOpacity = useSettingsStore((s) => s.crosshairOpacity);
  const settingsMinScale = useSettingsStore((s) => s.canvasMinScale);
  const settingsMaxScale = useSettingsStore((s) => s.canvasMaxScale);
  const settingsDoubleTapScale = useSettingsStore((s) => s.canvasDoubleTapScale);
  const settingsPinchSensitivity = useSettingsStore((s) => s.canvasPinchSensitivity);
  const settingsPinchOverzoomFactor = useSettingsStore((s) => s.canvasPinchOverzoomFactor);
  const settingsPanRubberBandFactor = useSettingsStore((s) => s.canvasPanRubberBandFactor);
  const settingsWheelZoomSensitivity = useSettingsStore((s) => s.canvasWheelZoomSensitivity);
  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const useHighQualityPreview = useSettingsStore((s) => s.useHighQualityPreview);
  const imageProcessingProfile = useSettingsStore((s) => s.imageProcessingProfile);
  const viewerApplyEditorRecipe = useSettingsStore((s) => s.viewerApplyEditorRecipe);
  const haptics = useHapticFeedback();
  const { toast } = useToast();
  const activeViewerRecipe = useMemo(() => {
    if (!viewerApplyEditorRecipe || !file?.editorRecipe) return null;
    return normalizeProcessingPipelineSnapshot(
      file.editorRecipe,
      file.editorRecipe.profile ?? "legacy",
    );
  }, [file?.editorRecipe, viewerApplyEditorRecipe]);
  const viewerPipelineProfile = activeViewerRecipe ? undefined : imageProcessingProfile;

  // Cursor & frame — grouped
  const { cursorX, cursorY, currentFrame, totalFrames, currentHDU } = useViewerStore(
    useShallow((s) => ({
      cursorX: s.cursorX,
      cursorY: s.cursorY,
      currentFrame: s.currentFrame,
      totalFrames: s.totalFrames,
      currentHDU: s.currentHDU,
    })),
  );
  const setCursorPosition = useViewerStore((s) => s.setCursorPosition);
  const setCurrentFrame = useViewerStore((s) => s.setCurrentFrame);
  const setTotalFrames = useViewerStore((s) => s.setTotalFrames);
  const setCurrentHDU = useViewerStore((s) => s.setCurrentHDU);

  const {
    metadata,
    headers,
    comments,
    history,
    pixels,
    rgbChannels,
    sourceBuffer,
    dimensions,
    hduList,
    isLoading: isFitsLoading,
    error: fitsError,
    loadFromPath,
    loadFrame,
    reset: resetFits,
  } = useFitsFile();

  const {
    rgbaData,
    displayWidth,
    displayHeight,
    histogram,
    rgbHistogram,
    regionHistogram,
    processImage,
    processImagePreview,
    getStatsAndHistogram,
    getRegionHistogram,
    clearRegionHistogram,
    stats,
    regionStats,
    isProcessing,
    processingError,
    reset: resetImageProcessing,
  } = useImageProcessing();

  const { generateThumbnailAsync } = useThumbnail();

  // Progressive loading phase: 0=reading, 1=parsing, 2=rendering
  const loadingPhase = useMemo(() => {
    if (isFitsLoading && !metadata) return 0;
    if (isFitsLoading && !pixels) return 1;
    if (!rgbaData || isProcessing) return 2;
    return 2;
  }, [isFitsLoading, metadata, pixels, rgbaData, isProcessing]);

  const histogramInputRange = useMemo(() => {
    if (!pixels) return null;

    if (stretch === "zscale") {
      const { z1, z2 } = computeZScale(pixels);
      if (Number.isFinite(z1) && Number.isFinite(z2) && z1 !== z2) {
        return z1 < z2 ? { min: z1, max: z2 } : { min: z2, max: z1 };
      }
    }

    if (stretch === "percentile") {
      const { z1, z2 } = computePercentile(pixels, 1, 99);
      if (Number.isFinite(z1) && Number.isFinite(z2) && z1 !== z2) {
        return z1 < z2 ? { min: z1, max: z2 } : { min: z2, max: z1 };
      }
    }

    if (
      stats &&
      Number.isFinite(stats.min) &&
      Number.isFinite(stats.max) &&
      stats.min !== stats.max
    ) {
      return stats.min < stats.max
        ? { min: stats.min, max: stats.max }
        : { min: stats.max, max: stats.min };
    }

    const edges = histogram?.edges;
    const edgeMin = edges?.[0];
    const edgeMax = edges && edges.length > 0 ? edges[edges.length - 1] : undefined;
    if (
      typeof edgeMin === "number" &&
      typeof edgeMax === "number" &&
      Number.isFinite(edgeMin) &&
      Number.isFinite(edgeMax) &&
      edgeMin !== edgeMax
    ) {
      return edgeMin < edgeMax ? { min: edgeMin, max: edgeMax } : { min: edgeMax, max: edgeMin };
    }

    return null;
  }, [pixels, stretch, stats, histogram?.edges]);

  const histogramDiagnostics = useMemo<HistogramDiagnostics | null>(() => {
    if (!histogram || histogram.counts.length === 0 || histogram.edges.length < 2) {
      return null;
    }

    const edge0 = histogram.edges[0];
    const edgeLast = histogram.edges[histogram.edges.length - 1];
    if (!Number.isFinite(edge0) || !Number.isFinite(edgeLast)) return null;

    const globalMin = Math.min(edge0, edgeLast);
    const globalMax = Math.max(edge0, edgeLast);

    const hasInputRange =
      histogramInputRange != null &&
      Number.isFinite(histogramInputRange.min) &&
      Number.isFinite(histogramInputRange.max) &&
      histogramInputRange.min !== histogramInputRange.max;

    const inputMin = hasInputRange
      ? Math.min(histogramInputRange.min, histogramInputRange.max)
      : globalMin;
    const inputMax = hasInputRange
      ? Math.max(histogramInputRange.min, histogramInputRange.max)
      : globalMax;
    const inputSpan = inputMax - inputMin;
    const hasInputSpan = Number.isFinite(inputSpan) && inputSpan > 0;

    const blackValue =
      inputMin + Math.max(0, Math.min(1, blackPoint)) * (hasInputSpan ? inputSpan : 1);
    const whiteValue =
      inputMin + Math.max(0, Math.min(1, whitePoint)) * (hasInputSpan ? inputSpan : 1);

    const { lowPercent, highPercent } = getHistogramClipPercents(
      histogram.counts,
      histogram.edges,
      blackValue,
      whiteValue,
    );

    return {
      p1: getHistogramPercentile(histogram.counts, histogram.edges, 1),
      p50: getHistogramPercentile(histogram.counts, histogram.edges, 50),
      p99: getHistogramPercentile(histogram.counts, histogram.edges, 99),
      peakValue: getHistogramPeakValue(histogram.counts, histogram.edges),
      clipLowPercent: lowPercent,
      clipHighPercent: highPercent,
      isApproximate: (pixels?.length ?? 0) > 2_000_000,
    };
  }, [histogram, histogramInputRange, blackPoint, whitePoint, pixels?.length]);

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRegionSelectActive, setIsRegionSelectActive] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAstrometryResult, setShowAstrometryResult] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [annotationLayerVisibility, setAnnotationLayerVisibility] = useState(
    createDefaultLayerVisibility,
  );
  const [showCoordinateGrid, setShowCoordinateGrid] = useState(false);
  const [showConstellations, setShowConstellations] = useState(false);
  const [selectedAnnotation, setSelectedAnnotation] = useState<AstrometryAnnotation | null>(null);

  const visibleAnnotationTypes = useMemo(
    () => getVisibleTypes(annotationLayerVisibility),
    [annotationLayerVisibility],
  );

  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExportFormat);
  const canvasGestureConfig = useMemo(
    () => ({
      pinchSensitivity: settingsPinchSensitivity,
      pinchOverzoomFactor: settingsPinchOverzoomFactor,
      panRubberBandFactor: settingsPanRubberBandFactor,
      wheelZoomSensitivity: settingsWheelZoomSensitivity,
    }),
    [
      settingsPanRubberBandFactor,
      settingsPinchOverzoomFactor,
      settingsPinchSensitivity,
      settingsWheelZoomSensitivity,
    ],
  );

  // Astrometry integration
  const { submitFile: astrometrySubmit, config: astrometryConfig } = useAstrometry();
  const allAstrometryJobs = useAstrometryStore((s) => s.jobs);
  const astrometryJobs = useMemo(
    () => allAstrometryJobs.filter((j) => j.fileId === (id ?? "")),
    [allAstrometryJobs, id],
  );
  const latestSolvedJob = astrometryJobs.find((j) => j.status === "success" && j.result);
  const activeAstrometryJob = astrometryJobs.find(
    (j) => j.status === "uploading" || j.status === "submitted" || j.status === "solving",
  );

  const exportSource = useMemo(
    () => ({
      sourceType: metadata?.sourceType,
      sourceFormat: metadata?.sourceFormat,
      sourceFileId: file?.id,
      originalBuffer: sourceBuffer,
      scientificPixels: pixels,
      rgbChannels,
      metadata: metadata ?? undefined,
      headerKeywords: headers,
      comments,
      history,
      starAnnotations: file?.starAnnotations?.points ?? [],
      astrometryAnnotations: latestSolvedJob?.result?.annotations ?? [],
    }),
    [
      file?.id,
      file?.starAnnotations?.points,
      sourceBuffer,
      pixels,
      rgbChannels,
      metadata,
      headers,
      comments,
      history,
      latestSolvedJob?.result?.annotations,
    ],
  );
  const fitsScientificAvailable = useMemo(
    () => canUseScientificFitsExport(exportSource),
    [exportSource],
  );

  const closeExportDialog = useCallback(() => setShowExport(false), []);
  const {
    isExporting,
    exportPhase,
    handleExport,
    handleShare,
    handleSaveToDevice,
    handleCopyToClipboard,
    handlePrint,
    handlePrintToPdf,
  } = useViewerExport({
    rgbaData,
    width: dimensions?.width,
    height: dimensions?.height,
    filename: file?.filename ?? "fits",
    format: exportFormat,
    source: exportSource,
    onDone: closeExportDialog,
  });
  const prevPixelsRef = useRef<Float32Array | null>(null);
  const regionHistogramDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });
  const canvasRef = useRef<FitsCanvasHandle>(null);

  useEffect(() => {
    StatusBar.setHidden(isLandscape || isFullscreen, "fade");
    return () => {
      StatusBar.setHidden(false, "fade");
    };
  }, [isLandscape, isFullscreen]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  const toggleFavorite = useFitsStore((s) => s.toggleFavorite);

  const handleSolveThis = useCallback(() => {
    if (!astrometryConfig.apiKey) {
      toast.show({ variant: "danger", label: t("astrometry.noApiKey") });
      return;
    }
    if (!id) return;
    astrometrySubmit(id);
    haptics.notify();
  }, [astrometryConfig.apiKey, id, astrometrySubmit, haptics, toast, t]);

  const handleViewerExportWCS = useCallback(async () => {
    if (!latestSolvedJob?.result || !file) return;
    try {
      const shared = await shareWCS(latestSolvedJob.result, file.filename);
      if (shared) {
        haptics.notify();
      }
    } catch {
      toast.show({ variant: "danger", label: t("viewer.exportFailed") });
    }
  }, [latestSolvedJob, file, haptics, toast, t]);

  const navigateTo = useCallback(
    (fileId: string) => {
      router.replace(`/viewer/${fileId}`);
    },
    [router],
  );

  const navigateToAstrometryResult = useCallback(
    (jobId: string) => {
      router.push(`/astrometry/result/${jobId}`);
    },
    [router],
  );

  const clamp01 = useCallback((value: number) => Math.max(0, Math.min(1, value)), []);

  const handleBlackPointChange = useCallback(
    (value: number) => {
      const next = Math.min(clamp01(value), Math.max(0, whitePoint - 0.01));
      setBlackPoint(next);
    },
    [clamp01, whitePoint, setBlackPoint],
  );

  const handleWhitePointChange = useCallback(
    (value: number) => {
      const next = Math.max(clamp01(value), Math.min(1, blackPoint + 0.01));
      setWhitePoint(next);
    },
    [clamp01, blackPoint, setWhitePoint],
  );

  const handleOutputBlackChange = useCallback(
    (value: number) => {
      const next = Math.min(clamp01(value), Math.max(0, outputWhite - 0.01));
      setOutputBlack(next);
    },
    [clamp01, outputWhite, setOutputBlack],
  );

  const handleOutputWhiteChange = useCallback(
    (value: number) => {
      const next = Math.max(clamp01(value), Math.min(1, outputBlack + 0.01));
      setOutputWhite(next);
    },
    [clamp01, outputBlack, setOutputWhite],
  );

  const applyViewerPreset = useCallback(
    (preset: ViewerPreset) => {
      const a = preset.adjustments;
      setStretch(a.stretch);
      setColormap(a.colormap);
      handleBlackPointChange(a.blackPoint);
      handleWhitePointChange(a.whitePoint);
      setGamma(a.gamma);
      setMidtone(a.midtone);
      handleOutputBlackChange(a.outputBlack);
      handleOutputWhiteChange(a.outputWhite);
      setBrightness(a.brightness);
      setContrast(a.contrast);
      setMtfMidtone(a.mtfMidtone);
      setCurvePreset(a.curvePreset);
      const o = preset.overlays;
      if (showGrid !== o.showGrid) toggleGrid();
      if (showCrosshair !== o.showCrosshair) toggleCrosshair();
      if (showPixelInfo !== o.showPixelInfo) togglePixelInfo();
      if (showMinimap !== o.showMinimap) toggleMinimap();
    },
    [
      setStretch,
      setColormap,
      handleBlackPointChange,
      handleWhitePointChange,
      setGamma,
      setMidtone,
      handleOutputBlackChange,
      handleOutputWhiteChange,
      setBrightness,
      setContrast,
      setMtfMidtone,
      setCurvePreset,
      showGrid,
      showCrosshair,
      showPixelInfo,
      showMinimap,
      toggleGrid,
      toggleCrosshair,
      togglePixelInfo,
      toggleMinimap,
    ],
  );

  const handleSaveViewerPreset = useCallback(() => {
    if (!file) return;
    const preset = toViewerPreset(
      {
        stretch,
        colormap,
        blackPoint,
        whitePoint,
        gamma,
        midtone,
        outputBlack,
        outputWhite,
        brightness,
        contrast,
        mtfMidtone,
        curvePreset,
      },
      { showGrid, showCrosshair, showPixelInfo, showMinimap },
    );
    updateFile(file.id, { viewerPreset: preset });
    haptics.notify();
  }, [
    file,
    stretch,
    colormap,
    blackPoint,
    whitePoint,
    gamma,
    midtone,
    outputBlack,
    outputWhite,
    brightness,
    contrast,
    mtfMidtone,
    curvePreset,
    showGrid,
    showCrosshair,
    showPixelInfo,
    showMinimap,
    updateFile,
    haptics,
  ]);

  const handleResetToSaved = useCallback(() => {
    if (file?.viewerPreset) {
      applyViewerPreset(file.viewerPreset);
      return;
    }
    initFromSettings();
  }, [file?.viewerPreset, applyViewerPreset, initFromSettings]);

  const handleResetView = useCallback(() => {
    canvasRef.current?.resetView();
  }, []);

  const handleZoomIn = useCallback(() => {
    const target = canvasTransform.scale * 1.5;
    const { x, y } = zoomAroundCenter(
      canvasTransform.scale,
      target,
      canvasTransform.translateX,
      canvasTransform.translateY,
      canvasTransform.canvasWidth,
      canvasTransform.canvasHeight,
    );
    canvasRef.current?.setTransform(x, y, target);
  }, [canvasTransform]);

  const handleZoomOut = useCallback(() => {
    const target = canvasTransform.scale / 1.5;
    const { x, y } = zoomAroundCenter(
      canvasTransform.scale,
      target,
      canvasTransform.translateX,
      canvasTransform.translateY,
      canvasTransform.canvasWidth,
      canvasTransform.canvasHeight,
    );
    canvasRef.current?.setTransform(x, y, target);
  }, [canvasTransform]);

  const handleOneToOne = useCallback(() => {
    const dims = dimensions;
    if (!dims || canvasTransform.canvasWidth <= 0 || canvasTransform.canvasHeight <= 0) return;
    const imgW = displayWidth || dims.width;
    const imgH = displayHeight || dims.height;
    const target = computeOneToOneScale(
      imgW,
      imgH,
      canvasTransform.canvasWidth,
      canvasTransform.canvasHeight,
    );
    const { x, y } = zoomAroundCenter(
      canvasTransform.scale,
      target,
      canvasTransform.translateX,
      canvasTransform.translateY,
      canvasTransform.canvasWidth,
      canvasTransform.canvasHeight,
    );
    canvasRef.current?.setTransform(x, y, target);
  }, [canvasTransform, dimensions, displayWidth, displayHeight]);

  const handlePan = useCallback(
    (dx: number, dy: number) => {
      canvasRef.current?.setTransform(
        canvasTransform.translateX + dx,
        canvasTransform.translateY + dy,
      );
    },
    [canvasTransform],
  );

  useViewerHotkeys({
    enabled: !isFullscreen,
    onZoomIn: handleZoomIn,
    onZoomOut: handleZoomOut,
    onResetView: handleResetView,
    onToggleGrid: toggleGrid,
    onToggleCrosshair: toggleCrosshair,
    onToggleMinimap: toggleMinimap,
    onTogglePixelInfo: togglePixelInfo,
    onOneToOne: handleOneToOne,
    onFit: handleResetView,
    onPan: handlePan,
  });

  const zoomControlsBottomOffset = useMemo(() => {
    if (isFullscreen) return Math.max(insets.bottom + 12, 16);
    if (isLandscape) return Math.max(insets.bottom + 12, 12);
    if (showControls) return insets.bottom + 86;
    return Math.max(insets.bottom + 14, 14);
  }, [insets.bottom, isFullscreen, isLandscape, showControls]);

  useEffect(() => {
    if (!id || !isVideo) return;
    router.replace(`/video/${id}`);
  }, [id, isVideo, router]);

  // --- Pixel tap handler ---
  const handlePixelTap = useCallback(
    (x: number, y: number) => {
      if (!pixels || !dimensions) return;
      const val = pixels[y * dimensions.width + x] ?? null;
      setCursorPosition(x, y, val);

      // Hit-test annotations: find nearest annotation within 30px radius
      if (showAnnotations && latestSolvedJob?.result?.annotations) {
        const HIT_RADIUS = 30; // pixels in source space
        let nearest: AstrometryAnnotation | null = null;
        let nearestDist = HIT_RADIUS;
        for (const ann of latestSolvedJob.result.annotations) {
          if (visibleAnnotationTypes && !visibleAnnotationTypes.includes(ann.type)) continue;
          const dx = ann.pixelx - x;
          const dy = ann.pixely - y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = ann;
          }
        }
        setSelectedAnnotation(nearest);
      }
    },
    [
      pixels,
      dimensions,
      setCursorPosition,
      showAnnotations,
      latestSolvedJob,
      visibleAnnotationTypes,
    ],
  );

  // --- Auto stretch handler ---
  const handleAutoStretch = useCallback(() => {
    if (!pixels) return;
    const { blackPoint: bp, whitePoint: wp } = computeAutoStretch(pixels);
    handleBlackPointChange(bp);
    handleWhitePointChange(wp);
    setMidtone(0.5);
    setStretch("asinh");
  }, [pixels, handleBlackPointChange, handleWhitePointChange, setMidtone, setStretch]);

  // --- Midtone change handler (converts midtone position to gamma) ---
  const handleMidtoneChange = useCallback(
    (value: number) => {
      setMidtone(value);
      // Convert midtone slider position to gamma: gamma = log(m) / log(0.5)
      if (value > 0.001 && value < 0.999) {
        const newGamma = Math.log(value) / Math.log(0.5);
        setGamma(Math.max(0.1, Math.min(5, newGamma)));
      }
    },
    [setMidtone, setGamma],
  );

  const handleApplyQuickPreset = useCallback(
    (preset: "auto" | "linearReset" | "deepSky" | "moonPlanet") => {
      haptics.selection();
      if (preset === "auto") {
        handleAutoStretch();
        return;
      }

      if (preset === "linearReset") {
        setStretch("linear");
        setColormap("grayscale");
        handleBlackPointChange(0);
        handleWhitePointChange(1);
        handleOutputBlackChange(0);
        handleOutputWhiteChange(1);
        setMidtone(0.5);
        setBrightness(0);
        setContrast(1);
        setMtfMidtone(0.25);
        setCurvePreset("linear");
        return;
      }

      if (preset === "deepSky") {
        if (pixels) handleAutoStretch();
        setStretch("asinh");
        setColormap("grayscale");
        handleOutputBlackChange(0.02);
        handleOutputWhiteChange(0.98);
        setBrightness(0.01);
        setContrast(1.15);
        setMtfMidtone(0.3);
        setCurvePreset("sCurve");
        return;
      }

      setStretch("sqrt");
      setColormap("grayscale");
      handleBlackPointChange(0.02);
      handleWhitePointChange(0.9);
      handleOutputBlackChange(0);
      handleOutputWhiteChange(1);
      setBrightness(0);
      setContrast(1.25);
      setMtfMidtone(0.45);
      setCurvePreset("highContrast");
    },
    [
      haptics,
      pixels,
      handleAutoStretch,
      setStretch,
      setColormap,
      handleBlackPointChange,
      handleWhitePointChange,
      handleOutputBlackChange,
      handleOutputWhiteChange,
      setMidtone,
      setBrightness,
      setContrast,
      setMtfMidtone,
      setCurvePreset,
    ],
  );

  // --- Region selection handlers ---
  const clearPendingRegionHistogram = useCallback(() => {
    if (regionHistogramDebounceRef.current) {
      clearTimeout(regionHistogramDebounceRef.current);
      regionHistogramDebounceRef.current = null;
    }
  }, []);

  const handleToggleRegionSelect = useCallback(() => {
    if (isRegionSelectActive) {
      clearPendingRegionHistogram();
      setIsRegionSelectActive(false);
      setRegionSelection(null);
      clearRegionHistogram();
    } else {
      setIsRegionSelectActive(true);
    }
  }, [isRegionSelectActive, clearPendingRegionHistogram, setRegionSelection, clearRegionHistogram]);

  const handleRegionChange = useCallback(
    (region: { x: number; y: number; w: number; h: number }) => {
      setRegionSelection(region);
      if (!pixels || !dimensions) return;

      clearPendingRegionHistogram();
      regionHistogramDebounceRef.current = setTimeout(() => {
        getRegionHistogram(pixels, dimensions.width, region, 256);
        regionHistogramDebounceRef.current = null;
      }, 80);
    },
    [pixels, dimensions, setRegionSelection, clearPendingRegionHistogram, getRegionHistogram],
  );

  const handleRegionClear = useCallback(() => {
    clearPendingRegionHistogram();
    setRegionSelection(null);
    clearRegionHistogram();
    setIsRegionSelectActive(false);
  }, [clearPendingRegionHistogram, setRegionSelection, clearRegionHistogram]);

  useEffect(() => () => clearPendingRegionHistogram(), [clearPendingRegionHistogram]);
  useEffect(() => {
    clearPendingRegionHistogram();
  }, [pixels, dimensions?.width, clearPendingRegionHistogram]);

  // --- Frame change handler ---
  const handleFrameChange = useCallback(
    async (frame: number) => {
      setCurrentFrame(frame);
      await loadFrame(frame, currentHDU);
    },
    [setCurrentFrame, loadFrame, currentHDU],
  );

  const handleHDUChange = useCallback(
    async (hdu: number) => {
      setCurrentHDU(hdu);
      setCurrentFrame(0);
      await loadFrame(0, hdu);
    },
    [setCurrentHDU, setCurrentFrame, loadFrame],
  );

  // Load file on mount, cleanup on unmount
  useEffect(() => {
    if (file) {
      initFromSettings();
      setCurrentHDU(0);
      setCurrentFrame(0);
      if (file.viewerPreset) {
        applyViewerPreset(file.viewerPreset);
      }
      loadFromPath(file.filepath, file.filename, file.fileSize);
      updateFile(file.id, { lastViewed: Date.now() });
    }
    return () => {
      resetFits();
      resetImageProcessing();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  useImageCacheWarmup({
    enabled: viewerPreloadNeighbors,
    currentFile: file,
    allFiles,
    radius: viewerPreloadRadius,
    frameClassificationConfig,
    startWhen: !isFitsLoading && !!metadata,
  });

  // Set total frames from dimensions
  useEffect(() => {
    if (dimensions?.isDataCube && dimensions.depth > 1) {
      setTotalFrames(dimensions.depth);
    } else {
      setTotalFrames(1);
    }
  }, [dimensions, setTotalFrames]);

  // Process image: use progressive preview for initial/new pixel data, chunked for param changes
  useEffect(() => {
    if (!pixels || !dimensions) return;

    const isNewPixelData = prevPixelsRef.current !== pixels;
    prevPixelsRef.current = pixels;

    if (isNewPixelData) {
      if (useHighQualityPreview) {
        processImage(
          pixels,
          dimensions.width,
          dimensions.height,
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
          {
            profile: viewerPipelineProfile,
            recipe: activeViewerRecipe,
          },
        );
      } else {
        // New pixel data (initial load or frame change): show preview immediately
        processImagePreview(
          pixels,
          dimensions.width,
          dimensions.height,
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
          {
            profile: viewerPipelineProfile,
            recipe: activeViewerRecipe,
          },
        );
      }
      return;
    }

    // Parameter change (slider drag): debounce with chunked processing
    const timer = setTimeout(() => {
      processImage(
        pixels,
        dimensions.width,
        dimensions.height,
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
        {
          profile: viewerPipelineProfile,
          recipe: activeViewerRecipe,
        },
      );
    }, settingsDebounce);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    pixels,
    dimensions,
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
    useHighQualityPreview,
    viewerPipelineProfile,
    activeViewerRecipe,
  ]);

  // Histogram and stats only on pixel/dimension change (deferred after interactions)
  useEffect(() => {
    if (pixels) {
      getStatsAndHistogram(pixels, 256, rgbChannels);
    }
  }, [pixels, rgbChannels, getStatsAndHistogram]);

  // Auto-generate thumbnail on first view if missing
  useEffect(() => {
    if (!file || file.thumbnailUri || !rgbaData || !dimensions) return;
    let cancelled = false;
    void generateThumbnailAsync(file.id, rgbaData, dimensions.width, dimensions.height).then(
      (thumbUri) => {
        if (!cancelled && thumbUri) {
          updateFile(file.id, { thumbnailUri: thumbUri });
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file, rgbaData, dimensions, generateThumbnailAsync, updateFile]);

  const pixelValue =
    pixels && dimensions && cursorX >= 0 && cursorY >= 0
      ? (pixels[cursorY * dimensions.width + cursorX] ?? null)
      : null;

  // Compute RA/Dec from WCS calibration for PixelInspector
  const pixelWcs = useMemo(() => {
    const cal = latestSolvedJob?.result?.calibration;
    if (!cal || !dimensions || cursorX < 0 || cursorY < 0) return null;
    const radec = pixelToRaDec(cursorX, cursorY, cal);
    if (!radec) return null;
    return {
      ra: formatRaFromDeg(radec.ra),
      dec: formatDecFromDeg(radec.dec),
    };
  }, [latestSolvedJob, dimensions, cursorX, cursorY]);

  const handleToggleAnnotations = useCallback(() => setShowAnnotations((prev) => !prev), []);

  const handleToggleAnnotationType = useCallback((type: AstrometryAnnotationType) => {
    setAnnotationLayerVisibility((prev) => ({ ...prev, [type]: !prev[type] }));
  }, []);

  const controlPanelProps = useMemo(
    () => ({
      file: file as FitsMetadata,
      histogram,
      rgbHistogram,
      regionHistogram,
      stats,
      regionStats,
      imageDimensions: dimensions
        ? {
            width: dimensions.width,
            height: dimensions.height,
            depth: dimensions.depth,
            isDataCube: dimensions.isDataCube,
          }
        : undefined,
      regionSelection,
      histogramDiagnostics,
      histogramInputRange,
      blackPoint,
      whitePoint,
      midtone,
      outputBlack,
      outputWhite,
      histogramHeight: settingsHistogramHeight,
      defaultHistogramMode,
      onBlackPointChange: handleBlackPointChange,
      onWhitePointChange: handleWhitePointChange,
      onMidtoneChange: handleMidtoneChange,
      onOutputBlackChange: handleOutputBlackChange,
      onOutputWhiteChange: handleOutputWhiteChange,
      onAutoStretch: handleAutoStretch,
      onResetLevels: resetLevels,
      onToggleRegionSelect: handleToggleRegionSelect,
      isRegionSelectActive,
      stretch,
      colormap,
      brightness,
      contrast,
      mtfMidtone,
      curvePreset,
      showGrid,
      showCrosshair,
      showPixelInfo,
      showMinimap,
      currentHDU,
      hduList,
      currentFrame,
      totalFrames,
      isDataCube: dimensions?.isDataCube ?? false,
      onStretchChange: setStretch,
      onColormapChange: setColormap,
      onBrightnessChange: setBrightness,
      onContrastChange: setContrast,
      onMtfMidtoneChange: setMtfMidtone,
      onCurvePresetChange: setCurvePreset,
      onToggleGrid: toggleGrid,
      onToggleCrosshair: toggleCrosshair,
      onTogglePixelInfo: togglePixelInfo,
      onToggleMinimap: toggleMinimap,
      onHDUChange: handleHDUChange,
      onFrameChange: handleFrameChange,
      onResetView: handleResetView,
      onSavePreset: handleSaveViewerPreset,
      onResetToSaved: handleResetToSaved,
      onApplyQuickPreset: handleApplyQuickPreset,
      showAstrometryResult,
      latestSolvedJob,
      showAnnotations,
      onToggleAnnotations: handleToggleAnnotations,
      annotationLayerVisibility,
      onToggleAnnotationType: handleToggleAnnotationType,
      showCoordinateGrid,
      onToggleCoordinateGrid: () => setShowCoordinateGrid((prev) => !prev),
      showConstellations,
      onToggleConstellations: () => setShowConstellations((prev) => !prev),
      onExportWCS: handleViewerExportWCS,
      onNavigateToAstrometryResult: navigateToAstrometryResult,
      showControls,
    }),
    [
      file,
      histogram,
      rgbHistogram,
      regionHistogram,
      stats,
      regionStats,
      dimensions,
      regionSelection,
      histogramDiagnostics,
      histogramInputRange,
      blackPoint,
      whitePoint,
      midtone,
      outputBlack,
      outputWhite,
      settingsHistogramHeight,
      defaultHistogramMode,
      handleBlackPointChange,
      handleWhitePointChange,
      handleMidtoneChange,
      handleOutputBlackChange,
      handleOutputWhiteChange,
      handleAutoStretch,
      resetLevels,
      handleToggleRegionSelect,
      isRegionSelectActive,
      stretch,
      colormap,
      brightness,
      contrast,
      mtfMidtone,
      curvePreset,
      showGrid,
      showCrosshair,
      showPixelInfo,
      showMinimap,
      currentHDU,
      hduList,
      currentFrame,
      totalFrames,
      setStretch,
      setColormap,
      setBrightness,
      setContrast,
      setMtfMidtone,
      setCurvePreset,
      toggleGrid,
      toggleCrosshair,
      togglePixelInfo,
      toggleMinimap,
      handleHDUChange,
      handleFrameChange,
      handleResetView,
      handleSaveViewerPreset,
      handleResetToSaved,
      handleApplyQuickPreset,
      showAstrometryResult,
      latestSolvedJob,
      showAnnotations,
      handleToggleAnnotations,
      annotationLayerVisibility,
      handleToggleAnnotationType,
      showCoordinateGrid,
      showConstellations,
      handleViewerExportWCS,
      navigateToAstrometryResult,
      showControls,
    ],
  );

  if (!file) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Ionicons name="alert-circle-outline" size={48} className="text-muted" />
        <Text className="mt-4 text-sm text-muted">{t("common.noData")}</Text>
        <Button variant="outline" className="mt-4" onPress={() => router.back()}>
          <Button.Label>{t("common.goHome")}</Button.Label>
        </Button>
      </View>
    );
  }

  if (isVideo) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="videocam-outline" size={48} className="text-muted" />
        <Text className="mt-4 text-center text-sm text-muted">This file is a video.</Text>
        <Button variant="primary" className="mt-4" onPress={() => router.replace(`/video/${id}`)}>
          <Button.Label>Open Video Player</Button.Label>
        </Button>
      </View>
    );
  }

  const canvasArea = (
    <View className="flex-1 bg-black">
      {fitsError || processingError ? (
        <View className="flex-1 items-center justify-center px-6">
          <HAlert status="danger">
            <HAlert.Indicator />
            <HAlert.Content>
              <HAlert.Title>{t("common.error")}</HAlert.Title>
              <HAlert.Description>{fitsError || processingError}</HAlert.Description>
            </HAlert.Content>
          </HAlert>
        </View>
      ) : rgbaData && dimensions ? (
        <ViewerErrorBoundary onReset={handleResetView}>
          <Animated.View entering={FadeIn.duration(250)} className="flex-1">
            <FitsCanvas
              ref={canvasRef}
              rgbaData={rgbaData}
              width={displayWidth || dimensions.width}
              height={displayHeight || dimensions.height}
              sourceWidth={dimensions.width}
              sourceHeight={dimensions.height}
              showGrid={showGrid}
              showCrosshair={showCrosshair}
              cursorX={cursorX}
              cursorY={cursorY}
              onPixelTap={handlePixelTap}
              onTransformChange={setCanvasTransform}
              gridColor={settingsGridColor}
              gridOpacity={settingsGridOpacity}
              crosshairColor={settingsCrosshairColor}
              crosshairOpacity={settingsCrosshairOpacity}
              minScale={settingsMinScale}
              maxScale={settingsMaxScale}
              doubleTapScale={settingsDoubleTapScale}
              gestureConfig={canvasGestureConfig}
              onSwipeLeft={() => nextId && navigateTo(nextId)}
              onSwipeRight={() => prevId && navigateTo(prevId)}
              onLongPress={toggleFullscreen}
              interactionEnabled={!isRegionSelectActive}
              wheelZoomEnabled
            />

            {/* Pixel Inspector */}
            <PixelInspector
              x={cursorX}
              y={cursorY}
              value={pixelValue}
              visible={showPixelInfo}
              decimalPlaces={pixelInfoDecimalPlaces}
              ra={pixelWcs?.ra}
              dec={pixelWcs?.dec}
            />

            {/* Minimap */}
            <Minimap
              rgbaData={rgbaData}
              imgWidth={displayWidth || dimensions.width}
              imgHeight={displayHeight || dimensions.height}
              visible={showMinimap}
              viewportScale={canvasTransform.scale}
              viewportTranslateX={canvasTransform.translateX}
              viewportTranslateY={canvasTransform.translateY}
              canvasWidth={canvasTransform.canvasWidth}
              canvasHeight={canvasTransform.canvasHeight}
              onNavigate={(tx: number, ty: number) => canvasRef.current?.setTransform(tx, ty)}
            />

            {/* Astrometry Annotation Overlay */}
            {latestSolvedJob?.result && showAnnotations && dimensions && (
              <View className="absolute inset-0" pointerEvents="none">
                <AstrometryAnnotationOverlay
                  annotations={latestSolvedJob.result.annotations}
                  renderWidth={displayWidth || dimensions.width}
                  renderHeight={displayHeight || dimensions.height}
                  sourceWidth={dimensions.width}
                  sourceHeight={dimensions.height}
                  transform={canvasTransform}
                  visible={showAnnotations}
                  visibleTypes={visibleAnnotationTypes}
                />
              </View>
            )}

            {/* Coordinate Grid Overlay */}
            {latestSolvedJob?.result && showCoordinateGrid && dimensions && (
              <View className="absolute inset-0" pointerEvents="none">
                <CoordinateGridOverlay
                  calibration={latestSolvedJob.result.calibration}
                  renderWidth={displayWidth || dimensions.width}
                  renderHeight={displayHeight || dimensions.height}
                  sourceWidth={dimensions.width}
                  sourceHeight={dimensions.height}
                  transform={canvasTransform}
                  visible={showCoordinateGrid}
                />
              </View>
            )}

            {/* Constellation Lines Overlay */}
            {latestSolvedJob?.result && showConstellations && dimensions && (
              <View className="absolute inset-0" pointerEvents="none">
                <ConstellationOverlay
                  calibration={latestSolvedJob.result.calibration}
                  renderWidth={displayWidth || dimensions.width}
                  renderHeight={displayHeight || dimensions.height}
                  sourceWidth={dimensions.width}
                  sourceHeight={dimensions.height}
                  transform={canvasTransform}
                  visible={showConstellations}
                />
              </View>
            )}

            {/* Region selection overlay */}
            {isRegionSelectActive && dimensions && (
              <RegionSelectOverlay
                renderWidth={displayWidth || dimensions.width}
                renderHeight={displayHeight || dimensions.height}
                sourceWidth={dimensions.width}
                sourceHeight={dimensions.height}
                containerWidth={canvasTransform.canvasWidth || 300}
                containerHeight={canvasTransform.canvasHeight || 300}
                transform={canvasTransform}
                onRegionChange={handleRegionChange}
                onClear={handleRegionClear}
              />
            )}

            {/* Stats overlay */}
            {stats && (
              <StatsOverlay
                width={dimensions.width}
                height={dimensions.height}
                isDataCube={dimensions.isDataCube}
                depth={dimensions.depth}
                min={stats.min}
                max={stats.max}
                mean={stats.mean}
                median={stats.median}
                stddev={stats.stddev}
                bitpix={metadata?.bitpix ?? file.bitpix}
                currentHDU={currentHDU}
                currentFrame={currentFrame}
                totalFrames={totalFrames}
              />
            )}

            {/* Astrometry status badge */}
            {activeAstrometryJob && (
              <AstrometryBadge
                status={activeAstrometryJob.status}
                progress={activeAstrometryJob.progress}
              />
            )}

            {/* Zoom controls */}
            <ZoomControls
              scale={canvasTransform.scale}
              translateX={canvasTransform.translateX}
              translateY={canvasTransform.translateY}
              canvasWidth={canvasTransform.canvasWidth}
              canvasHeight={canvasTransform.canvasHeight}
              imageWidth={displayWidth || dimensions.width}
              imageHeight={displayHeight || dimensions.height}
              bottomOffset={zoomControlsBottomOffset}
              onSetTransform={(tx, ty, s) => canvasRef.current?.setTransform(tx, ty, s)}
            />

            {/* Compass Indicator */}
            {latestSolvedJob?.result?.calibration && showAnnotations && (
              <View className="absolute" style={{ top: 8, right: 8 }}>
                <CompassIndicator calibration={latestSolvedJob.result.calibration} />
              </View>
            )}

            {/* Annotation Detail Sheet */}
            {selectedAnnotation && latestSolvedJob?.result?.calibration && (
              <AnnotationDetailSheet
                annotation={selectedAnnotation}
                calibration={latestSolvedJob.result.calibration}
                onClose={() => setSelectedAnnotation(null)}
              />
            )}

            {/* Exit fullscreen button */}
            {isFullscreen && (
              <View
                className="absolute"
                style={{
                  top: Math.max(insets.top + 8, 12),
                  right: Math.max(insets.right + 8, 12),
                }}
              >
                <Button
                  size="sm"
                  variant="ghost"
                  isIconOnly
                  onPress={toggleFullscreen}
                  className="h-8 w-8 bg-black/50 rounded-full"
                >
                  <Ionicons name="contract-outline" size={16} color="#fff" />
                </Button>
              </View>
            )}
          </Animated.View>
        </ViewerErrorBoundary>
      ) : (
        <View className="flex-1 items-center justify-center px-6">
          <Animated.View entering={FadeIn.duration(300)} className="w-full max-w-sm items-center">
            {/* Image skeleton — animation accelerates as phase progresses */}
            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              className="relative w-full"
            >
              <Skeleton
                className="aspect-[4/3] w-full rounded-2xl"
                variant={loadingPhase >= 2 ? "pulse" : "shimmer"}
                animation={
                  loadingPhase >= 2
                    ? { pulse: { duration: 800, minOpacity: 0.4, maxOpacity: 0.9 } }
                    : {
                        shimmer: {
                          duration: loadingPhase === 0 ? 2200 : 1400,
                          speed: loadingPhase === 0 ? 0.7 : 1.2,
                          highlightColor: "#22c55e14",
                        },
                      }
                }
              />
              {/* Centered icon on skeleton */}
              <View className="absolute inset-0 items-center justify-center">
                <View style={{ opacity: 0.25 }}>
                  <Ionicons
                    name={
                      loadingPhase === 0
                        ? "cloud-download-outline"
                        : loadingPhase === 1
                          ? "code-slash-outline"
                          : "color-palette-outline"
                    }
                    size={32}
                    className="text-muted"
                  />
                </View>
              </View>
            </Animated.View>

            {/* Spinner + phase status card */}
            <Animated.View
              entering={FadeInUp.delay(300).duration(400)}
              className="mt-5 items-center"
            >
              <Surface variant="secondary" className="items-center rounded-2xl px-6 py-4">
                <Spinner size="md" color="success">
                  <Spinner.Indicator
                    animation={{ rotation: { speed: 0.5 + loadingPhase * 0.4 } }}
                  />
                </Spinner>
                <Animated.Text
                  key={loadingPhase}
                  entering={FadeIn.duration(200)}
                  exiting={FadeOut.duration(150)}
                  className="mt-2 text-xs font-medium text-muted"
                >
                  {loadingPhase === 0
                    ? t("viewer.loadingPhaseRead")
                    : loadingPhase === 1
                      ? t("viewer.loadingPhaseParse")
                      : t("viewer.loadingPhaseRender")}
                </Animated.Text>
              </Surface>
            </Animated.View>

            {/* Step indicator dots */}
            <Animated.View
              entering={FadeInUp.delay(500).duration(400)}
              className="mt-4 flex-row items-center gap-2"
            >
              {[0, 1, 2].map((step) => {
                const isActive = loadingPhase >= step;
                const isCurrent = loadingPhase === step;
                return (
                  <Animated.View
                    key={step}
                    className={isActive ? "bg-success" : "bg-muted/25"}
                    style={{
                      width: isCurrent ? 16 : 6,
                      height: 6,
                      borderRadius: 3,
                      opacity: isCurrent ? 1 : isActive ? 0.5 : 0.3,
                    }}
                  />
                );
              })}
            </Animated.View>
          </Animated.View>
        </View>
      )}
    </View>
  );

  const sidePanel = (
    <ScrollView
      className="bg-background border-l border-separator"
      style={{ width: sidePanelWidth }}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <ViewerControlPanel {...controlPanelProps} />
    </ScrollView>
  );

  return (
    <View
      testID="e2e-screen-viewer__param_id"
      className="flex-1 bg-background"
      style={isLandscape ? { paddingLeft: insets.left, paddingRight: insets.right } : undefined}
    >
      <LoadingOverlay
        visible={isExporting}
        message={
          isExporting && exportPhase !== "idle"
            ? t(
                `viewer.exportPhase${exportPhase.charAt(0).toUpperCase() + exportPhase.slice(1)}` as Parameters<
                  typeof t
                >[0],
              )
            : t("common.loading")
        }
      />

      {/* Top Bar - hidden in fullscreen */}
      {!isFullscreen && (
        <ViewerToolbar
          filename={file.filename}
          isLandscape={isLandscape}
          isFavorite={file.isFavorite}
          prevId={prevId}
          nextId={nextId}
          showControls={showControls}
          hasAstrometryResult={!!latestSolvedJob}
          isAstrometryActive={!!activeAstrometryJob}
          onToggleFullscreen={toggleFullscreen}
          onBack={() => router.back()}
          onPrev={() => prevId && navigateTo(prevId)}
          onNext={() => nextId && navigateTo(nextId)}
          onToggleFavorite={() => file && toggleFavorite(file.id)}
          onOpenHeader={() => router.push(`/header/${id}`)}
          onOpenEditor={() => router.push(`/editor/${id}`)}
          canCompare={canCompare}
          onCompare={() => {
            if (compareIds.length < 2) return;
            router.push(`/compare?ids=${compareIds.join(",")}`);
          }}
          onExport={() => setShowExport(true)}
          onAstrometry={
            latestSolvedJob
              ? () => setShowAstrometryResult(!showAstrometryResult)
              : activeAstrometryJob
                ? () => router.push("/astrometry")
                : handleSolveThis
          }
          onToggleControls={() => setShowControls(!showControls)}
        />
      )}

      {isLandscape ? (
        <View className="flex-1 flex-row">
          {canvasArea}
          {showControls && !isFullscreen && sidePanel}
        </View>
      ) : (
        <>
          {canvasArea}
          {!isFullscreen && (
            <ViewerBottomSheet
              visible={showControls}
              onVisibleChange={setShowControls}
              {...controlPanelProps}
            />
          )}
        </>
      )}

      {/* Export Dialog */}
      <ExportDialog
        visible={showExport}
        filename={file.filename}
        format={exportFormat}
        width={dimensions?.width}
        height={dimensions?.height}
        onFormatChange={setExportFormat}
        onExport={handleExport}
        onShare={handleShare}
        onSaveToDevice={handleSaveToDevice}
        onCopyToClipboard={handleCopyToClipboard}
        fitsScientificAvailable={fitsScientificAvailable}
        onPrint={handlePrint}
        onPrintToPdf={handlePrintToPdf}
        onClose={() => setShowExport(false)}
      />
    </View>
  );
}
