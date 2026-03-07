/**
 * 测量线段 Skia 叠加层
 * 在 FitsCanvas 上绘制测量线段、端点和距离标签
 */

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Canvas,
  Line,
  Circle,
  Text as SkiaText,
  Group,
  useFont,
  DashPathEffect,
} from "@shopify/react-native-skia";
import type { CanvasTransform } from "./FitsCanvas";
import type { MeasurementLine, MeasurementPoint } from "../../hooks/viewer/useMeasurement";
import { imageToScreenPoint, remapPointBetweenSpaces } from "../../lib/viewer/transform";

interface MeasurementOverlayProps {
  measurements: MeasurementLine[];
  pendingPoint: MeasurementPoint | null;
  renderWidth: number;
  renderHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  transform: CanvasTransform;
  visible: boolean;
}

const LINE_COLOR = "#f97316";
const PENDING_COLOR = "#facc15";
const ENDPOINT_RADIUS = 4;
const LABEL_BG_COLOR = "#111827cc";

function toScreen(
  point: { x: number; y: number },
  sourceWidth: number,
  sourceHeight: number,
  renderWidth: number,
  renderHeight: number,
  transform: CanvasTransform,
) {
  const remapped = remapPointBetweenSpaces(
    point,
    sourceWidth,
    sourceHeight,
    renderWidth,
    renderHeight,
  );
  return imageToScreenPoint(remapped, transform, renderWidth, renderHeight);
}

export function MeasurementOverlay({
  measurements,
  pendingPoint,
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  transform,
  visible,
}: MeasurementOverlayProps) {
  const font = useFont(null, 9);

  const screenData = useMemo(() => {
    if (!visible || (measurements.length === 0 && !pendingPoint)) return [];
    if (renderWidth <= 0 || renderHeight <= 0) return [];

    return measurements.map((m) => {
      const s1 = toScreen(m.p1, sourceWidth, sourceHeight, renderWidth, renderHeight, transform);
      const s2 = toScreen(m.p2, sourceWidth, sourceHeight, renderWidth, renderHeight, transform);
      const midX = (s1.x + s2.x) / 2;
      const midY = (s1.y + s2.y) / 2;

      let label = `${m.pixelDist.toFixed(1)}px`;
      if (m.angularDistLabel) {
        label = m.angularDistLabel;
      }

      return { s1, s2, midX, midY, label, id: m.id };
    });
  }, [
    visible,
    measurements,
    pendingPoint,
    renderWidth,
    renderHeight,
    sourceWidth,
    sourceHeight,
    transform,
  ]);

  const pendingScreen = useMemo(() => {
    if (!visible || !pendingPoint || renderWidth <= 0 || renderHeight <= 0) return null;
    return toScreen(pendingPoint, sourceWidth, sourceHeight, renderWidth, renderHeight, transform);
  }, [visible, pendingPoint, sourceWidth, sourceHeight, renderWidth, renderHeight, transform]);

  if (!visible || (screenData.length === 0 && !pendingScreen)) return null;

  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Group>
        {screenData.map((item) => (
          <Group key={item.id}>
            <Line
              p1={{ x: item.s1.x, y: item.s1.y }}
              p2={{ x: item.s2.x, y: item.s2.y }}
              color={LINE_COLOR}
              strokeWidth={1.5}
              style="stroke"
            >
              <DashPathEffect intervals={[6, 4]} />
            </Line>
            <Circle
              cx={item.s1.x}
              cy={item.s1.y}
              r={ENDPOINT_RADIUS}
              color={LINE_COLOR}
              style="fill"
              opacity={0.6}
            />
            <Circle
              cx={item.s2.x}
              cy={item.s2.y}
              r={ENDPOINT_RADIUS}
              color={LINE_COLOR}
              style="fill"
              opacity={0.6}
            />
            <Circle
              cx={item.s1.x}
              cy={item.s1.y}
              r={ENDPOINT_RADIUS}
              color={LINE_COLOR}
              style="stroke"
              strokeWidth={1}
            />
            <Circle
              cx={item.s2.x}
              cy={item.s2.y}
              r={ENDPOINT_RADIUS}
              color={LINE_COLOR}
              style="stroke"
              strokeWidth={1}
            />
            {font && (
              <>
                <Circle cx={item.midX} cy={item.midY - 5} r={0} color={LABEL_BG_COLOR} />
                <SkiaText
                  x={item.midX + 4}
                  y={item.midY - 4}
                  text={item.label}
                  font={font}
                  color="#fff"
                />
              </>
            )}
          </Group>
        ))}

        {pendingScreen && (
          <Group>
            <Circle
              cx={pendingScreen.x}
              cy={pendingScreen.y}
              r={ENDPOINT_RADIUS + 2}
              color={PENDING_COLOR}
              style="stroke"
              strokeWidth={1.5}
            />
            <Circle
              cx={pendingScreen.x}
              cy={pendingScreen.y}
              r={2}
              color={PENDING_COLOR}
              style="fill"
            />
          </Group>
        )}
      </Group>
    </Canvas>
  );
}
