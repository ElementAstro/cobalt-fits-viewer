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
  screenToImagePoint,
} from "../../lib/viewer/transform";

interface RegionSelectOverlayProps {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  transform: CanvasTransform;
  onRegionChange: (region: { x: number; y: number; w: number; h: number }) => void;
  onClear: () => void;
}

const MIN_REGION_SIZE = 10;

export function RegionSelectOverlay({
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  transform,
  onRegionChange,
  onClear,
}: RegionSelectOverlayProps) {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");

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
      const clampedX = Math.max(0, Math.min(x, imageWidth - MIN_REGION_SIZE));
      const clampedY = Math.max(0, Math.min(y, imageHeight - MIN_REGION_SIZE));
      const clampedW = Math.max(MIN_REGION_SIZE, Math.min(w, imageWidth - clampedX));
      const clampedH = Math.max(MIN_REGION_SIZE, Math.min(h, imageHeight - clampedY));
      const r = {
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        w: Math.round(clampedW),
        h: Math.round(clampedH),
      };
      setRegion(r);
      onRegionChange(r);
    },
    [imageWidth, imageHeight, onRegionChange],
  );

  const drawGesture = Gesture.Pan()
    .onBegin((e) => {
      "worklet";
      const p = screenToImagePoint({ x: e.x, y: e.y }, transform, imageWidth, imageHeight);
      const cp = clampImagePoint(p, imageWidth, imageHeight);
      startImgX.value = cp.x;
      startImgY.value = cp.y;
    })
    .onUpdate((e) => {
      "worklet";
      const p = screenToImagePoint({ x: e.x, y: e.y }, transform, imageWidth, imageHeight);
      const cp = clampImagePoint(p, imageWidth, imageHeight);
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

  const regionDisplay = region
    ? (() => {
        const p1 = imageToScreenPoint(
          { x: region.x, y: region.y },
          transform,
          imageWidth,
          imageHeight,
        );
        const p2 = imageToScreenPoint(
          { x: region.x + region.w, y: region.y + region.h },
          transform,
          imageWidth,
          imageHeight,
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
