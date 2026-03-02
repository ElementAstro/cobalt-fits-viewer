import { View, Text, Alert } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useI18n, type TranslationKey } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useShallow } from "zustand/shallow";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageEditor } from "../../hooks/useImageEditor";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useEditorToolState } from "../../hooks/useEditorToolState";
import { useEditorStarAnnotation } from "../../hooks/useEditorStarAnnotation";
import { useEditorExport } from "../../hooks/useEditorExport";
import { useEditorHotkeys } from "../../hooks/useEditorHotkeys";
import {
  FitsCanvas,
  type CanvasTransform,
  type FitsCanvasHandle,
} from "../../components/fits/FitsCanvas";
import { CropOverlay } from "../../components/fits/CropOverlay";
import { StarAnnotationOverlay } from "../../components/fits/StarAnnotationOverlay";
import { ZoomControls } from "../../components/fits/ZoomControls";
import { PixelInspector } from "../../components/fits/PixelInspector";
import { Minimap } from "../../components/fits/Minimap";
import { HistogramLevels } from "../../components/fits/HistogramLevels";
import { EditorHeader } from "../../components/editor/EditorHeader";
import { EditorToolBar } from "../../components/editor/EditorToolBar";
import { EditorToolParamPanel } from "../../components/editor/EditorToolParamPanel";
import { StarAnnotationPanel } from "../../components/editor/StarAnnotationPanel";
import { RecipePipelinePanel } from "../../components/editor/RecipePipelinePanel";
import { ExportDialog } from "../../components/common/ExportDialog";
import type { ProcessingPipelineSnapshot } from "../../lib/fits/types";
import type { ImageEditOperation } from "../../lib/utils/imageOperations";
import { isVideoFile } from "../../lib/media/routing";
import { calculateHistogram, calculateStats } from "../../lib/utils/pixelMath";
import { resolveComparePair } from "../../lib/viewer/compareRouting";

const EMPTY_TRANSFORM: CanvasTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  canvasWidth: 0,
  canvasHeight: 0,
};

export default function EditorDetailScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const allFiles = useFitsStore((s) => s.files);
  const updateFile = useFitsStore((s) => s.updateFile);
  const isVideo = file ? isVideoFile(file) : false;
  const compareIds = useMemo(
    () => (file?.id ? resolveComparePair(file.id, allFiles, file.derivedFromId) : []),
    [allFiles, file?.derivedFromId, file?.id],
  );
  const canCompare = compareIds.length >= 2;
  const editorSettings = useSettingsStore(
    useShallow((s) => ({
      defaultBlurSigma: s.defaultBlurSigma,
      defaultSharpenAmount: s.defaultSharpenAmount,
      defaultDenoiseRadius: s.defaultDenoiseRadius,
      editorMaxUndo: s.editorMaxUndo,
      imageProcessingProfile: s.imageProcessingProfile,
      canvasMinScale: s.canvasMinScale,
      canvasMaxScale: s.canvasMaxScale,
      canvasDoubleTapScale: s.canvasDoubleTapScale,
      canvasPinchSensitivity: s.canvasPinchSensitivity,
      canvasPinchOverzoomFactor: s.canvasPinchOverzoomFactor,
      canvasPanRubberBandFactor: s.canvasPanRubberBandFactor,
      canvasWheelZoomSensitivity: s.canvasWheelZoomSensitivity,
    })),
  );
  const {
    pixels,
    dimensions,
    isLoading: fitsLoading,
    error: fitsError,
    loadFromPath,
  } = useFitsFile();
  const handleEditorOperationRef = useRef<
    ((event: import("../../hooks/useImageEditor").EditorOperationEvent) => void) | null
  >(null);
  const handleRecipeChange = useCallback(
    (nextRecipe: ProcessingPipelineSnapshot) => {
      if (!file?.id) return;
      updateFile(file.id, { editorRecipe: nextRecipe });
    },
    [file?.id, updateFile],
  );
  const editor = useImageEditor({
    maxHistory: editorSettings.editorMaxUndo,
    profile: editorSettings.imageProcessingProfile,
    onRecipeChange: handleRecipeChange,
    onOperation: (event) => {
      handleEditorOperationRef.current?.(event);
    },
  });
  const haptics = useHapticFeedback();

  const canvasRef = useRef<FitsCanvasHandle>(null);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showPixelInfo, setShowPixelInfo] = useState(false);
  const [showMinimap, setShowMinimap] = useState(false);
  const [cursorX, setCursorX] = useState(-1);
  const [cursorY, setCursorY] = useState(-1);
  const [showHistogram, setShowHistogram] = useState(false);
  const [showPipeline, setShowPipeline] = useState(false);

  const editorCurrent = editor.current;
  const histogramData = useMemo(() => {
    if (!editorCurrent) return null;
    const stats = calculateStats(editorCurrent.pixels);
    const range = { min: stats.min, max: stats.max };
    const hist = calculateHistogram(editorCurrent.pixels, 256, range);
    return { counts: hist.counts, edges: hist.edges };
  }, [editorCurrent]);

  const toolState = useEditorToolState({
    blurSigma: editorSettings.defaultBlurSigma,
    sharpenAmount: editorSettings.defaultSharpenAmount,
    denoiseRadius: editorSettings.defaultDenoiseRadius,
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
    resetToolParams,
  } = toolState;
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });
  const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>(EMPTY_TRANSFORM);
  const starAnnotation = useEditorStarAnnotation({
    fileId: file?.id,
    editorCurrent: editor.current,
    editorHistoryIndex: editor.historyIndex,
    dimensions,
    updateFile,
    starAnnotations: file?.starAnnotations,
  });
  const {
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
  } = starAnnotation;

  // Load FITS file
  useEffect(() => {
    if (file?.filepath) {
      loadFromPath(file.filepath, file.filename, file.fileSize ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.filepath]);

  useEffect(() => {
    if (!id || !isVideo) return;
    router.replace(`/video/${id}`);
  }, [id, isVideo, router]);

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
    editor.setProfile(editorSettings.imageProcessingProfile);
  }, [editor, editorSettings.imageProcessingProfile]);

  useEffect(() => {
    handleEditorOperationRef.current = handleEditorOperation;
    return () => {
      handleEditorOperationRef.current = null;
    };
  }, [handleEditorOperation]);

  // Unsaved changes guard
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (editor.historyLength <= 1) return;
      e.preventDefault();
      Alert.alert(
        t("editor.unsavedChangesTitle" as TranslationKey),
        t("editor.unsavedChangesMessage" as TranslationKey),
        [
          {
            text: t("editor.keepEditing" as TranslationKey),
            style: "cancel",
          },
          {
            text: t("editor.discardChanges" as TranslationKey),
            style: "destructive",
            onPress: () => navigation.dispatch(e.data.action),
          },
        ],
      );
    });
    return unsubscribe;
  }, [navigation, editor.historyLength, t]);

  const handlePixelTap = useCallback(
    (x: number, y: number) => {
      setCursorX(x);
      setCursorY(y);
      handleStarPointTap(x, y);
    },
    [handleStarPointTap],
  );

  const handleToolPress = useCallback(
    (tool: string) => {
      haptics.selection();
      if (tool === "histogram") {
        setShowHistogram((prev) => !prev);
        return;
      }
      if (tool === "pipeline") {
        setShowPipeline((prev) => !prev);
        return;
      }
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
      if (editor.isPreviewActive) {
        editor.commitPreview(op);
      } else {
        editor.applyEdit(op);
      }
    }
    setActiveTool(null);
  }, [activeTool, buildOperation, editor, haptics, setActiveTool, setShowCrop]);

  const handleCancelTool = useCallback(() => {
    editor.cancelPreview();
    setActiveTool(null);
  }, [editor, setActiveTool]);

  useEditorHotkeys({
    onUndo: editor.undo,
    onRedo: editor.redo,
    onCancelTool: handleCancelTool,
    onToggleOriginal: () => setShowOriginal((prev) => !prev),
    onToggleHistogram: () => setShowHistogram((prev) => !prev),
    onTogglePixelInfo: () => setShowPixelInfo((prev) => !prev),
    onToggleMinimap: () => setShowMinimap((prev) => !prev),
    onResetView: () => canvasRef.current?.setTransform(0, 0, 1),
  });

  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, []);
  const handleParamPreview = useCallback(
    (op: ImageEditOperation | null) => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
        previewTimerRef.current = null;
      }
      if (!op) return;
      previewTimerRef.current = setTimeout(() => {
        editor.previewEdit(op);
        previewTimerRef.current = null;
      }, 300);
    },
    [editor],
  );

  const handleQuickAction = useCallback(
    (op: ImageEditOperation) => {
      editor.cancelPreview();
      editor.applyEdit(op);
    },
    [editor],
  );

  const editorExport = useEditorExport({
    editorData:
      editor.rgbaData && editor.current
        ? { rgbaData: editor.rgbaData, current: editor.current }
        : null,
    fileInfo: file
      ? {
          filename: file.filename,
          id: file.id,
          sourceType: file.sourceType,
          sourceFormat: file.sourceFormat,
        }
      : null,
    starPoints,
  });
  const {
    showExport,
    setShowExport,
    exportFormat,
    setExportFormat,
    isExporting,
    handleEditorExport,
    handleEditorShare,
    handleEditorSave,
  } = editorExport;

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

  if (isVideo) {
    return (
      <View className="flex-1 items-center justify-center bg-background px-6">
        <Ionicons name="videocam-outline" size={48} color={mutedColor} />
        <Text className="mt-4 text-center text-sm text-muted">
          {t("editor.videoRedirectMessage" as TranslationKey)}
        </Text>
        <Button variant="primary" className="mt-4" onPress={() => router.replace(`/video/${id}`)}>
          <Button.Label>{t("editor.openVideoWorkspace" as TranslationKey)}</Button.Label>
        </Button>
      </View>
    );
  }

  const isLoading = fitsLoading || editor.isProcessing;

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
        canCompare={canCompare}
        onCompare={() => {
          if (compareIds.length < 2) return;
          router.push(`/compare?ids=${compareIds.join(",")}`);
        }}
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
              ref={canvasRef}
              rgbaData={
                showOriginal && editor.originalRgbaData ? editor.originalRgbaData : editor.rgbaData
              }
              width={editor.current.width}
              height={editor.current.height}
              sourceWidth={editor.current.width}
              sourceHeight={editor.current.height}
              showGrid={false}
              showCrosshair={false}
              cursorX={cursorX}
              cursorY={cursorY}
              onPixelTap={handlePixelTap}
              onPixelLongPress={handleStarPointLongPress}
              onTransformChange={setCanvasTransform}
              minScale={editorSettings.canvasMinScale}
              maxScale={editorSettings.canvasMaxScale}
              doubleTapScale={editorSettings.canvasDoubleTapScale}
              gestureConfig={{
                pinchSensitivity: editorSettings.canvasPinchSensitivity,
                pinchOverzoomFactor: editorSettings.canvasPinchOverzoomFactor,
                panRubberBandFactor: editorSettings.canvasPanRubberBandFactor,
                wheelZoomSensitivity: editorSettings.canvasWheelZoomSensitivity,
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

            {/* Pixel Inspector */}
            <PixelInspector
              x={cursorX}
              y={cursorY}
              value={
                editor.current && cursorX >= 0 && cursorY >= 0
                  ? (editor.current.pixels[cursorY * editor.current.width + cursorX] ?? null)
                  : null
              }
              visible={showPixelInfo && cursorX >= 0 && cursorY >= 0}
            />

            {/* Minimap */}
            <Minimap
              rgbaData={editor.rgbaData}
              imgWidth={editor.current.width}
              imgHeight={editor.current.height}
              visible={showMinimap}
              viewportScale={canvasTransform.scale}
              viewportTranslateX={canvasTransform.translateX}
              viewportTranslateY={canvasTransform.translateY}
              canvasWidth={canvasTransform.canvasWidth}
              canvasHeight={canvasTransform.canvasHeight}
            />

            {/* Zoom Controls */}
            <ZoomControls
              scale={canvasTransform.scale}
              translateX={canvasTransform.translateX}
              translateY={canvasTransform.translateY}
              canvasWidth={canvasTransform.canvasWidth}
              canvasHeight={canvasTransform.canvasHeight}
              imageWidth={editor.current.width}
              imageHeight={editor.current.height}
              onSetTransform={(tx, ty, s) => canvasRef.current?.setTransform(tx, ty, s)}
            />
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
          onCancel={handleCancelTool}
          onQuickAction={handleQuickAction}
          onReset={resetToolParams}
          onParamChange={handleParamPreview}
        />
        {showPipeline && (
          <RecipePipelinePanel
            recipe={editor.recipe}
            successColor={successColor}
            onToggleNode={editor.toggleNode}
            onRemoveNode={editor.removeNode}
            onClose={() => setShowPipeline(false)}
          />
        )}
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
            onClearAnchors={clearAnchors}
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

      {/* Histogram Panel */}
      {showHistogram && histogramData && (
        <View className="border-t border-separator bg-background px-3 py-2">
          <HistogramLevels counts={histogramData.counts} edges={histogramData.edges} height={80} />
        </View>
      )}

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
