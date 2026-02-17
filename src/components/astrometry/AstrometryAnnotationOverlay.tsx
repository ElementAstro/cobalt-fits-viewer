/**
 * Astrometry 天体标注 Skia 叠加层
 * 在 FitsCanvas 上绘制解析结果中的天体标注
 */

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Circle, Text as SkiaText, Group, useFont } from "@shopify/react-native-skia";
import type { AstrometryAnnotation, AstrometryAnnotationType } from "../../lib/astrometry/types";
import type { CanvasTransform } from "../fits/FitsCanvas";
import { imageToScreenPoint, remapPointBetweenSpaces } from "../../lib/viewer/transform";

interface AstrometryAnnotationOverlayProps {
  annotations: AstrometryAnnotation[];
  renderWidth: number;
  renderHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  transform: CanvasTransform;
  visible: boolean;
}

const TYPE_COLORS: Record<AstrometryAnnotationType, string> = {
  messier: "#ff4444",
  ngc: "#ffaa00",
  ic: "#44aaff",
  hd: "#aaaaaa",
  bright_star: "#44ff88",
  star: "#cccccc",
  other: "#888888",
};

const CIRCLE_OPACITY = 0.7;
const TEXT_OPACITY = 0.9;
const MIN_VISIBLE_SCALE = 0.3;

export function AstrometryAnnotationOverlay({
  annotations,
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  transform,
  visible,
}: AstrometryAnnotationOverlayProps) {
  const font = useFont(null, 10);

  // 计算像素坐标到画布坐标的变换
  const items = useMemo(() => {
    if (!visible || annotations.length === 0 || renderWidth <= 0 || renderHeight <= 0) return [];
    const fitScale = Math.min(
      transform.canvasWidth / renderWidth,
      transform.canvasHeight / renderHeight,
    );
    const sourceToRenderScale =
      sourceWidth > 0 && sourceHeight > 0
        ? (renderWidth / sourceWidth + renderHeight / sourceHeight) / 2
        : 1;

    return annotations
      .map((ann) => {
        const renderPoint = remapPointBetweenSpaces(
          { x: ann.pixelx, y: ann.pixely },
          sourceWidth,
          sourceHeight,
          renderWidth,
          renderHeight,
        );
        const p = imageToScreenPoint(
          { x: renderPoint.x, y: renderPoint.y },
          transform,
          renderWidth,
          renderHeight,
        );
        const screenX = p.x;
        const screenY = p.y;

        // 过滤不可见的标注
        if (
          screenX < -50 ||
          screenX > transform.canvasWidth + 50 ||
          screenY < -50 ||
          screenY > transform.canvasHeight + 50
        ) {
          return null;
        }

        const radius = (ann.radius ?? 15) * sourceToRenderScale * fitScale * transform.scale;
        const color = TYPE_COLORS[ann.type] ?? TYPE_COLORS.other;
        const label = ann.names.length > 0 ? ann.names[0] : "";

        return {
          x: screenX,
          y: screenY,
          radius: Math.max(4, Math.min(radius, 60)),
          color,
          label,
        };
      })
      .filter(Boolean) as Array<{
      x: number;
      y: number;
      radius: number;
      color: string;
      label: string;
    }>;
  }, [annotations, renderWidth, renderHeight, sourceWidth, sourceHeight, transform, visible]);

  if (!visible || items.length === 0 || transform.scale < MIN_VISIBLE_SCALE) {
    return null;
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group>
        {items.map((item, i) => (
          <Group key={i}>
            <Circle
              cx={item.x}
              cy={item.y}
              r={item.radius}
              color={item.color}
              style="stroke"
              strokeWidth={1.5}
              opacity={CIRCLE_OPACITY}
            />
            {font && item.label && (
              <SkiaText
                x={item.x + item.radius + 3}
                y={item.y - 2}
                text={item.label}
                font={font}
                color={item.color}
                opacity={TEXT_OPACITY}
              />
            )}
          </Group>
        ))}
      </Group>
    </Canvas>
  );
}
