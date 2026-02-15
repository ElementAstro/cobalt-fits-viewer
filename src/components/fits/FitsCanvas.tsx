/**
 * FITS 图像 Skia Canvas 渲染组件
 * 支持: 图像渲染、缩放/平移手势、网格/十字线叠加、像素检测
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  forwardRef,
  useState,
} from "react";
import { LayoutChangeEvent, View, Text } from "react-native";
import {
  Canvas,
  Fill,
  ImageShader,
  Group,
  Line,
  Skia,
  vec,
  rect,
} from "@shopify/react-native-skia";
import { useSkImage } from "../../hooks/useSkImage";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useSharedValue,
  useDerivedValue,
  useAnimatedReaction,
  withTiming,
  withSpring,
  withDecay,
  runOnJS,
  clamp,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";

// --- Constants ---
const MIN_SCALE = 0.5;
const MAX_SCALE = 10;
const DOUBLE_TAP_SCALE = 3;
const RUBBER_BAND_FACTOR = 0.55;
const SPRING_CONFIG = { damping: 20, stiffness: 250, mass: 0.5, overshootClamping: false };

// --- Worklet helpers ---
function getTranslateBounds(
  currentScale: number,
  imgW: number,
  imgH: number,
  cw: number,
  ch: number,
): { maxX: number; maxY: number } {
  "worklet";
  const fs = Math.min(cw / imgW, ch / imgH);
  const displayW = imgW * fs;
  const displayH = imgH * fs;
  const scaledW = displayW * currentScale;
  const scaledH = displayH * currentScale;
  const excessW = Math.max(0, scaledW - cw);
  const excessH = Math.max(0, scaledH - ch);
  return { maxX: excessW / 2, maxY: excessH / 2 };
}

function clampTranslation(
  tx: number,
  ty: number,
  currentScale: number,
  imgW: number,
  imgH: number,
  cw: number,
  ch: number,
): { x: number; y: number } {
  "worklet";
  const { maxX, maxY } = getTranslateBounds(currentScale, imgW, imgH, cw, ch);
  return {
    x: clamp(tx, -maxX, maxX),
    y: clamp(ty, -maxY, maxY),
  };
}

function rubberBand(value: number, min: number, max: number, dimension: number): number {
  "worklet";
  if (value < min) {
    const overscroll = min - value;
    return min - (1 - 1 / ((overscroll * RUBBER_BAND_FACTOR) / dimension + 1)) * dimension;
  }
  if (value > max) {
    const overscroll = value - max;
    return max + (1 - 1 / ((overscroll * RUBBER_BAND_FACTOR) / dimension + 1)) * dimension;
  }
  return value;
}

function applyRubberBandTranslation(
  tx: number,
  ty: number,
  currentScale: number,
  imgW: number,
  imgH: number,
  cw: number,
  ch: number,
): { x: number; y: number } {
  "worklet";
  const { maxX, maxY } = getTranslateBounds(currentScale, imgW, imgH, cw, ch);
  return {
    x: rubberBand(tx, -maxX, maxX, cw),
    y: rubberBand(ty, -maxY, maxY, ch),
  };
}

export interface CanvasTransform {
  scale: number;
  translateX: number;
  translateY: number;
  canvasWidth: number;
  canvasHeight: number;
}

export interface FitsCanvasHandle {
  setTransform: (tx: number, ty: number, s?: number) => void;
}

interface FitsCanvasProps {
  rgbaData: Uint8ClampedArray | null;
  width: number;
  height: number;
  showGrid: boolean;
  showCrosshair: boolean;
  cursorX: number;
  cursorY: number;
  onPixelTap?: (imageX: number, imageY: number) => void;
  onTransformChange?: (transform: CanvasTransform) => void;
  gridColor?: string;
  gridOpacity?: number;
  crosshairColor?: string;
  crosshairOpacity?: number;
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onLongPress?: () => void;
}

export const FitsCanvas = forwardRef<FitsCanvasHandle, FitsCanvasProps>(function FitsCanvas(
  {
    rgbaData,
    width: imgWidth,
    height: imgHeight,
    showGrid,
    showCrosshair,
    cursorX,
    cursorY,
    onPixelTap,
    onTransformChange,
    gridColor: gridColorProp = "#64c8ff",
    gridOpacity: gridOpacityProp = 0.3,
    crosshairColor: crosshairColorProp = "#ff5050",
    crosshairOpacity: crosshairOpacityProp = 0.7,
    minScale: propMinScale = MIN_SCALE,
    maxScale: propMaxScale = MAX_SCALE,
    doubleTapScale: propDoubleTapScale = DOUBLE_TAP_SCALE,
    onSwipeLeft,
    onSwipeRight,
    onLongPress,
  },
  ref,
) {
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
  const isPinching = useSharedValue(false);

  // Zoom level for indicator overlay
  const [zoomText, setZoomText] = useState("");
  const zoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Notify parent of transform changes
  const notifyTransform = useCallback(() => {
    onTransformChange?.({
      scale: scale.value,
      translateX: translateX.value,
      translateY: translateY.value,
      canvasWidth: canvasWidth.value,
      canvasHeight: canvasHeight.value,
    });
  }, [onTransformChange, scale, translateX, translateY, canvasWidth, canvasHeight]);

  // Show zoom indicator temporarily
  const showZoomIndicator = useCallback((s: number) => {
    const pct = Math.round(s * 100);
    setZoomText(`${pct}%`);
    if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    zoomTimerRef.current = setTimeout(() => setZoomText(""), 1200);
  }, []);

  // Track scale changes to show zoom indicator
  useAnimatedReaction(
    () => scale.value,
    (curr, prev) => {
      if (prev !== null && Math.abs(curr - prev) > 0.01) {
        runOnJS(showZoomIndicator)(curr);
      }
    },
    [showZoomIndicator],
  );

  // Track scale/translate changes to notify parent
  useAnimatedReaction(
    () => ({
      s: Math.round(scale.value * 100) / 100,
      tx: Math.round(translateX.value),
      ty: Math.round(translateY.value),
    }),
    (curr, prev) => {
      if (prev !== null && (curr.s !== prev.s || curr.tx !== prev.tx || curr.ty !== prev.ty)) {
        runOnJS(notifyTransform)();
      }
    },
    [notifyTransform],
  );

  // Expose imperative handle for programmatic navigation
  useImperativeHandle(
    ref,
    () => ({
      setTransform: (tx: number, ty: number, s?: number) => {
        const targetScale = s ?? scale.value;
        const clamped = clampTranslation(
          tx,
          ty,
          targetScale,
          imgWidth,
          imgHeight,
          canvasWidth.value,
          canvasHeight.value,
        );
        translateX.value = withTiming(clamped.x, { duration: 200 });
        translateY.value = withTiming(clamped.y, { duration: 200 });
        if (s != null) {
          scale.value = withTiming(s, { duration: 200 });
          savedScale.value = s;
        }
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
      },
    }),
    [
      translateX,
      translateY,
      scale,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      canvasWidth,
      canvasHeight,
      imgWidth,
      imgHeight,
    ],
  );

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
      if (isPinching.value) {
        savedTranslateX.value = translateX.value - e.translationX;
        savedTranslateY.value = translateY.value - e.translationY;
        return;
      }
      const rawX = savedTranslateX.value + e.translationX;
      const rawY = savedTranslateY.value + e.translationY;
      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      // Apply rubber band effect at boundaries
      const rb = applyRubberBandTranslation(rawX, rawY, scale.value, imgWidth, imgHeight, cw, ch);
      translateX.value = rb.x;
      translateY.value = rb.y;
    })
    .onEnd((e) => {
      if (isPinching.value) return;

      // Detect horizontal swipe for file navigation when not zoomed in
      const SWIPE_VELOCITY_THRESHOLD = 800;
      if (
        scale.value <= 1.05 &&
        Math.abs(e.velocityX) > SWIPE_VELOCITY_THRESHOLD &&
        Math.abs(e.velocityX) > Math.abs(e.velocityY) * 2
      ) {
        if (e.velocityX > 0 && onSwipeRight) {
          runOnJS(onSwipeRight)();
          return;
        }
        if (e.velocityX < 0 && onSwipeLeft) {
          runOnJS(onSwipeLeft)();
          return;
        }
      }

      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      const { maxX, maxY } = getTranslateBounds(scale.value, imgWidth, imgHeight, cw, ch);

      // Apply momentum with decay, clamped to bounds
      translateX.value = withDecay({ velocity: e.velocityX, clamp: [-maxX, maxX] }, () => {
        // Spring snap-back if beyond bounds after decay
        const clamped = clampTranslation(
          translateX.value,
          translateY.value,
          scale.value,
          imgWidth,
          imgHeight,
          cw,
          ch,
        );
        if (Math.abs(translateX.value - clamped.x) > 0.5) {
          translateX.value = withSpring(clamped.x, SPRING_CONFIG);
        }
      });
      translateY.value = withDecay({ velocity: e.velocityY, clamp: [-maxY, maxY] }, () => {
        const clamped = clampTranslation(
          translateX.value,
          translateY.value,
          scale.value,
          imgWidth,
          imgHeight,
          cw,
          ch,
        );
        if (Math.abs(translateY.value - clamped.y) > 0.5) {
          translateY.value = withSpring(clamped.y, SPRING_CONFIG);
        }
      });
    })
    .minPointers(1)
    .maxPointers(2);

  const pinchGesture = Gesture.Pinch()
    .onStart((e) => {
      isPinching.value = true;
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      focalX.value = e.focalX;
      focalY.value = e.focalY;
    })
    .onUpdate((e) => {
      // Allow slight over-zoom with rubber band feel, hard clamp at extremes
      const rawScale = savedScale.value * e.scale;
      const newScale = clamp(rawScale, propMinScale * 0.5, propMaxScale * 1.5);

      // Track focal point delta for accurate pinch center
      const focalDeltaX = e.focalX - focalX.value;
      const focalDeltaY = e.focalY - focalY.value;

      // Adjust translation to keep content under focal point stable
      const scaleFactor = newScale / savedScale.value;
      const newTx =
        focalDeltaX +
        savedTranslateX.value +
        (savedTranslateX.value - focalX.value) * (scaleFactor - 1);
      const newTy =
        focalDeltaY +
        savedTranslateY.value +
        (savedTranslateY.value - focalY.value) * (scaleFactor - 1);

      scale.value = newScale;
      translateX.value = newTx;
      translateY.value = newTy;
    })
    .onEnd(() => {
      // Snap scale back to valid range with spring
      const clampedScale = clamp(scale.value, propMinScale, propMaxScale);
      if (Math.abs(scale.value - clampedScale) > 0.01) {
        scale.value = withSpring(clampedScale, SPRING_CONFIG);
      }
      savedScale.value = clampedScale;

      // Snap translation back to valid bounds
      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      const clamped = clampTranslation(
        translateX.value,
        translateY.value,
        clampedScale,
        imgWidth,
        imgHeight,
        cw,
        ch,
      );
      translateX.value = withSpring(clamped.x, SPRING_CONFIG);
      translateY.value = withSpring(clamped.y, SPRING_CONFIG);
      isPinching.value = false;
    })
    .onFinalize(() => {
      isPinching.value = false;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      if (scale.value > 1.1) {
        // Reset to fit
        scale.value = withTiming(1, { duration: 250 });
        translateX.value = withTiming(0, { duration: 250 });
        translateY.value = withTiming(0, { duration: 250 });
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom to DOUBLE_TAP_SCALE at tap point, clamped to bounds
        const targetScale = propDoubleTapScale;
        const cx = cw / 2;
        const cy = ch / 2;
        const rawTx = cx - (e.x - translateX.value) * (targetScale / scale.value);
        const rawTy = cy - (e.y - translateY.value) * (targetScale / scale.value);
        const clamped = clampTranslation(rawTx, rawTy, targetScale, imgWidth, imgHeight, cw, ch);
        scale.value = withTiming(targetScale, { duration: 250 });
        translateX.value = withTiming(clamped.x, { duration: 250 });
        translateY.value = withTiming(clamped.y, { duration: 250 });
        savedScale.value = targetScale;
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
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

  const longPressGesture = Gesture.LongPress()
    .minDuration(500)
    .onEnd((_e, success) => {
      if (success && onLongPress) {
        runOnJS(onLongPress)();
      }
    });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    pinchGesture,
    Gesture.Exclusive(doubleTapGesture, singleTapGesture, longPressGesture),
  );

  // --- Skia Transform ---
  const transform = useDerivedValue(() => [
    { scale: scale.value },
    { translateX: translateX.value },
    { translateY: translateY.value },
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
    p.setColor(Skia.Color(gridColorProp));
    p.setAlphaf(gridOpacityProp);
    p.setStrokeWidth(1);
    return p;
  }, [gridColorProp, gridOpacityProp]);

  const crosshairPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color(crosshairColorProp));
    p.setAlphaf(crosshairOpacityProp);
    p.setStrokeWidth(1);
    return p;
  }, [crosshairColorProp, crosshairOpacityProp]);

  if (!skImage) return null;

  return (
    <View style={{ flex: 1 }} onLayout={onLayout}>
      <GestureDetector gesture={composedGesture}>
        <View style={{ flex: 1 }}>
          <Canvas style={{ flex: 1 }}>
            <Group transform={transform}>
              <Group transform={imageTransform}>
                <Fill>
                  <ImageShader image={skImage} fit="fill" rect={rect(0, 0, imgWidth, imgHeight)} />
                </Fill>

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

      {/* Zoom level indicator */}
      {zoomText !== "" && (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(300)}
          style={{
            position: "absolute",
            alignSelf: "center",
            top: "45%",
            backgroundColor: "rgba(0,0,0,0.6)",
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 6,
          }}
          pointerEvents="none"
        >
          <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700" }}>{zoomText}</Text>
        </Animated.View>
      )}
    </View>
  );
});
