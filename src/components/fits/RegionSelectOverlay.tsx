import { useState, useCallback } from "react";
import { View, Text } from "react-native";
import { Button, useThemeColor } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, runOnJS } from "react-native-reanimated";

interface RegionSelectOverlayProps {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  onRegionChange: (region: { x: number; y: number; w: number; h: number }) => void;
  onClear: () => void;
}

const MIN_REGION_SIZE = 10;

export function RegionSelectOverlay({
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  onRegionChange,
  onClear,
}: RegionSelectOverlayProps) {
  const { t } = useI18n();
  const accentColor = useThemeColor("accent");

  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY);

  const displayW = imageWidth * scale;
  const displayH = imageHeight * scale;
  const offsetX = (containerWidth - displayW) / 2;
  const offsetY = (containerHeight - displayH) / 2;

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
      const imgX = (e.x - offsetX) / scale;
      const imgY = (e.y - offsetY) / scale;
      startImgX.value = Math.max(0, Math.min(imgX, imageWidth));
      startImgY.value = Math.max(0, Math.min(imgY, imageHeight));
    })
    .onUpdate((e) => {
      "worklet";
      const imgX = (e.x - offsetX) / scale;
      const imgY = (e.y - offsetY) / scale;
      const endX = Math.max(0, Math.min(imgX, imageWidth));
      const endY = Math.max(0, Math.min(imgY, imageHeight));

      const x = Math.min(startImgX.value, endX);
      const y = Math.min(startImgY.value, endY);
      const w = Math.abs(endX - startImgX.value);
      const h = Math.abs(endY - startImgY.value);

      if (w > MIN_REGION_SIZE / scale && h > MIN_REGION_SIZE / scale) {
        runOnJS(updateRegion)(x, y, w, h);
      }
    })
    .minDistance(5);

  const handleClear = useCallback(() => {
    setRegion(null);
    onClear();
  }, [onClear]);

  const regionDisplay = region
    ? {
        left: offsetX + region.x * scale,
        top: offsetY + region.y * scale,
        width: region.w * scale,
        height: region.h * scale,
      }
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
