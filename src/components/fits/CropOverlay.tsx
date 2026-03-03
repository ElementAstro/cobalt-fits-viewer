/**
 * 交互式裁剪覆盖层组件
 * 支持拖拽四角和边来调整裁剪区域、宽高比锁定、辅助网格、数值输入、预设尺寸
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { View, Text, TextInput, Platform, ScrollView } from "react-native";
import { Button, Chip } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, runOnJS } from "react-native-reanimated";
import {
  clampCropRegion,
  moveCropRegion,
  resizeCropRegionWithAspect,
  applyAspectRatio,
  getAspectRatioValue,
  type AspectRatioPreset,
  type CropResizeHandle,
  type CropRegion,
} from "./cropMath";
import type { CanvasTransform } from "./FitsCanvas";
import { imageToScreenPoint, computeFitGeometry } from "../../lib/viewer/transform";

interface CropOverlayProps {
  imageWidth: number;
  imageHeight: number;
  containerWidth: number;
  containerHeight: number;
  transform?: CanvasTransform;
  onCropConfirm: (x: number, y: number, width: number, height: number) => void;
  onCropCancel: () => void;
}

const MIN_CROP_SIZE = 20;
const HANDLE_TOUCH_SIZE = 24;
const HANDLE_DOT_SIZE = 10;
const RESIZE_HANDLES: CropResizeHandle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

type GridMode = "none" | "thirds" | "center";
const GRID_CYCLE: GridMode[] = ["none", "thirds", "center"];
const GRID_LABEL: Record<GridMode, string> = {
  none: "editor.cropNoGrid",
  thirds: "editor.cropThirds",
  center: "editor.cropCenterCross",
};

const ASPECT_PRESETS: { key: AspectRatioPreset; labelKey: string }[] = [
  { key: "free", labelKey: "editor.cropFree" },
  { key: "1:1", labelKey: "editor.cropSquare" },
  { key: "4:3", labelKey: "4:3" },
  { key: "3:2", labelKey: "3:2" },
  { key: "16:9", labelKey: "16:9" },
  { key: "original", labelKey: "editor.cropOriginal" },
];

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
  transform,
  onCropConfirm,
  onCropCancel,
}: CropOverlayProps) {
  const { t } = useI18n();

  const [aspectPreset, setAspectPreset] = useState<AspectRatioPreset>("free");
  const [gridMode, setGridMode] = useState<GridMode>("none");

  const aspectValue = useMemo(
    () => getAspectRatioValue(aspectPreset, imageWidth, imageHeight),
    [aspectPreset, imageWidth, imageHeight],
  );
  const aspectRef = useRef(aspectValue);
  useEffect(() => {
    aspectRef.current = aspectValue;
  }, [aspectValue]);

  // Coordinate mapping: use CanvasTransform when available, fallback to fit-scale
  const fallbackFit = useMemo(
    () => computeFitGeometry(imageWidth, imageHeight, containerWidth, containerHeight),
    [imageWidth, imageHeight, containerWidth, containerHeight],
  );

  const effectiveScale = useMemo(() => {
    if (transform) {
      const fit = computeFitGeometry(
        imageWidth,
        imageHeight,
        transform.canvasWidth,
        transform.canvasHeight,
      );
      return fit.fitScale * transform.scale;
    }
    return fallbackFit.fitScale;
  }, [transform, imageWidth, imageHeight, fallbackFit]);

  const imgToScreen = useCallback(
    (imgX: number, imgY: number) => {
      if (transform) {
        return imageToScreenPoint({ x: imgX, y: imgY }, transform, imageWidth, imageHeight);
      }
      return {
        x: fallbackFit.offsetX + imgX * fallbackFit.fitScale,
        y: fallbackFit.offsetY + imgY * fallbackFit.fitScale,
      };
    },
    [transform, imageWidth, imageHeight, fallbackFit],
  );

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
            e.translationX / effectiveScale,
            e.translationY / effectiveScale,
            imageWidth,
            imageHeight,
            MIN_CROP_SIZE,
          );
          runOnJS(applyCropRegion)(next);
        }),
    [applyCropRegion, imageHeight, imageWidth, effectiveScale, startH, startW, startX, startY],
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
          const next = resizeCropRegionWithAspect(
            {
              x: startX.value,
              y: startY.value,
              w: startW.value,
              h: startH.value,
            },
            handle,
            e.translationX / effectiveScale,
            e.translationY / effectiveScale,
            aspectRef.current,
            imageWidth,
            imageHeight,
            MIN_CROP_SIZE,
          );
          runOnJS(applyCropRegion)(next);
        }),
    [applyCropRegion, imageHeight, imageWidth, effectiveScale, startH, startW, startX, startY],
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

  const cropDisplay = useMemo(() => {
    const tl = imgToScreen(cropRegion.x, cropRegion.y);
    const br = imgToScreen(cropRegion.x + cropRegion.w, cropRegion.y + cropRegion.h);
    return {
      left: tl.x,
      top: tl.y,
      width: br.x - tl.x,
      height: br.y - tl.y,
    };
  }, [cropRegion, imgToScreen]);

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

  // Web-only: Enter to confirm crop (skip when editing a text input)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        e.preventDefault();
        const r = cropRegionRef.current;
        onCropConfirm(r.x, r.y, r.w, r.h);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCropConfirm]);

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
        <View
          style={{
            position: "absolute",
            left: cropDisplay.left,
            top: cropDisplay.top,
            width: cropDisplay.width,
            height: cropDisplay.height,
            borderWidth: 1.5,
            borderColor: "#17c964",
            borderStyle: "dashed",
          }}
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

      {/* Grid overlay lines inside crop area */}
      {gridMode === "thirds" &&
        [1 / 3, 2 / 3].map((frac) => (
          <React.Fragment key={frac}>
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: cropDisplay.left + cropDisplay.width * frac,
                top: cropDisplay.top,
                width: 0.5,
                height: cropDisplay.height,
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            />
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: cropDisplay.left,
                top: cropDisplay.top + cropDisplay.height * frac,
                width: cropDisplay.width,
                height: 0.5,
                backgroundColor: "rgba(255,255,255,0.35)",
              }}
            />
          </React.Fragment>
        ))}
      {gridMode === "center" && (
        <>
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: cropDisplay.left + cropDisplay.width / 2,
              top: cropDisplay.top,
              width: 0.5,
              height: cropDisplay.height,
              backgroundColor: "rgba(255,255,255,0.4)",
            }}
          />
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: cropDisplay.left,
              top: cropDisplay.top + cropDisplay.height / 2,
              width: cropDisplay.width,
              height: 0.5,
              backgroundColor: "rgba(255,255,255,0.4)",
            }}
          />
        </>
      )}

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

      {/* Bottom toolbar */}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "rgba(0,0,0,0.75)",
          borderTopLeftRadius: 10,
          borderTopRightRadius: 10,
          paddingHorizontal: 8,
          paddingTop: 6,
          paddingBottom: Platform.OS === "ios" ? 28 : 8,
          gap: 6,
        }}
      >
        {/* Row 1: Aspect ratio chips + Grid toggle */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
            {ASPECT_PRESETS.map((p) => (
              <Chip
                key={p.key}
                size="sm"
                variant={aspectPreset === p.key ? "primary" : "secondary"}
                onPress={() => {
                  setAspectPreset(p.key);
                  const av = getAspectRatioValue(p.key, imageWidth, imageHeight);
                  if (av != null) {
                    applyCropRegion(
                      applyAspectRatio(
                        cropRegionRef.current,
                        av,
                        imageWidth,
                        imageHeight,
                        MIN_CROP_SIZE,
                      ),
                    );
                  }
                }}
              >
                <Chip.Label className="text-[9px]">
                  {p.labelKey.startsWith("editor.") ? t(p.labelKey) : p.labelKey}
                </Chip.Label>
              </Chip>
            ))}
            <View
              style={{
                width: 1,
                height: 16,
                backgroundColor: "rgba(255,255,255,0.2)",
                marginHorizontal: 2,
              }}
            />
            <Chip
              size="sm"
              variant={gridMode !== "none" ? "primary" : "secondary"}
              onPress={() => {
                const idx = GRID_CYCLE.indexOf(gridMode);
                setGridMode(GRID_CYCLE[(idx + 1) % GRID_CYCLE.length]);
              }}
            >
              <Chip.Label className="text-[9px]">{t(GRID_LABEL[gridMode])}</Chip.Label>
            </Chip>
          </View>
        </ScrollView>

        {/* Row 2: Numeric coordinate inputs */}
        <View style={{ flexDirection: "row", gap: 4 }}>
          {(["x", "y", "w", "h"] as const).map((key) => (
            <View key={key} style={{ flex: 1 }}>
              <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.5)", marginBottom: 1 }}>
                {key.toUpperCase()}
              </Text>
              <TextInput
                keyboardType="number-pad"
                value={String(cropRegion[key])}
                onChangeText={(text) => {
                  const val = parseInt(text, 10);
                  if (!isNaN(val)) {
                    const next = { ...cropRegionRef.current, [key]: val };
                    const av = aspectRef.current;
                    if (av != null && (key === "w" || key === "h")) {
                      if (key === "w") next.h = Math.round(val / av);
                      else next.w = Math.round(val * av);
                    }
                    applyCropRegion(next);
                  }
                }}
                selectTextOnFocus
                style={{
                  fontSize: 10,
                  color: "#fff",
                  backgroundColor: "rgba(255,255,255,0.1)",
                  borderRadius: 4,
                  paddingHorizontal: 4,
                  height: 24,
                  textAlign: "center",
                }}
              />
            </View>
          ))}
        </View>

        {/* Row 3: Presets + Action buttons */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              const base = { x: 0, y: 0, w: imageWidth, h: imageHeight };
              const av = aspectRef.current;
              applyCropRegion(
                av != null
                  ? applyAspectRatio(base, av, imageWidth, imageHeight, MIN_CROP_SIZE)
                  : base,
              );
            }}
          >
            <Button.Label className="text-[9px]">{t("editor.cropPresetAll")}</Button.Label>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onPress={() => {
              const base = {
                x: Math.floor(imageWidth * 0.25),
                y: Math.floor(imageHeight * 0.25),
                w: Math.floor(imageWidth * 0.5),
                h: Math.floor(imageHeight * 0.5),
              };
              const av = aspectRef.current;
              applyCropRegion(
                av != null
                  ? applyAspectRatio(base, av, imageWidth, imageHeight, MIN_CROP_SIZE)
                  : base,
              );
            }}
          >
            <Button.Label className="text-[9px]">{t("editor.cropPresetCenter50")}</Button.Label>
          </Button>
          <View style={{ flex: 1 }} />
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
