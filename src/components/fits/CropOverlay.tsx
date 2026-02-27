/**
 * 交互式裁剪覆盖层组件
 * 支持拖拽四角和边来调整裁剪区域
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text } from "react-native";
import { Button } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from "react-native-reanimated";
import {
  clampCropRegion,
  moveCropRegion,
  resizeCropRegion,
  type CropResizeHandle,
  type CropRegion,
} from "./cropMath";

interface CropOverlayProps {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  onCropConfirm: (x: number, y: number, width: number, height: number) => void;
  onCropCancel: () => void;
}

const MIN_CROP_SIZE = 20;
const HANDLE_TOUCH_SIZE = 24;
const HANDLE_DOT_SIZE = 10;
const RESIZE_HANDLES: CropResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function getHandlePosition(
  cropDisplay: { left: number; top: number; width: number; height: number },
  handle: CropResizeHandle,
) {
  const centerX = cropDisplay.left + cropDisplay.width / 2;
  const centerY = cropDisplay.top + cropDisplay.height / 2;
  const right = cropDisplay.left + cropDisplay.width;
  const bottom = cropDisplay.top + cropDisplay.height;

  switch (handle) {
    case "nw":
      return { x: cropDisplay.left, y: cropDisplay.top };
    case "n":
      return { x: centerX, y: cropDisplay.top };
    case "ne":
      return { x: right, y: cropDisplay.top };
    case "e":
      return { x: right, y: centerY };
    case "se":
      return { x: right, y: bottom };
    case "s":
      return { x: centerX, y: bottom };
    case "sw":
      return { x: cropDisplay.left, y: bottom };
    case "w":
      return { x: cropDisplay.left, y: centerY };
  }
}

export function CropOverlay({
  imageWidth,
  imageHeight,
  containerWidth,
  containerHeight,
  onCropConfirm,
  onCropCancel,
}: CropOverlayProps) {
  const { t } = useI18n();

  // Scale factor from image coords to container coords
  const scaleX = containerWidth / imageWidth;
  const scaleY = containerHeight / imageHeight;
  const scale = Math.max(0.0001, Math.min(scaleX, scaleY));

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
  const cropRegionRef = useRef(cropRegion);

  useEffect(() => {
    cropRegionRef.current = cropRegion;
  }, [cropRegion]);

  // Shared values for gesture tracking (image coordinates)
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const startW = useSharedValue(0);
  const startH = useSharedValue(0);

  const applyCropRegion = useCallback(
    (next: CropRegion) => {
      const clamped = clampCropRegion(next, imageWidth, imageHeight, MIN_CROP_SIZE);
      setCropRegion({
        x: Math.round(clamped.x),
        y: Math.round(clamped.y),
        w: Math.round(clamped.w),
        h: Math.round(clamped.h),
      });
    },
    [imageHeight, imageWidth],
  );

  const moveGesture = useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          const current = cropRegionRef.current;
          startX.value = current.x;
          startY.value = current.y;
          startW.value = current.w;
          startH.value = current.h;
        })
        .onUpdate((e) => {
          const next = moveCropRegion(
            {
              x: startX.value,
              y: startY.value,
              w: startW.value,
              h: startH.value,
            },
            e.translationX / scale,
            e.translationY / scale,
            imageWidth,
            imageHeight,
            MIN_CROP_SIZE,
          );
          runOnJS(applyCropRegion)(next);
        }),
    [applyCropRegion, imageHeight, imageWidth, scale, startH, startW, startX, startY],
  );

  const createResizeGesture = useCallback(
    (handle: CropResizeHandle) =>
      Gesture.Pan()
        .onBegin(() => {
          const current = cropRegionRef.current;
          startX.value = current.x;
          startY.value = current.y;
          startW.value = current.w;
          startH.value = current.h;
        })
        .onUpdate((e) => {
          const next = resizeCropRegion(
            {
              x: startX.value,
              y: startY.value,
              w: startW.value,
              h: startH.value,
            },
            handle,
            e.translationX / scale,
            e.translationY / scale,
            imageWidth,
            imageHeight,
            MIN_CROP_SIZE,
          );
          runOnJS(applyCropRegion)(next);
        }),
    [applyCropRegion, imageHeight, imageWidth, scale, startH, startW, startX, startY],
  );

  const resizeGestures = useMemo(
    () =>
      RESIZE_HANDLES.reduce<Record<CropResizeHandle, ReturnType<typeof Gesture.Pan>>>(
        (acc, handle) => {
          acc[handle] = createResizeGesture(handle);
          return acc;
        },
        {} as Record<CropResizeHandle, ReturnType<typeof Gesture.Pan>>,
      ),
    [createResizeGesture],
  );

  const cropDisplay = useMemo(
    () => ({
      left: offsetX + cropRegion.x * scale,
      top: offsetY + cropRegion.y * scale,
      width: cropRegion.w * scale,
      height: cropRegion.h * scale,
    }),
    [cropRegion.h, cropRegion.w, cropRegion.x, cropRegion.y, offsetX, offsetY, scale],
  );

  const handleDisplayPositions = useMemo(() => {
    return RESIZE_HANDLES.map((handle) => ({
      handle,
      ...getHandlePosition(cropDisplay, handle),
    }));
  }, [cropDisplay]);

  const infoTop = Math.max(4, cropDisplay.top - 20);

  useEffect(() => {
    const safe = clampCropRegion(cropRegionRef.current, imageWidth, imageHeight, MIN_CROP_SIZE);
    if (
      safe.x !== cropRegionRef.current.x ||
      safe.y !== cropRegionRef.current.y ||
      safe.w !== cropRegionRef.current.w ||
      safe.h !== cropRegionRef.current.h
    ) {
      setCropRegion({
        x: Math.round(safe.x),
        y: Math.round(safe.y),
        w: Math.round(safe.w),
        h: Math.round(safe.h),
      });
    }
  }, [imageHeight, imageWidth]);

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
              borderColor: "#17c964",
              borderStyle: "dashed",
            },
          ]}
        />
      </GestureDetector>

      {/* Resize handles */}
      {handleDisplayPositions.map((handlePosition) => (
        <GestureDetector
          key={handlePosition.handle}
          gesture={resizeGestures[handlePosition.handle]}
        >
          <View
            style={{
              position: "absolute",
              left: handlePosition.x - HANDLE_TOUCH_SIZE / 2,
              top: handlePosition.y - HANDLE_TOUCH_SIZE / 2,
              width: HANDLE_TOUCH_SIZE,
              height: HANDLE_TOUCH_SIZE,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <View
              style={{
                width: HANDLE_DOT_SIZE,
                height: HANDLE_DOT_SIZE,
                borderWidth: 1.5,
                borderColor: "#17c964",
                borderRadius: 3,
                backgroundColor: "#ffffff",
              }}
            />
          </View>
        </GestureDetector>
      ))}

      {/* Dimension info */}
      <View
        style={{
          position: "absolute",
          left: cropDisplay.left,
          top: infoTop,
          flexDirection: "row",
          gap: 4,
        }}
      >
        <Text style={{ color: "#17c964", fontSize: 10, fontWeight: "600" }}>
          {cropRegion.w} × {cropRegion.h}
        </Text>
        <Text className="text-muted" style={{ fontSize: 10 }}>
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
            paddingHorizontal: 8,
            paddingVertical: 4,
            flexDirection: "row",
            gap: 8,
          }}
        >
          <Button size="sm" variant="danger" onPress={onCropCancel}>
            <Button.Label className="text-xs">{t("common.cancel")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="primary"
            onPress={() => onCropConfirm(cropRegion.x, cropRegion.y, cropRegion.w, cropRegion.h)}
          >
            <Button.Label className="text-xs">{t("editor.apply")}</Button.Label>
          </Button>
        </View>
      </View>
    </View>
  );
}
