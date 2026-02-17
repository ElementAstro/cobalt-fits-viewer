import { useState, useCallback } from "react";
import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, runOnJS } from "react-native-reanimated";
import type { CanvasTransform } from "./FitsCanvas";
import {
  clampImagePoint,
  imageToScreenPoint,
  remapPointBetweenSpaces,
  screenToImagePoint,
} from "../../lib/viewer/transform";

interface RegionSelectOverlayProps {
  renderWidth: number;
  renderHeight: number;
  sourceWidth?: number;
  sourceHeight?: number;
  containerWidth: number;
  containerHeight: number;
  transform: CanvasTransform;
  onRegionChange: (region: { x: number; y: number; w: number; h: number }) => void;
  onClear: () => void;
}

const MIN_REGION_SIZE = 10;

export function RegionSelectOverlay({
  renderWidth,
  renderHeight,
  sourceWidth,
  sourceHeight,
  containerWidth,
  containerHeight,
  transform,
  onRegionChange,
  onClear,
}: RegionSelectOverlayProps) {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");
  const regionSourceWidth = sourceWidth ?? renderWidth;
  const regionSourceHeight = sourceHeight ?? renderHeight;

  const [region, setRegion] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  const startImgX = useSharedValue(0);
  const startImgY = useSharedValue(0);

  const updateRegion = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const clampedX = Math.max(0, Math.min(x, regionSourceWidth - MIN_REGION_SIZE));
      const clampedY = Math.max(0, Math.min(y, regionSourceHeight - MIN_REGION_SIZE));
      const clampedW = Math.max(MIN_REGION_SIZE, Math.min(w, regionSourceWidth - clampedX));
      const clampedH = Math.max(MIN_REGION_SIZE, Math.min(h, regionSourceHeight - clampedY));
      const r = {
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        w: Math.round(clampedW),
        h: Math.round(clampedH),
      };
      setRegion(r);
      onRegionChange(r);
    },
    [regionSourceWidth, regionSourceHeight, onRegionChange],
  );

  const drawGesture = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      const renderPoint = screenToImagePoint(
        { x: e.x, y: e.y },
        transform,
        renderWidth,
        renderHeight,
      );
      const sourcePoint = remapPointBetweenSpaces(
        renderPoint,
        renderWidth,
        renderHeight,
        regionSourceWidth,
        regionSourceHeight,
      );
      const cp = clampImagePoint(sourcePoint, regionSourceWidth, regionSourceHeight);
      startImgX.value = cp.x;
      startImgY.value = cp.y;
    })
    .onUpdate((e) => {
      "worklet";
      const renderPoint = screenToImagePoint(
        { x: e.x, y: e.y },
        transform,
        renderWidth,
        renderHeight,
      );
      const sourcePoint = remapPointBetweenSpaces(
        renderPoint,
        renderWidth,
        renderHeight,
        regionSourceWidth,
        regionSourceHeight,
      );
      const cp = clampImagePoint(sourcePoint, regionSourceWidth, regionSourceHeight);
      const endX = cp.x;
      const endY = cp.y;

      const x = Math.min(startImgX.value, endX);
      const y = Math.min(startImgY.value, endY);
      const w = Math.abs(endX - startImgX.value);
      const h = Math.abs(endY - startImgY.value);

      if (w > MIN_REGION_SIZE && h > MIN_REGION_SIZE) {
        runOnJS(updateRegion)(x, y, w, h);
      }
    })
    .minDistance(5);

  const handleClear = useCallback(() => {
    setRegion(null);
    onClear();
  }, [onClear]);

  if (renderWidth <= 0 || renderHeight <= 0 || regionSourceWidth <= 0 || regionSourceHeight <= 0) {
    return null;
  }

  const regionDisplay = region
    ? (() => {
        const renderP1 = remapPointBetweenSpaces(
          { x: region.x, y: region.y },
          regionSourceWidth,
          regionSourceHeight,
          renderWidth,
          renderHeight,
        );
        const renderP2 = remapPointBetweenSpaces(
          { x: region.x + region.w, y: region.y + region.h },
          regionSourceWidth,
          regionSourceHeight,
          renderWidth,
          renderHeight,
        );
        const p1 = imageToScreenPoint(
          { x: renderP1.x, y: renderP1.y },
          transform,
          renderWidth,
          renderHeight,
        );
        const p2 = imageToScreenPoint(
          { x: renderP2.x, y: renderP2.y },
          transform,
          renderWidth,
          renderHeight,
        );
        return {
          left: Math.min(p1.x, p2.x),
          top: Math.min(p1.y, p2.y),
          width: Math.abs(p2.x - p1.x),
          height: Math.abs(p2.y - p1.y),
        };
      })()
    : null;

  return (
    <GestureDetector gesture={drawGesture}>
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: containerWidth,
          height: containerHeight,
        }}
      >
        {/* Region rectangle */}
        {regionDisplay && (
          <>
            {/* Dimmed overlay outside region */}
            <View
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: containerWidth,
                height: regionDisplay.top,
                backgroundColor: "rgba(0,0,0,0.35)",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 0,
                top: regionDisplay.top + regionDisplay.height,
                width: containerWidth,
                height: containerHeight - regionDisplay.top - regionDisplay.height,
                backgroundColor: "rgba(0,0,0,0.35)",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: 0,
                top: regionDisplay.top,
                width: regionDisplay.left,
                height: regionDisplay.height,
                backgroundColor: "rgba(0,0,0,0.35)",
              }}
            />
            <View
              style={{
                position: "absolute",
                left: regionDisplay.left + regionDisplay.width,
                top: regionDisplay.top,
                width: containerWidth - regionDisplay.left - regionDisplay.width,
                height: regionDisplay.height,
                backgroundColor: "rgba(0,0,0,0.35)",
              }}
            />

            {/* Region border */}
            <View
              style={{
                position: "absolute",
                left: regionDisplay.left,
                top: regionDisplay.top,
                width: regionDisplay.width,
                height: regionDisplay.height,
                borderWidth: 1.5,
                borderColor: accentColor,
                borderStyle: "dashed",
              }}
            />

            {/* Dimension label */}
            <View
              style={{
                position: "absolute",
                left: regionDisplay.left,
                top: regionDisplay.top - 16,
              }}
            >
              <Text
                style={{
                  color: accentColor,
                  fontSize: 9,
                  fontWeight: "600",
                }}
              >
                {region!.w} × {region!.h}
              </Text>
            </View>
          </>
        )}

        {/* Clear button */}
        {region && (
          <View
            style={{
              position: "absolute",
              top: 8,
              right: 8,
            }}
          >
            <Button size="sm" variant="danger" onPress={handleClear} className="px-2 py-0.5">
              <Button.Label className="text-[9px]">{t("common.cancel")}</Button.Label>
            </Button>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}
