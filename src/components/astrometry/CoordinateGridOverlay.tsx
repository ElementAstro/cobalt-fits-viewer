/**
 * RA/Dec 坐标网格 Skia 叠加层
 * 在 FitsCanvas 上绘制天球坐标网格线
 */

import { useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Canvas,
  Path as SkiaPath,
  Text as SkiaText,
  Group,
  Skia,
  useFont,
} from "@shopify/react-native-skia";
import type { AstrometryCalibration } from "../../lib/astrometry/types";
import type { CanvasTransform } from "../fits/FitsCanvas";
import { imageToScreenPoint, remapPointBetweenSpaces } from "../../lib/viewer/transform";
import { generateGridLines, type GridLine } from "../../lib/astrometry/coordinateGrid";
import { OVERLAY_COLORS } from "../../lib/astrometry/annotationConstants";

interface CoordinateGridOverlayProps {
  calibration: AstrometryCalibration;
  renderWidth: number;
  renderHeight: number;
  sourceWidth: number;
  sourceHeight: number;
  transform: CanvasTransform;
  visible: boolean;
  color?: string;
  opacity?: number;
}

const DEFAULT_GRID_COLOR = OVERLAY_COLORS.coordinateGrid;
const DEFAULT_GRID_OPACITY = 0.35;
const LABEL_OPACITY = 0.6;

export function CoordinateGridOverlay({
  calibration,
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  transform,
  visible,
  color = DEFAULT_GRID_COLOR,
  opacity = DEFAULT_GRID_OPACITY,
}: CoordinateGridOverlayProps) {
  const font = useFont(null, 9);

  // Compute grid lines in image pixel space (only recompute when calibration changes)
  const gridLines = useMemo(() => {
    if (!visible || sourceWidth <= 0 || sourceHeight <= 0) return [];
    return generateGridLines(calibration, sourceWidth, sourceHeight);
  }, [calibration, sourceWidth, sourceHeight, visible]);

  // Transform grid lines to screen space and build Skia paths
  const screenPaths = useMemo(() => {
    if (gridLines.length === 0 || renderWidth <= 0 || renderHeight <= 0) return [];

    return gridLines.map((line: GridLine) => {
      const path = Skia.Path.Make();
      let started = false;
      const screenPoints: Array<{ x: number; y: number }> = [];

      for (const pt of line.points) {
        const renderPt = remapPointBetweenSpaces(
          pt,
          sourceWidth,
          sourceHeight,
          renderWidth,
          renderHeight,
        );
        const screenPt = imageToScreenPoint(renderPt, transform, renderWidth, renderHeight);

        // Clip to canvas bounds with margin
        if (
          screenPt.x < -100 ||
          screenPt.x > transform.canvasWidth + 100 ||
          screenPt.y < -100 ||
          screenPt.y > transform.canvasHeight + 100
        ) {
          started = false;
          continue;
        }

        if (!started) {
          path.moveTo(screenPt.x, screenPt.y);
          started = true;
        } else {
          path.lineTo(screenPt.x, screenPt.y);
        }
        screenPoints.push(screenPt);
      }

      // Label position
      let labelScreen: { x: number; y: number } | null = null;
      if (line.labelPos) {
        const renderLabel = remapPointBetweenSpaces(
          line.labelPos,
          sourceWidth,
          sourceHeight,
          renderWidth,
          renderHeight,
        );
        const sl = imageToScreenPoint(renderLabel, transform, renderWidth, renderHeight);
        if (
          sl.x >= 0 &&
          sl.x < transform.canvasWidth - 30 &&
          sl.y >= 10 &&
          sl.y < transform.canvasHeight - 5
        ) {
          labelScreen = sl;
        }
      }

      return {
        path,
        label: line.label,
        labelPos: labelScreen,
        hasPoints: screenPoints.length >= 2,
      };
    });
  }, [gridLines, renderWidth, renderHeight, sourceWidth, sourceHeight, transform]);

  if (!visible || screenPaths.length === 0) {
    return null;
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group>
        {screenPaths.map(
          (item, i) =>
            item.hasPoints && (
              <Group key={i}>
                <SkiaPath
                  path={item.path}
                  color={color}
                  style="stroke"
                  strokeWidth={0.8}
                  opacity={opacity}
                />
                {font && item.labelPos && (
                  <SkiaText
                    x={item.labelPos.x + 2}
                    y={item.labelPos.y - 3}
                    text={item.label}
                    font={font}
                    color={color}
                    opacity={LABEL_OPACITY}
                  />
                )}
              </Group>
            ),
        )}
      </Group>
    </Canvas>
  );
}
