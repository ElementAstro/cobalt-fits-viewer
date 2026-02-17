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
import { LayoutChangeEvent, Platform, View, Text } from "react-native";
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
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import {
  clampScale,
  clampTranslation,
  computeFitGeometry,
  computeTranslateBounds,
  remapPointBetweenSpaces,
} from "../../lib/viewer/transform";

// --- Constants ---
const MIN_SCALE = 0.5;
const MAX_SCALE = 10;
const DOUBLE_TAP_SCALE = 3;
const RUBBER_BAND_FACTOR = 0.55;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const SPRING_CONFIG = { damping: 20, stiffness: 250, mass: 0.5, overshootClamping: false };

// --- Worklet helpers ---
function zoomAroundFocalPoint(
  focalPointX: number,
  focalPointY: number,
  currentScale: number,
  targetScale: number,
  currentTranslateX: number,
  currentTranslateY: number,
): { x: number; y: number } {
  "worklet";
  const safeCurrentScale = currentScale <= 0 ? 1 : currentScale;
  const scaleFactor = targetScale / safeCurrentScale;
  return {
    x: focalPointX - (focalPointX - currentTranslateX) * scaleFactor,
    y: focalPointY - (focalPointY - currentTranslateY) * scaleFactor,
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
  const { maxX, maxY } = computeTranslateBounds(currentScale, imgW, imgH, cw, ch);
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
  resetView: () => void;
  getTransform: () => CanvasTransform;
}

interface FitsCanvasProps {
  rgbaData: Uint8ClampedArray | null;
  width: number;
  height: number;
  sourceWidth?: number;
  sourceHeight?: number;
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
  interactionEnabled?: boolean;
  wheelZoomEnabled?: boolean;
}

export const FitsCanvas = forwardRef<FitsCanvasHandle, FitsCanvasProps>(function FitsCanvas(
  {
    rgbaData,
    width: imgWidth,
    height: imgHeight,
    sourceWidth,
    sourceHeight,
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
    interactionEnabled = true,
    wheelZoomEnabled = false,
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
      cw: Math.round(canvasWidth.value),
      ch: Math.round(canvasHeight.value),
    }),
    (curr, prev) => {
      if (
        prev === null ||
        curr.s !== prev.s ||
        curr.tx !== prev.tx ||
        curr.ty !== prev.ty ||
        curr.cw !== prev.cw ||
        curr.ch !== prev.ch
      ) {
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
        const targetScale = clampScale(s ?? scale.value, propMinScale, propMaxScale);
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
          scale.value = withTiming(targetScale, { duration: 200 });
        }
        savedScale.value = targetScale;
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
      },
      resetView: () => {
        scale.value = withTiming(1, { duration: 220 });
        translateX.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(0, { duration: 220 });
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      },
      getTransform: () => ({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
        canvasWidth: canvasWidth.value,
        canvasHeight: canvasHeight.value,
      }),
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
      propMinScale,
      propMaxScale,
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
      onTransformChange?.({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
        canvasWidth: canvasWidth.value,
        canvasHeight: canvasHeight.value,
      });
    },
    [canvasWidth, canvasHeight, onTransformChange, scale, translateX, translateY],
  );

  const handleWheel = useCallback(
    (event: unknown) => {
      if (!wheelZoomEnabled || !interactionEnabled || Platform.OS !== "web") return;
      const evt = event as {
        preventDefault?: () => void;
        nativeEvent?: {
          deltaY?: number;
          offsetX?: number;
          offsetY?: number;
          locationX?: number;
          locationY?: number;
          x?: number;
          y?: number;
        };
      };
      evt.preventDefault?.();

      const nativeEvent = evt.nativeEvent ?? {};
      const deltaY = nativeEvent.deltaY ?? 0;
      if (Math.abs(deltaY) < 0.01) return;

      const currentScale = scale.value;
      const rawScale = currentScale * Math.exp(-deltaY * WHEEL_ZOOM_SENSITIVITY);
      const targetScale = clampScale(rawScale, propMinScale, propMaxScale);
      if (Math.abs(targetScale - currentScale) < 0.0001) return;

      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      const focalXOnCanvas =
        nativeEvent.offsetX ?? nativeEvent.locationX ?? nativeEvent.x ?? cw / 2;
      const focalYOnCanvas =
        nativeEvent.offsetY ?? nativeEvent.locationY ?? nativeEvent.y ?? ch / 2;

      const rawTranslate = zoomAroundFocalPoint(
        focalXOnCanvas,
        focalYOnCanvas,
        currentScale,
        targetScale,
        translateX.value,
        translateY.value,
      );
      const clamped = clampTranslation(
        rawTranslate.x,
        rawTranslate.y,
        targetScale,
        imgWidth,
        imgHeight,
        cw,
        ch,
      );

      scale.value = withTiming(targetScale, { duration: 90 });
      translateX.value = withTiming(clamped.x, { duration: 90 });
      translateY.value = withTiming(clamped.y, { duration: 90 });
      savedScale.value = targetScale;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
    },
    [
      wheelZoomEnabled,
      interactionEnabled,
      scale,
      translateX,
      translateY,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      canvasWidth,
      canvasHeight,
      propMinScale,
      propMaxScale,
      imgWidth,
      imgHeight,
    ],
  );

  // --- Gestures ---

  const panGesture = Gesture.Pan()
    .enabled(interactionEnabled)
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
      const { maxX, maxY } = computeTranslateBounds(scale.value, imgWidth, imgHeight, cw, ch);

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
    .enabled(interactionEnabled)
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
      const newScale = clampScale(rawScale, propMinScale * 0.5, propMaxScale * 1.5);

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
      const clampedScale = clampScale(scale.value, propMinScale, propMaxScale);
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
    .enabled(interactionEnabled)
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
        const targetScale = clampScale(propDoubleTapScale, propMinScale, propMaxScale);
        const rawTranslate = zoomAroundFocalPoint(
          e.x,
          e.y,
          scale.value,
          targetScale,
          translateX.value,
          translateY.value,
        );
        const clamped = clampTranslation(
          rawTranslate.x,
          rawTranslate.y,
          targetScale,
          imgWidth,
          imgHeight,
          cw,
          ch,
        );
        scale.value = withTiming(targetScale, { duration: 250 });
        translateX.value = withTiming(clamped.x, { duration: 250 });
        translateY.value = withTiming(clamped.y, { duration: 250 });
        savedScale.value = targetScale;
        savedTranslateX.value = clamped.x;
        savedTranslateY.value = clamped.y;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .enabled(interactionEnabled)
    .numberOfTaps(1)
    .onEnd((e) => {
      if (!onPixelTap || imgWidth <= 0 || imgHeight <= 0) return;
      // Convert screen coords to image pixel coords
      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      const { fitScale, offsetX, offsetY } = computeFitGeometry(imgWidth, imgHeight, cw, ch);
      if (fitScale <= 0) return;

      // Remove canvas transform
      const localX = (e.x - translateX.value) / scale.value;
      const localY = (e.y - translateY.value) / scale.value;

      // Remove fit offset and scale
      const pixelX = Math.floor((localX - offsetX) / fitScale);
      const pixelY = Math.floor((localY - offsetY) / fitScale);

      if (pixelX >= 0 && pixelX < imgWidth && pixelY >= 0 && pixelY < imgHeight) {
        const sourceW = sourceWidth ?? imgWidth;
        const sourceH = sourceHeight ?? imgHeight;
        const sourcePoint = remapPointBetweenSpaces(
          { x: pixelX + 0.5, y: pixelY + 0.5 },
          imgWidth,
          imgHeight,
          sourceW,
          sourceH,
        );
        const sourceX = Math.max(0, Math.min(sourceW - 1, Math.floor(sourcePoint.x)));
        const sourceY = Math.max(0, Math.min(sourceH - 1, Math.floor(sourcePoint.y)));
        runOnJS(onPixelTap)(sourceX, sourceY);
      }
    });

  const longPressGesture = Gesture.LongPress()
    .enabled(interactionEnabled)
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
    const { fitScale, offsetX, offsetY } = computeFitGeometry(imgWidth, imgHeight, cw, ch);
    return [{ translateX: offsetX }, { translateY: offsetY }, { scale: fitScale }];
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

  const webWheelProps: Record<string, unknown> =
    wheelZoomEnabled && interactionEnabled && Platform.OS === "web" ? { onWheel: handleWheel } : {};

  return (
    <View style={{ flex: 1 }} onLayout={onLayout} {...webWheelProps}>
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
