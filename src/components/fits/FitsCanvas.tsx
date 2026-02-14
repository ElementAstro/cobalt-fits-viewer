/**
 * FITS 图像 Skia Canvas 渲染组件
 * 支持: 图像渲染、缩放/平移手势、网格/十字线叠加、像素检测
 */

import { useCallback, useEffect, useMemo } from "react";
import { LayoutChangeEvent, View } from "react-native";
import { Canvas, Image as SkiaImage, Group, Line, Skia, vec } from "@shopify/react-native-skia";
import { useSkImage } from "../../hooks/useSkImage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  runOnJS,
  clamp,
} from "react-native-reanimated";

interface FitsCanvasProps {
  rgbaData: Uint8ClampedArray | null;
  width: number;
  height: number;
  showGrid: boolean;
  showCrosshair: boolean;
  cursorX: number;
  cursorY: number;
  onPixelTap?: (imageX: number, imageY: number) => void;
}

export function FitsCanvas({
  rgbaData,
  width: imgWidth,
  height: imgHeight,
  showGrid,
  showCrosshair,
  cursorX,
  cursorY,
  onPixelTap,
}: FitsCanvasProps) {
  // Canvas layout dimensions
  const canvasWidth = useSharedValue(300);
  const canvasHeight = useSharedValue(300);

  // Transform state
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Focal point for pinch
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);

  // Create SkImage from RGBA data
  const skImage = useSkImage(rgbaData, imgWidth, imgHeight);

  // Reset transform when image changes
  useEffect(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgWidth, imgHeight]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      canvasWidth.value = e.nativeEvent.layout.width;
      canvasHeight.value = e.nativeEvent.layout.height;
    },
    [canvasWidth, canvasHeight],
  );

  // --- Gestures ---

  const panGesture = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .minPointers(1)
    .maxPointers(2);

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      savedScale.value = scale.value;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      const newScale = clamp(savedScale.value * e.scale, 0.1, 20);
      // Adjust translation to keep focal point stable
      const dx = (focalX.value - translateX.value) * (1 - newScale / scale.value);
      const dy = (focalY.value - translateY.value) * (1 - newScale / scale.value);
      translateX.value += dx;
      translateY.value += dy;
      scale.value = newScale;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1.1) {
        // Reset to fit
        scale.value = withTiming(1, { duration: 250 });
        translateX.value = withTiming(0, { duration: 250 });
        translateY.value = withTiming(0, { duration: 250 });
        savedScale.value = 1;
      } else {
        // Zoom to 3x at tap point
        const targetScale = 3;
        const cx = canvasWidth.value / 2;
        const cy = canvasHeight.value / 2;
        const tx = cx - (e.x - translateX.value) * (targetScale / scale.value);
        const ty = cy - (e.y - translateY.value) * (targetScale / scale.value);
        scale.value = withTiming(targetScale, { duration: 250 });
        translateX.value = withTiming(tx, { duration: 250 });
        translateY.value = withTiming(ty, { duration: 250 });
        savedScale.value = targetScale;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd((e) => {
      if (!onPixelTap || imgWidth <= 0 || imgHeight <= 0) return;
      // Convert screen coords to image pixel coords
      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      const fs = Math.min(cw / imgWidth, ch / imgHeight);
      const displayW = imgWidth * fs;
      const displayH = imgHeight * fs;
      const offsetX = (cw - displayW) / 2;
      const offsetY = (ch - displayH) / 2;

      // Remove canvas transform
      const localX = (e.x - translateX.value) / scale.value;
      const localY = (e.y - translateY.value) / scale.value;

      // Remove fit offset and scale
      const pixelX = Math.floor((localX - offsetX) / fs);
      const pixelY = Math.floor((localY - offsetY) / fs);

      if (pixelX >= 0 && pixelX < imgWidth && pixelY >= 0 && pixelY < imgHeight) {
        runOnJS(onPixelTap)(pixelX, pixelY);
      }
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture),
  );

  // --- Skia Transform ---
  const transform = useDerivedValue(() => [
    { translateX: translateX.value },
    { translateY: translateY.value },
    { scale: scale.value },
  ]);

  // Compute the fit-to-canvas offset for centering
  const imageTransform = useDerivedValue(() => {
    if (imgWidth <= 0 || imgHeight <= 0) return [];
    const cw = canvasWidth.value;
    const ch = canvasHeight.value;
    const fs = Math.min(cw / imgWidth, ch / imgHeight);
    const offsetX = (cw - imgWidth * fs) / 2;
    const offsetY = (ch - imgHeight * fs) / 2;
    return [{ translateX: offsetX }, { translateY: offsetY }, { scale: fs }];
  });

  // --- Grid lines ---
  const gridLines = useMemo(() => {
    if (!showGrid || imgWidth <= 0 || imgHeight <= 0) return [];
    const lines: Array<{ p1: { x: number; y: number }; p2: { x: number; y: number } }> = [];
    const step = Math.max(Math.ceil(Math.max(imgWidth, imgHeight) / 10 / 100) * 100, 50);
    // Vertical lines
    for (let x = step; x < imgWidth; x += step) {
      lines.push({ p1: { x, y: 0 }, p2: { x, y: imgHeight } });
    }
    // Horizontal lines
    for (let y = step; y < imgHeight; y += step) {
      lines.push({ p1: { x: 0, y }, p2: { x: imgWidth, y } });
    }
    return lines;
  }, [showGrid, imgWidth, imgHeight]);

  // --- Crosshair lines ---
  const crosshairLines = useMemo(() => {
    if (!showCrosshair || cursorX < 0 || cursorY < 0) return [];
    return [
      { p1: { x: cursorX + 0.5, y: 0 }, p2: { x: cursorX + 0.5, y: imgHeight } },
      { p1: { x: 0, y: cursorY + 0.5 }, p2: { x: imgWidth, y: cursorY + 0.5 } },
    ];
  }, [showCrosshair, cursorX, cursorY, imgWidth, imgHeight]);

  const gridPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("rgba(100, 200, 255, 0.3)"));
    p.setStrokeWidth(1);
    return p;
  }, []);

  const crosshairPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("rgba(255, 80, 80, 0.7)"));
    p.setStrokeWidth(1);
    return p;
  }, []);

  if (!skImage) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <GestureDetector gesture={composedGesture}>
        <View style={{ flex: 1 }}>
          <Canvas style={{ flex: 1 }}>
            <Group transform={transform}>
              <Group transform={imageTransform}>
                <SkiaImage image={skImage} x={0} y={0} width={imgWidth} height={imgHeight} />

                {/* Grid overlay */}
                {showGrid &&
                  gridLines.map((line, i) => (
                    <Line
                      key={`g${i}`}
                      p1={vec(line.p1.x, line.p1.y)}
                      p2={vec(line.p2.x, line.p2.y)}
                      paint={gridPaint}
                    />
                  ))}

                {/* Crosshair overlay */}
                {showCrosshair &&
                  crosshairLines.map((line, i) => (
                    <Line
                      key={`c${i}`}
                      p1={vec(line.p1.x, line.p1.y)}
                      p2={vec(line.p2.x, line.p2.y)}
                      paint={crosshairPaint}
                    />
                  ))}
              </Group>
            </Group>
          </Canvas>
        </View>
      </GestureDetector>
    </View>
  );
}
