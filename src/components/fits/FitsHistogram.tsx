import { useRef, useCallback, useState } from "react";
import { View, Text, PanResponder } from "react-native";
import { useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";

interface FitsHistogramProps {
  counts: number[];
  edges: number[];
  blackPoint?: number;
  whitePoint?: number;
  width?: number;
  height?: number;
  onBlackPointChange?: (value: number) => void;
  onWhitePointChange?: (value: number) => void;
  logScale?: boolean;
}

export function FitsHistogram({
  counts,
  edges,
  blackPoint = 0,
  whitePoint = 1,
  width = 300,
  height = 100,
  onBlackPointChange,
  onWhitePointChange,
  logScale = false,
}: FitsHistogramProps) {
  const { t } = useI18n();
  const _mutedColor = useThemeColor("muted");
  const containerRef = useRef<View>(null);
  const [dragging, setDragging] = useState<"black" | "white" | null>(null);

  const processedCounts = logScale ? counts.map((c) => (c > 0 ? Math.log10(c + 1) : 0)) : counts;
  const maxCount = Math.max(...processedCounts, 1);
  const barWidth = width / counts.length;

  const handleTouch = useCallback(
    (pageX: number) => {
      if (!containerRef.current) return;
      containerRef.current.measure((_x, _y, w, _h, px) => {
        const relX = Math.min(Math.max((pageX - px) / w, 0), 1);
        if (dragging === "black" && onBlackPointChange) {
          onBlackPointChange(Math.min(relX, whitePoint - 0.01));
        } else if (dragging === "white" && onWhitePointChange) {
          onWhitePointChange(Math.max(relX, blackPoint + 0.01));
        }
      });
    },
    [dragging, blackPoint, whitePoint, onBlackPointChange, onWhitePointChange],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!onBlackPointChange || !!onWhitePointChange,
      onMoveShouldSetPanResponder: () => !!onBlackPointChange || !!onWhitePointChange,
      onPanResponderGrant: (evt) => {
        if (!containerRef.current) return;
        containerRef.current.measure((_x, _y, w, _h, px) => {
          const relX = (evt.nativeEvent.pageX - px) / w;
          const distBlack = Math.abs(relX - blackPoint);
          const distWhite = Math.abs(relX - whitePoint);
          setDragging(distBlack < distWhite ? "black" : "white");
        });
      },
      onPanResponderMove: (evt) => {
        handleTouch(evt.nativeEvent.pageX);
      },
      onPanResponderRelease: () => {
        setDragging(null);
      },
    }),
  ).current;

  const blackX = blackPoint * width;
  const whiteX = whitePoint * width;

  return (
    <View className="rounded-lg bg-surface-secondary p-3">
      <Text className="text-[10px] font-semibold text-muted mb-2">{t("viewer.histogram")}</Text>
      <View
        ref={containerRef}
        style={{
          width,
          height,
          flexDirection: "row",
          alignItems: "flex-end",
          position: "relative",
        }}
        {...panResponder.panHandlers}
      >
        {processedCounts.map((count, i) => {
          const barHeight = Math.max(1, (count / maxCount) * height);
          const normalized = i / counts.length;
          const isInRange = normalized >= blackPoint && normalized <= whitePoint;
          return (
            <View
              key={i}
              style={{
                width: barWidth,
                height: barHeight,
                backgroundColor: isInRange ? "#22c55e" : "#333",
              }}
            />
          );
        })}

        {/* Black point marker */}
        {onBlackPointChange && (
          <View
            style={{
              position: "absolute",
              left: blackX - 1,
              top: 0,
              width: 2,
              height,
              backgroundColor: dragging === "black" ? "#ef4444" : "#f97316",
            }}
          />
        )}

        {/* White point marker */}
        {onWhitePointChange && (
          <View
            style={{
              position: "absolute",
              left: whiteX - 1,
              top: 0,
              width: 2,
              height,
              backgroundColor: dragging === "white" ? "#3b82f6" : "#60a5fa",
            }}
          />
        )}
      </View>
      <View className="flex-row justify-between mt-1">
        <Text className="text-[8px] text-muted">{edges[0]?.toFixed(0)}</Text>
        {(onBlackPointChange || onWhitePointChange) && (
          <Text className="text-[8px] text-muted">
            BP: {blackPoint.toFixed(2)} | WP: {whitePoint.toFixed(2)}
          </Text>
        )}
        <Text className="text-[8px] text-muted">{edges[edges.length - 1]?.toFixed(0)}</Text>
      </View>
    </View>
  );
}
