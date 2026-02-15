/**
 * Astrometry 天体标注 Skia 叠加层
 * 在 FitsCanvas 上绘制解析结果中的天体标注
 */

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { Canvas, Circle, Text as SkiaText, Group, useFont } from "@shopify/react-native-skia";
import type { AstrometryAnnotation, AstrometryAnnotationType } from "../../lib/astrometry/types";
import type { CanvasTransform } from "../fits/FitsCanvas";

interface AstrometryAnnotationOverlayProps {
  annotations: AstrometryAnnotation[];
  imageWidth: number;
  imageHeight: number;
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
  imageWidth,
  imageHeight,
  transform,
  visible,
}: AstrometryAnnotationOverlayProps) {
  const font = useFont(null, 10);

  // 计算像素坐标到画布坐标的变换
  const items = useMemo(() => {
    if (!visible || annotations.length === 0) return [];

    const { scale, translateX, translateY, canvasWidth, canvasHeight } = transform;

    // fit-to-canvas scale
    const fitScale = Math.min(canvasWidth / imageWidth, canvasHeight / imageHeight);
    const displayW = imageWidth * fitScale;
    const displayH = imageHeight * fitScale;
    const offsetX = (canvasWidth - displayW) / 2;
    const offsetY = (canvasHeight - displayH) / 2;

    return annotations
      .map((ann) => {
        // 像素坐标 → 画布坐标
        const cx = offsetX + ann.pixelx * fitScale;
        const cy = offsetY + ann.pixely * fitScale;

        // 应用缩放和平移
        const screenX = cx * scale + translateX + (canvasWidth * (1 - scale)) / 2;
        const screenY = cy * scale + translateY + (canvasHeight * (1 - scale)) / 2;

        // 过滤不可见的标注
        if (
          screenX < -50 ||
          screenX > canvasWidth + 50 ||
          screenY < -50 ||
          screenY > canvasHeight + 50
        ) {
          return null;
        }

        const radius = (ann.radius ?? 15) * fitScale * scale;
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
  }, [annotations, imageWidth, imageHeight, transform, visible]);

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
