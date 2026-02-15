import { View, Text, Alert, ScrollView, StatusBar, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Alert as HAlert, Button, Skeleton, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import Animated, { FadeIn } from "react-native-reanimated";
import { useI18n } from "../../i18n/useI18n";
import { useScreenOrientation } from "../../hooks/useScreenOrientation";
import { useFitsStore } from "../../stores/useFitsStore";
import { useViewerStore } from "../../stores/useViewerStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageProcessing } from "../../hooks/useImageProcessing";
import { useViewerExport } from "../../hooks/useViewerExport";
import { useThumbnail } from "../../hooks/useThumbnail";
import { PixelInspector } from "../../components/fits/PixelInspector";
import { RegionSelectOverlay } from "../../components/fits/RegionSelectOverlay";
import {
  FitsCanvas,
  type CanvasTransform,
  type FitsCanvasHandle,
} from "../../components/fits/FitsCanvas";
import { Minimap } from "../../components/fits/Minimap";
import { LoadingOverlay } from "../../components/common/LoadingOverlay";
import { ExportDialog } from "../../components/common/ExportDialog";
import type { ExportFormat } from "../../lib/fits/types";
import { computeAutoStretch } from "../../lib/utils/pixelMath";
import { useAstrometry } from "../../hooks/useAstrometry";
import { useAstrometryStore } from "../../stores/useAstrometryStore";
import { AstrometryAnnotationOverlay } from "../../components/astrometry/AstrometryAnnotationOverlay";
import { ViewerControlPanel } from "../../components/fits/ViewerControlPanel";
import { ViewerBottomSheet } from "../../components/fits/ViewerBottomSheet";
import { ViewerToolbar } from "../../components/fits/ViewerToolbar";
import { StatsOverlay } from "../../components/fits/StatsOverlay";
import { ZoomControls } from "../../components/fits/ZoomControls";
import { AstrometryBadge } from "../../components/fits/AstrometryBadge";
import { shareWCS } from "../../lib/astrometry/wcsExport";

export default function ViewerDetailScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const { isLandscape } = useScreenOrientation();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const sidePanelWidth = useMemo(
    () => Math.min(Math.max(Math.round(screenWidth * 0.32), 240), 360),
    [screenWidth],
  );

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

  // Display parameters — grouped to reduce re-renders
  const { stretch, colormap, blackPoint, whitePoint, gamma, midtone, outputBlack, outputWhite } =
    useViewerStore(
      useShallow((s) => ({
        stretch: s.stretch,
        colormap: s.colormap,
        blackPoint: s.blackPoint,
        whitePoint: s.whitePoint,
        gamma: s.gamma,
        midtone: s.midtone,
        outputBlack: s.outputBlack,
        outputWhite: s.outputWhite,
      })),
    );

  // Display parameter setters (stable references)
  const setStretch = useViewerStore((s) => s.setStretch);
  const setColormap = useViewerStore((s) => s.setColormap);
  const setBlackPoint = useViewerStore((s) => s.setBlackPoint);
  const setWhitePoint = useViewerStore((s) => s.setWhitePoint);
  const setGamma = useViewerStore((s) => s.setGamma);
  const setMidtone = useViewerStore((s) => s.setMidtone);
  const setOutputBlack = useViewerStore((s) => s.setOutputBlack);
  const setOutputWhite = useViewerStore((s) => s.setOutputWhite);
  const resetLevels = useViewerStore((s) => s.resetLevels);
  const _regionSelection = useViewerStore((s) => s.regionSelection);
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
  const pixelInfoDecimalPlaces = useSettingsStore((s) => s.pixelInfoDecimalPlaces);
  const settingsGridColor = useSettingsStore((s) => s.gridColor);
  const settingsGridOpacity = useSettingsStore((s) => s.gridOpacity);
  const settingsCrosshairColor = useSettingsStore((s) => s.crosshairColor);
  const settingsCrosshairOpacity = useSettingsStore((s) => s.crosshairOpacity);
  const settingsMinScale = useSettingsStore((s) => s.canvasMinScale);
  const settingsMaxScale = useSettingsStore((s) => s.canvasMaxScale);
  const settingsDoubleTapScale = useSettingsStore((s) => s.canvasDoubleTapScale);

  // Cursor & frame — grouped
  const { cursorX, cursorY, currentFrame, totalFrames } = useViewerStore(
    useShallow((s) => ({
      cursorX: s.cursorX,
      cursorY: s.cursorY,
      currentFrame: s.currentFrame,
      totalFrames: s.totalFrames,
    })),
  );
  const setCursorPosition = useViewerStore((s) => s.setCursorPosition);
  const setCurrentFrame = useViewerStore((s) => s.setCurrentFrame);
  const setTotalFrames = useViewerStore((s) => s.setTotalFrames);

  const {
    pixels,
    dimensions,
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
    regionHistogram,
    processImage,
    processImagePreview,
    getStatsAndHistogram,
    getRegionHistogram,
    clearRegionHistogram,
    stats,
    processingError,
  } = useImageProcessing();

  const { generateThumbnail } = useThumbnail();

  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isRegionSelectActive, setIsRegionSelectActive] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAstrometryResult, setShowAstrometryResult] = useState(false);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");

  const closeExportDialog = useCallback(() => setShowExport(false), []);
  const {
    isExporting,
    handleExport,
    handleShare,
    handleSaveToDevice,
    handlePrint,
    handlePrintToPdf,
  } = useViewerExport({
    rgbaData,
    width: dimensions?.width,
    height: dimensions?.height,
    filename: file?.filename ?? "fits",
    format: exportFormat,
    onDone: closeExportDialog,
  });
  const prevPixelsRef = useRef<Float32Array | null>(null);
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

  const handleSolveThis = useCallback(() => {
    if (!astrometryConfig.apiKey) {
      Alert.alert(t("common.error"), t("astrometry.noApiKey"));
      return;
    }
    if (!id) return;
    astrometrySubmit(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [astrometryConfig.apiKey, id, astrometrySubmit, t]);

  const handleViewerExportWCS = useCallback(async () => {
    if (!latestSolvedJob?.result || !file) return;
    try {
      const shared = await shareWCS(latestSolvedJob.result, file.filename);
      if (shared) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch {
      Alert.alert(t("common.error"), "Failed to export WCS.");
    }
  }, [latestSolvedJob, file, t]);

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

  // --- Pixel tap handler ---
  const handlePixelTap = useCallback(
    (x: number, y: number) => {
      if (!pixels || !dimensions) return;
      const val = pixels[y * dimensions.width + x] ?? null;
      setCursorPosition(x, y, val);
    },
    [pixels, dimensions, setCursorPosition],
  );

  // --- Auto stretch handler ---
  const handleAutoStretch = useCallback(() => {
    if (!pixels) return;
    const { blackPoint: bp, whitePoint: wp } = computeAutoStretch(pixels);
    setBlackPoint(bp);
    setWhitePoint(wp);
    setMidtone(0.5);
    setStretch("asinh");
  }, [pixels, setBlackPoint, setWhitePoint, setMidtone, setStretch]);

  // --- Midtone change handler (converts midtone position to gamma) ---
  const handleMidtoneChange = useCallback(
    (value: number) => {
      setMidtone(value);
      // Convert midtone slider position to gamma: gamma = -log(2) / log(midtonePos)
      if (value > 0.001 && value < 0.999) {
        const newGamma = -Math.log(2) / Math.log(value);
        setGamma(Math.max(0.1, Math.min(5, newGamma)));
      }
    },
    [setMidtone, setGamma],
  );

  // --- Region selection handlers ---
  const handleToggleRegionSelect = useCallback(() => {
    if (isRegionSelectActive) {
      setIsRegionSelectActive(false);
      setRegionSelection(null);
      clearRegionHistogram();
    } else {
      setIsRegionSelectActive(true);
    }
  }, [isRegionSelectActive, setRegionSelection, clearRegionHistogram]);

  const handleRegionChange = useCallback(
    (region: { x: number; y: number; w: number; h: number }) => {
      setRegionSelection(region);
      if (pixels && dimensions) {
        getRegionHistogram(pixels, dimensions.width, region, 256);
      }
    },
    [pixels, dimensions, setRegionSelection, getRegionHistogram],
  );

  const handleRegionClear = useCallback(() => {
    setRegionSelection(null);
    clearRegionHistogram();
    setIsRegionSelectActive(false);
  }, [setRegionSelection, clearRegionHistogram]);

  // --- Frame change handler ---
  const handleFrameChange = useCallback(
    async (frame: number) => {
      setCurrentFrame(frame);
      await loadFrame(frame);
    },
    [setCurrentFrame, loadFrame],
  );

  // Load file on mount, cleanup on unmount
  useEffect(() => {
    if (file) {
      initFromSettings();
      loadFromPath(file.filepath, file.filename, file.fileSize);
      updateFile(file.id, { lastViewed: Date.now() });
    }
    return () => {
      resetFits();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id]);

  // Set total frames from dimensions
  useEffect(() => {
    if (dimensions?.isDataCube && dimensions.depth > 1) {
      setTotalFrames(dimensions.depth);
    }
  }, [dimensions, setTotalFrames]);

  // Process image: use progressive preview for initial/new pixel data, chunked for param changes
  useEffect(() => {
    if (!pixels || !dimensions) return;

    const isNewPixelData = prevPixelsRef.current !== pixels;
    prevPixelsRef.current = pixels;

    if (isNewPixelData) {
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
      );
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
  ]);

  // Histogram and stats only on pixel/dimension change (deferred after interactions)
  useEffect(() => {
    if (pixels) {
      getStatsAndHistogram(pixels, 256);
    }
  }, [pixels, getStatsAndHistogram]);

  // Auto-generate thumbnail on first view if missing
  useEffect(() => {
    if (!file || file.thumbnailUri || !rgbaData || !dimensions) return;
    const thumbUri = generateThumbnail(file.id, rgbaData, dimensions.width, dimensions.height);
    if (thumbUri) {
      updateFile(file.id, { thumbnailUri: thumbUri });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, file?.thumbnailUri, rgbaData, dimensions]);

  const pixelValue =
    pixels && dimensions && cursorX >= 0 && cursorY >= 0
      ? (pixels[cursorY * dimensions.width + cursorX] ?? null)
      : null;

  // Compute RA/Dec from WCS calibration for PixelInspector
  const pixelWcs = useMemo(() => {
    const cal = latestSolvedJob?.result?.calibration;
    if (!cal || !dimensions || cursorX < 0 || cursorY < 0) return null;
    const cx = dimensions.width / 2;
    const cy = dimensions.height / 2;
    const dx = cursorX - cx;
    const dy = cursorY - cy;
    const rad = (Math.PI / 180) * cal.orientation;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const rotX = dx * cosR - dy * sinR;
    const rotY = dx * sinR + dy * cosR;
    const degPerPx = cal.pixscale / 3600;
    const decOffset = -rotY * degPerPx;
    const raOffset = (rotX * degPerPx) / Math.cos((cal.dec * Math.PI) / 180);
    return {
      ra: ((cal.ra + raOffset) / 15).toFixed(4) + "h",
      dec: (cal.dec + decOffset >= 0 ? "+" : "") + (cal.dec + decOffset).toFixed(4) + "°",
    };
  }, [latestSolvedJob, dimensions, cursorX, cursorY]);

  const handleToggleAnnotations = useCallback(() => setShowAnnotations((prev) => !prev), []);

  const controlPanelProps = useMemo(
    () => ({
      file: file!,
      histogram,
      regionHistogram,
      blackPoint,
      whitePoint,
      midtone,
      outputBlack,
      outputWhite,
      histogramHeight: settingsHistogramHeight,
      defaultHistogramMode,
      onBlackPointChange: setBlackPoint,
      onWhitePointChange: setWhitePoint,
      onMidtoneChange: handleMidtoneChange,
      onOutputBlackChange: setOutputBlack,
      onOutputWhiteChange: setOutputWhite,
      onAutoStretch: handleAutoStretch,
      onResetLevels: resetLevels,
      onToggleRegionSelect: handleToggleRegionSelect,
      isRegionSelectActive,
      stretch,
      colormap,
      gamma,
      showGrid,
      showCrosshair,
      showPixelInfo,
      showMinimap,
      currentFrame,
      totalFrames,
      isDataCube: dimensions?.isDataCube ?? false,
      onStretchChange: setStretch,
      onColormapChange: setColormap,
      onGammaChange: setGamma,
      onToggleGrid: toggleGrid,
      onToggleCrosshair: toggleCrosshair,
      onTogglePixelInfo: togglePixelInfo,
      onToggleMinimap: toggleMinimap,
      onFrameChange: handleFrameChange,
      showAstrometryResult,
      latestSolvedJob,
      showAnnotations,
      onToggleAnnotations: handleToggleAnnotations,
      onExportWCS: handleViewerExportWCS,
      onNavigateToAstrometryResult: navigateToAstrometryResult,
      showControls,
    }),
    [
      file,
      histogram,
      regionHistogram,
      blackPoint,
      whitePoint,
      midtone,
      outputBlack,
      outputWhite,
      settingsHistogramHeight,
      defaultHistogramMode,
      setBlackPoint,
      setWhitePoint,
      handleMidtoneChange,
      setOutputBlack,
      setOutputWhite,
      handleAutoStretch,
      resetLevels,
      handleToggleRegionSelect,
      isRegionSelectActive,
      stretch,
      colormap,
      gamma,
      showGrid,
      showCrosshair,
      showPixelInfo,
      showMinimap,
      currentFrame,
      totalFrames,
      dimensions?.isDataCube,
      setStretch,
      setColormap,
      setGamma,
      toggleGrid,
      toggleCrosshair,
      togglePixelInfo,
      toggleMinimap,
      handleFrameChange,
      showAstrometryResult,
      latestSolvedJob,
      showAnnotations,
      handleToggleAnnotations,
      handleViewerExportWCS,
      navigateToAstrometryResult,
      showControls,
    ],
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
        <Animated.View entering={FadeIn.duration(250)} className="flex-1">
          <FitsCanvas
            ref={canvasRef}
            rgbaData={rgbaData}
            width={displayWidth || dimensions.width}
            height={displayHeight || dimensions.height}
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
            onSwipeLeft={() => nextId && navigateTo(nextId)}
            onSwipeRight={() => prevId && navigateTo(prevId)}
            onLongPress={toggleFullscreen}
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
                imageWidth={displayWidth || dimensions.width}
                imageHeight={displayHeight || dimensions.height}
                transform={canvasTransform}
                visible={showAnnotations}
              />
            </View>
          )}

          {/* Region selection overlay */}
          {isRegionSelectActive && dimensions && (
            <RegionSelectOverlay
              imageWidth={displayWidth || dimensions.width}
              imageHeight={displayHeight || dimensions.height}
              containerWidth={canvasTransform.canvasWidth || 300}
              containerHeight={canvasTransform.canvasHeight || 300}
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
            imageWidth={dimensions.width}
            onSetTransform={(tx, ty, s) => canvasRef.current?.setTransform(tx, ty, s)}
          />

          {/* Exit fullscreen button */}
          {isFullscreen && (
            <View className="absolute top-3 right-3">
              <Button
                size="sm"
                variant="ghost"
                onPress={toggleFullscreen}
                className="h-8 w-8 bg-black/50 rounded-full"
              >
                <Ionicons name="contract-outline" size={16} color="#fff" />
              </Button>
            </View>
          )}
        </Animated.View>
      ) : (
        <View className="flex-1 items-center justify-center">
          <Skeleton className="w-3/4 h-3/4 rounded-lg">
            <View className="flex-1 items-center justify-center">
              <Ionicons name="image-outline" size={64} color="#333" />
              <Text className="mt-3 text-xs text-neutral-500">{t("common.loading")}</Text>
            </View>
          </Skeleton>
        </View>
      )}
    </View>
  );

  const sidePanel = (
    <ScrollView
      className="bg-background"
      style={{
        width: sidePanelWidth,
        borderLeftWidth: 1,
        borderLeftColor: "rgba(128,128,128,0.2)",
      }}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      <ViewerControlPanel {...controlPanelProps} />
    </ScrollView>
  );

  return (
    <View
      className="flex-1 bg-background"
      style={isLandscape ? { paddingLeft: insets.left, paddingRight: insets.right } : undefined}
    >
      <LoadingOverlay visible={isFitsLoading || isExporting} message={t("common.loading")} />

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
          showAstrometryResult={showAstrometryResult}
          onToggleFullscreen={toggleFullscreen}
          onBack={() => router.back()}
          onPrev={() => prevId && navigateTo(prevId)}
          onNext={() => nextId && navigateTo(nextId)}
          onToggleFavorite={() => file && toggleFavorite(file.id)}
          onOpenHeader={() => router.push(`/header/${id}`)}
          onOpenEditor={() => router.push(`/editor/${id}`)}
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
          {!isFullscreen && <ViewerBottomSheet visible={showControls} {...controlPanelProps} />}
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
        onPrint={handlePrint}
        onPrintToPdf={handlePrintToPdf}
        onClose={() => setShowExport(false)}
      />
    </View>
  );
}
