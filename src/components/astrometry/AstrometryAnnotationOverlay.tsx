/**
 * Astrometry 天体标注 Skia 叠加层
 * 在 FitsCanvas 上绘制解析结果中的天体标注
 * 按类型分化渲染样式，缩放级别智能适配
 */

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Canvas,
  Circle,
  Line as SkiaLine,
  Text as SkiaText,
  Group,
  useFont,
  DashPathEffect,
  vec,
} from "@shopify/react-native-skia";
import type { AstrometryAnnotation, AstrometryAnnotationType } from "../../lib/astrometry/types";
import { ANNOTATION_TYPE_COLORS } from "../../lib/astrometry/annotationConstants";
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
  visibleTypes?: AstrometryAnnotationType[];
}

type RenderStyle = "solid_circle" | "dash_circle" | "crosshair" | "dot";

interface AnnotationItem {
  x: number;
  y: number;
  radius: number;
  color: string;
  label: string;
  type: AstrometryAnnotationType;
  renderStyle: RenderStyle;
  strokeWidth: number;
  showLabel: boolean;
}

const CIRCLE_OPACITY = 0.7;
const TEXT_OPACITY = 0.9;
const MIN_VISIBLE_SCALE = 0.3;

function getRenderStyle(
  type: AstrometryAnnotationType,
  scale: number,
): {
  style: RenderStyle;
  strokeWidth: number;
  showLabel: boolean;
} {
  switch (type) {
    case "messier":
      return { style: "solid_circle", strokeWidth: 2, showLabel: scale >= 0.8 };
    case "ngc":
    case "ic":
      return { style: "dash_circle", strokeWidth: 1.5, showLabel: scale >= 1.0 };
    case "bright_star":
      return { style: "crosshair", strokeWidth: 1.5, showLabel: scale >= 1.0 };
    case "hd":
    case "star":
      return { style: "dot", strokeWidth: 1, showLabel: scale >= 2.0 };
    default:
      return { style: "solid_circle", strokeWidth: 1, showLabel: scale >= 1.0 };
  }
}

function shouldShowAtScale(type: AstrometryAnnotationType, scale: number): boolean {
  if (type === "hd" || type === "star") return scale >= 0.5;
  return true;
}

export function AstrometryAnnotationOverlay({
  annotations,
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  transform,
  visible,
  visibleTypes,
}: AstrometryAnnotationOverlayProps) {
  const font = useFont(null, 10);
  const fontBold = useFont(null, 11);

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

    const filtered = visibleTypes
      ? annotations.filter((a) => visibleTypes.includes(a.type))
      : annotations;

    return filtered
      .map((ann): AnnotationItem | null => {
        if (!shouldShowAtScale(ann.type, transform.scale)) return null;

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

        if (
          screenX < -50 ||
          screenX > transform.canvasWidth + 50 ||
          screenY < -50 ||
          screenY > transform.canvasHeight + 50
        ) {
          return null;
        }

        const radius = (ann.radius ?? 15) * sourceToRenderScale * fitScale * transform.scale;
        const color = ANNOTATION_TYPE_COLORS[ann.type] ?? ANNOTATION_TYPE_COLORS.other;
        const label = ann.names.length > 0 ? ann.names[0] : "";
        const { style, strokeWidth, showLabel } = getRenderStyle(ann.type, transform.scale);

        return {
          x: screenX,
          y: screenY,
          radius: Math.max(4, Math.min(radius, 60)),
          color,
          label,
          type: ann.type,
          renderStyle: style,
          strokeWidth,
          showLabel,
        };
      })
      .filter(Boolean) as AnnotationItem[];
  }, [
    annotations,
    renderWidth,
    renderHeight,
    sourceWidth,
    sourceHeight,
    transform,
    visible,
    visibleTypes,
  ]);

  if (!visible || items.length === 0 || transform.scale < MIN_VISIBLE_SCALE) {
    return null;
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group>
        {items.map((item, i) => {
          const labelFont = item.type === "messier" ? (fontBold ?? font) : font;
          const crossLen = Math.max(6, item.radius * 0.6);

          return (
            <Group key={i}>
              {/* Solid circle: messier, other */}
              {item.renderStyle === "solid_circle" && (
                <Circle
                  cx={item.x}
                  cy={item.y}
                  r={item.radius}
                  color={item.color}
                  style="stroke"
                  strokeWidth={item.strokeWidth}
                  opacity={CIRCLE_OPACITY}
                />
              )}

              {/* Dashed circle: NGC, IC */}
              {item.renderStyle === "dash_circle" && (
                <Circle
                  cx={item.x}
                  cy={item.y}
                  r={item.radius}
                  color={item.color}
                  style="stroke"
                  strokeWidth={item.strokeWidth}
                  opacity={CIRCLE_OPACITY}
                >
                  <DashPathEffect intervals={[4, 3]} />
                </Circle>
              )}

              {/* Crosshair marker: bright stars */}
              {item.renderStyle === "crosshair" && (
                <>
                  <SkiaLine
                    p1={vec(item.x - crossLen, item.y)}
                    p2={vec(item.x + crossLen, item.y)}
                    color={item.color}
                    strokeWidth={item.strokeWidth}
                    opacity={CIRCLE_OPACITY}
                  />
                  <SkiaLine
                    p1={vec(item.x, item.y - crossLen)}
                    p2={vec(item.x, item.y + crossLen)}
                    color={item.color}
                    strokeWidth={item.strokeWidth}
                    opacity={CIRCLE_OPACITY}
                  />
                </>
              )}

              {/* Small dot: HD, star */}
              {item.renderStyle === "dot" && (
                <Circle
                  cx={item.x}
                  cy={item.y}
                  r={Math.min(3, item.radius * 0.3)}
                  color={item.color}
                  style="fill"
                  opacity={0.5}
                />
              )}

              {/* Label */}
              {labelFont && item.label && item.showLabel && (
                <SkiaText
                  x={item.x + item.radius + 3}
                  y={item.y - 2}
                  text={item.label}
                  font={labelFont}
                  color={item.color}
                  opacity={TEXT_OPACITY}
                />
              )}
            </Group>
          );
        })}
      </Group>
    </Canvas>
  );
}
