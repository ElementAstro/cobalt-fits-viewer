import { useMemo } from "react";
import { Text, View } from "react-native";
import type { StarAnnotationPoint } from "../../lib/fits/types";
import type { CanvasTransform } from "./FitsCanvas";
import { imageToScreenPoint, remapPointBetweenSpaces } from "../../lib/viewer/transform";

interface StarAnnotationOverlayProps {
  points: StarAnnotationPoint[];
  renderWidth: number;
  renderHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  transform: CanvasTransform;
  visible: boolean;
}

const MANUAL_COLOR = "#22c55e";
const DETECTED_COLOR = "#f59e0b";
const DISABLED_COLOR = "#6b7280";

export function StarAnnotationOverlay({
  points,
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  transform,
  visible,
}: StarAnnotationOverlayProps) {
  const items = useMemo(() => {
    if (!visible || points.length === 0 || renderWidth <= 0 || renderHeight <= 0) return [];
    return points
      .map((point) => {
        const renderPoint = remapPointBetweenSpaces(
          { x: point.x, y: point.y },
          sourceWidth,
          sourceHeight,
          renderWidth,
          renderHeight,
        );
        const screenPoint = imageToScreenPoint(renderPoint, transform, renderWidth, renderHeight);
        if (
          !Number.isFinite(screenPoint.x) ||
          !Number.isFinite(screenPoint.y) ||
          screenPoint.x < -20 ||
          screenPoint.y < -20 ||
          screenPoint.x > transform.canvasWidth + 20 ||
          screenPoint.y > transform.canvasHeight + 20
        ) {
          return null;
        }

        const baseColor = point.enabled
          ? point.source === "manual"
            ? MANUAL_COLOR
            : DETECTED_COLOR
          : DISABLED_COLOR;
        return {
          id: point.id,
          x: screenPoint.x,
          y: screenPoint.y,
          color: baseColor,
          enabled: point.enabled,
          anchorIndex: point.anchorIndex,
          source: point.source,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      x: number;
      y: number;
      color: string;
      enabled: boolean;
      anchorIndex?: 1 | 2 | 3;
      source: "detected" | "manual";
    }>;
  }, [points, renderWidth, renderHeight, sourceWidth, sourceHeight, transform, visible]);

  if (!visible || items.length === 0) return null;

  return (
    <View className="absolute inset-0" pointerEvents="none">
      {items.map((item) => (
        <View
          key={item.id}
          style={{
            position: "absolute",
            left: item.x - 5,
            top: item.y - 5,
            width: 10,
            height: 10,
            borderRadius: 999,
            borderWidth: 1.5,
            borderColor: item.color,
            backgroundColor: item.enabled ? `${item.color}33` : "transparent",
          }}
        >
          {item.anchorIndex && (
            <View
              style={{
                position: "absolute",
                left: 8,
                top: -10,
                minWidth: 12,
                paddingHorizontal: 3,
                borderRadius: 6,
                backgroundColor: "#111827cc",
              }}
            >
              <Text
                style={{
                  color: "#f9fafb",
                  fontSize: 8,
                  fontWeight: "700",
                  textAlign: "center",
                }}
              >
                {item.anchorIndex}
              </Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}
