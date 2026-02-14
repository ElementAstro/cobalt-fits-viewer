/**
 * 交互式裁剪覆盖层组件
 * 支持拖拽四角和边来调整裁剪区域
 */

import { useState, useCallback } from "react";
import { View, Text } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from "react-native-reanimated";

interface CropOverlayProps {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  onCropConfirm: (x: number, y: number, width: number, height: number) => void;
  onCropCancel: () => void;
}

const MIN_CROP_SIZE = 20;

export function CropOverlay({
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  onCropConfirm,
  onCropCancel,
}: CropOverlayProps) {
  // Scale factor from image coords to container coords
  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;
  const scale = Math.min(scaleX, scaleY);

  const displayW = imageWidth * scale;
  const displayH = imageHeight * scale;
  const offsetX = (containerWidth - displayW) / 2;
  const offsetY = (containerHeight - displayH) / 2;

  // Crop region in image coordinates (initially 80% center)
  const margin = 0.1;
  const [cropRegion, setCropRegion] = useState({
    x: Math.floor(imageWidth * margin),
    y: Math.floor(imageHeight * margin),
    w: Math.floor(imageWidth * (1 - 2 * margin)),
    h: Math.floor(imageHeight * (1 - 2 * margin)),
  });

  // Shared values for gesture tracking
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const updateCrop = useCallback(
    (x: number, y: number, w: number, h: number) => {
      const clampedX = Math.max(0, Math.min(x, imageWidth - MIN_CROP_SIZE));
      const clampedY = Math.max(0, Math.min(y, imageHeight - MIN_CROP_SIZE));
      const clampedW = Math.max(MIN_CROP_SIZE, Math.min(w, imageWidth - clampedX));
      const clampedH = Math.max(MIN_CROP_SIZE, Math.min(h, imageHeight - clampedY));
      setCropRegion({
        x: Math.round(clampedX),
        y: Math.round(clampedY),
        w: Math.round(clampedW),
        h: Math.round(clampedH),
      });
    },
    [imageWidth, imageHeight],
  );

  // Move the entire crop region
  const moveGesture = Gesture.Pan()
    .onBegin(() => {
      startX.value = cropRegion.x;
      startY.value = cropRegion.y;
    })
    .onUpdate((e) => {
      const dx = e.translationX / scale;
      const dy = e.translationY / scale;
      runOnJS(updateCrop)(startX.value + dx, startY.value + dy, cropRegion.w, cropRegion.h);
    });

  // Display coordinates
  const cropDisplay = {
    left: offsetX + cropRegion.x * scale,
    top: offsetY + cropRegion.y * scale,
    width: cropRegion.w * scale,
    height: cropRegion.h * scale,
  };

  const cropStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    left: cropDisplay.left,
    top: cropDisplay.top,
    width: cropDisplay.width,
    height: cropDisplay.height,
  }));

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: containerWidth,
        height: containerHeight,
      }}
    >
      {/* Darkened overlay areas */}
      {/* Top */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: containerWidth,
          height: cropDisplay.top,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      {/* Bottom */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: cropDisplay.top + cropDisplay.height,
          width: containerWidth,
          height: containerHeight - cropDisplay.top - cropDisplay.height,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      {/* Left */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: cropDisplay.top,
          width: cropDisplay.left,
          height: cropDisplay.height,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />
      {/* Right */}
      <View
        style={{
          position: "absolute",
          left: cropDisplay.left + cropDisplay.width,
          top: cropDisplay.top,
          width: containerWidth - cropDisplay.left - cropDisplay.width,
          height: cropDisplay.height,
          backgroundColor: "rgba(0,0,0,0.5)",
        }}
      />

      {/* Crop border + drag area */}
      <GestureDetector gesture={moveGesture}>
        <Animated.View
          style={[
            cropStyle,
            {
              borderWidth: 1.5,
              borderColor: "#22c55e",
              borderStyle: "dashed",
            },
          ]}
        />
      </GestureDetector>

      {/* Dimension info */}
      <View
        style={{
          position: "absolute",
          left: cropDisplay.left,
          top: cropDisplay.top - 20,
          flexDirection: "row",
          gap: 4,
        }}
      >
        <Text style={{ color: "#22c55e", fontSize: 10, fontWeight: "600" }}>
          {cropRegion.w} × {cropRegion.h}
        </Text>
        <Text style={{ color: "#999", fontSize: 10 }}>
          ({cropRegion.x}, {cropRegion.y})
        </Text>
      </View>

      {/* Action buttons */}
      <View
        style={{
          position: "absolute",
          bottom: 12,
          left: 0,
          right: 0,
          flexDirection: "row",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 8,
            flexDirection: "row",
            gap: 24,
          }}
        >
          <Text
            style={{ color: "#ef4444", fontSize: 12, fontWeight: "600" }}
            onPress={onCropCancel}
          >
            Cancel
          </Text>
          <Text
            style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}
            onPress={() => onCropConfirm(cropRegion.x, cropRegion.y, cropRegion.w, cropRegion.h)}
          >
            Apply
          </Text>
        </View>
      </View>
    </View>
  );
}
