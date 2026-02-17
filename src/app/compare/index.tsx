import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, ScrollView, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, Chip, Dialog, Input, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
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
import { computeAutoStretch } from "../../lib/utils/pixelMath";

const MODES: { key: CompareMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "blink", label: "Blink", icon: "eye-outline" },
  { key: "side-by-side", label: "Side by Side", icon: "git-compare-outline" },
  { key: "split", label: "Split", icon: "swap-horizontal-outline" },
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

export default function CompareScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ ids?: string }>();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);
  const { width: viewportWidth } = useWindowDimensions();
  const { horizontalPadding } = useResponsiveLayout();

  const files = useFitsStore((s) => s.files);
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
  const debounceMs = useSettingsStore((s) => s.imageProcessingDebounce);
  const useHighQualityPreview = useSettingsStore((s) => s.useHighQualityPreview);

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

  const initialIds = useMemo(() => (params.ids ? params.ids.split(",") : []), [params.ids]);
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
  } = useImageComparison({ initialIds });

  const fileA = useMemo(() => files.find((f) => f.id === imageIds[0]), [files, imageIds]);
  const fileB = useMemo(() => files.find((f) => f.id === imageIds[1]), [files, imageIds]);

  const fitsA = useFitsFile();
  const fitsB = useFitsFile();
  const procA = useImageProcessing();
  const procB = useImageProcessing();

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

  const canvasARef = useRef<FitsCanvasHandle>(null);
  const canvasBRef = useRef<FitsCanvasHandle>(null);
  const prevPixelsA = useRef<Float32Array | null>(null);
  const prevPixelsB = useRef<Float32Array | null>(null);

  useEffect(() => {
    if (!imageIds.length && initialIds.length) {
      setImageIds(initialIds);
    }
  }, [imageIds.length, initialIds, setImageIds]);

  useEffect(() => {
    if (fileA) {
      fitsA.loadFromPath(fileA.filepath, fileA.filename, fileA.fileSize);
      setAdjustmentsA(resolveAdjustmentsFromPreset(fileA.viewerPreset, defaultAdjustments));
      if (activeSide === "A") {
        const overlays = resolveOverlaysFromPreset(fileA.viewerPreset, defaultOverlays);
        setShowGrid(overlays.showGrid);
        setShowCrosshair(overlays.showCrosshair);
        setShowPixelInfo(overlays.showPixelInfo);
        setShowMinimap(overlays.showMinimap);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileA?.id, activeSide, defaultAdjustments, defaultOverlays]);

  useEffect(() => {
    if (fileB) {
      fitsB.loadFromPath(fileB.filepath, fileB.filename, fileB.fileSize);
      setAdjustmentsB(resolveAdjustmentsFromPreset(fileB.viewerPreset, defaultAdjustments));
      if (activeSide === "B") {
        const overlays = resolveOverlaysFromPreset(fileB.viewerPreset, defaultOverlays);
        setShowGrid(overlays.showGrid);
        setShowCrosshair(overlays.showCrosshair);
        setShowPixelInfo(overlays.showPixelInfo);
        setShowMinimap(overlays.showMinimap);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileB?.id, activeSide, defaultAdjustments, defaultOverlays]);

  useEffect(() => {
    const pixels = fitsA.pixels;
    const dimensions = fitsA.dimensions;
    if (!pixels || !dimensions) return;
    const isNew = prevPixelsA.current !== pixels;
    prevPixelsA.current = pixels;
    if (isNew) {
      const processFn = useHighQualityPreview ? procA.processImage : procA.processImagePreview;
      processFn(
        pixels,
        dimensions.width,
        dimensions.height,
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
      procA.processImage(
        pixels,
        dimensions.width,
        dimensions.height,
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
  }, [fitsA.pixels, fitsA.dimensions, adjustmentsA, procA, debounceMs, useHighQualityPreview]);

  useEffect(() => {
    const pixels = fitsB.pixels;
    const dimensions = fitsB.dimensions;
    if (!pixels || !dimensions) return;
    const isNew = prevPixelsB.current !== pixels;
    prevPixelsB.current = pixels;
    if (isNew) {
      const processFn = useHighQualityPreview ? procB.processImage : procB.processImagePreview;
      processFn(
        pixels,
        dimensions.width,
        dimensions.height,
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
      procB.processImage(
        pixels,
        dimensions.width,
        dimensions.height,
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
  }, [fitsB.pixels, fitsB.dimensions, adjustmentsB, procB, debounceMs, useHighQualityPreview]);

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
    const pixels = activeSide === "A" ? fitsA.pixels : fitsB.pixels;
    if (!pixels) return;
    const { blackPoint, whitePoint } = computeAutoStretch(pixels);
    updateAdjustments({
      blackPoint,
      whitePoint,
      midtone: 0.5,
      stretch: "asinh",
    });
  }, [activeSide, fitsA.pixels, fitsB.pixels, updateAdjustments]);

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
    if (!q) return files;
    return files.filter(
      (f) =>
        f.filename.toLowerCase().includes(q) ||
        f.object?.toLowerCase().includes(q) ||
        f.filter?.toLowerCase().includes(q),
    );
  }, [pickerQuery, files]);

  const activeCursor = activeSide === "A" ? cursorA : cursorB;
  const activePixels = activeSide === "A" ? fitsA.pixels : fitsB.pixels;
  const activeDims = activeSide === "A" ? fitsA.dimensions : fitsB.dimensions;
  const activeValue =
    activePixels && activeDims && activeCursor.x >= 0 && activeCursor.y >= 0
      ? (activePixels[activeCursor.y * activeDims.width + activeCursor.x] ?? null)
      : null;

  const renderCanvas = useCallback(
    (side: "A" | "B", forceInteractive = false) => {
      const proc = side === "A" ? procA : procB;
      const fits = side === "A" ? fitsA : fitsB;
      const transform = side === "A" ? canvasA : canvasB;
      const setTransform = side === "A" ? setCanvasA : setCanvasB;
      const ref = side === "A" ? canvasARef : canvasBRef;
      const cursor = side === "A" ? cursorA : cursorB;
      const setCursor = side === "A" ? setCursorA : setCursorB;
      const interactive = forceInteractive || activeSide === side;

      if (!proc.rgbaData || !fits.dimensions) {
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
              rgbaData={proc.rgbaData}
              width={proc.displayWidth || fits.dimensions.width}
              height={proc.displayHeight || fits.dimensions.height}
              sourceWidth={fits.dimensions.width}
              sourceHeight={fits.dimensions.height}
              showGrid={showGrid && interactive}
              showCrosshair={showCrosshair && interactive}
              cursorX={interactive ? cursor.x : -1}
              cursorY={interactive ? cursor.y : -1}
              onPixelTap={(x, y) => {
                setActiveSide(side);
                setCursor({ x, y });
              }}
              onTransformChange={setTransform}
              interactionEnabled={interactive}
              wheelZoomEnabled
            />
          </Pressable>
          <Minimap
            rgbaData={proc.rgbaData}
            imgWidth={proc.displayWidth || fits.dimensions.width}
            imgHeight={proc.displayHeight || fits.dimensions.height}
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
      procA,
      procB,
      fitsA,
      fitsB,
      canvasA,
      canvasB,
      cursorA,
      cursorB,
      showGrid,
      showCrosshair,
      showMinimap,
      activeSide,
    ],
  );

  const showBoth = !!fileA && !!fileB;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
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
        <Button size="sm" variant="outline" onPress={() => openPicker("A")}>
          <Button.Label className="text-[10px]">A</Button.Label>
        </Button>
        <Button size="sm" variant="outline" onPress={() => openPicker("B")}>
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
                onPress={() => setMode(m.key)}
              >
                <Ionicons
                  name={m.icon}
                  size={10}
                  color={mode === m.key ? successColor : mutedColor}
                />
                <Chip.Label className="text-[10px]">{m.label}</Chip.Label>
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
            {activeIndex === 0 ? renderCanvas("A", true) : renderCanvas("B", true)}
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
              <View
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: splitLayoutWidth * splitPosition - 1,
                  width: 2,
                  backgroundColor: "#22c55e",
                }}
              />
            )}
          </View>
        )}

        <PixelInspector
          x={activeCursor.x}
          y={activeCursor.y}
          value={activeValue}
          visible={showPixelInfo && activeSide !== "B" ? !!fileA : !!fileB}
        />
      </View>

      <View
        className="py-2 border-t border-separator bg-background"
        style={{ paddingHorizontal: horizontalPadding }}
      >
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row gap-1">
            <Button
              size="sm"
              variant={linked ? "primary" : "outline"}
              onPress={() => setLinked((v) => !v)}
            >
              <Button.Label className="text-[10px]">{linked ? "Linked" : "Unlinked"}</Button.Label>
            </Button>
            <Button size="sm" variant="outline" onPress={handleAutoStretch}>
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
              label="Blink"
              value={blinkSpeed}
              min={0.3}
              max={5}
              step={0.1}
              onValueChange={setBlinkSpeed}
            />
          </View>
        )}

        {mode === "split" && (
          <View className="mb-2">
            <SimpleSlider
              label="Split"
              value={splitPosition}
              min={0.1}
              max={0.9}
              step={0.01}
              onValueChange={setSplitPosition}
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
            <Dialog.Title>{pickerTarget === "A" ? "Select A" : "Select B"}</Dialog.Title>
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
