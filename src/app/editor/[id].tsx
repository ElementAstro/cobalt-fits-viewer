import { View, Text } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useState, useCallback, useEffect, useRef } from "react";
import { Button, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n, type TranslationKey } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageEditor } from "../../hooks/useImageEditor";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
import { useEditorToolState } from "../../hooks/useEditorToolState";
import { useEditorStarAnnotation } from "../../hooks/useEditorStarAnnotation";
import { useEditorExport } from "../../hooks/useEditorExport";
import { FitsCanvas, type CanvasTransform } from "../../components/fits/FitsCanvas";
import { CropOverlay } from "../../components/fits/CropOverlay";
import { StarAnnotationOverlay } from "../../components/fits/StarAnnotationOverlay";
import { EditorHeader } from "../../components/editor/EditorHeader";
import { EditorToolBar } from "../../components/editor/EditorToolBar";
import { EditorToolParamPanel } from "../../components/editor/EditorToolParamPanel";
import { StarAnnotationPanel } from "../../components/editor/StarAnnotationPanel";
import { ExportDialog } from "../../components/common/ExportDialog";
import type { ProcessingPipelineSnapshot } from "../../lib/fits/types";
import type { ImageEditOperation } from "../../lib/utils/imageOperations";

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
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const updateFile = useFitsStore((s) => s.updateFile);
  const isVideoFile = file?.mediaKind === "video" || file?.sourceType === "video";
  const editorSettings = useSettingsStore((s) => ({
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
  }));
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

  const [showOriginal, setShowOriginal] = useState(false);
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
    editor.setProfile(editorSettings.imageProcessingProfile);
  }, [editor, editorSettings.imageProcessingProfile]);

  useEffect(() => {
    handleEditorOperationRef.current = handleEditorOperation;
    return () => {
      handleEditorOperationRef.current = null;
    };
  }, [handleEditorOperation]);

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

  if (isVideoFile) {
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
          onReset={resetToolParams}
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
