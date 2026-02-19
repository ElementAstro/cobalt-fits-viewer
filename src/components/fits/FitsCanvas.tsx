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
  computeIncrementalPinchTranslation,
  computeFitGeometry,
  computeTranslateBounds,
  remapPointBetweenSpaces,
  zoomAroundPoint,
} from "../../lib/viewer/transform";

// --- Constants ---
const MIN_SCALE = 0.5;
const MAX_SCALE = 10;
const DOUBLE_TAP_SCALE = 3;
const PINCH_SENSITIVITY = 1;
const PINCH_OVERZOOM_FACTOR = 1.25;
const PAN_RUBBER_BAND_FACTOR = 0.55;
const WHEEL_ZOOM_SENSITIVITY = 0.0015;
const SPRING_CONFIG = { damping: 20, stiffness: 250, mass: 0.5, overshootClamping: false };

// --- Worklet helpers ---
function rubberBand(
  value: number,
  min: number,
  max: number,
  dimension: number,
  rubberBandFactor: number,
): number {
  "worklet";
  if (rubberBandFactor <= 0) {
    return Math.max(min, Math.min(max, value));
  }
  if (value < min) {
    const overscroll = min - value;
    return min - (1 - 1 / ((overscroll * rubberBandFactor) / dimension + 1)) * dimension;
  }
  if (value > max) {
    const overscroll = value - max;
    return max + (1 - 1 / ((overscroll * rubberBandFactor) / dimension + 1)) * dimension;
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
  rubberBandFactor: number,
): { x: number; y: number } {
  "worklet";
  const { maxX, maxY } = computeTranslateBounds(currentScale, imgW, imgH, cw, ch);
  return {
    x: rubberBand(tx, -maxX, maxX, cw, rubberBandFactor),
    y: rubberBand(ty, -maxY, maxY, ch, rubberBandFactor),
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
  setTransform: (tx: number, ty: number, s?: number, options?: TransformSetOptions) => void;
  resetView: () => void;
  getTransform: () => CanvasTransform;
}

export interface TransformSetOptions {
  animated?: boolean;
  duration?: number;
}

export interface FitsCanvasGestureConfig {
  pinchSensitivity?: number;
  pinchOverzoomFactor?: number;
  panRubberBandFactor?: number;
  wheelZoomSensitivity?: number;
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
  onPixelLongPress?: (imageX: number, imageY: number) => void;
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
  gestureConfig?: FitsCanvasGestureConfig;
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
    onPixelLongPress,
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
    gestureConfig,
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
  const panStartTranslateX = useSharedValue(0);
  const panStartTranslateY = useSharedValue(0);
  const pinchStartScale = useSharedValue(1);
  const pinchPrevFocalX = useSharedValue(0);
  const pinchPrevFocalY = useSharedValue(0);

  const isPinching = useSharedValue(false);

  const pinchSensitivity = useMemo(
    () => clampScale(gestureConfig?.pinchSensitivity ?? PINCH_SENSITIVITY, 0.6, 1.8),
    [gestureConfig?.pinchSensitivity],
  );
  const pinchOverzoomFactor = useMemo(
    () => clampScale(gestureConfig?.pinchOverzoomFactor ?? PINCH_OVERZOOM_FACTOR, 1, 1.6),
    [gestureConfig?.pinchOverzoomFactor],
  );
  const panRubberBandFactor = useMemo(
    () => clampScale(gestureConfig?.panRubberBandFactor ?? PAN_RUBBER_BAND_FACTOR, 0, 0.9),
    [gestureConfig?.panRubberBandFactor],
  );
  const wheelZoomSensitivity = useMemo(
    () => clampScale(gestureConfig?.wheelZoomSensitivity ?? WHEEL_ZOOM_SENSITIVITY, 0.0005, 0.004),
    [gestureConfig?.wheelZoomSensitivity],
  );

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

  useEffect(
    () => () => {
      if (zoomTimerRef.current) clearTimeout(zoomTimerRef.current);
    },
    [],
  );

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
  const applyTransform = useCallback(
    (tx: number, ty: number, nextScale?: number, options?: TransformSetOptions) => {
      const targetScale = clampScale(nextScale ?? scale.value, propMinScale, propMaxScale);
      const clamped = clampTranslation(
        tx,
        ty,
        targetScale,
        imgWidth,
        imgHeight,
        canvasWidth.value,
        canvasHeight.value,
      );
      const animated = options?.animated ?? true;
      const duration = Math.max(0, options?.duration ?? 200);

      if (animated) {
        if (nextScale != null) {
          scale.value = withTiming(targetScale, { duration });
        }
        translateX.value = withTiming(clamped.x, { duration });
        translateY.value = withTiming(clamped.y, { duration });
      } else {
        if (nextScale != null) {
          scale.value = targetScale;
        }
        translateX.value = clamped.x;
        translateY.value = clamped.y;
      }

      savedScale.value = targetScale;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
      panStartTranslateX.value = clamped.x;
      panStartTranslateY.value = clamped.y;
      pinchStartScale.value = targetScale;
    },
    [
      canvasHeight,
      canvasWidth,
      imgHeight,
      imgWidth,
      panStartTranslateX,
      panStartTranslateY,
      pinchStartScale,
      propMaxScale,
      propMinScale,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      scale,
      translateX,
      translateY,
    ],
  );

  useImperativeHandle(
    ref,
    () => ({
      setTransform: (tx: number, ty: number, s?: number, options?: TransformSetOptions) => {
        applyTransform(tx, ty, s, options);
      },
      resetView: () => {
        applyTransform(0, 0, 1, { animated: true, duration: 220 });
      },
      getTransform: () => ({
        scale: scale.value,
        translateX: translateX.value,
        translateY: translateY.value,
        canvasWidth: canvasWidth.value,
        canvasHeight: canvasHeight.value,
      }),
    }),
    [applyTransform, canvasHeight, canvasWidth, scale, translateX, translateY],
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
    panStartTranslateX.value = 0;
    panStartTranslateY.value = 0;
    pinchStartScale.value = 1;
    pinchPrevFocalX.value = 0;
    pinchPrevFocalY.value = 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imgWidth, imgHeight]);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const nextCanvasWidth = e.nativeEvent.layout.width;
      const nextCanvasHeight = e.nativeEvent.layout.height;
      canvasWidth.value = nextCanvasWidth;
      canvasHeight.value = nextCanvasHeight;

      const nextScale = clampScale(scale.value, propMinScale, propMaxScale);
      if (Math.abs(nextScale - scale.value) > 0.0001) {
        scale.value = nextScale;
      }
      const clamped = clampTranslation(
        translateX.value,
        translateY.value,
        nextScale,
        imgWidth,
        imgHeight,
        nextCanvasWidth,
        nextCanvasHeight,
      );
      translateX.value = clamped.x;
      translateY.value = clamped.y;
      savedScale.value = nextScale;
      savedTranslateX.value = clamped.x;
      savedTranslateY.value = clamped.y;
      panStartTranslateX.value = clamped.x;
      panStartTranslateY.value = clamped.y;
      pinchStartScale.value = nextScale;
      pinchPrevFocalX.value = nextCanvasWidth / 2;
      pinchPrevFocalY.value = nextCanvasHeight / 2;

      onTransformChange?.({
        scale: nextScale,
        translateX: clamped.x,
        translateY: clamped.y,
        canvasWidth: nextCanvasWidth,
        canvasHeight: nextCanvasHeight,
      });
    },
    [
      canvasHeight,
      canvasWidth,
      imgHeight,
      imgWidth,
      onTransformChange,
      propMaxScale,
      propMinScale,
      panStartTranslateX,
      panStartTranslateY,
      pinchPrevFocalX,
      pinchPrevFocalY,
      pinchStartScale,
      savedScale,
      savedTranslateX,
      savedTranslateY,
      scale,
      translateX,
      translateY,
    ],
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
      const rawScale = currentScale * Math.exp(-deltaY * wheelZoomSensitivity);
      const targetScale = clampScale(rawScale, propMinScale, propMaxScale);
      if (Math.abs(targetScale - currentScale) < 0.0001) return;

      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      const focalXOnCanvas =
        nativeEvent.offsetX ?? nativeEvent.locationX ?? nativeEvent.x ?? cw / 2;
      const focalYOnCanvas =
        nativeEvent.offsetY ?? nativeEvent.locationY ?? nativeEvent.y ?? ch / 2;

      const rawTranslate = zoomAroundPoint(
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
      panStartTranslateX.value = clamped.x;
      panStartTranslateY.value = clamped.y;
      pinchStartScale.value = targetScale;
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
      panStartTranslateX,
      panStartTranslateY,
      pinchStartScale,
      canvasWidth,
      canvasHeight,
      propMinScale,
      propMaxScale,
      wheelZoomSensitivity,
      imgWidth,
      imgHeight,
    ],
  );

  // --- Gestures ---

  const panGesture = Gesture.Pan()
    .enabled(interactionEnabled)
    .onStart(() => {
      panStartTranslateX.value = translateX.value;
      panStartTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      if (isPinching.value) {
        return;
      }
      const rawX = panStartTranslateX.value + e.translationX;
      const rawY = panStartTranslateY.value + e.translationY;
      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      // Apply rubber band effect at boundaries
      const rb = applyRubberBandTranslation(
        rawX,
        rawY,
        scale.value,
        imgWidth,
        imgHeight,
        cw,
        ch,
        panRubberBandFactor,
      );
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
      pinchStartScale.value = scale.value;
      pinchPrevFocalX.value = e.focalX;
      pinchPrevFocalY.value = e.focalY;
    })
    .onUpdate((e) => {
      // Allow slight over-zoom with rubber band feel, hard clamp at extremes
      const rawScale = pinchStartScale.value * Math.pow(e.scale, pinchSensitivity);
      const overzoomMin = propMinScale / pinchOverzoomFactor;
      const overzoomMax = propMaxScale * pinchOverzoomFactor;
      const targetScale = clampScale(rawScale, overzoomMin, overzoomMax);

      const rawTranslate = computeIncrementalPinchTranslation(
        e.focalX,
        e.focalY,
        pinchPrevFocalX.value,
        pinchPrevFocalY.value,
        scale.value,
        targetScale,
        translateX.value,
        translateY.value,
      );
      const cw = canvasWidth.value;
      const ch = canvasHeight.value;
      const rb = applyRubberBandTranslation(
        rawTranslate.x,
        rawTranslate.y,
        targetScale,
        imgWidth,
        imgHeight,
        cw,
        ch,
        panRubberBandFactor,
      );

      scale.value = targetScale;
      translateX.value = rb.x;
      translateY.value = rb.y;
      pinchPrevFocalX.value = e.focalX;
      pinchPrevFocalY.value = e.focalY;
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
      panStartTranslateX.value = clamped.x;
      panStartTranslateY.value = clamped.y;
      pinchStartScale.value = clampedScale;
      isPinching.value = false;
    })
    .onFinalize(() => {
      panStartTranslateX.value = translateX.value;
      panStartTranslateY.value = translateY.value;
      isPinching.value = false;
    });

  const doubleTapGesture = Gesture.Tap()
    .enabled(interactionEnabled)
    .numberOfTaps(2)
    .maxDistance(18)
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
        panStartTranslateX.value = 0;
        panStartTranslateY.value = 0;
        pinchStartScale.value = 1;
      } else {
        // Zoom to DOUBLE_TAP_SCALE at tap point, clamped to bounds
        const targetScale = clampScale(propDoubleTapScale, propMinScale, propMaxScale);
        const rawTranslate = zoomAroundPoint(
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
        panStartTranslateX.value = clamped.x;
        panStartTranslateY.value = clamped.y;
        pinchStartScale.value = targetScale;
      }
    });

  const singleTapGesture = Gesture.Tap()
    .enabled(interactionEnabled)
    .numberOfTaps(1)
    .maxDistance(10)
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
    .maxDistance(12)
    .onEnd((e, success) => {
      if (!success) return;

      if (onPixelLongPress && imgWidth > 0 && imgHeight > 0) {
        const cw = canvasWidth.value;
        const ch = canvasHeight.value;
        const { fitScale, offsetX, offsetY } = computeFitGeometry(imgWidth, imgHeight, cw, ch);
        if (fitScale > 0) {
          const localX = (e.x - translateX.value) / scale.value;
          const localY = (e.y - translateY.value) / scale.value;
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
            runOnJS(onPixelLongPress)(sourceX, sourceY);
          }
        }
      }

      if (onLongPress) {
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
