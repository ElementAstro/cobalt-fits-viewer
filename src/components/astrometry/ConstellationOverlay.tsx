/**
 * 星座连线 Skia 叠加层
 * 在 FitsCanvas 上绘制可见星座的连线
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
import { raDecToPixel } from "../../lib/astrometry/wcsProjection";
import { CONSTELLATIONS, type ConstellationDef } from "../../lib/astrometry/constellationData";
import { OVERLAY_COLORS } from "../../lib/astrometry/annotationConstants";

interface ConstellationOverlayProps {
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

const DEFAULT_COLOR = OVERLAY_COLORS.constellationLines;
const DEFAULT_OPACITY = 0.3;
const LABEL_OPACITY = 0.5;

interface ConstellationScreen {
  path: ReturnType<typeof Skia.Path.Make>;
  labelPos: { x: number; y: number } | null;
  name: string;
  hasSegments: boolean;
}

export function ConstellationOverlay({
  calibration,
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  transform,
  visible,
  color = DEFAULT_COLOR,
  opacity = DEFAULT_OPACITY,
}: ConstellationOverlayProps) {
  const font = useFont(null, 10);

  // Project constellation stars to image pixel space
  const constellationPixels = useMemo(() => {
    if (!visible || sourceWidth <= 0 || sourceHeight <= 0) return [];

    return CONSTELLATIONS.map((c: ConstellationDef) => {
      const starPixels = c.stars.map((s) => raDecToPixel(s.ra, s.dec, calibration));
      return { def: c, starPixels };
    });
  }, [calibration, sourceWidth, sourceHeight, visible]);

  // Transform to screen space and build Skia paths
  const screenData = useMemo((): ConstellationScreen[] => {
    if (constellationPixels.length === 0 || renderWidth <= 0 || renderHeight <= 0) return [];

    return constellationPixels
      .map(({ def, starPixels }) => {
        const path = Skia.Path.Make();
        let segmentCount = 0;
        let sumX = 0;
        let sumY = 0;
        let visibleStarCount = 0;

        for (const [i, j] of def.lines) {
          const pxA = starPixels[i];
          const pxB = starPixels[j];
          if (!pxA || !pxB) continue;

          // Check if at least one endpoint is within the image
          const aInImage =
            pxA.x >= -sourceWidth * 0.3 &&
            pxA.x < sourceWidth * 1.3 &&
            pxA.y >= -sourceHeight * 0.3 &&
            pxA.y < sourceHeight * 1.3;
          const bInImage =
            pxB.x >= -sourceWidth * 0.3 &&
            pxB.x < sourceWidth * 1.3 &&
            pxB.y >= -sourceHeight * 0.3 &&
            pxB.y < sourceHeight * 1.3;

          if (!aInImage && !bInImage) continue;

          // Transform to screen coordinates
          const renderA = remapPointBetweenSpaces(
            pxA,
            sourceWidth,
            sourceHeight,
            renderWidth,
            renderHeight,
          );
          const screenA = imageToScreenPoint(renderA, transform, renderWidth, renderHeight);

          const renderB = remapPointBetweenSpaces(
            pxB,
            sourceWidth,
            sourceHeight,
            renderWidth,
            renderHeight,
          );
          const screenB = imageToScreenPoint(renderB, transform, renderWidth, renderHeight);

          path.moveTo(screenA.x, screenA.y);
          path.lineTo(screenB.x, screenB.y);
          segmentCount++;

          sumX += screenA.x + screenB.x;
          sumY += screenA.y + screenB.y;
          visibleStarCount += 2;
        }

        // Label at centroid of visible segments
        let labelPos: { x: number; y: number } | null = null;
        if (visibleStarCount > 0) {
          const cx = sumX / visibleStarCount;
          const cy = sumY / visibleStarCount;
          if (cx >= 0 && cx < transform.canvasWidth && cy >= 10 && cy < transform.canvasHeight) {
            labelPos = { x: cx, y: cy - 8 };
          }
        }

        return {
          path,
          labelPos,
          name: def.name,
          hasSegments: segmentCount > 0,
        };
      })
      .filter((c) => c.hasSegments);
  }, [constellationPixels, renderWidth, renderHeight, sourceWidth, sourceHeight, transform]);

  if (!visible || screenData.length === 0) {
    return null;
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Group>
        {screenData.map((c, i) => (
          <Group key={i}>
            <SkiaPath
              path={c.path}
              color={color}
              style="stroke"
              strokeWidth={1}
              opacity={opacity}
            />
            {font && c.labelPos && (
              <SkiaText
                x={c.labelPos.x}
                y={c.labelPos.y}
                text={c.name}
                font={font}
                color={color}
                opacity={LABEL_OPACITY}
              />
            )}
          </Group>
        ))}
      </Group>
    </Canvas>
  );
}
