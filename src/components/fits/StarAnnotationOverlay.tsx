import { useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Canvas,
  Circle,
  Text as SkiaText,
  Group,
  RoundedRect,
  useFont,
} from "@shopify/react-native-skia";
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
const ANCHOR_BG_COLOR = "#111827cc";
const ANCHOR_TEXT_COLOR = "#f9fafb";
const MAX_RENDERED = 500;
const MARKER_RADIUS = 5;

interface StarItem {
  id: string;
  x: number;
  y: number;
  color: string;
  enabled: boolean;
  anchorIndex?: 1 | 2 | 3;
  source: "detected" | "manual";
}

export function StarAnnotationOverlay({
  points,
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  transform,
  visible,
}: StarAnnotationOverlayProps) {
  const font = useFont(null, 8);

  const items = useMemo(() => {
    if (!visible || points.length === 0 || renderWidth <= 0 || renderHeight <= 0) return [];
    const result: StarItem[] = [];
    const margin = MARKER_RADIUS * 4;
    for (const point of points) {
      if (result.length >= MAX_RENDERED) break;
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
        screenPoint.x < -margin ||
        screenPoint.y < -margin ||
        screenPoint.x > transform.canvasWidth + margin ||
        screenPoint.y > transform.canvasHeight + margin
      ) {
        continue;
      }

      const baseColor = point.enabled
        ? point.source === "manual"
          ? MANUAL_COLOR
          : DETECTED_COLOR
        : DISABLED_COLOR;
      result.push({
        id: point.id,
        x: screenPoint.x,
        y: screenPoint.y,
        color: baseColor,
        enabled: point.enabled,
        anchorIndex: point.anchorIndex,
        source: point.source,
      });
    }
    return result;
  }, [points, renderWidth, renderHeight, sourceWidth, sourceHeight, transform, visible]);

  if (!visible || items.length === 0) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group>
        {items.map((item) => (
          <Group key={item.id}>
            {item.enabled && (
              <Circle
                cx={item.x}
                cy={item.y}
                r={MARKER_RADIUS}
                color={item.color}
                style="fill"
                opacity={0.2}
              />
            )}
            <Circle
              cx={item.x}
              cy={item.y}
              r={MARKER_RADIUS}
              color={item.color}
              style="stroke"
              strokeWidth={1.5}
            />
            {item.anchorIndex != null && font && (
              <>
                <RoundedRect
                  x={item.x + MARKER_RADIUS + 3}
                  y={item.y - MARKER_RADIUS - 4}
                  width={12}
                  height={12}
                  r={6}
                  color={ANCHOR_BG_COLOR}
                />
                <SkiaText
                  x={item.x + MARKER_RADIUS + 6}
                  y={item.y - MARKER_RADIUS + 5}
                  text={String(item.anchorIndex)}
                  font={font}
                  color={ANCHOR_TEXT_COLOR}
                />
              </>
            )}
          </Group>
        ))}
      </Group>
    </Canvas>
  );
}
