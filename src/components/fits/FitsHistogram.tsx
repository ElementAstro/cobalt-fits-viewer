import { useCallback, useMemo, useState } from "react";
import { View, Text, LayoutChangeEvent } from "react-native";
import { Canvas, Path, Line, Skia, vec } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS, useSharedValue } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { Chip, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

type HistogramMode = "linear" | "log" | "cdf";

interface FitsHistogramProps {
  counts: number[];
  edges: number[];
  blackPoint?: number;
  whitePoint?: number;
  height?: number;
  onBlackPointChange?: (value: number) => void;
  onWhitePointChange?: (value: number) => void;
  initialMode?: HistogramMode;
}

/**
 * Format edge label based on data range for optimal readability
 */
function formatEdgeLabel(value: number | undefined, range: number): string {
  if (value == null || !isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (range > 100) return value.toFixed(0);
  if (range > 1) return value.toFixed(1);
  if (range > 0.01) return value.toFixed(3);
  if (abs > 0 && abs < 0.001) return value.toExponential(2);
  return value.toFixed(4);
}

export function FitsHistogram({
  counts,
  edges,
  blackPoint = 0,
  whitePoint = 1,
  height = 100,
  onBlackPointChange,
  onWhitePointChange,
  initialMode = "linear",
}: FitsHistogramProps) {
  const { t } = useI18n();
  const mutedColor = useThemeColor("muted");
  const accentColor = useThemeColor("accent");

  const [canvasWidth, setCanvasWidth] = useState(0);
  const [mode, setMode] = useState<HistogramMode>(initialMode);

  const draggingTarget = useSharedValue<"black" | "white" | null>(null);

  const interactive = !!(onBlackPointChange || onWhitePointChange);

  // Responsive width via onLayout
  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setCanvasWidth(e.nativeEvent.layout.width);
  }, []);

  // Process counts based on mode (log / cdf / linear)
  const processedCounts = useMemo(() => {
    if (counts.length === 0) return [];
    if (mode === "log") {
      return counts.map((c) => (c > 0 ? Math.log10(c + 1) : 0));
    }
    if (mode === "cdf") {
      const cdf: number[] = new Array(counts.length);
      cdf[0] = counts[0];
      for (let i = 1; i < counts.length; i++) {
        cdf[i] = cdf[i - 1] + counts[i];
      }
      const total = cdf[counts.length - 1];
      if (total > 0) {
        for (let i = 0; i < counts.length; i++) {
          cdf[i] = cdf[i] / total;
        }
      }
      return cdf;
    }
    return counts;
  }, [counts, mode]);

  // Safe max computation (no spread operator)
  const maxCount = useMemo(() => {
    let m = 1;
    for (let i = 0; i < processedCounts.length; i++) {
      if (processedCounts[i] > m) m = processedCounts[i];
    }
    return m;
  }, [processedCounts]);

  // Build Skia path for histogram bars
  const histogramPath = useMemo(() => {
    if (canvasWidth <= 0 || processedCounts.length === 0) return null;

    const path = Skia.Path.Make();
    const binCount = processedCounts.length;
    const barW = canvasWidth / binCount;

    path.moveTo(0, height);
    for (let i = 0; i < binCount; i++) {
      const barH = Math.max(0.5, (processedCounts[i] / maxCount) * height);
      const x = i * barW;
      const y = height - barH;
      path.lineTo(x, y);
      path.lineTo(x + barW, y);
    }
    path.lineTo(canvasWidth, height);
    path.close();

    return path;
  }, [processedCounts, maxCount, canvasWidth, height]);

  // Build highlight path for black-white range
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
      const y = height - barH;
      path.lineTo(x, y);
      path.lineTo(x + barW, y);
    }
    path.lineTo(endBin * barW, height);
    path.close();

    return path;
  }, [processedCounts, maxCount, canvasWidth, height, blackPoint, whitePoint]);

  // Skia paints
  const bgPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(mutedColor || "#555"));
    p.setAlphaf(0.3);
    return p;
  }, [mutedColor]);

  const rangePaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(accentColor || "#22c55e"));
    p.setAlphaf(0.8);
    return p;
  }, [accentColor]);

  // Gesture handling (runs on JS thread via runOnJS)
  const updateBlackPoint = useCallback(
    (val: number) => onBlackPointChange?.(val),
    [onBlackPointChange],
  );
  const updateWhitePoint = useCallback(
    (val: number) => onWhitePointChange?.(val),
    [onWhitePointChange],
  );

  const panGesture = useMemo(() => {
    if (!interactive || canvasWidth <= 0) return Gesture.Pan().enabled(false);

    return Gesture.Pan()
      .onBegin((e) => {
        "worklet";
        const relX = e.x / canvasWidth;
        const distB = Math.abs(relX - blackPoint);
        const distW = Math.abs(relX - whitePoint);
        draggingTarget.value = distB < distW ? "black" : "white";
      })
      .onUpdate((e) => {
        "worklet";
        const relX = Math.min(Math.max(e.x / canvasWidth, 0), 1);
        if (draggingTarget.value === "black") {
          const clamped = Math.min(relX, whitePoint - 0.01);
          runOnJS(updateBlackPoint)(clamped);
        } else if (draggingTarget.value === "white") {
          const clamped = Math.max(relX, blackPoint + 0.01);
          runOnJS(updateWhitePoint)(clamped);
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
    draggingTarget,
    updateBlackPoint,
    updateWhitePoint,
  ]);

  // Tap gesture for quick-set
  const tapGesture = useMemo(() => {
    if (!interactive || canvasWidth <= 0) return Gesture.Tap().enabled(false);

    return Gesture.Tap().onEnd((e) => {
      "worklet";
      const relX = Math.min(Math.max(e.x / canvasWidth, 0), 1);
      const distB = Math.abs(relX - blackPoint);
      const distW = Math.abs(relX - whitePoint);
      if (distB < distW) {
        const clamped = Math.min(relX, whitePoint - 0.01);
        runOnJS(updateBlackPoint)(clamped);
      } else {
        const clamped = Math.max(relX, blackPoint + 0.01);
        runOnJS(updateWhitePoint)(clamped);
      }
    });
  }, [interactive, canvasWidth, blackPoint, whitePoint, updateBlackPoint, updateWhitePoint]);

  const composedGesture = useMemo(
    () => Gesture.Race(panGesture, tapGesture),
    [panGesture, tapGesture],
  );

  // Marker positions
  const blackX = blackPoint * canvasWidth;
  const whiteX = whitePoint * canvasWidth;

  // Edge label formatting
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

  return (
    <View className="rounded-lg bg-surface-secondary p-3">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-[10px] font-semibold text-muted">{t("viewer.histogram")}</Text>
        <Chip size="sm" variant="secondary" onPress={cycleMode}>
          <Chip.Label className="text-[9px] font-bold">{modeLabel}</Chip.Label>
        </Chip>
      </View>

      {/* Canvas */}
      <View onLayout={handleLayout} style={{ height }}>
        {canvasWidth > 0 && (
          <GestureDetector gesture={composedGesture}>
            <View style={{ width: canvasWidth, height }}>
              <Canvas style={{ width: canvasWidth, height }}>
                {/* Background histogram (full range, muted) */}
                {histogramPath && <Path path={histogramPath} paint={bgPaint} />}

                {/* Highlighted range (black–white points) */}
                {rangePath && <Path path={rangePath} paint={rangePaint} />}

                {/* Black point marker */}
                {interactive && (
                  <Line
                    p1={vec(blackX, 0)}
                    p2={vec(blackX, height)}
                    color="#f97316"
                    strokeWidth={2}
                  />
                )}

                {/* White point marker */}
                {interactive && (
                  <Line
                    p1={vec(whiteX, 0)}
                    p2={vec(whiteX, height)}
                    color="#60a5fa"
                    strokeWidth={2}
                  />
                )}
              </Canvas>
            </View>
          </GestureDetector>
        )}
      </View>

      {/* Footer labels */}
      <View className="flex-row justify-between mt-1">
        <Text className="text-[8px] text-muted">{formatEdgeLabel(edges[0], edgeRange)}</Text>
        {interactive && (
          <View className="flex-row items-center gap-2">
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="remove-circle" size={8} color="#f97316" />
              <Text className="text-[8px] text-muted">{blackPoint.toFixed(2)}</Text>
            </View>
            <View className="flex-row items-center gap-0.5">
              <Ionicons name="add-circle" size={8} color="#60a5fa" />
              <Text className="text-[8px] text-muted">{whitePoint.toFixed(2)}</Text>
            </View>
          </View>
        )}
        <Text className="text-[8px] text-muted">
          {formatEdgeLabel(edges[edges.length - 1], edgeRange)}
        </Text>
      </View>
    </View>
  );
}
