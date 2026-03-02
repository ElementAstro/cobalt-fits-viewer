import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Chip, Dialog, Input, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useI18n } from "../../i18n/useI18n";
import { useResponsiveLayout } from "../../hooks/useResponsiveLayout";
import { useFitsStore } from "../../stores/useFitsStore";
import { useImageComparison, type CompareMode } from "../../hooks/useImageComparison";
import { useFitsFile } from "../../hooks/useFitsFile";
import { useImageProcessing } from "../../hooks/useImageProcessing";
import {
  FitsCanvas,
  type CanvasTransform,
  type FitsCanvasHandle,
} from "../../components/fits/FitsCanvas";
import { PixelInspector } from "../../components/fits/PixelInspector";
import { Minimap } from "../../components/fits/Minimap";
import { SimpleSlider } from "../../components/common/SimpleSlider";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { ViewerCurvePreset } from "../../lib/fits/types";
import {
  resolveAdjustmentsFromPreset,
  resolveOverlaysFromPreset,
  toViewerPreset,
  type ViewerAdjustments,
  type ViewerOverlays,
} from "../../lib/viewer/model";
import { VIEWER_CURVE_PRESETS } from "../../lib/viewer/presets";
import { syncCompareTransform } from "../../lib/viewer/compareTransformSync";
import { computeAutoStretch } from "../../lib/utils/pixelMath";
import { isImageLikeMedia } from "../../lib/import/imageParsePipeline";
import { pickImageLikeIds } from "../../lib/viewer/compareRouting";

const MODES: { key: CompareMode; labelKey: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "blink", labelKey: "compare.modeBlink", icon: "eye-outline" },
  { key: "side-by-side", labelKey: "compare.modeSideBySide", icon: "git-compare-outline" },
  { key: "split", labelKey: "compare.modeSplit", icon: "swap-horizontal-outline" },
];

const STRETCHES: ViewerAdjustments["stretch"][] = [
  "linear",
  "sqrt",
  "log",
  "asinh",
  "power",
  "zscale",
  "minmax",
  "percentile",
];

const COLORMAPS: ViewerAdjustments["colormap"][] = [
  "grayscale",
  "inverted",
  "heat",
  "cool",
  "thermal",
  "rainbow",
  "jet",
  "viridis",
  "plasma",
  "magma",
  "inferno",
  "cividis",
  "cubehelix",
  "red",
  "green",
  "blue",
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function CompareScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ ids?: string }>();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { width: viewportWidth } = useWindowDimensions();
  const { horizontalPadding } = useResponsiveLayout();

  const files = useFitsStore((s) => s.files);
  const imageFiles = useMemo(() => files.filter((file) => isImageLikeMedia(file)), [files]);
  const updateFile = useFitsStore((s) => s.updateFile);
  const defaultStretch = useSettingsStore((s) => s.defaultStretch);
  const defaultColormap = useSettingsStore((s) => s.defaultColormap);
  const defaultBlackPoint = useSettingsStore((s) => s.defaultBlackPoint);
  const defaultWhitePoint = useSettingsStore((s) => s.defaultWhitePoint);
  const defaultGamma = useSettingsStore((s) => s.defaultGamma);
  const defaultShowGrid = useSettingsStore((s) => s.defaultShowGrid);
  const defaultShowCrosshair = useSettingsStore((s) => s.defaultShowCrosshair);
  const defaultShowPixelInfo = useSettingsStore((s) => s.defaultShowPixelInfo);
  const defaultShowMinimap = useSettingsStore((s) => s.defaultShowMinimap);
  const defaultCompareMode = useSettingsStore((s) => s.compareDefaultMode);
  const defaultCompareBlinkSpeed = useSettingsStore((s) => s.compareBlinkSpeed);
  const defaultCompareSplitPosition = useSettingsStore((s) => s.compareSplitPosition);
  const debounceMs = useSettingsStore((s) => s.imageProcessingDebounce);
  const useHighQualityPreview = useSettingsStore((s) => s.useHighQualityPreview);
  const settingsMinScale = useSettingsStore((s) => s.canvasMinScale);
  const settingsMaxScale = useSettingsStore((s) => s.canvasMaxScale);
  const settingsDoubleTapScale = useSettingsStore((s) => s.canvasDoubleTapScale);
  const settingsPinchSensitivity = useSettingsStore((s) => s.canvasPinchSensitivity);
  const settingsPinchOverzoomFactor = useSettingsStore((s) => s.canvasPinchOverzoomFactor);
  const settingsPanRubberBandFactor = useSettingsStore((s) => s.canvasPanRubberBandFactor);
  const settingsWheelZoomSensitivity = useSettingsStore((s) => s.canvasWheelZoomSensitivity);
  const applySettingsPatch = useSettingsStore((s) => s.applySettingsPatch);

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

  const defaultAdjustments = useMemo<ViewerAdjustments>(
    () => ({
      stretch: defaultStretch,
      colormap: defaultColormap,
      blackPoint: defaultBlackPoint,
      whitePoint: defaultWhitePoint,
      gamma: defaultGamma,
      midtone: 0.5,
      outputBlack: 0,
      outputWhite: 1,
      brightness: 0,
      contrast: 1,
      mtfMidtone: 0.5,
      curvePreset: "linear",
    }),
    [defaultStretch, defaultColormap, defaultBlackPoint, defaultWhitePoint, defaultGamma],
  );
  const defaultOverlays = useMemo<ViewerOverlays>(
    () => ({
      showGrid: defaultShowGrid,
      showCrosshair: defaultShowCrosshair,
      showPixelInfo: defaultShowPixelInfo,
      showMinimap: defaultShowMinimap,
    }),
    [defaultShowGrid, defaultShowCrosshair, defaultShowPixelInfo, defaultShowMinimap],
  );

  const initialIds = useMemo(() => {
    if (!params.ids) return [];
    return pickImageLikeIds(params.ids.split(","), files, 2);
  }, [files, params.ids]);
  const {
    imageIds,
    mode,
    activeIndex,
    blinkSpeed,
    splitPosition,
    isBlinkPlaying,
    setImageIds,
    setMode,
    setBlinkSpeed,
    setSplitPosition,
    nextImage,
    prevImage,
    toggleBlinkPlay,
  } = useImageComparison({
    initialIds,
    initialMode: defaultCompareMode,
    initialBlinkSpeed: defaultCompareBlinkSpeed,
    initialSplitPosition: defaultCompareSplitPosition,
  });

  const fileA = useMemo(() => imageFiles.find((f) => f.id === imageIds[0]), [imageFiles, imageIds]);
  const fileB = useMemo(() => imageFiles.find((f) => f.id === imageIds[1]), [imageFiles, imageIds]);

  const fitsA = useFitsFile();
  const fitsB = useFitsFile();
  const procA = useImageProcessing();
  const procB = useImageProcessing();
  const { pixels: pixelsA, dimensions: dimensionsA, loadFromPath: loadFromPathA } = fitsA;
  const { pixels: pixelsB, dimensions: dimensionsB, loadFromPath: loadFromPathB } = fitsB;
  const {
    rgbaData: rgbaDataA,
    displayWidth: displayWidthA,
    displayHeight: displayHeightA,
    processImage: processImageA,
    processImagePreview: processImagePreviewA,
  } = procA;
  const {
    rgbaData: rgbaDataB,
    displayWidth: displayWidthB,
    displayHeight: displayHeightB,
    processImage: processImageB,
    processImagePreview: processImagePreviewB,
  } = procB;

  const [adjustmentsA, setAdjustmentsA] = useState(defaultAdjustments);
  const [adjustmentsB, setAdjustmentsB] = useState(defaultAdjustments);
  const [linked, setLinked] = useState(true);
  const [activeSide, setActiveSide] = useState<"A" | "B">("A");
  const [showGrid, setShowGrid] = useState(defaultOverlays.showGrid);
  const [showCrosshair, setShowCrosshair] = useState(defaultOverlays.showCrosshair);
  const [showPixelInfo, setShowPixelInfo] = useState(defaultOverlays.showPixelInfo);
  const [showMinimap, setShowMinimap] = useState(defaultOverlays.showMinimap);
  const [cursorA, setCursorA] = useState({ x: -1, y: -1 });
  const [cursorB, setCursorB] = useState({ x: -1, y: -1 });
  const [canvasA, setCanvasA] = useState<CanvasTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });
  const [canvasB, setCanvasB] = useState<CanvasTransform>({
    scale: 1,
    translateX: 0,
    translateY: 0,
    canvasWidth: 0,
    canvasHeight: 0,
  });
  const [showPicker, setShowPicker] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"A" | "B">("B");
  const [pickerQuery, setPickerQuery] = useState("");
  const [splitLayoutWidth, setSplitLayoutWidth] = useState(viewportWidth);
  const [displayedSide, setDisplayedSide] = useState<"A" | "B">("A");

  const canvasARef = useRef<FitsCanvasHandle>(null);
  const canvasBRef = useRef<FitsCanvasHandle>(null);
  const splitStartRef = useRef(splitPosition);
  const prevPixelsA = useRef<Float32Array | null>(null);
  const prevPixelsB = useRef<Float32Array | null>(null);
  const syncedTargetTransformRef = useRef<
    Partial<Record<"A" | "B", { scale: number; translateX: number; translateY: number }>>
  >({});
  const syncMetaRef = useRef<{ linked: boolean; aId?: string; bId?: string }>({
    linked: true,
    aId: fileA?.id,
    bId: fileB?.id,
  });

  useEffect(() => {
    if (!imageIds.length && initialIds.length) {
      setImageIds(initialIds);
    }
  }, [imageIds.length, initialIds, setImageIds]);

  const handleModeChange = useCallback(
    (nextMode: CompareMode) => {
      setMode(nextMode);
      applySettingsPatch({ compareDefaultMode: nextMode });
    },
    [applySettingsPatch, setMode],
  );

  const handleBlinkSpeedChange = useCallback(
    (value: number) => {
      const next = clamp(value, 0.3, 5);
      setBlinkSpeed(next);
      applySettingsPatch({ compareBlinkSpeed: next });
    },
    [applySettingsPatch, setBlinkSpeed],
  );

  const handleSplitPositionChange = useCallback(
    (value: number) => {
      const next = clamp(value, 0.1, 0.9);
      setSplitPosition(next);
      applySettingsPatch({ compareSplitPosition: next });
    },
    [applySettingsPatch, setSplitPosition],
  );

  useEffect(() => {
    if (mode !== "blink") return;
    const side = activeIndex === 0 ? "A" : "B";
    setDisplayedSide((prev) => (prev === side ? prev : side));
    setActiveSide((prev) => (prev === side ? prev : side));
  }, [mode, activeIndex]);

  useEffect(() => {
    if (!fileA?.filepath) return;
    loadFromPathA(fileA.filepath, fileA.filename, fileA.fileSize);
  }, [fileA?.id, fileA?.filepath, fileA?.filename, fileA?.fileSize, loadFromPathA]);

  useEffect(() => {
    setAdjustmentsA(resolveAdjustmentsFromPreset(fileA?.viewerPreset, defaultAdjustments));
  }, [fileA?.id, fileA?.viewerPreset, defaultAdjustments]);

  useEffect(() => {
    if (!fileB?.filepath) return;
    loadFromPathB(fileB.filepath, fileB.filename, fileB.fileSize);
  }, [fileB?.id, fileB?.filepath, fileB?.filename, fileB?.fileSize, loadFromPathB]);

  useEffect(() => {
    setAdjustmentsB(resolveAdjustmentsFromPreset(fileB?.viewerPreset, defaultAdjustments));
  }, [fileB?.id, fileB?.viewerPreset, defaultAdjustments]);

  useEffect(() => {
    const preset = activeSide === "A" ? fileA?.viewerPreset : fileB?.viewerPreset;
    const overlays = resolveOverlaysFromPreset(preset, defaultOverlays);
    setShowGrid(overlays.showGrid);
    setShowCrosshair(overlays.showCrosshair);
    setShowPixelInfo(overlays.showPixelInfo);
    setShowMinimap(overlays.showMinimap);
  }, [activeSide, fileA?.viewerPreset, fileB?.viewerPreset, defaultOverlays]);

  useEffect(() => {
    if (!pixelsA || !dimensionsA) return;
    const isNew = prevPixelsA.current !== pixelsA;
    prevPixelsA.current = pixelsA;
    if (isNew) {
      const processFn = useHighQualityPreview ? processImageA : processImagePreviewA;
      processFn(
        pixelsA,
        dimensionsA.width,
        dimensionsA.height,
        adjustmentsA.stretch,
        adjustmentsA.colormap,
        adjustmentsA.blackPoint,
        adjustmentsA.whitePoint,
        adjustmentsA.gamma,
        adjustmentsA.outputBlack,
        adjustmentsA.outputWhite,
        adjustmentsA.brightness,
        adjustmentsA.contrast,
        adjustmentsA.mtfMidtone,
        adjustmentsA.curvePreset,
      );
      return;
    }
    const timer = setTimeout(() => {
      processImageA(
        pixelsA,
        dimensionsA.width,
        dimensionsA.height,
        adjustmentsA.stretch,
        adjustmentsA.colormap,
        adjustmentsA.blackPoint,
        adjustmentsA.whitePoint,
        adjustmentsA.gamma,
        adjustmentsA.outputBlack,
        adjustmentsA.outputWhite,
        adjustmentsA.brightness,
        adjustmentsA.contrast,
        adjustmentsA.mtfMidtone,
        adjustmentsA.curvePreset,
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [
    pixelsA,
    dimensionsA,
    adjustmentsA,
    processImageA,
    processImagePreviewA,
    debounceMs,
    useHighQualityPreview,
  ]);

  useEffect(() => {
    if (!pixelsB || !dimensionsB) return;
    const isNew = prevPixelsB.current !== pixelsB;
    prevPixelsB.current = pixelsB;
    if (isNew) {
      const processFn = useHighQualityPreview ? processImageB : processImagePreviewB;
      processFn(
        pixelsB,
        dimensionsB.width,
        dimensionsB.height,
        adjustmentsB.stretch,
        adjustmentsB.colormap,
        adjustmentsB.blackPoint,
        adjustmentsB.whitePoint,
        adjustmentsB.gamma,
        adjustmentsB.outputBlack,
        adjustmentsB.outputWhite,
        adjustmentsB.brightness,
        adjustmentsB.contrast,
        adjustmentsB.mtfMidtone,
        adjustmentsB.curvePreset,
      );
      return;
    }
    const timer = setTimeout(() => {
      processImageB(
        pixelsB,
        dimensionsB.width,
        dimensionsB.height,
        adjustmentsB.stretch,
        adjustmentsB.colormap,
        adjustmentsB.blackPoint,
        adjustmentsB.whitePoint,
        adjustmentsB.gamma,
        adjustmentsB.outputBlack,
        adjustmentsB.outputWhite,
        adjustmentsB.brightness,
        adjustmentsB.contrast,
        adjustmentsB.mtfMidtone,
        adjustmentsB.curvePreset,
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [
    pixelsB,
    dimensionsB,
    adjustmentsB,
    processImageB,
    processImagePreviewB,
    debounceMs,
    useHighQualityPreview,
  ]);

  const activeAdjustments = activeSide === "A" ? adjustmentsA : adjustmentsB;

  const updateAdjustments = useCallback(
    (patch: Partial<ViewerAdjustments>) => {
      if (activeSide === "A") {
        setAdjustmentsA((prev) => ({ ...prev, ...patch }));
        if (linked) setAdjustmentsB((prev) => ({ ...prev, ...patch }));
      } else {
        setAdjustmentsB((prev) => ({ ...prev, ...patch }));
        if (linked) setAdjustmentsA((prev) => ({ ...prev, ...patch }));
      }
    },
    [activeSide, linked],
  );

  const handleAutoStretch = useCallback(() => {
    const pixels = activeSide === "A" ? pixelsA : pixelsB;
    if (!pixels) return;
    const { blackPoint, whitePoint } = computeAutoStretch(pixels);
    updateAdjustments({
      blackPoint,
      whitePoint,
      midtone: 0.5,
      stretch: "asinh",
    });
  }, [activeSide, pixelsA, pixelsB, updateAdjustments]);

  const handleResetActive = useCallback(() => {
    const file = activeSide === "A" ? fileA : fileB;
    const target = resolveAdjustmentsFromPreset(file?.viewerPreset, defaultAdjustments);
    const overlays = resolveOverlaysFromPreset(file?.viewerPreset, defaultOverlays);
    if (activeSide === "A") setAdjustmentsA(target);
    else setAdjustmentsB(target);
    setShowGrid(overlays.showGrid);
    setShowCrosshair(overlays.showCrosshair);
    setShowPixelInfo(overlays.showPixelInfo);
    setShowMinimap(overlays.showMinimap);
  }, [activeSide, fileA, fileB, defaultAdjustments, defaultOverlays]);

  const handleSaveActive = useCallback(() => {
    const file = activeSide === "A" ? fileA : fileB;
    if (!file) return;
    const adjustments = activeSide === "A" ? adjustmentsA : adjustmentsB;
    updateFile(file.id, {
      viewerPreset: toViewerPreset(adjustments, {
        showGrid,
        showCrosshair,
        showPixelInfo,
        showMinimap,
      }),
    });
  }, [
    activeSide,
    fileA,
    fileB,
    adjustmentsA,
    adjustmentsB,
    showGrid,
    showCrosshair,
    showPixelInfo,
    showMinimap,
    updateFile,
  ]);

  const openPicker = useCallback((target: "A" | "B") => {
    setPickerTarget(target);
    setPickerQuery("");
    setShowPicker(true);
  }, []);

  const applyPickedFile = useCallback(
    (fileId: string) => {
      if (pickerTarget === "A") {
        setImageIds([fileId, imageIds[1]].filter(Boolean) as string[]);
        setActiveSide("A");
      } else {
        setImageIds([imageIds[0], fileId].filter(Boolean) as string[]);
        setActiveSide("B");
      }
      setShowPicker(false);
    },
    [pickerTarget, imageIds, setImageIds],
  );

  const pickerFiles = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return imageFiles;
    return imageFiles.filter(
      (f) =>
        f.filename.toLowerCase().includes(q) ||
        f.object?.toLowerCase().includes(q) ||
        f.filter?.toLowerCase().includes(q),
    );
  }, [pickerQuery, imageFiles]);

  const activeCursor = activeSide === "A" ? cursorA : cursorB;
  const activePixels = activeSide === "A" ? pixelsA : pixelsB;
  const activeDims = activeSide === "A" ? dimensionsA : dimensionsB;
  const activeValue =
    activePixels && activeDims && activeCursor.x >= 0 && activeCursor.y >= 0
      ? (activePixels[activeCursor.y * activeDims.width + activeCursor.x] ?? null)
      : null;

  const handleCanvasTransformChange = useCallback(
    (side: "A" | "B", transform: CanvasTransform) => {
      if (side === "A") {
        setCanvasA(transform);
      } else {
        setCanvasB(transform);
      }

      if (!linked) return;

      const expected = syncedTargetTransformRef.current[side];
      if (expected) {
        const isSyncedUpdate =
          Math.abs(expected.scale - transform.scale) < 0.02 &&
          Math.abs(expected.translateX - transform.translateX) < 1.5 &&
          Math.abs(expected.translateY - transform.translateY) < 1.5;
        delete syncedTargetTransformRef.current[side];
        if (isSyncedUpdate) return;
      }

      const targetSide = side === "A" ? "B" : "A";
      const targetRef = targetSide === "A" ? canvasARef.current : canvasBRef.current;
      if (!targetRef) return;
      const targetTransform = targetSide === "A" ? canvasA : canvasB;
      const sourceImage =
        side === "A"
          ? {
              width: displayWidthA || dimensionsA?.width || 0,
              height: displayHeightA || dimensionsA?.height || 0,
            }
          : {
              width: displayWidthB || dimensionsB?.width || 0,
              height: displayHeightB || dimensionsB?.height || 0,
            };
      const targetImage =
        targetSide === "A"
          ? {
              width: displayWidthA || dimensionsA?.width || 0,
              height: displayHeightA || dimensionsA?.height || 0,
            }
          : {
              width: displayWidthB || dimensionsB?.width || 0,
              height: displayHeightB || dimensionsB?.height || 0,
            };
      const next = syncCompareTransform({
        sourceTransform: transform,
        targetTransform,
        sourceImage,
        targetImage,
      });
      syncedTargetTransformRef.current[targetSide] = {
        scale: next.scale,
        translateX: next.translateX,
        translateY: next.translateY,
      };
      targetRef.setTransform(next.translateX, next.translateY, next.scale, {
        animated: false,
      });
    },
    [
      linked,
      canvasA,
      canvasB,
      displayWidthA,
      displayHeightA,
      displayWidthB,
      displayHeightB,
      dimensionsA?.width,
      dimensionsA?.height,
      dimensionsB?.width,
      dimensionsB?.height,
    ],
  );

  useEffect(() => {
    const prev = syncMetaRef.current;
    const aId = fileA?.id;
    const bId = fileB?.id;
    const justEnabled = linked && !prev.linked;
    const pairChanged = linked && prev.linked && (aId !== prev.aId || bId !== prev.bId);
    syncMetaRef.current = { linked, aId, bId };

    if ((!justEnabled && !pairChanged) || !linked || !aId || !bId) return;
    if (!canvasBRef.current) return;
    const next = syncCompareTransform({
      sourceTransform: canvasA,
      targetTransform: canvasB,
      sourceImage: {
        width: displayWidthA || dimensionsA?.width || 0,
        height: displayHeightA || dimensionsA?.height || 0,
      },
      targetImage: {
        width: displayWidthB || dimensionsB?.width || 0,
        height: displayHeightB || dimensionsB?.height || 0,
      },
    });
    syncedTargetTransformRef.current.B = {
      scale: next.scale,
      translateX: next.translateX,
      translateY: next.translateY,
    };
    canvasBRef.current.setTransform(next.translateX, next.translateY, next.scale, {
      animated: false,
    });
  }, [
    linked,
    fileA?.id,
    fileB?.id,
    canvasA,
    canvasB,
    displayWidthA,
    displayHeightA,
    displayWidthB,
    displayHeightB,
    dimensionsA?.width,
    dimensionsA?.height,
    dimensionsB?.width,
    dimensionsB?.height,
  ]);

  const splitPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(mode === "split" && !!fileA && !!fileB)
        .runOnJS(true)
        .onStart(() => {
          splitStartRef.current = splitPosition;
        })
        .onUpdate((event) => {
          if (splitLayoutWidth <= 0) return;
          const next = clamp(
            splitStartRef.current + event.translationX / splitLayoutWidth,
            0.1,
            0.9,
          );
          setSplitPosition(next);
        })
        .onEnd((event) => {
          if (splitLayoutWidth <= 0) return;
          const next = clamp(
            splitStartRef.current + event.translationX / splitLayoutWidth,
            0.1,
            0.9,
          );
          applySettingsPatch({ compareSplitPosition: next });
        }),
    [mode, fileA, fileB, splitPosition, splitLayoutWidth, setSplitPosition, applySettingsPatch],
  );

  const renderCanvas = useCallback(
    (side: "A" | "B", forceInteractive = false) => {
      const rgbaData = side === "A" ? rgbaDataA : rgbaDataB;
      const displayWidth = side === "A" ? displayWidthA : displayWidthB;
      const displayHeight = side === "A" ? displayHeightA : displayHeightB;
      const dimensions = side === "A" ? dimensionsA : dimensionsB;
      const transform = side === "A" ? canvasA : canvasB;
      const ref = side === "A" ? canvasARef : canvasBRef;
      const cursor = side === "A" ? cursorA : cursorB;
      const setCursor = side === "A" ? setCursorA : setCursorB;
      const interactive = forceInteractive || activeSide === side;

      if (!rgbaData || !dimensions) {
        return (
          <View className="flex-1 items-center justify-center bg-black">
            <Text className="text-xs text-muted">{side}</Text>
          </View>
        );
      }
      return (
        <View className="flex-1">
          <Pressable className="flex-1" onPress={() => setActiveSide(side)}>
            <FitsCanvas
              ref={ref}
              rgbaData={rgbaData}
              width={displayWidth || dimensions.width}
              height={displayHeight || dimensions.height}
              sourceWidth={dimensions.width}
              sourceHeight={dimensions.height}
              showGrid={showGrid && interactive}
              showCrosshair={showCrosshair && interactive}
              cursorX={interactive ? cursor.x : -1}
              cursorY={interactive ? cursor.y : -1}
              onPixelTap={(x, y) => {
                setActiveSide(side);
                setCursor({ x, y });
              }}
              onTransformChange={(nextTransform) =>
                handleCanvasTransformChange(side, nextTransform)
              }
              interactionEnabled={interactive}
              minScale={settingsMinScale}
              maxScale={settingsMaxScale}
              doubleTapScale={settingsDoubleTapScale}
              gestureConfig={canvasGestureConfig}
              wheelZoomEnabled
            />
          </Pressable>
          <Minimap
            rgbaData={rgbaData}
            imgWidth={displayWidth || dimensions.width}
            imgHeight={displayHeight || dimensions.height}
            visible={showMinimap && interactive}
            viewportScale={transform.scale}
            viewportTranslateX={transform.translateX}
            viewportTranslateY={transform.translateY}
            canvasWidth={transform.canvasWidth}
            canvasHeight={transform.canvasHeight}
            onNavigate={(tx, ty) => ref.current?.setTransform(tx, ty)}
          />
        </View>
      );
    },
    [
      rgbaDataA,
      rgbaDataB,
      displayWidthA,
      displayHeightA,
      displayWidthB,
      displayHeightB,
      dimensionsA,
      dimensionsB,
      canvasA,
      canvasB,
      cursorA,
      cursorB,
      showGrid,
      showCrosshair,
      showMinimap,
      activeSide,
      handleCanvasTransformChange,
      settingsMinScale,
      settingsMaxScale,
      settingsDoubleTapScale,
      canvasGestureConfig,
    ],
  );

  const showBoth = !!fileA && !!fileB;

  return (
    <SafeAreaView
      testID="e2e-screen-compare__index"
      className="flex-1 bg-background"
      edges={["top"]}
    >
      <View
        className="flex-row items-center gap-2 py-2"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <Button size="sm" variant="outline" onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={16} color={mutedColor} />
        </Button>
        <Text className="flex-1 text-base font-semibold text-foreground">
          {t("gallery.compare")}
        </Text>
        <Button
          testID="e2e-action-compare__index-open-picker-a"
          size="sm"
          variant="outline"
          onPress={() => openPicker("A")}
        >
          <Button.Label className="text-[10px]">A</Button.Label>
        </Button>
        <Button
          testID="e2e-action-compare__index-open-picker-b"
          size="sm"
          variant="outline"
          onPress={() => openPicker("B")}
        >
          <Button.Label className="text-[10px]">B</Button.Label>
        </Button>
      </View>

      <View className="pb-2" style={{ paddingHorizontal: horizontalPadding }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1.5">
            {MODES.map((m) => (
              <Chip
                key={m.key}
                size="sm"
                variant={mode === m.key ? "primary" : "secondary"}
                onPress={() => handleModeChange(m.key)}
              >
                <Ionicons
                  name={m.icon}
                  size={10}
                  color={mode === m.key ? successColor : mutedColor}
                />
                <Chip.Label className="text-[10px]">{t(m.labelKey)}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      <View
        className="flex-1"
        style={{ paddingHorizontal: horizontalPadding }}
        onLayout={(e) => {
          setSplitLayoutWidth(e.nativeEvent.layout.width);
        }}
      >
        {mode === "blink" && (
          <View className="flex-1">
            {displayedSide === "A" ? renderCanvas("A", true) : renderCanvas("B", true)}
          </View>
        )}

        {mode === "side-by-side" && (
          <View className="flex-1 flex-row gap-2">
            <View className="flex-1">{renderCanvas("A")}</View>
            <View className="flex-1">
              {showBoth ? renderCanvas("B") : <View className="flex-1 bg-black" />}
            </View>
          </View>
        )}

        {mode === "split" && (
          <View className="flex-1 overflow-hidden rounded-lg bg-black">
            {renderCanvas("A", activeSide === "A")}
            {showBoth && (
              <View
                pointerEvents="box-none"
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: splitLayoutWidth * splitPosition,
                  overflow: "hidden",
                }}
              >
                {renderCanvas("B", activeSide === "B")}
              </View>
            )}
            {showBoth && (
              <>
                <View
                  pointerEvents="none"
                  style={{
                    position: "absolute",
                    top: 0,
                    bottom: 0,
                    left: splitLayoutWidth * splitPosition - 1,
                    width: 2,
                    backgroundColor: "#22c55e",
                  }}
                />
                <GestureDetector gesture={splitPanGesture}>
                  <View
                    accessibilityRole="adjustable"
                    accessibilityLabel={t("compare.splitHandle")}
                    accessibilityValue={{
                      min: 10,
                      max: 90,
                      now: Math.round(splitPosition * 100),
                    }}
                    style={{
                      position: "absolute",
                      top: 0,
                      bottom: 0,
                      left: splitLayoutWidth * splitPosition - 16,
                      width: 32,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <View
                      pointerEvents="none"
                      style={{
                        width: 4,
                        height: 32,
                        borderRadius: 999,
                        backgroundColor: "#22c55e",
                      }}
                    />
                  </View>
                </GestureDetector>
              </>
            )}
          </View>
        )}

        <PixelInspector
          x={activeCursor.x}
          y={activeCursor.y}
          value={activeValue}
          visible={showPixelInfo && (activeSide === "A" ? !!fileA : !!fileB)}
        />
      </View>

      <View
        className="py-2 border-t border-separator bg-background"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row gap-1">
            <Button
              testID="e2e-action-compare__index-toggle-linked"
              size="sm"
              variant={linked ? "primary" : "outline"}
              onPress={() => setLinked((v) => !v)}
            >
              <Button.Label className="text-[10px]">
                {linked ? t("compare.linked") : t("compare.unlinked")}
              </Button.Label>
            </Button>
            <Button
              testID="e2e-action-compare__index-auto-stretch"
              size="sm"
              variant="outline"
              onPress={handleAutoStretch}
            >
              <Ionicons name="flash-outline" size={12} color={mutedColor} />
            </Button>
            <Button size="sm" variant="outline" onPress={handleResetActive}>
              <Ionicons name="refresh-outline" size={12} color={mutedColor} />
            </Button>
            <Button size="sm" variant="outline" onPress={handleSaveActive}>
              <Ionicons name="save-outline" size={12} color={mutedColor} />
            </Button>
          </View>

          <View className="flex-row gap-1">
            <Button
              size="sm"
              variant={showGrid ? "primary" : "outline"}
              onPress={() => setShowGrid((v) => !v)}
            >
              <Ionicons
                name="grid-outline"
                size={12}
                color={showGrid ? successColor : mutedColor}
              />
            </Button>
            <Button
              size="sm"
              variant={showCrosshair ? "primary" : "outline"}
              onPress={() => setShowCrosshair((v) => !v)}
            >
              <Ionicons
                name="add-outline"
                size={12}
                color={showCrosshair ? successColor : mutedColor}
              />
            </Button>
            <Button
              size="sm"
              variant={showPixelInfo ? "primary" : "outline"}
              onPress={() => setShowPixelInfo((v) => !v)}
            >
              <Ionicons
                name="information-circle-outline"
                size={12}
                color={showPixelInfo ? successColor : mutedColor}
              />
            </Button>
            <Button
              size="sm"
              variant={showMinimap ? "primary" : "outline"}
              onPress={() => setShowMinimap((v) => !v)}
            >
              <Ionicons
                name="map-outline"
                size={12}
                color={showMinimap ? successColor : mutedColor}
              />
            </Button>
          </View>
        </View>

        {mode === "blink" && (
          <View className="mb-2">
            <View className="flex-row items-center justify-center gap-3 mb-1">
              <Pressable onPress={prevImage}>
                <Ionicons name="play-skip-back" size={18} color={mutedColor} />
              </Pressable>
              <Pressable onPress={toggleBlinkPlay}>
                <Ionicons
                  name={isBlinkPlaying ? "pause-circle" : "play-circle"}
                  size={32}
                  color={successColor}
                />
              </Pressable>
              <Pressable onPress={nextImage}>
                <Ionicons name="play-skip-forward" size={18} color={mutedColor} />
              </Pressable>
            </View>
            <SimpleSlider
              label={t("compare.blinkLabel")}
              value={blinkSpeed}
              min={0.3}
              max={5}
              step={0.1}
              onValueChange={handleBlinkSpeedChange}
            />
          </View>
        )}

        {mode === "split" && (
          <View className="mb-2">
            <SimpleSlider
              label={t("compare.splitLabel")}
              value={splitPosition}
              min={0.1}
              max={0.9}
              step={0.01}
              onValueChange={handleSplitPositionChange}
            />
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
          <View className="flex-row gap-1">
            {STRETCHES.map((s) => (
              <Chip
                key={s}
                size="sm"
                variant={activeAdjustments.stretch === s ? "primary" : "secondary"}
                onPress={() => updateAdjustments({ stretch: s })}
              >
                <Chip.Label className="text-[9px]">{s}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-1">
          <View className="flex-row gap-1">
            {COLORMAPS.map((c) => (
              <Chip
                key={c}
                size="sm"
                variant={activeAdjustments.colormap === c ? "primary" : "secondary"}
                onPress={() => updateAdjustments({ colormap: c })}
              >
                <Chip.Label className="text-[9px]">{c}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
        <SimpleSlider
          label="BP"
          value={activeAdjustments.blackPoint}
          min={0}
          max={1}
          step={0.01}
          onValueChange={(v) => updateAdjustments({ blackPoint: v })}
        />
        <SimpleSlider
          label="WP"
          value={activeAdjustments.whitePoint}
          min={0}
          max={1}
          step={0.01}
          onValueChange={(v) => updateAdjustments({ whitePoint: v })}
        />
        <SimpleSlider
          label="Gamma"
          value={activeAdjustments.gamma}
          min={0.1}
          max={5}
          step={0.1}
          onValueChange={(v) => updateAdjustments({ gamma: v })}
        />
        <SimpleSlider
          label="Bri"
          value={activeAdjustments.brightness}
          min={-0.5}
          max={0.5}
          step={0.01}
          onValueChange={(v) => updateAdjustments({ brightness: v })}
        />
        <SimpleSlider
          label="Ctr"
          value={activeAdjustments.contrast}
          min={0.2}
          max={2.5}
          step={0.05}
          onValueChange={(v) => updateAdjustments({ contrast: v })}
        />
        <SimpleSlider
          label="MTF"
          value={activeAdjustments.mtfMidtone}
          min={0.01}
          max={0.99}
          step={0.01}
          onValueChange={(v) => updateAdjustments({ mtfMidtone: v })}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-1">
            {VIEWER_CURVE_PRESETS.map((preset) => (
              <Chip
                key={preset.key}
                size="sm"
                variant={activeAdjustments.curvePreset === preset.key ? "primary" : "secondary"}
                onPress={() => updateAdjustments({ curvePreset: preset.key as ViewerCurvePreset })}
              >
                <Chip.Label className="text-[9px]">{t(preset.labelKey)}</Chip.Label>
              </Chip>
            ))}
          </View>
        </ScrollView>
      </View>

      <Dialog isOpen={showPicker} onOpenChange={(open) => !open && setShowPicker(false)}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="mx-6 w-full max-w-md rounded-2xl bg-background p-4">
            <Dialog.Title>
              {pickerTarget === "A" ? t("compare.selectA") : t("compare.selectB")}
            </Dialog.Title>
            <Input
              value={pickerQuery}
              onChangeText={setPickerQuery}
              placeholder={t("gallery.searchPlaceholder")}
              className="mt-2"
            />
            <ScrollView className="max-h-72 mt-2">
              {pickerFiles.map((f) => (
                <Pressable
                  key={f.id}
                  onPress={() => applyPickedFile(f.id)}
                  className="px-2 py-2 border-b border-separator"
                >
                  <Text className="text-sm text-foreground" numberOfLines={1}>
                    {f.filename}
                  </Text>
                  <Text className="text-[10px] text-muted">
                    {f.object ?? "—"} · {f.filter ?? "—"} · {f.exptime ?? 0}s
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <Button variant="outline" className="mt-3" onPress={() => setShowPicker(false)}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </SafeAreaView>
  );
}
