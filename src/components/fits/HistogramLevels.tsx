import { useCallback, useMemo, useState } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import { Canvas, Path, Line, Skia, vec, LinearGradient, Rect } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Button, Chip, useThemeColor } from "heroui-native";
import { transformHistogramCounts } from "../../lib/utils/pixelMath";
import type { HistogramMode, ChannelHistogramData } from "../../lib/fits/types";
import { useI18n } from "../../i18n/useI18n";

type DragTarget = "black" | "white" | "midtone" | "outBlack" | "outWhite" | null;

type ChannelDisplay = "luminance" | "rgb" | "r" | "g" | "b";

interface HistogramLevelsProps {
  counts: number[];
  edges: number[];
  regionCounts?: number[];
  rgbHistogram?: ChannelHistogramData | null;
  blackPoint?: number;
  whitePoint?: number;
  midtone?: number;
  outputBlack?: number;
  outputWhite?: number;
  height?: number;
  onBlackPointChange?: (value: number) => void;
  onWhitePointChange?: (value: number) => void;
  onMidtoneChange?: (value: number) => void;
  onOutputBlackChange?: (value: number) => void;
  onOutputWhiteChange?: (value: number) => void;
  onAutoStretch?: () => void;
  onResetLevels?: () => void;
  onToggleRegionSelect?: () => void;
  isRegionSelectActive?: boolean;
  initialMode?: HistogramMode;
}

const HANDLE_SIZE = 10;
const OUTPUT_BAR_H = 20;
const GRADIENT_BAR_H = 12;
const SNAP_DISTANCE = 0.04;

function makeTrianglePath(centerX: number, topY: number, size: number) {
  const path = Skia.Path.Make();
  const half = size / 2;
  path.moveTo(centerX, topY);
  path.lineTo(centerX - half, topY + size);
  path.lineTo(centerX + half, topY + size);
  path.close();
  return path;
}

function formatEdgeLabel(value: number | undefined, range: number): string {
  if (value == null || !isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (range > 100) return value.toFixed(0);
  if (range > 1) return value.toFixed(1);
  if (range > 0.01) return value.toFixed(3);
  if (abs > 0 && abs < 0.001) return value.toExponential(2);
  return value.toFixed(4);
}

export function HistogramLevels({
  counts,
  edges,
  regionCounts,
  rgbHistogram,
  blackPoint = 0,
  whitePoint = 1,
  midtone = 0.5,
  outputBlack = 0,
  outputWhite = 1,
  height = 120,
  onBlackPointChange,
  onWhitePointChange,
  onMidtoneChange,
  onOutputBlackChange,
  onOutputWhiteChange,
  onAutoStretch,
  onResetLevels,
  onToggleRegionSelect,
  isRegionSelectActive = false,
  initialMode = "linear",
}: HistogramLevelsProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");
  const successColor = useThemeColor("success");

  const [canvasWidth, setCanvasWidth] = useState(0);
  const [mode, setMode] = useState<HistogramMode>(initialMode);
  const [channelDisplay, setChannelDisplay] = useState<ChannelDisplay>("luminance");

  const hasRgb = !!rgbHistogram;

  const draggingTarget = useSharedValue<DragTarget>(null);

  const interactive = !!(onBlackPointChange || onWhitePointChange || onMidtoneChange);
  const hasOutputControls = !!(onOutputBlackChange || onOutputWhiteChange);

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setCanvasWidth(e.nativeEvent.layout.width);
  }, []);

  // Process counts based on mode
  const processedCounts = useMemo(() => transformHistogramCounts(counts, mode), [counts, mode]);

  // Process RGB channel counts based on mode
  const processedChannels = useMemo(() => {
    if (!rgbHistogram) return null;
    return {
      r: transformHistogramCounts(rgbHistogram.r.counts, mode),
      g: transformHistogramCounts(rgbHistogram.g.counts, mode),
      b: transformHistogramCounts(rgbHistogram.b.counts, mode),
    };
  }, [rgbHistogram, mode]);

  // Process region counts with same mode
  const processedRegionCounts = useMemo(() => {
    if (!regionCounts || regionCounts.length === 0) return null;
    return transformHistogramCounts(regionCounts, mode);
  }, [regionCounts, mode]);

  // Max count for normalization (use global max for both, including RGB channels)
  const maxCount = useMemo(() => {
    let m = 1;
    for (let i = 0; i < processedCounts.length; i++) {
      if (processedCounts[i] > m) m = processedCounts[i];
    }
    if (processedRegionCounts) {
      for (let i = 0; i < processedRegionCounts.length; i++) {
        if (processedRegionCounts[i] > m) m = processedRegionCounts[i];
      }
    }
    if (processedChannels) {
      for (const ch of [processedChannels.r, processedChannels.g, processedChannels.b]) {
        for (let i = 0; i < ch.length; i++) {
          if (ch[i] > m) m = ch[i];
        }
      }
    }
    return m;
  }, [processedCounts, processedRegionCounts, processedChannels]);

  // Build Skia path for full histogram (muted background)
  const histogramPath = useMemo(() => {
    if (canvasWidth <= 0 || processedCounts.length === 0) return null;
    const path = Skia.Path.Make();
    const binCount = processedCounts.length;
    const barW = canvasWidth / binCount;
    path.moveTo(0, height);
    for (let i = 0; i < binCount; i++) {
      const barH = Math.max(0.5, (processedCounts[i] / maxCount) * height);
      const x = i * barW;
      const y2 = height - barH;
      path.lineTo(x, y2);
      path.lineTo(x + barW, y2);
    }
    path.lineTo(canvasWidth, height);
    path.close();
    return path;
  }, [processedCounts, maxCount, canvasWidth, height]);

  // Build per-channel Skia paths
  const channelPaths = useMemo(() => {
    if (!processedChannels || canvasWidth <= 0) return null;

    const buildPath = (data: number[]) => {
      if (data.length === 0) return null;
      const path = Skia.Path.Make();
      const binCount = data.length;
      const barW = canvasWidth / binCount;
      path.moveTo(0, height);
      for (let i = 0; i < binCount; i++) {
        const barH = Math.max(0.5, (data[i] / maxCount) * height);
        const x = i * barW;
        path.lineTo(x, height - barH);
        path.lineTo(x + barW, height - barH);
      }
      path.lineTo(canvasWidth, height);
      path.close();
      return path;
    };

    return {
      r: buildPath(processedChannels.r),
      g: buildPath(processedChannels.g),
      b: buildPath(processedChannels.b),
    };
  }, [processedChannels, maxCount, canvasWidth, height]);

  // Build Skia path for region histogram (bright overlay)
  const regionPath = useMemo(() => {
    if (canvasWidth <= 0 || !processedRegionCounts || processedRegionCounts.length === 0)
      return null;
    const path = Skia.Path.Make();
    const binCount = processedRegionCounts.length;
    const barW = canvasWidth / binCount;
    path.moveTo(0, height);
    for (let i = 0; i < binCount; i++) {
      const barH = Math.max(0.5, (processedRegionCounts[i] / maxCount) * height);
      const x = i * barW;
      const y2 = height - barH;
      path.lineTo(x, y2);
      path.lineTo(x + barW, y2);
    }
    path.lineTo(canvasWidth, height);
    path.close();
    return path;
  }, [processedRegionCounts, maxCount, canvasWidth, height]);

  // Build highlighted range path (between BP and WP)
  const rangePath = useMemo(() => {
    if (canvasWidth <= 0 || processedCounts.length === 0) return null;
    const path = Skia.Path.Make();
    const binCount = processedCounts.length;
    const barW = canvasWidth / binCount;
    const bpBin = Math.floor(blackPoint * binCount);
    const wpBin = Math.ceil(whitePoint * binCount);
    const startBin = Math.max(0, Math.min(bpBin, binCount));
    const endBin = Math.max(0, Math.min(wpBin, binCount));
    if (startBin >= endBin) return null;
    const startX = startBin * barW;
    path.moveTo(startX, height);
    for (let i = startBin; i < endBin; i++) {
      const barH = Math.max(0.5, (processedCounts[i] / maxCount) * height);
      const x = i * barW;
      const y2 = height - barH;
      path.lineTo(x, y2);
      path.lineTo(x + barW, y2);
    }
    path.lineTo(endBin * barW, height);
    path.close();
    return path;
  }, [processedCounts, maxCount, canvasWidth, height, blackPoint, whitePoint]);

  // Paints
  const bgPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(mutedColor || "#555"));
    p.setAlphaf(0.25);
    return p;
  }, [mutedColor]);

  const rangePaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(accentColor || "#22c55e"));
    p.setAlphaf(0.5);
    return p;
  }, [accentColor]);

  const regionPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("#fbbf24"));
    p.setAlphaf(0.6);
    return p;
  }, []);

  const redPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("#ef4444"));
    p.setAlphaf(0.55);
    return p;
  }, []);

  const greenPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("#22c55e"));
    p.setAlphaf(0.55);
    return p;
  }, []);

  const bluePaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("#3b82f6"));
    p.setAlphaf(0.55);
    return p;
  }, []);

  // Gesture callbacks
  const updateBlackPoint = useCallback(
    (val: number) => onBlackPointChange?.(val),
    [onBlackPointChange],
  );
  const updateWhitePoint = useCallback(
    (val: number) => onWhitePointChange?.(val),
    [onWhitePointChange],
  );
  const updateMidtone = useCallback((val: number) => onMidtoneChange?.(val), [onMidtoneChange]);

  // Compute midtone X position (between BP and WP)
  const midtoneX = useMemo(() => {
    return (blackPoint + midtone * (whitePoint - blackPoint)) * canvasWidth;
  }, [blackPoint, whitePoint, midtone, canvasWidth]);

  const blackX = blackPoint * canvasWidth;
  const whiteX = whitePoint * canvasWidth;

  // Input levels pan gesture (handles BP, midtone, WP)
  const inputPanGesture = useMemo(() => {
    if (!interactive || canvasWidth <= 0) return Gesture.Pan().enabled(false);

    return Gesture.Pan()
      .onBegin((e) => {
        "worklet";
        const relX = e.x / canvasWidth;
        const bpX = blackPoint;
        const wpX = whitePoint;
        const mtX = blackPoint + midtone * (whitePoint - blackPoint);

        const distB = Math.abs(relX - bpX);
        const distW = Math.abs(relX - wpX);
        const distM = Math.abs(relX - mtX);

        const minDist = Math.min(distB, distW, distM);
        if (minDist > SNAP_DISTANCE * 3) {
          draggingTarget.value = null;
          return;
        }

        if (minDist === distB) {
          draggingTarget.value = "black";
        } else if (minDist === distW) {
          draggingTarget.value = "white";
        } else {
          draggingTarget.value = "midtone";
        }
      })
      .onUpdate((e) => {
        "worklet";
        const relX = Math.min(Math.max(e.x / canvasWidth, 0), 1);

        if (draggingTarget.value === "black") {
          const clamped = Math.min(relX, whitePoint - 0.02);
          runOnJS(updateBlackPoint)(Math.max(0, clamped));
        } else if (draggingTarget.value === "white") {
          const clamped = Math.max(relX, blackPoint + 0.02);
          runOnJS(updateWhitePoint)(Math.min(1, clamped));
        } else if (draggingTarget.value === "midtone") {
          // Midtone is relative position between BP and WP
          const range = whitePoint - blackPoint;
          if (range > 0.02) {
            const mtPos = (relX - blackPoint) / range;
            const clamped = Math.min(Math.max(mtPos, 0.01), 0.99);
            runOnJS(updateMidtone)(clamped);
          }
        }
      })
      .onEnd(() => {
        "worklet";
        draggingTarget.value = null;
      })
      .minDistance(0);
  }, [
    interactive,
    canvasWidth,
    blackPoint,
    whitePoint,
    midtone,
    draggingTarget,
    updateBlackPoint,
    updateWhitePoint,
    updateMidtone,
  ]);

  // Tap gesture for quick-set closest handle
  const inputTapGesture = useMemo(() => {
    if (!interactive || canvasWidth <= 0) return Gesture.Tap().enabled(false);

    return Gesture.Tap().onEnd((e) => {
      "worklet";
      const relX = Math.min(Math.max(e.x / canvasWidth, 0), 1);
      const mtX = blackPoint + midtone * (whitePoint - blackPoint);

      const distB = Math.abs(relX - blackPoint);
      const distW = Math.abs(relX - whitePoint);
      const distM = Math.abs(relX - mtX);

      const minDist = Math.min(distB, distW, distM);

      if (minDist === distB) {
        const clamped = Math.min(relX, whitePoint - 0.02);
        runOnJS(updateBlackPoint)(Math.max(0, clamped));
      } else if (minDist === distW) {
        const clamped = Math.max(relX, blackPoint + 0.02);
        runOnJS(updateWhitePoint)(Math.min(1, clamped));
      } else {
        const range = whitePoint - blackPoint;
        if (range > 0.02) {
          const mtPos = (relX - blackPoint) / range;
          const clamped = Math.min(Math.max(mtPos, 0.01), 0.99);
          runOnJS(updateMidtone)(clamped);
        }
      }
    });
  }, [
    interactive,
    canvasWidth,
    blackPoint,
    whitePoint,
    midtone,
    updateBlackPoint,
    updateWhitePoint,
    updateMidtone,
  ]);

  const composedInputGesture = useMemo(
    () => Gesture.Race(inputPanGesture, inputTapGesture),
    [inputPanGesture, inputTapGesture],
  );

  // Output levels gesture
  const updateOutputBlack = useCallback(
    (val: number) => onOutputBlackChange?.(val),
    [onOutputBlackChange],
  );
  const updateOutputWhite = useCallback(
    (val: number) => onOutputWhiteChange?.(val),
    [onOutputWhiteChange],
  );

  const outputDragTarget = useSharedValue<"outBlack" | "outWhite" | null>(null);

  const outputPanGesture = useMemo(() => {
    if (!hasOutputControls || canvasWidth <= 0) return Gesture.Pan().enabled(false);

    return Gesture.Pan()
      .onBegin((e) => {
        "worklet";
        const relX = e.x / canvasWidth;
        const distB = Math.abs(relX - outputBlack);
        const distW = Math.abs(relX - outputWhite);
        outputDragTarget.value = distB < distW ? "outBlack" : "outWhite";
      })
      .onUpdate((e) => {
        "worklet";
        const relX = Math.min(Math.max(e.x / canvasWidth, 0), 1);
        if (outputDragTarget.value === "outBlack") {
          const clamped = Math.min(relX, outputWhite - 0.02);
          runOnJS(updateOutputBlack)(Math.max(0, clamped));
        } else if (outputDragTarget.value === "outWhite") {
          const clamped = Math.max(relX, outputBlack + 0.02);
          runOnJS(updateOutputWhite)(Math.min(1, clamped));
        }
      })
      .onEnd(() => {
        "worklet";
        outputDragTarget.value = null;
      })
      .minDistance(0);
  }, [
    hasOutputControls,
    canvasWidth,
    outputBlack,
    outputWhite,
    outputDragTarget,
    updateOutputBlack,
    updateOutputWhite,
  ]);

  // Edge labels
  const edgeRange = (edges[edges.length - 1] ?? 0) - (edges[0] ?? 0);

  // Mode cycle
  const cycleMode = useCallback(() => {
    setMode((prev) => {
      if (prev === "linear") return "log";
      if (prev === "log") return "cdf";
      return "linear";
    });
  }, []);

  const modeLabel = mode === "log" ? "LOG" : mode === "cdf" ? "CDF" : "LIN";

  const cycleChannel = useCallback(() => {
    setChannelDisplay((prev) => {
      if (prev === "luminance") return "rgb";
      if (prev === "rgb") return "r";
      if (prev === "r") return "g";
      if (prev === "g") return "b";
      return "luminance";
    });
  }, []);

  const channelLabel =
    channelDisplay === "luminance"
      ? "L"
      : channelDisplay === "rgb"
        ? "RGB"
        : channelDisplay.toUpperCase();

  const channelColor =
    channelDisplay === "r"
      ? "#ef4444"
      : channelDisplay === "g"
        ? "#22c55e"
        : channelDisplay === "b"
          ? "#3b82f6"
          : undefined;

  // Determine which paths to show based on channel mode
  const showLuminance = channelDisplay === "luminance";
  const showAllRgb = channelDisplay === "rgb";
  const showR = channelDisplay === "r" || showAllRgb;
  const showG = channelDisplay === "g" || showAllRgb;
  const showB = channelDisplay === "b" || showAllRgb;

  // Midtone → gamma display value
  const gammaFromMidtone = useMemo(() => {
    if (midtone <= 0.001 || midtone >= 0.999) return 1;
    return -Math.log(2) / Math.log(midtone);
  }, [midtone]);

  // Output level positions
  const outBlackX = outputBlack * canvasWidth;
  const outWhiteX = outputWhite * canvasWidth;

  return (
    <View className="rounded-lg bg-surface-secondary p-3">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[10px] font-semibold text-muted">{t("viewer.levels")}</Text>
        <View className="flex-row items-center gap-1">
          {onToggleRegionSelect && (
            <Button
              size="sm"
              variant={isRegionSelectActive ? "primary" : "ghost"}
              isIconOnly
              onPress={onToggleRegionSelect}
              className="h-6 w-6"
            >
              <Ionicons
                name="scan-outline"
                size={11}
                color={isRegionSelectActive ? "#fff" : mutedColor}
              />
            </Button>
          )}
          {onAutoStretch && (
            <Button
              size="sm"
              variant="ghost"
              onPress={onAutoStretch}
              className="flex-row items-center bg-primary/20 rounded-md px-1.5 py-0.5"
            >
              <Ionicons name="flash-outline" size={10} color={successColor} />
              <Button.Label className="text-[8px] font-semibold text-primary ml-0.5">
                {t("viewer.autoStretch")}
              </Button.Label>
            </Button>
          )}
          {onResetLevels && (
            <Button
              size="sm"
              variant="ghost"
              isIconOnly
              onPress={onResetLevels}
              className="h-6 w-6"
            >
              <Ionicons name="refresh-outline" size={11} color={mutedColor} />
            </Button>
          )}
          {hasRgb && (
            <Chip
              size="sm"
              variant="secondary"
              onPress={cycleChannel}
              style={channelColor ? { borderColor: channelColor, borderWidth: 1 } : undefined}
            >
              <Chip.Label
                className="text-[9px] font-bold"
                style={channelColor ? { color: channelColor } : undefined}
              >
                {channelLabel}
              </Chip.Label>
            </Chip>
          )}
          <Chip size="sm" variant="secondary" onPress={cycleMode}>
            <Chip.Label className="text-[9px] font-bold">{modeLabel}</Chip.Label>
          </Chip>
        </View>
      </View>

      {/* Histogram Canvas with Input Levels */}
      <View onLayout={handleLayout} style={{ height: height + HANDLE_SIZE + 2 }}>
        {canvasWidth > 0 && (
          <GestureDetector gesture={composedInputGesture}>
            <View style={{ width: canvasWidth, height: height + HANDLE_SIZE + 2 }}>
              <Canvas style={{ width: canvasWidth, height: height + HANDLE_SIZE + 2 }}>
                {/* Background histogram (full range, muted) */}
                {showLuminance && histogramPath && <Path path={histogramPath} paint={bgPaint} />}

                {/* Highlighted range (black–white points) */}
                {showLuminance && rangePath && <Path path={rangePath} paint={rangePaint} />}

                {/* Per-channel histogram overlays */}
                {channelPaths && showR && channelPaths.r && (
                  <Path path={channelPaths.r} paint={redPaint} />
                )}
                {channelPaths && showG && channelPaths.g && (
                  <Path path={channelPaths.g} paint={greenPaint} />
                )}
                {channelPaths && showB && channelPaths.b && (
                  <Path path={channelPaths.b} paint={bluePaint} />
                )}

                {/* Luminance bg when in single-channel mode (dimmed) */}
                {!showLuminance && !showAllRgb && histogramPath && (
                  <Path path={histogramPath} paint={bgPaint} />
                )}

                {/* Region histogram overlay */}
                {regionPath && <Path path={regionPath} paint={regionPaint} />}

                {/* Black point marker line */}
                {interactive && (
                  <Line
                    p1={vec(blackX, 0)}
                    p2={vec(blackX, height)}
                    color="#f97316"
                    strokeWidth={1.5}
                  />
                )}

                {/* White point marker line */}
                {interactive && (
                  <Line
                    p1={vec(whiteX, 0)}
                    p2={vec(whiteX, height)}
                    color="#60a5fa"
                    strokeWidth={1.5}
                  />
                )}

                {/* Midtone marker line (dashed effect via shorter line) */}
                {interactive && onMidtoneChange && (
                  <Line
                    p1={vec(midtoneX, 0)}
                    p2={vec(midtoneX, height)}
                    color="#a3a3a3"
                    strokeWidth={1}
                  />
                )}

                {/* Black point triangle handle ▲ */}
                {interactive && (
                  <Path path={makeTrianglePath(blackX, height + 1, HANDLE_SIZE)} color="#f97316" />
                )}

                {/* Midtone triangle handle ▲ */}
                {interactive && onMidtoneChange && (
                  <Path
                    path={makeTrianglePath(midtoneX, height + 1, HANDLE_SIZE)}
                    color="#a3a3a3"
                  />
                )}

                {/* White point triangle handle ▲ */}
                {interactive && (
                  <Path path={makeTrianglePath(whiteX, height + 1, HANDLE_SIZE)} color="#60a5fa" />
                )}
              </Canvas>
            </View>
          </GestureDetector>
        )}
      </View>

      {/* Input Levels labels */}
      <View className="flex-row justify-between mt-0.5">
        <View className="flex-row items-center gap-0.5">
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#f97316" }} />
          <Text className="text-[8px] text-muted">{blackPoint.toFixed(2)}</Text>
        </View>
        {onMidtoneChange && (
          <View className="flex-row items-center gap-0.5">
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#a3a3a3" }} />
            <Text className="text-[8px] text-muted">γ{gammaFromMidtone.toFixed(2)}</Text>
          </View>
        )}
        <View className="flex-row items-center gap-0.5">
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#60a5fa" }} />
          <Text className="text-[8px] text-muted">{whitePoint.toFixed(2)}</Text>
        </View>
      </View>

      {/* Output Levels */}
      {hasOutputControls && (
        <View className="mt-2">
          <Text className="text-[8px] text-muted mb-1">{t("viewer.outputLevels")}</Text>
          <GestureDetector gesture={outputPanGesture}>
            <View style={{ height: OUTPUT_BAR_H }}>
              {canvasWidth > 0 && (
                <Canvas style={{ width: canvasWidth, height: OUTPUT_BAR_H }}>
                  {/* Gradient bar background */}
                  <Rect x={0} y={0} width={canvasWidth} height={GRADIENT_BAR_H}>
                    <LinearGradient
                      start={vec(0, 0)}
                      end={vec(canvasWidth, 0)}
                      colors={["#000000", "#ffffff"]}
                    />
                  </Rect>

                  {/* Active range highlight */}
                  <Rect x={outBlackX} y={0} width={outWhiteX - outBlackX} height={GRADIENT_BAR_H}>
                    <LinearGradient
                      start={vec(outBlackX, 0)}
                      end={vec(outWhiteX, 0)}
                      colors={[
                        `rgba(${Math.round(outputBlack * 255)},${Math.round(outputBlack * 255)},${Math.round(outputBlack * 255)},1)`,
                        `rgba(${Math.round(outputWhite * 255)},${Math.round(outputWhite * 255)},${Math.round(outputWhite * 255)},1)`,
                      ]}
                    />
                  </Rect>

                  {/* Output black triangle */}
                  <Path
                    path={makeTrianglePath(outBlackX, GRADIENT_BAR_H + 1, HANDLE_SIZE - 2)}
                    color="#f97316"
                  />

                  {/* Output white triangle */}
                  <Path
                    path={makeTrianglePath(outWhiteX, GRADIENT_BAR_H + 1, HANDLE_SIZE - 2)}
                    color="#60a5fa"
                  />
                </Canvas>
              )}
            </View>
          </GestureDetector>

          {/* Output level labels */}
          <View className="flex-row justify-between mt-0.5">
            <Text className="text-[8px] text-muted">{Math.round(outputBlack * 255)}</Text>
            <Text className="text-[8px] text-muted">{Math.round(outputWhite * 255)}</Text>
          </View>
        </View>
      )}

      {/* Footer edge labels */}
      <View className="flex-row justify-between mt-1">
        <Text className="text-[8px] text-muted">{formatEdgeLabel(edges[0], edgeRange)}</Text>
        <Text className="text-[8px] text-muted">
          {formatEdgeLabel(edges[edges.length - 1], edgeRange)}
        </Text>
      </View>
    </View>
  );
}
