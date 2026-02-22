/**
 * 罗盘方向指示器
 * 根据 WCS 标定数据显示 N/E/S/W 方向
 */

import { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import {
  Canvas,
  Line as SkiaLine,
  Text as SkiaText,
  Group,
  useFont,
  vec,
} from "@shopify/react-native-skia";
import type { AstrometryCalibration } from "../../lib/astrometry/types";

interface CompassIndicatorProps {
  calibration: AstrometryCalibration;
  size?: number;
  color?: string;
}

const DEFAULT_SIZE = 60;
const DEFAULT_COLOR = "#ffffff";

export function CompassIndicator({
  calibration,
  size = DEFAULT_SIZE,
  color = DEFAULT_COLOR,
}: CompassIndicatorProps) {
  const font = useFont(null, 10);

  const compass = useMemo(() => {
    // orientation: angle in degrees from N through E
    // parity: 1 = mirrored, 0 = normal
    const orientRad = (calibration.orientation * Math.PI) / 180;
    const paritySign = calibration.parity === 1 ? -1 : 1;

    const cx = size / 2;
    const cy = size / 2;
    const armLen = size * 0.35;
    const labelOffset = size * 0.45;

    // North direction in image: rotated by orientation
    // In standard WCS TAN: N is along +Dec, E is along -RA
    const nAngle = -orientRad; // North angle from image +Y axis
    const eAngle = nAngle + (Math.PI / 2) * paritySign; // East is 90° from North

    const nX = cx + armLen * Math.sin(nAngle);
    const nY = cy - armLen * Math.cos(nAngle);
    const eX = cx + armLen * Math.sin(eAngle);
    const eY = cy - armLen * Math.cos(eAngle);

    const nLabelX = cx + labelOffset * Math.sin(nAngle) - 3;
    const nLabelY = cy - labelOffset * Math.cos(nAngle) + 4;
    const eLabelX = cx + labelOffset * Math.sin(eAngle) - 3;
    const eLabelY = cy - labelOffset * Math.cos(eAngle) + 4;

    return { cx, cy, nX, nY, eX, eY, nLabelX, nLabelY, eLabelX, eLabelY };
  }, [calibration.orientation, calibration.parity, size]);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      <Canvas style={{ width: size, height: size }}>
        <Group>
          {/* N arm (thicker) */}
          <SkiaLine
            p1={vec(compass.cx, compass.cy)}
            p2={vec(compass.nX, compass.nY)}
            color={color}
            strokeWidth={2}
            opacity={0.9}
          />
          {/* E arm */}
          <SkiaLine
            p1={vec(compass.cx, compass.cy)}
            p2={vec(compass.eX, compass.eY)}
            color={color}
            strokeWidth={1.2}
            opacity={0.6}
          />

          {/* Labels */}
          {font && (
            <>
              <SkiaText
                x={compass.nLabelX}
                y={compass.nLabelY}
                text="N"
                font={font}
                color={color}
                opacity={0.9}
              />
              <SkiaText
                x={compass.eLabelX}
                y={compass.eLabelY}
                text="E"
                font={font}
                color={color}
                opacity={0.7}
              />
            </>
          )}
        </Group>
      </Canvas>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    overflow: "hidden",
  },
});
