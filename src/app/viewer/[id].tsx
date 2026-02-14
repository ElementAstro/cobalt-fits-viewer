import { View, Text, Alert } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useState, useEffect, useCallback, useRef } from "react";
import { Alert as HAlert, Button, Chip, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useShallow } from "zustand/react/shallow";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useViewerStore } from "../../stores/useViewerStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageProcessing } from "../../hooks/useImageProcessing";
import { useExport } from "../../hooks/useExport";
import { useThumbnail } from "../../hooks/useThumbnail";
import { ViewerControls } from "../../components/fits/ViewerControls";
import { PixelInspector } from "../../components/fits/PixelInspector";
import { FitsHistogram } from "../../components/fits/FitsHistogram";
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

export default function ViewerDetailScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const updateFile = useFitsStore((s) => s.updateFile);
  const getAdjacentFileIds = useFitsStore((s) => s.getAdjacentFileIds);
  const { prevId, nextId } = id ? getAdjacentFileIds(id) : { prevId: null, nextId: null };

  // Display parameters — grouped to reduce re-renders
  const { stretch, colormap, blackPoint, whitePoint, gamma } = useViewerStore(
    useShallow((s) => ({
      stretch: s.stretch,
      colormap: s.colormap,
      blackPoint: s.blackPoint,
      whitePoint: s.whitePoint,
      gamma: s.gamma,
    })),
  );

  // Display parameter setters (stable references)
  const setStretch = useViewerStore((s) => s.setStretch);
  const setColormap = useViewerStore((s) => s.setColormap);
  const setBlackPoint = useViewerStore((s) => s.setBlackPoint);
  const setWhitePoint = useViewerStore((s) => s.setWhitePoint);
  const setGamma = useViewerStore((s) => s.setGamma);

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
    processImage,
    processImagePreview,
    getStatsAndHistogram,
    stats,
    processingError,
  } = useImageProcessing();

  const { isExporting, exportImage, shareImage, saveImage, printImage, printToPdf } = useExport();
  const { generateThumbnail } = useThumbnail();

  const [showControls, setShowControls] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const prevPixelsRef = useRef<Float32Array | null>(null);
  const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });
  const canvasRef = useRef<FitsCanvasHandle>(null);

  const toggleFavorite = useFitsStore((s) => s.toggleFavorite);

  const navigateTo = useCallback(
    (fileId: string) => {
      router.replace(`/viewer/${fileId}`);
    },
    [router],
  );

  // --- Export handlers ---
  const handleExport = useCallback(
    async (quality: number) => {
      if (!rgbaData || !dimensions) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const path = await exportImage(
        rgbaData,
        dimensions.width,
        dimensions.height,
        file?.filename ?? "fits",
        exportFormat,
        quality,
      );
      if (path) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("common.success"), t("viewer.exportSuccess"));
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      setShowExport(false);
    },
    [rgbaData, dimensions, exportImage, file?.filename, exportFormat, t],
  );

  const handleShare = useCallback(
    async (quality: number) => {
      if (!rgbaData || !dimensions) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      try {
        await shareImage(
          rgbaData,
          dimensions.width,
          dimensions.height,
          file?.filename ?? "fits",
          exportFormat,
          quality,
        );
      } catch {
        Alert.alert(t("common.error"), t("share.failed"));
      }
      setShowExport(false);
    },
    [rgbaData, dimensions, shareImage, file?.filename, exportFormat, t],
  );

  const handleSaveToDevice = useCallback(
    async (quality: number) => {
      if (!rgbaData || !dimensions) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const uri = await saveImage(
        rgbaData,
        dimensions.width,
        dimensions.height,
        file?.filename ?? "fits",
        exportFormat,
        quality,
      );
      if (uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(t("common.success"), t("viewer.savedToDevice"));
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      setShowExport(false);
    },
    [rgbaData, dimensions, saveImage, file?.filename, exportFormat, t],
  );

  const handlePrint = useCallback(async () => {
    if (!rgbaData || !dimensions) {
      Alert.alert(t("common.error"), t("viewer.noImageData"));
      return;
    }
    try {
      await printImage(rgbaData, dimensions.width, dimensions.height, file?.filename ?? "fits");
    } catch {
      Alert.alert(t("common.error"), t("viewer.printFailed"));
    }
    setShowExport(false);
  }, [rgbaData, dimensions, printImage, file?.filename, t]);

  const handlePrintToPdf = useCallback(async () => {
    if (!rgbaData || !dimensions) {
      Alert.alert(t("common.error"), t("viewer.noImageData"));
      return;
    }
    try {
      await printToPdf(rgbaData, dimensions.width, dimensions.height, file?.filename ?? "fits");
    } catch {
      Alert.alert(t("common.error"), t("viewer.printFailed"));
    }
    setShowExport(false);
  }, [rgbaData, dimensions, printToPdf, file?.filename, t]);

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
    setStretch("asinh");
  }, [pixels, setBlackPoint, setWhitePoint, setStretch]);

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
      );
    }, 150);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixels, dimensions, stretch, colormap, blackPoint, whitePoint, gamma]);

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

  return (
    <View className="flex-1 bg-background">
      <LoadingOverlay visible={isFitsLoading || isExporting} message={t("common.loading")} />

      {/* Top Bar */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-2">
        <View className="flex-row gap-1">
          <Button size="sm" variant="outline" onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={16} color={mutedColor} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            isDisabled={!prevId}
            onPress={() => prevId && navigateTo(prevId)}
          >
            <Ionicons name="chevron-back" size={14} color={prevId ? mutedColor : "#555"} />
          </Button>
          <Button
            size="sm"
            variant="outline"
            isDisabled={!nextId}
            onPress={() => nextId && navigateTo(nextId)}
          >
            <Ionicons name="chevron-forward" size={14} color={nextId ? mutedColor : "#555"} />
          </Button>
        </View>
        <Text
          className="flex-1 mx-2 text-sm font-semibold text-foreground text-center"
          numberOfLines={1}
        >
          {file.filename}
        </Text>
        <View className="flex-row gap-1">
          <Button size="sm" variant="outline" onPress={() => file && toggleFavorite(file.id)}>
            <Ionicons
              name={file.isFavorite ? "heart" : "heart-outline"}
              size={14}
              color={file.isFavorite ? "#ef4444" : mutedColor}
            />
          </Button>
          <Button size="sm" variant="outline" onPress={() => router.push(`/header/${id}`)}>
            <Ionicons name="code-outline" size={14} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={() => router.push(`/editor/${id}`)}>
            <Ionicons name="create-outline" size={14} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={() => setShowExport(true)}>
            <Ionicons name="share-outline" size={14} color={mutedColor} />
          </Button>
          <Button size="sm" variant="outline" onPress={() => setShowControls(!showControls)}>
            <Ionicons
              name={showControls ? "chevron-down" : "chevron-up"}
              size={14}
              color={mutedColor}
            />
          </Button>
        </View>
      </View>

      {/* Canvas Area */}
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
          <View className="flex-1">
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
            />

            {/* Pixel Inspector */}
            <PixelInspector x={cursorX} y={cursorY} value={pixelValue} visible={showPixelInfo} />

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

            {/* Stats overlay */}
            {stats && (
              <View className="absolute top-2 left-2 bg-black/60 rounded-md px-2 py-1">
                <Text className="text-[9px] text-neutral-300">
                  {dimensions.width}×{dimensions.height}
                  {dimensions.isDataCube && ` ×${dimensions.depth}f`}
                </Text>
                <Text className="text-[9px] text-neutral-400">
                  Min:{stats.min.toFixed(1)} Max:{stats.max.toFixed(1)} μ:{stats.mean.toFixed(1)}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View className="flex-1 items-center justify-center">
            <Ionicons name="image-outline" size={80} color="#333" />
            <Text className="mt-4 text-sm text-neutral-500">{t("common.loading")}</Text>
          </View>
        )}
      </View>

      {/* Histogram */}
      {histogram && showControls && (
        <View className="px-3 py-2 bg-background">
          <FitsHistogram
            counts={histogram.counts}
            edges={histogram.edges}
            blackPoint={blackPoint}
            whitePoint={whitePoint}
            onBlackPointChange={setBlackPoint}
            onWhitePointChange={setWhitePoint}
          />
        </View>
      )}

      {/* File Info Chips */}
      <View className="flex-row flex-wrap gap-1 px-3 py-1 bg-background">
        {file.object && (
          <Chip size="sm" variant="primary">
            <Chip.Label className="text-[9px]">{file.object}</Chip.Label>
          </Chip>
        )}
        {file.filter && (
          <Chip size="sm" variant="secondary">
            <Chip.Label className="text-[9px]">{file.filter}</Chip.Label>
          </Chip>
        )}
        {file.exptime != null && (
          <Chip size="sm" variant="secondary">
            <Chip.Label className="text-[9px]">{file.exptime}s</Chip.Label>
          </Chip>
        )}
        {file.telescope && (
          <Chip size="sm" variant="secondary">
            <Chip.Label className="text-[9px]">{file.telescope}</Chip.Label>
          </Chip>
        )}
        {file.instrument && (
          <Chip size="sm" variant="secondary">
            <Chip.Label className="text-[9px]">{file.instrument}</Chip.Label>
          </Chip>
        )}
        {file.dateObs && (
          <Chip size="sm" variant="secondary">
            <Chip.Label className="text-[9px]">{file.dateObs}</Chip.Label>
          </Chip>
        )}
      </View>

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

      {/* Viewer Controls */}
      {showControls && (
        <ViewerControls
          stretch={stretch}
          colormap={colormap}
          blackPoint={blackPoint}
          whitePoint={whitePoint}
          gamma={gamma}
          showGrid={showGrid}
          showCrosshair={showCrosshair}
          showPixelInfo={showPixelInfo}
          showMinimap={showMinimap}
          currentFrame={currentFrame}
          totalFrames={totalFrames}
          isDataCube={dimensions?.isDataCube ?? false}
          onStretchChange={setStretch}
          onColormapChange={setColormap}
          onBlackPointChange={setBlackPoint}
          onWhitePointChange={setWhitePoint}
          onGammaChange={setGamma}
          onToggleGrid={toggleGrid}
          onToggleCrosshair={toggleCrosshair}
          onTogglePixelInfo={togglePixelInfo}
          onToggleMinimap={toggleMinimap}
          onFrameChange={handleFrameChange}
          onAutoStretch={handleAutoStretch}
        />
      )}
    </View>
  );
}
