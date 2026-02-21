import { View, Text, ScrollView, Alert, TextInput } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useState, useCallback, useEffect, useRef } from "react";
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
import { FitsCanvas, type CanvasTransform } from "../../components/fits/FitsCanvas";
import { CropOverlay } from "../../components/fits/CropOverlay";
import { StarAnnotationOverlay } from "../../components/fits/StarAnnotationOverlay";
import { SimpleSlider } from "../../components/common/SimpleSlider";
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
  | "dbe"
  | "multiscaleDenoise"
  | "localContrast"
  | "starReduction"
  | "deconvolutionAuto"
  | "scnr"
  | "colorCalibration"
  | "saturation"
  | "colorBalance"
  | "pixelMath"
  | null;

type EditorExportOptions = {
  fits?: Partial<FitsTargetOptions>;
  tiff?: Partial<TiffTargetOptions>;
  render?: ExportRenderOptions;
};

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
  { key: "saturation", icon: "color-fill-outline" },
  { key: "colorBalance", icon: "color-filter-outline" },
  { key: "colorCalibration", icon: "flask-outline" },
  { key: "scnr", icon: "leaf-outline" },
  { key: "invert", icon: "contrast-outline" },
  { key: "histogram", icon: "bar-chart-outline" },
];

const PROCESS_TOOLS: { key: EditorTool & string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "blur", icon: "water-outline" },
  { key: "sharpen", icon: "sparkles-outline" },
  { key: "denoise", icon: "layers-outline" },
  { key: "dbe", icon: "planet-outline" },
  { key: "multiscaleDenoise", icon: "layers-outline" },
  { key: "localContrast", icon: "contrast-outline" },
  { key: "starReduction", icon: "star-outline" },
  { key: "clahe", icon: "grid-outline" },
  { key: "hdr", icon: "aperture-outline" },
  { key: "deconvolution", icon: "flashlight-outline" },
  { key: "deconvolutionAuto", icon: "flash-outline" },
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
  { key: "compose", icon: "color-palette-outline", route: "/compose/advanced" },
  { key: "statistics", icon: "stats-chart-outline" },
  { key: "starDetect", icon: "star-outline" },
];

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
  type TranslationKey = Parameters<typeof t>[0];
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
  const { pixels, dimensions, isLoading: fitsLoading, loadFromPath } = useFitsFile();
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
  const [canvasTransform, setCanvasTransform] = useState<CanvasTransform>(EMPTY_TRANSFORM);
  const [detectedStars, setDetectedStars] = useState<DetectedStar[]>([]);
  const [isStarAnnotationMode, setIsStarAnnotationMode] = useState(false);
  const [starPoints, setStarPoints] = useState<StarAnnotationPoint[]>([]);
  const [starSnapshot, setStarSnapshot] = useState<StarAnnotationDetectionSnapshot>({
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
  });
  const [starAnnotationsStale, setStarAnnotationsStale] = useState(false);
  const [starAnnotationsStaleReason, setStarAnnotationsStaleReason] = useState<
    StarAnnotationStaleReason | undefined
  >(undefined);
  const [isDetectingStars, setIsDetectingStars] = useState(false);
  const [starDetectionProgress, setStarDetectionProgress] = useState(0);
  const [starDetectionStage, setStarDetectionStage] = useState("idle");
  const [pendingAnchorIndex, setPendingAnchorIndex] = useState<1 | 2 | 3 | null>(null);

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
  const [dbeSamplesX, setDbeSamplesX] = useState(12);
  const [dbeSamplesY, setDbeSamplesY] = useState(8);
  const [dbeSigma, setDbeSigma] = useState(2.5);
  const [multiscaleLayers, setMultiscaleLayers] = useState(4);
  const [multiscaleThreshold, setMultiscaleThreshold] = useState(2.5);
  const [localContrastSigma, setLocalContrastSigma] = useState(8);
  const [localContrastAmount, setLocalContrastAmount] = useState(0.35);
  const [starReductionScale, setStarReductionScale] = useState(1.2);
  const [starReductionStrength, setStarReductionStrength] = useState(0.6);
  const [deconvAutoIterations, setDeconvAutoIterations] = useState(20);
  const [deconvAutoRegularization, setDeconvAutoRegularization] = useState(0.1);
  const [scnrMethod, setScnrMethod] = useState<"averageNeutral" | "maximumNeutral">(
    "averageNeutral",
  );
  const [scnrAmount, setScnrAmount] = useState(0.5);
  const [colorCalibrationPercentile, setColorCalibrationPercentile] = useState(0.92);
  const [saturationAmount, setSaturationAmount] = useState(0);
  const [colorBalanceRedGain, setColorBalanceRedGain] = useState(1);
  const [colorBalanceGreenGain, setColorBalanceGreenGain] = useState(1);
  const [colorBalanceBlueGain, setColorBalanceBlueGain] = useState(1);
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

  const buildDetectionSnapshot = useCallback(
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
    const snapshot = buildDetectionSnapshot();
    applyStarAnnotationState([], snapshot, false, undefined, {
      width: currentWidth,
      height: currentHeight,
      historyIndex,
      persist: false,
    });
    setDetectedStars([]);
  }, [
    applyStarAnnotationState,
    buildDetectionSnapshot,
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
    const snapshot = buildDetectionSnapshot();
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
  }, [applyStarAnnotationState, buildDetectionSnapshot, editor, isDetectingStars, starPoints, t]);

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
      case "dbe":
        op = { type: "dbe", samplesX: dbeSamplesX, samplesY: dbeSamplesY, sigma: dbeSigma };
        break;
      case "multiscaleDenoise":
        op = {
          type: "multiscaleDenoise",
          layers: multiscaleLayers,
          threshold: multiscaleThreshold,
        };
        break;
      case "localContrast":
        op = { type: "localContrast", sigma: localContrastSigma, amount: localContrastAmount };
        break;
      case "starReduction":
        op = { type: "starReduction", scale: starReductionScale, strength: starReductionStrength };
        break;
      case "deconvolutionAuto":
        op = {
          type: "deconvolutionAuto",
          iterations: deconvAutoIterations,
          regularization: deconvAutoRegularization,
        };
        break;
      case "scnr":
        op = { type: "scnr", method: scnrMethod, amount: scnrAmount };
        break;
      case "colorCalibration":
        op = { type: "colorCalibration", percentile: colorCalibrationPercentile };
        break;
      case "saturation":
        op = { type: "saturation", amount: saturationAmount };
        break;
      case "colorBalance":
        op = {
          type: "colorBalance",
          redGain: colorBalanceRedGain,
          greenGain: colorBalanceGreenGain,
          blueGain: colorBalanceBlueGain,
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
    dbeSamplesX,
    dbeSamplesY,
    dbeSigma,
    multiscaleLayers,
    multiscaleThreshold,
    localContrastSigma,
    localContrastAmount,
    starReductionScale,
    starReductionStrength,
    deconvAutoIterations,
    deconvAutoRegularization,
    scnrMethod,
    scnrAmount,
    colorCalibrationPercentile,
    saturationAmount,
    colorBalanceRedGain,
    colorBalanceGreenGain,
    colorBalanceBlueGain,
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
    async (quality: number, options?: EditorExportOptions) => {
      if (!editor.rgbaData || !editor.current) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const detailed = await exportImageDetailed({
        rgbaData: editor.rgbaData,
        width: editor.current.width,
        height: editor.current.height,
        filename: file?.filename ?? "edited",
        format: exportFormat,
        quality,
        fits: { ...options?.fits, mode: "rendered" },
        tiff: options?.tiff,
        renderOptions: options?.render,
        source: {
          sourceType: file?.sourceType,
          sourceFormat: file?.sourceFormat,
          sourceFileId: file?.id,
          starAnnotations: starPoints,
        },
      });
      if (detailed.path) {
        const fallbackMessage =
          detailed.diagnostics.fallbackApplied && detailed.diagnostics.fallbackReasonMessageKey
            ? `\n${t(detailed.diagnostics.fallbackReasonMessageKey)}`
            : "";
        Alert.alert(t("common.success"), `${t("viewer.exportSuccess")}${fallbackMessage}`);
      } else {
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      setShowExport(false);
    },
    [
      editor,
      exportImageDetailed,
      file?.filename,
      file?.id,
      file?.sourceFormat,
      file?.sourceType,
      exportFormat,
      t,
      starPoints,
    ],
  );

  const handleEditorShare = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      if (!editor.rgbaData || !editor.current) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      try {
        await shareImage({
          rgbaData: editor.rgbaData,
          width: editor.current.width,
          height: editor.current.height,
          filename: file?.filename ?? "edited",
          format: exportFormat,
          quality,
          fits: { ...options?.fits, mode: "rendered" },
          tiff: options?.tiff,
          renderOptions: options?.render,
          source: {
            sourceType: file?.sourceType,
            sourceFormat: file?.sourceFormat,
            sourceFileId: file?.id,
            starAnnotations: starPoints,
          },
        });
      } catch {
        Alert.alert(t("common.error"), t("share.failed"));
      }
      setShowExport(false);
    },
    [
      editor,
      shareImage,
      file?.filename,
      file?.id,
      file?.sourceFormat,
      file?.sourceType,
      exportFormat,
      t,
      starPoints,
    ],
  );

  const handleEditorSave = useCallback(
    async (quality: number, options?: EditorExportOptions) => {
      if (!editor.rgbaData || !editor.current) {
        Alert.alert(t("common.error"), t("viewer.noImageData"));
        return;
      }
      const uri = await saveImage({
        rgbaData: editor.rgbaData,
        width: editor.current.width,
        height: editor.current.height,
        filename: file?.filename ?? "edited",
        format: exportFormat,
        quality,
        fits: { ...options?.fits, mode: "rendered" },
        tiff: options?.tiff,
        renderOptions: options?.render,
        source: {
          sourceType: file?.sourceType,
          sourceFormat: file?.sourceFormat,
          sourceFileId: file?.id,
          starAnnotations: starPoints,
        },
      });
      if (uri) {
        Alert.alert(t("common.success"), t("viewer.savedToDevice"));
      } else {
        Alert.alert(t("common.error"), t("viewer.exportFailed"));
      }
      setShowExport(false);
    },
    [
      editor,
      saveImage,
      file?.filename,
      file?.id,
      file?.sourceFormat,
      file?.sourceType,
      exportFormat,
      t,
      starPoints,
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
      <View
        className="flex-row items-center justify-between pb-2"
        style={{ paddingHorizontal: horizontalPadding, paddingTop: contentPaddingTop }}
      >
        <Button
          testID="e2e-action-editor__param_id-back"
          size="sm"
          variant="outline"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <Text
          className="flex-1 mx-2 text-sm font-semibold text-foreground text-center"
          numberOfLines={1}
        >
          {t("editor.title")} - {file.filename}
        </Text>
        <View className="flex-row gap-1">
          <Button
            testID="e2e-action-editor__param_id-undo"
            size="sm"
            variant="outline"
            onPress={editor.undo}
            isDisabled={!editor.canUndo}
          >
            <Ionicons
              name="arrow-undo-outline"
              size={14}
              color={editor.canUndo ? successColor : mutedColor}
            />
          </Button>
          <Button
            testID="e2e-action-editor__param_id-redo"
            size="sm"
            variant="outline"
            onPress={editor.redo}
            isDisabled={!editor.canRedo}
          >
            <Ionicons
              name="arrow-redo-outline"
              size={14}
              color={editor.canRedo ? successColor : mutedColor}
            />
          </Button>
          <Button
            testID="e2e-action-editor__param_id-open-export"
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
              rgbaData={editor.rgbaData}
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

                {activeTool === "dbe" && (
                  <View>
                    <SimpleSlider
                      label="Samples X"
                      value={dbeSamplesX}
                      min={4}
                      max={24}
                      step={1}
                      onValueChange={(v) => setDbeSamplesX(Math.round(v))}
                    />
                    <SimpleSlider
                      label="Samples Y"
                      value={dbeSamplesY}
                      min={4}
                      max={24}
                      step={1}
                      onValueChange={(v) => setDbeSamplesY(Math.round(v))}
                    />
                    <SimpleSlider
                      label="Sigma"
                      value={dbeSigma}
                      min={1}
                      max={5}
                      step={0.1}
                      onValueChange={setDbeSigma}
                    />
                  </View>
                )}

                {activeTool === "multiscaleDenoise" && (
                  <View>
                    <SimpleSlider
                      label="Layers"
                      value={multiscaleLayers}
                      min={1}
                      max={8}
                      step={1}
                      onValueChange={(v) => setMultiscaleLayers(Math.round(v))}
                    />
                    <SimpleSlider
                      label="Threshold"
                      value={multiscaleThreshold}
                      min={0.5}
                      max={6}
                      step={0.1}
                      onValueChange={setMultiscaleThreshold}
                    />
                  </View>
                )}

                {activeTool === "localContrast" && (
                  <View>
                    <SimpleSlider
                      label="Sigma"
                      value={localContrastSigma}
                      min={1}
                      max={20}
                      step={0.5}
                      onValueChange={setLocalContrastSigma}
                    />
                    <SimpleSlider
                      label="Amount"
                      value={localContrastAmount}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={setLocalContrastAmount}
                    />
                  </View>
                )}

                {activeTool === "starReduction" && (
                  <View>
                    <SimpleSlider
                      label="Scale"
                      value={starReductionScale}
                      min={0.5}
                      max={4}
                      step={0.1}
                      onValueChange={setStarReductionScale}
                    />
                    <SimpleSlider
                      label="Strength"
                      value={starReductionStrength}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={setStarReductionStrength}
                    />
                  </View>
                )}

                {activeTool === "deconvolutionAuto" && (
                  <View>
                    <SimpleSlider
                      label="Iterations"
                      value={deconvAutoIterations}
                      min={5}
                      max={80}
                      step={1}
                      onValueChange={(v) => setDeconvAutoIterations(Math.round(v))}
                    />
                    <SimpleSlider
                      label="Regularization"
                      value={deconvAutoRegularization}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={setDeconvAutoRegularization}
                    />
                  </View>
                )}

                {activeTool === "scnr" && (
                  <View>
                    <SimpleSlider
                      label="Amount"
                      value={scnrAmount}
                      min={0}
                      max={1}
                      step={0.05}
                      onValueChange={setScnrAmount}
                    />
                    <View className="flex-row gap-2 mt-1">
                      <Button
                        size="sm"
                        variant={scnrMethod === "averageNeutral" ? "primary" : "outline"}
                        onPress={() => setScnrMethod("averageNeutral")}
                      >
                        <Button.Label className="text-[9px]">Average</Button.Label>
                      </Button>
                      <Button
                        size="sm"
                        variant={scnrMethod === "maximumNeutral" ? "primary" : "outline"}
                        onPress={() => setScnrMethod("maximumNeutral")}
                      >
                        <Button.Label className="text-[9px]">Maximum</Button.Label>
                      </Button>
                    </View>
                  </View>
                )}

                {activeTool === "colorCalibration" && (
                  <SimpleSlider
                    label="Reference Percentile"
                    value={colorCalibrationPercentile}
                    min={0.5}
                    max={0.99}
                    step={0.01}
                    onValueChange={setColorCalibrationPercentile}
                  />
                )}

                {activeTool === "saturation" && (
                  <SimpleSlider
                    label="Amount"
                    value={saturationAmount}
                    min={-1}
                    max={2}
                    step={0.05}
                    onValueChange={setSaturationAmount}
                  />
                )}

                {activeTool === "colorBalance" && (
                  <View>
                    <SimpleSlider
                      label="Red Gain"
                      value={colorBalanceRedGain}
                      min={0}
                      max={4}
                      step={0.05}
                      onValueChange={setColorBalanceRedGain}
                    />
                    <SimpleSlider
                      label="Green Gain"
                      value={colorBalanceGreenGain}
                      min={0}
                      max={4}
                      step={0.05}
                      onValueChange={setColorBalanceGreenGain}
                    />
                    <SimpleSlider
                      label="Blue Gain"
                      value={colorBalanceBlueGain}
                      min={0}
                      max={4}
                      step={0.05}
                      onValueChange={setColorBalanceBlueGain}
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
                      testID="e2e-action-editor__param_id-rotate90cw"
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "rotate90cw" })}
                    >
                      <Button.Label className="text-[9px]">90° CW</Button.Label>
                    </Button>
                    <Button
                      testID="e2e-action-editor__param_id-rotate90ccw"
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "rotate90ccw" })}
                    >
                      <Button.Label className="text-[9px]">90° CCW</Button.Label>
                    </Button>
                    <Button
                      testID="e2e-action-editor__param_id-rotate180"
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
                      testID="e2e-action-editor__param_id-flip-h"
                      size="sm"
                      variant="outline"
                      onPress={() => handleQuickAction({ type: "flipH" })}
                    >
                      <Button.Label className="text-[9px]">Horizontal</Button.Label>
                    </Button>
                    <Button
                      testID="e2e-action-editor__param_id-flip-v"
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

        {isStarAnnotationMode && (
          <View className="absolute top-4 left-4 right-4">
            <Card variant="secondary">
              <Card.Body className="p-3">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <Ionicons name="star-outline" size={14} color={successColor} />
                    <Text className="text-xs font-semibold text-success">
                      {t("editor.starAnnotationMode" as TranslationKey)}
                    </Text>
                  </View>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
                      cancelStarDetection();
                      setIsStarAnnotationMode(false);
                      setPendingAnchorIndex(null);
                    }}
                  >
                    <Button.Label className="text-[10px]">{t("common.close")}</Button.Label>
                  </Button>
                </View>

                <Text
                  testID="e2e-text-editor__param_id-star-counts"
                  className="mt-2 text-[10px] text-muted"
                >
                  {t("editor.detectedStars" as TranslationKey)}: {detectedStarCount} ·{" "}
                  {t("editor.manualStars" as TranslationKey)}: {manualStarCount} ·{" "}
                  {t("editor.enabledStars" as TranslationKey)}: {enabledStarCount}
                </Text>

                {starAnnotationsStale && (
                  <View className="mt-2 rounded-md bg-warning/15 px-2 py-1">
                    <Text className="text-[9px] text-warning">
                      {t("editor.annotationStale" as TranslationKey)}
                      {starAnnotationsStaleReason ? ` (${starAnnotationsStaleReason})` : ""}
                    </Text>
                  </View>
                )}

                {isDetectingStars && (
                  <View className="mt-2 rounded-md bg-success/10 px-2 py-1">
                    <Text className="text-[9px] text-success">
                      {t("editor.reDetectStars" as TranslationKey)} · {starDetectionStage} ·{" "}
                      {starDetectionProgress}%
                    </Text>
                  </View>
                )}

                <View className="mt-2 flex-row flex-wrap gap-1.5">
                  <Button
                    testID="e2e-action-editor__param_id-redetect-stars"
                    size="sm"
                    variant="outline"
                    onPress={detectAndMergeStars}
                    isDisabled={isDetectingStars}
                  >
                    <Button.Label className="text-[9px]">
                      {t("editor.reDetectStars" as TranslationKey)}
                    </Button.Label>
                  </Button>
                  {isDetectingStars && (
                    <Button size="sm" variant="outline" onPress={cancelStarDetection}>
                      <Button.Label className="text-[9px]">{t("common.cancel")}</Button.Label>
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={pendingAnchorIndex === 1 ? "primary" : "outline"}
                    onPress={() => setPendingAnchorIndex((prev) => (prev === 1 ? null : 1))}
                  >
                    <Button.Label className="text-[9px]">
                      {t("editor.setAnchor1" as TranslationKey)}
                    </Button.Label>
                  </Button>
                  <Button
                    size="sm"
                    variant={pendingAnchorIndex === 2 ? "primary" : "outline"}
                    onPress={() => setPendingAnchorIndex((prev) => (prev === 2 ? null : 2))}
                  >
                    <Button.Label className="text-[9px]">
                      {t("editor.setAnchor2" as TranslationKey)}
                    </Button.Label>
                  </Button>
                  <Button
                    size="sm"
                    variant={pendingAnchorIndex === 3 ? "primary" : "outline"}
                    onPress={() => setPendingAnchorIndex((prev) => (prev === 3 ? null : 3))}
                  >
                    <Button.Label className="text-[9px]">
                      {t("editor.setAnchor3" as TranslationKey)}
                    </Button.Label>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onPress={() => {
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
                  >
                    <Button.Label className="text-[9px]">
                      {t("editor.clearAnchors" as TranslationKey)}
                    </Button.Label>
                  </Button>
                </View>
              </Card.Body>
            </Card>
          </View>
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

      {/* History indicator */}
      {editor.historyLength > 1 && (
        <View className="flex-row items-center gap-1 px-3 py-1 bg-background">
          <Ionicons name="time-outline" size={10} color={mutedColor} />
          <Text className="text-[9px] text-muted">
            {editor.historyIndex}/{editor.historyLength - 1} {t("editor.edits" as TranslationKey)}
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
                <PressableFeedback
                  key={tool.key}
                  testID={`e2e-action-editor__param_id-tool-${tool.key}`}
                  onPress={() => handleToolPress(tool.key)}
                >
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
                testID={`e2e-action-editor__param_id-advanced-${tool.key}`}
                onPress={() => {
                  if (tool.route) {
                    if (tool.key === "compose" && id) {
                      router.push(`/compose/advanced?sourceId=${id}`);
                    } else {
                      router.push(tool.route);
                    }
                  } else if (tool.key === "starDetect") {
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
                      tool.key === "starDetect" &&
                      (detectedStars.length > 0 || isStarAnnotationMode)
                        ? successColor
                        : mutedColor
                    }
                  />
                  <Text
                    className={`mt-1 text-[9px] ${tool.key === "starDetect" && (detectedStars.length > 0 || isStarAnnotationMode) ? "text-success font-semibold" : "text-muted"}`}
                  >
                    {tool.key === "starDetect" && detectedStars.length > 0
                      ? `${detectedStars.length} ${t("editor.stars")}`
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
