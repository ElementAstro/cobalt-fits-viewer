import { View, Text, ScrollView, Alert } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import * as Haptics from "expo-haptics";
import { useState, useCallback, useEffect } from "react";
import { Button, Card, PressableFeedback, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/useFitsStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageEditor } from "../../hooks/useImageEditor";
import { useExport } from "../../hooks/useExport";
import { FitsCanvas } from "../../components/fits/FitsCanvas";
import { CropOverlay } from "../../components/fits/CropOverlay";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { ExportDialog } from "../../components/common/ExportDialog";
import type { ExportFormat } from "../../lib/fits/types";
import type { ImageEditOperation } from "../../lib/utils/imageOperations";
import { detectStars, type DetectedStar } from "../../lib/stacking/starDetection";

type EditorTool =
  | "crop"
  | "rotate"
  | "flip"
  | "invert"
  | "blur"
  | "sharpen"
  | "denoise"
  | "histogram"
  | "brightness"
  | "contrast"
  | "gamma"
  | "levels"
  | "background"
  | "rotateCustom"
  | null;

const EDITOR_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "crop", icon: "crop-outline" },
  { key: "rotate", icon: "refresh-outline" },
  { key: "flip", icon: "swap-horizontal-outline" },
  { key: "invert", icon: "contrast-outline" },
  { key: "brightness", icon: "sunny-outline" },
  { key: "contrast", icon: "options-outline" },
  { key: "gamma", icon: "pulse-outline" },
  { key: "levels", icon: "analytics-outline" },
  { key: "blur", icon: "water-outline" },
  { key: "sharpen", icon: "sparkles-outline" },
  { key: "denoise", icon: "layers-outline" },
  { key: "histogram", icon: "bar-chart-outline" },
  { key: "background", icon: "globe-outline" },
  { key: "rotateCustom", icon: "sync-outline" },
];

const ADVANCED_TOOLS: { key: string; icon: keyof typeof Ionicons.glyphMap; route?: string }[] = [
  { key: "calibration", icon: "flask-outline" },
  { key: "stacking", icon: "copy-outline", route: "/stacking" },
  { key: "compose", icon: "color-palette-outline", route: "/compose" },
  { key: "statistics", icon: "stats-chart-outline" },
  { key: "starDetect", icon: "star-outline" },
];

export default function EditorDetailScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const { pixels, dimensions, isLoading: fitsLoading, loadFromPath } = useFitsFile();
  const editor = useImageEditor();
  const { isExporting, exportImage, shareImage, saveImage } = useExport();

  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [activeTool, setActiveTool] = useState<EditorTool>(null);
  const [blurSigma, setBlurSigma] = useState(2.0);
  const [sharpenAmount, setSharpenAmount] = useState(1.5);
  const [sharpenSigma, setSharpenSigma] = useState(1.0);
  const [denoiseRadius, setDenoiseRadius] = useState(1);
  const [brightnessAmount, setBrightnessAmount] = useState(0);
  const [contrastFactor, setContrastFactor] = useState(1.0);
  const [gammaValue, setGammaValue] = useState(1.0);
  const [levelsInputBlack, setLevelsInputBlack] = useState(0);
  const [levelsInputWhite, setLevelsInputWhite] = useState(1);
  const [levelsGamma, setLevelsGamma] = useState(1.0);
  const [showCrop, setShowCrop] = useState(false);
  const [bgGridSize, setBgGridSize] = useState(8);
  const [rotateAngle, setRotateAngle] = useState(0);
  const [canvasLayout, setCanvasLayout] = useState({ width: 0, height: 0 });
  const [detectedStars, setDetectedStars] = useState<DetectedStar[]>([]);

  // Load FITS file
  useEffect(() => {
    if (file?.filepath) {
      loadFromPath(file.filepath, file.filename, file.fileSize ?? 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.filepath]);

  // Initialize editor when pixels are ready
  useEffect(() => {
    if (pixels && dimensions) {
      editor.initialize(pixels, dimensions.width, dimensions.height, "linear", "grayscale");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pixels, dimensions]);

  const handleToolPress = useCallback((tool: EditorTool & string) => {
    Haptics.selectionAsync();
    setActiveTool((prev) => (prev === tool ? null : tool));
  }, []);

  const handleApply = useCallback(() => {
    if (!activeTool) return;

    let op: ImageEditOperation | null = null;

    switch (activeTool) {
      case "rotate":
        op = { type: "rotate90cw" };
        break;
      case "flip":
        op = { type: "flipH" };
        break;
      case "invert":
        op = { type: "invert" };
        break;
      case "blur":
        op = { type: "blur", sigma: blurSigma };
        break;
      case "sharpen":
        op = { type: "sharpen", amount: sharpenAmount, sigma: sharpenSigma };
        break;
      case "denoise":
        op = { type: "denoise", radius: denoiseRadius };
        break;
      case "histogram":
        op = { type: "histogramEq" };
        break;
      case "brightness":
        op = { type: "brightness", amount: brightnessAmount };
        break;
      case "contrast":
        op = { type: "contrast", factor: contrastFactor };
        break;
      case "gamma":
        op = { type: "gamma", gamma: gammaValue };
        break;
      case "levels":
        op = {
          type: "levels",
          inputBlack: levelsInputBlack,
          inputWhite: levelsInputWhite,
          gamma: levelsGamma,
          outputBlack: 0,
          outputWhite: 1,
        };
        break;
      case "background":
        op = { type: "backgroundExtract", gridSize: bgGridSize };
        break;
      case "rotateCustom":
        op = { type: "rotateArbitrary", angle: rotateAngle };
        break;
      case "crop":
        setShowCrop(true);
        return;
    }

    if (op) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      editor.applyEdit(op);
    }
    setActiveTool(null);
  }, [
    activeTool,
    blurSigma,
    sharpenAmount,
    sharpenSigma,
    denoiseRadius,
    brightnessAmount,
    contrastFactor,
    gammaValue,
    levelsInputBlack,
    levelsInputWhite,
    levelsGamma,
    bgGridSize,
    rotateAngle,
    editor,
  ]);

  const handleQuickAction = useCallback(
    (op: ImageEditOperation) => {
      editor.applyEdit(op);
    },
    [editor],
  );

  const handleEditorExport = useCallback(
    async (quality: number) => {
      if (!editor.rgbaData || !editor.current) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const path = await exportImage(
        editor.rgbaData,
        editor.current.width,
        editor.current.height,
        file?.filename ?? "edited",
        exportFormat,
        quality,
      );
      if (path) {
        Alert.alert(t("common.success"), t("viewer.exportSuccess"));
      } else {
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      setShowExport(false);
    },
    [editor.rgbaData, editor.current, exportImage, file?.filename, exportFormat, t],
  );

  const handleEditorShare = useCallback(
    async (quality: number) => {
      if (!editor.rgbaData || !editor.current) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      try {
        await shareImage(
          editor.rgbaData,
          editor.current.width,
          editor.current.height,
          file?.filename ?? "edited",
          exportFormat,
          quality,
        );
      } catch {
        Alert.alert(t("common.error"), t("share.failed"));
      }
      setShowExport(false);
    },
    [editor.rgbaData, editor.current, shareImage, file?.filename, exportFormat, t],
  );

  const handleEditorSave = useCallback(
    async (quality: number) => {
      if (!editor.rgbaData || !editor.current) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const uri = await saveImage(
        editor.rgbaData,
        editor.current.width,
        editor.current.height,
        file?.filename ?? "edited",
        exportFormat,
        quality,
      );
      if (uri) {
        Alert.alert(t("common.success"), t("viewer.savedToDevice"));
      } else {
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      setShowExport(false);
    },
    [editor.rgbaData, editor.current, saveImage, file?.filename, exportFormat, t],
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

  const isLoading = fitsLoading || editor.isProcessing;

  return (
    <View className="flex-1 bg-background">
      {/* Top Bar */}
      <View className="flex-row items-center justify-between px-4 pt-14 pb-2">
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <Text
          className="flex-1 mx-2 text-sm font-semibold text-foreground text-center"
          numberOfLines={1}
        >
          {t("editor.title")} - {file.filename}
        </Text>
        <View className="flex-row gap-1">
          <Button size="sm" variant="outline" onPress={editor.undo} isDisabled={!editor.canUndo}>
            <Ionicons
              name="arrow-undo-outline"
              size={14}
              color={editor.canUndo ? successColor : mutedColor}
            />
          </Button>
          <Button size="sm" variant="outline" onPress={editor.redo} isDisabled={!editor.canRedo}>
            <Ionicons
              name="arrow-redo-outline"
              size={14}
              color={editor.canRedo ? successColor : mutedColor}
            />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={() => setShowExport(true)}
            isDisabled={!editor.rgbaData}
          >
            <Ionicons
              name="share-outline"
              size={14}
              color={editor.rgbaData ? successColor : mutedColor}
            />
          </Button>
        </View>
      </View>

      {/* Canvas Area */}
      <View className="flex-1 bg-black">
        {isLoading && !editor.rgbaData ? (
          <View className="flex-1 items-center justify-center">
            <Spinner size="lg" color={successColor} />
            <Text className="mt-4 text-sm text-neutral-500">
              {fitsLoading ? "Loading FITS..." : "Processing..."}
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
              rgbaData={editor.rgbaData}
              width={editor.current.width}
              height={editor.current.height}
              showGrid={false}
              showCrosshair={false}
              cursorX={-1}
              cursorY={-1}
            />
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
        {activeTool && (
          <View className="absolute bottom-4 left-4 right-4">
            <Card variant="secondary">
              <Card.Body className="p-3">
                <View className="flex-row items-center justify-between mb-2">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="construct-outline" size={14} color={successColor} />
                    <Text className="text-xs font-semibold text-success capitalize">
                      {activeTool}
                    </Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Button size="sm" variant="outline" onPress={() => setActiveTool(null)}>
                      <Button.Label className="text-[10px]">{t("common.cancel")}</Button.Label>
                    </Button>
                    <Button size="sm" variant="primary" onPress={handleApply}>
                      <Button.Label className="text-[10px]">{t("editor.apply")}</Button.Label>
                    </Button>
                  </View>
                </View>

                {/* Tool-specific parameters */}
                {activeTool === "blur" && (
                  <SimpleSlider
                    label="Sigma"
                    value={blurSigma}
                    min={0.5}
                    max={10}
                    step={0.5}
                    onValueChange={setBlurSigma}
                  />
                )}
                {activeTool === "sharpen" && (
                  <View>
                    <SimpleSlider
                      label="Amount"
                      value={sharpenAmount}
                      min={0.5}
                      max={5}
                      step={0.1}
                      onValueChange={setSharpenAmount}
                    />
                    <SimpleSlider
                      label="Sigma"
                      value={sharpenSigma}
                      min={0.5}
                      max={5}
                      step={0.5}
                      onValueChange={setSharpenSigma}
                    />
                  </View>
                )}
                {activeTool === "denoise" && (
                  <SimpleSlider
                    label="Radius"
                    value={denoiseRadius}
                    min={1}
                    max={5}
                    step={1}
                    onValueChange={(v) => setDenoiseRadius(Math.round(v))}
                  />
                )}
                {activeTool === "brightness" && (
                  <SimpleSlider
                    label="Amount"
                    value={brightnessAmount}
                    min={-0.5}
                    max={0.5}
                    step={0.01}
                    onValueChange={setBrightnessAmount}
                  />
                )}
                {activeTool === "contrast" && (
                  <SimpleSlider
                    label="Factor"
                    value={contrastFactor}
                    min={0.2}
                    max={3.0}
                    step={0.1}
                    onValueChange={setContrastFactor}
                  />
                )}
                {activeTool === "gamma" && (
                  <SimpleSlider
                    label="Gamma"
                    value={gammaValue}
                    min={0.1}
                    max={5.0}
                    step={0.1}
                    onValueChange={setGammaValue}
                  />
                )}
                {activeTool === "levels" && (
                  <View>
                    <SimpleSlider
                      label="Input Black"
                      value={levelsInputBlack}
                      min={0}
                      max={0.5}
                      step={0.01}
                      onValueChange={setLevelsInputBlack}
                    />
                    <SimpleSlider
                      label="Input White"
                      value={levelsInputWhite}
                      min={0.5}
                      max={1}
                      step={0.01}
                      onValueChange={setLevelsInputWhite}
                    />
                    <SimpleSlider
                      label="Gamma"
                      value={levelsGamma}
                      min={0.1}
                      max={5.0}
                      step={0.1}
                      onValueChange={setLevelsGamma}
                    />
                  </View>
                )}

                {activeTool === "background" && (
                  <SimpleSlider
                    label="Grid Size"
                    value={bgGridSize}
                    min={4}
                    max={16}
                    step={1}
                    onValueChange={(v) => setBgGridSize(Math.round(v))}
                  />
                )}
                {activeTool === "rotateCustom" && (
                  <SimpleSlider
                    label="Angle (°)"
                    value={rotateAngle}
                    min={-180}
                    max={180}
                    step={0.5}
                    onValueChange={setRotateAngle}
                  />
                )}

                {/* Quick actions for rotate/flip */}
                {activeTool === "rotate" && (
                  <View className="flex-row gap-2 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "rotate90cw" })}
                    >
                      <Button.Label className="text-[9px]">90° CW</Button.Label>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "rotate90ccw" })}
                    >
                      <Button.Label className="text-[9px]">90° CCW</Button.Label>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "rotate180" })}
                    >
                      <Button.Label className="text-[9px]">180°</Button.Label>
                    </Button>
                  </View>
                )}
                {activeTool === "flip" && (
                  <View className="flex-row gap-2 mt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "flipH" })}
                    >
                      <Button.Label className="text-[9px]">Horizontal</Button.Label>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "flipV" })}
                    >
                      <Button.Label className="text-[9px]">Vertical</Button.Label>
                    </Button>
                  </View>
                )}
              </Card.Body>
            </Card>
          </View>
        )}

        {/* Processing indicator overlay */}
        {editor.isProcessing && (
          <View className="absolute inset-0 items-center justify-center bg-black/50">
            <Spinner size="sm" color={successColor} />
            <Text className="mt-2 text-xs text-white">Processing...</Text>
          </View>
        )}
      </View>

      {/* History indicator */}
      {editor.historyLength > 1 && (
        <View className="flex-row items-center gap-1 px-3 py-1 bg-background">
          <Ionicons name="time-outline" size={10} color={mutedColor} />
          <Text className="text-[9px] text-muted">
            {editor.historyIndex}/{editor.historyLength - 1} edits
          </Text>
        </View>
      )}

      {/* Basic Tools */}
      <View className="border-t border-separator bg-background px-2 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-0.5">
            {EDITOR_TOOLS.map((tool) => {
              const isActive = activeTool === tool.key;
              return (
                <PressableFeedback key={tool.key} onPress={() => handleToolPress(tool.key)}>
                  <View
                    className={`items-center justify-center px-3 py-2 rounded-lg ${isActive ? "bg-success/10" : ""}`}
                  >
                    <Ionicons
                      name={tool.icon}
                      size={20}
                      color={isActive ? successColor : mutedColor}
                    />
                    <Text
                      className={`mt-1 text-[9px] ${isActive ? "text-success font-semibold" : "text-muted"}`}
                    >
                      {t(`editor.${tool.key}` as any)}
                    </Text>
                  </View>
                </PressableFeedback>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Advanced Tools */}
      <View className="border-t border-separator bg-background px-2 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-0.5">
            {ADVANCED_TOOLS.map((tool) => (
              <PressableFeedback
                key={tool.key}
                onPress={() => {
                  if (tool.route) {
                    router.push(tool.route as any);
                  } else if (tool.key === "starDetect" && editor.current) {
                    const stars = detectStars(
                      editor.current.pixels,
                      editor.current.width,
                      editor.current.height,
                    );
                    setDetectedStars(stars);
                  } else {
                    handleToolPress(tool.key as any);
                  }
                }}
              >
                <View className="items-center justify-center px-3 py-2">
                  <Ionicons
                    name={tool.icon}
                    size={20}
                    color={
                      tool.key === "starDetect" && detectedStars.length > 0
                        ? successColor
                        : mutedColor
                    }
                  />
                  <Text
                    className={`mt-1 text-[9px] ${tool.key === "starDetect" && detectedStars.length > 0 ? "text-success font-semibold" : "text-muted"}`}
                  >
                    {tool.key === "starDetect" && detectedStars.length > 0
                      ? `${detectedStars.length} stars`
                      : t(`editor.${tool.key}` as any)}
                  </Text>
                </View>
              </PressableFeedback>
            ))}
          </View>
        </ScrollView>
      </View>

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
