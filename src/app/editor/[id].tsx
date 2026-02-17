import { View, Text, ScrollView, Alert, TextInput } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useState, useCallback, useEffect } from "react";
import { Button, Card, PressableFeedback, Spinner, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageEditor } from "../../hooks/useImageEditor";
import { useExport } from "../../hooks/useExport";
import { useHapticFeedback } from "../../hooks/useHapticFeedback";
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
  | "mtf"
  | "curves"
  | "clahe"
  | "hdr"
  | "morphology"
  | "starMask"
  | "rangeMask"
  | "binarize"
  | "rescale"
  | "deconvolution"
  | "pixelMath"
  | null;

const GEOMETRY_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "crop", icon: "crop-outline" },
  { key: "rotate", icon: "refresh-outline" },
  { key: "flip", icon: "swap-horizontal-outline" },
  { key: "rotateCustom", icon: "sync-outline" },
];

const ADJUST_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "brightness", icon: "sunny-outline" },
  { key: "contrast", icon: "options-outline" },
  { key: "gamma", icon: "pulse-outline" },
  { key: "levels", icon: "analytics-outline" },
  { key: "curves", icon: "trending-up-outline" },
  { key: "mtf", icon: "color-wand-outline" },
  { key: "invert", icon: "contrast-outline" },
  { key: "histogram", icon: "bar-chart-outline" },
];

const PROCESS_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "blur", icon: "water-outline" },
  { key: "sharpen", icon: "sparkles-outline" },
  { key: "denoise", icon: "layers-outline" },
  { key: "clahe", icon: "grid-outline" },
  { key: "hdr", icon: "aperture-outline" },
  { key: "deconvolution", icon: "flashlight-outline" },
  { key: "morphology", icon: "shapes-outline" },
  { key: "background", icon: "globe-outline" },
];

const MASK_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "starMask", icon: "star-half-outline" },
  { key: "rangeMask", icon: "funnel-outline" },
  { key: "binarize", icon: "moon-outline" },
  { key: "rescale", icon: "resize-outline" },
  { key: "pixelMath", icon: "calculator-outline" },
];

const ADVANCED_TOOLS: { key: string; icon: keyof typeof Ionicons.glyphMap; route?: Href }[] = [
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
  type TranslationKey = Parameters<typeof t>[0];
  const [successColor, mutedColor] = useThemeColor(["success", "muted"]);
  const { contentPaddingTop, horizontalPadding } = useResponsiveLayout();

  const file = useFitsStore((s) => s.getFileById(id ?? ""));
  const defaultExportFormat = useSettingsStore((s) => s.defaultExportFormat);
  const defaultBlurSigma = useSettingsStore((s) => s.defaultBlurSigma);
  const defaultSharpenAmount = useSettingsStore((s) => s.defaultSharpenAmount);
  const defaultDenoiseRadius = useSettingsStore((s) => s.defaultDenoiseRadius);
  const editorMaxUndo = useSettingsStore((s) => s.editorMaxUndo);
  const { pixels, dimensions, isLoading: fitsLoading, loadFromPath } = useFitsFile();
  const editor = useImageEditor({ maxHistory: editorMaxUndo });
  const haptics = useHapticFeedback();
  const { isExporting, exportImage, shareImage, saveImage } = useExport();

  const [showExport, setShowExport] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>(defaultExportFormat);
  const [activeTool, setActiveTool] = useState<EditorTool>(null);
  const [blurSigma, setBlurSigma] = useState(defaultBlurSigma);
  const [sharpenAmount, setSharpenAmount] = useState(defaultSharpenAmount);
  const [sharpenSigma, setSharpenSigma] = useState(1.0);
  const [denoiseRadius, setDenoiseRadius] = useState(defaultDenoiseRadius);
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

  // New tool state
  const [mtfMidtone, setMtfMidtone] = useState(0.25);
  const [mtfShadows, setMtfShadows] = useState(0);
  const [mtfHighlights, setMtfHighlights] = useState(1);
  const [claheTileSize, setClaheTileSize] = useState(8);
  const [claheClipLimit, setClaheClipLimit] = useState(3.0);
  const [hdrLayers, setHdrLayers] = useState(5);
  const [hdrAmount, setHdrAmount] = useState(0.7);
  const [morphOp, setMorphOp] = useState<"erode" | "dilate" | "open" | "close">("dilate");
  const [morphRadius, setMorphRadius] = useState(1);
  const [starMaskScale, setStarMaskScale] = useState(1.5);
  const [starMaskInvert, setStarMaskInvert] = useState(false);
  const [rangeMaskLow, setRangeMaskLow] = useState(0);
  const [rangeMaskHigh, setRangeMaskHigh] = useState(1);
  const [rangeMaskFuzz, setRangeMaskFuzz] = useState(0.1);
  const [binarizeThreshold, setBinarizeThreshold] = useState(0.5);
  const [deconvPsfSigma, setDeconvPsfSigma] = useState(2.0);
  const [deconvIterations, setDeconvIterations] = useState(20);
  const [deconvRegularization, setDeconvRegularization] = useState(0.1);
  const [pixelMathExpr, setPixelMathExpr] = useState("$T");
  const [activeToolGroup, setActiveToolGroup] = useState<
    "geometry" | "adjust" | "process" | "mask"
  >("adjust");
  const [curvesPreset, setCurvesPreset] = useState<
    "linear" | "sCurve" | "brighten" | "darken" | "highContrast"
  >("sCurve");

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

  const handleToolPress = useCallback(
    (tool: EditorTool & string) => {
      haptics.selection();
      setActiveTool((prev) => (prev === tool ? null : tool));
    },
    [haptics],
  );

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
      case "mtf":
        op = {
          type: "mtf",
          midtone: mtfMidtone,
          shadowsClip: mtfShadows,
          highlightsClip: mtfHighlights,
        };
        break;
      case "clahe":
        op = { type: "clahe", tileSize: claheTileSize, clipLimit: claheClipLimit };
        break;
      case "curves": {
        const CURVE_PRESETS: Record<string, { x: number; y: number }[]> = {
          linear: [
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ],
          sCurve: [
            { x: 0, y: 0 },
            { x: 0.25, y: 0.15 },
            { x: 0.5, y: 0.5 },
            { x: 0.75, y: 0.85 },
            { x: 1, y: 1 },
          ],
          brighten: [
            { x: 0, y: 0 },
            { x: 0.25, y: 0.35 },
            { x: 0.5, y: 0.65 },
            { x: 0.75, y: 0.85 },
            { x: 1, y: 1 },
          ],
          darken: [
            { x: 0, y: 0 },
            { x: 0.25, y: 0.15 },
            { x: 0.5, y: 0.35 },
            { x: 0.75, y: 0.65 },
            { x: 1, y: 1 },
          ],
          highContrast: [
            { x: 0, y: 0 },
            { x: 0.2, y: 0.05 },
            { x: 0.5, y: 0.5 },
            { x: 0.8, y: 0.95 },
            { x: 1, y: 1 },
          ],
        };
        op = { type: "curves", points: CURVE_PRESETS[curvesPreset] ?? CURVE_PRESETS.sCurve };
        break;
      }
      case "hdr":
        op = { type: "hdr", layers: hdrLayers, amount: hdrAmount };
        break;
      case "morphology":
        op = { type: "morphology", operation: morphOp, radius: morphRadius };
        break;
      case "starMask":
        op = { type: "starMask", scale: starMaskScale, invert: starMaskInvert };
        break;
      case "rangeMask":
        op = {
          type: "rangeMask",
          low: rangeMaskLow,
          high: rangeMaskHigh,
          fuzziness: rangeMaskFuzz,
        };
        break;
      case "binarize":
        op = { type: "binarize", threshold: binarizeThreshold };
        break;
      case "rescale":
        op = { type: "rescale" };
        break;
      case "deconvolution":
        op = {
          type: "deconvolution",
          psfSigma: deconvPsfSigma,
          iterations: deconvIterations,
          regularization: deconvRegularization,
        };
        break;
      case "pixelMath":
        op = { type: "pixelMath", expression: pixelMathExpr };
        break;
    }

    if (op) {
      haptics.impact();
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
    mtfMidtone,
    mtfShadows,
    mtfHighlights,
    claheTileSize,
    claheClipLimit,
    hdrLayers,
    hdrAmount,
    morphOp,
    morphRadius,
    starMaskScale,
    starMaskInvert,
    rangeMaskLow,
    rangeMaskHigh,
    rangeMaskFuzz,
    binarizeThreshold,
    deconvPsfSigma,
    deconvIterations,
    deconvRegularization,
    pixelMathExpr,
    curvesPreset,
    haptics,
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
    [editor, exportImage, file?.filename, exportFormat, t],
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
    [editor, shareImage, file?.filename, exportFormat, t],
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
    [editor, saveImage, file?.filename, exportFormat, t],
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
      <View
        className="flex-row items-center justify-between pb-2"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
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
              interactionEnabled={!showCrop}
              wheelZoomEnabled
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

                {/* Curves preset selector */}
                {activeTool === "curves" && (
                  <View className="flex-row flex-wrap gap-1">
                    {[
                      { key: "linear" as const, label: "Linear" },
                      { key: "sCurve" as const, label: "S-Curve" },
                      { key: "brighten" as const, label: "Brighten" },
                      { key: "darken" as const, label: "Darken" },
                      { key: "highContrast" as const, label: "High Contrast" },
                    ].map((p) => (
                      <Button
                        key={p.key}
                        size="sm"
                        variant={curvesPreset === p.key ? "primary" : "outline"}
                        onPress={() => setCurvesPreset(p.key)}
                      >
                        <Button.Label className="text-[9px]">{p.label}</Button.Label>
                      </Button>
                    ))}
                  </View>
                )}

                {/* MTF parameters */}
                {activeTool === "mtf" && (
                  <View>
                    <SimpleSlider
                      label="Midtone"
                      value={mtfMidtone}
                      min={0.01}
                      max={0.99}
                      step={0.01}
                      onValueChange={setMtfMidtone}
                    />
                    <SimpleSlider
                      label="Shadows Clip"
                      value={mtfShadows}
                      min={0}
                      max={0.5}
                      step={0.01}
                      onValueChange={setMtfShadows}
                    />
                    <SimpleSlider
                      label="Highlights Clip"
                      value={mtfHighlights}
                      min={0.5}
                      max={1}
                      step={0.01}
                      onValueChange={setMtfHighlights}
                    />
                  </View>
                )}

                {/* CLAHE parameters */}
                {activeTool === "clahe" && (
                  <View>
                    <SimpleSlider
                      label="Tile Size"
                      value={claheTileSize}
                      min={4}
                      max={16}
                      step={1}
                      onValueChange={(v) => setClaheTileSize(Math.round(v))}
                    />
                    <SimpleSlider
                      label="Clip Limit"
                      value={claheClipLimit}
                      min={1.0}
                      max={10.0}
                      step={0.5}
                      onValueChange={setClaheClipLimit}
                    />
                  </View>
                )}

                {/* HDR parameters */}
                {activeTool === "hdr" && (
                  <View>
                    <SimpleSlider
                      label="Layers"
                      value={hdrLayers}
                      min={3}
                      max={8}
                      step={1}
                      onValueChange={(v) => setHdrLayers(Math.round(v))}
                    />
                    <SimpleSlider
                      label="Amount"
                      value={hdrAmount}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={setHdrAmount}
                    />
                  </View>
                )}

                {/* Morphology parameters */}
                {activeTool === "morphology" && (
                  <View>
                    <View className="flex-row gap-1 mb-2">
                      {(["erode", "dilate", "open", "close"] as const).map((op) => (
                        <Button
                          key={op}
                          size="sm"
                          variant={morphOp === op ? "primary" : "outline"}
                          onPress={() => setMorphOp(op)}
                        >
                          <Button.Label className="text-[9px] capitalize">{op}</Button.Label>
                        </Button>
                      ))}
                    </View>
                    <SimpleSlider
                      label="Radius"
                      value={morphRadius}
                      min={1}
                      max={5}
                      step={1}
                      onValueChange={(v) => setMorphRadius(Math.round(v))}
                    />
                  </View>
                )}

                {/* StarMask parameters */}
                {activeTool === "starMask" && (
                  <View>
                    <SimpleSlider
                      label="Scale"
                      value={starMaskScale}
                      min={0.5}
                      max={4.0}
                      step={0.1}
                      onValueChange={setStarMaskScale}
                    />
                    <View className="flex-row gap-2 mt-1">
                      <Button
                        size="sm"
                        variant={!starMaskInvert ? "primary" : "outline"}
                        onPress={() => setStarMaskInvert(false)}
                      >
                        <Button.Label className="text-[9px]">Isolate Stars</Button.Label>
                      </Button>
                      <Button
                        size="sm"
                        variant={starMaskInvert ? "primary" : "outline"}
                        onPress={() => setStarMaskInvert(true)}
                      >
                        <Button.Label className="text-[9px]">Remove Stars</Button.Label>
                      </Button>
                    </View>
                  </View>
                )}

                {/* RangeMask parameters */}
                {activeTool === "rangeMask" && (
                  <View>
                    <SimpleSlider
                      label="Low Bound"
                      value={rangeMaskLow}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={setRangeMaskLow}
                    />
                    <SimpleSlider
                      label="High Bound"
                      value={rangeMaskHigh}
                      min={0}
                      max={1}
                      step={0.01}
                      onValueChange={setRangeMaskHigh}
                    />
                    <SimpleSlider
                      label="Fuzziness"
                      value={rangeMaskFuzz}
                      min={0}
                      max={0.5}
                      step={0.01}
                      onValueChange={setRangeMaskFuzz}
                    />
                  </View>
                )}

                {/* Binarize parameters */}
                {activeTool === "binarize" && (
                  <SimpleSlider
                    label="Threshold"
                    value={binarizeThreshold}
                    min={0}
                    max={1}
                    step={0.01}
                    onValueChange={setBinarizeThreshold}
                  />
                )}

                {/* Deconvolution parameters */}
                {activeTool === "deconvolution" && (
                  <View>
                    <SimpleSlider
                      label="PSF Sigma"
                      value={deconvPsfSigma}
                      min={0.5}
                      max={5}
                      step={0.1}
                      onValueChange={setDeconvPsfSigma}
                    />
                    <SimpleSlider
                      label="Iterations"
                      value={deconvIterations}
                      min={5}
                      max={50}
                      step={1}
                      onValueChange={(v) => setDeconvIterations(Math.round(v))}
                    />
                    <SimpleSlider
                      label="Regularization"
                      value={deconvRegularization}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={setDeconvRegularization}
                    />
                  </View>
                )}

                {/* PixelMath parameters */}
                {activeTool === "pixelMath" && (
                  <View>
                    <Text className="text-[9px] text-muted mb-1">
                      Variables: $T, $mean, $median, $min, $max
                    </Text>
                    <TextInput
                      className="h-8 px-2 text-xs text-foreground bg-background rounded border border-separator"
                      value={pixelMathExpr}
                      onChangeText={setPixelMathExpr}
                      placeholder="($T - $min) / ($max - $min)"
                      placeholderTextColor="#666"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
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

      {/* Tool Group Tabs */}
      <View className="border-t border-separator bg-background px-2 pt-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1">
            {[
              { key: "geometry" as const, label: t("editor.geometry" as TranslationKey) },
              { key: "adjust" as const, label: t("editor.adjust" as TranslationKey) },
              { key: "process" as const, label: t("editor.process" as TranslationKey) },
              { key: "mask" as const, label: t("editor.maskTools" as TranslationKey) },
            ].map((tab) => (
              <PressableFeedback key={tab.key} onPress={() => setActiveToolGroup(tab.key)}>
                <View
                  className={`px-3 py-1 rounded-full ${activeToolGroup === tab.key ? "bg-success/15" : ""}`}
                >
                  <Text
                    className={`text-[10px] font-semibold ${activeToolGroup === tab.key ? "text-success" : "text-muted"}`}
                  >
                    {tab.label}
                  </Text>
                </View>
              </PressableFeedback>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Tools Row */}
      <View className="border-t border-separator bg-background px-2 py-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-0.5">
            {(activeToolGroup === "geometry"
              ? GEOMETRY_TOOLS
              : activeToolGroup === "adjust"
                ? ADJUST_TOOLS
                : activeToolGroup === "process"
                  ? PROCESS_TOOLS
                  : MASK_TOOLS
            ).map((tool) => {
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
                      {t(`editor.${tool.key}` as TranslationKey)}
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
                    router.push(tool.route);
                  } else if (tool.key === "starDetect" && editor.current) {
                    const stars = detectStars(
                      editor.current.pixels,
                      editor.current.width,
                      editor.current.height,
                    );
                    setDetectedStars(stars);
                  } else {
                    handleToolPress(tool.key as Exclude<EditorTool, null>);
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
                      : t(`editor.${tool.key}` as TranslationKey)}
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
