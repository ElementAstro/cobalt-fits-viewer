/**
 * 小地图组件 - 显示缩略图和当前可视区域
 * 支持: 视口矩形、点击导航、拖拽导航、淡入淡出动画、缩放指示器
 */

import { memo, useCallback, useMemo, useRef } from "react";
import { Text, StyleSheet } from "react-native";
import {
  Canvas,
  Image as SkiaImage,
  Rect,
  Skia,
  PaintStyle,
  AlphaType,
  ColorType,
} from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import type { SkImage } from "@shopify/react-native-skia";
import { computeFitGeometry, screenToImagePoint } from "../../lib/viewer/transform";

interface MinimapProps {
  rgbaData: Uint8ClampedArray | null;
  imgWidth: number;
  imgHeight: number;
  visible: boolean;
  size?: number;
  viewportScale?: number;
  viewportTranslateX?: number;
  viewportTranslateY?: number;
  canvasWidth?: number;
  canvasHeight?: number;
  onNavigate?: (translateX: number, translateY: number) => void;
}

export const Minimap = memo(function Minimap({
  rgbaData,
  imgWidth,
  imgHeight,
  visible,
  size = 120,
  viewportScale = 1,
  viewportTranslateX = 0,
  viewportTranslateY = 0,
  canvasWidth = 0,
  canvasHeight = 0,
  onNavigate,
}: MinimapProps) {
  const skImage = useMemo<SkImage | null>(() => {
    if (!rgbaData || imgWidth <= 0 || imgHeight <= 0) return null;
    try {
      const maxDim = 200;
      const scaleFactor = Math.min(maxDim / imgWidth, maxDim / imgHeight, 1);
      if (scaleFactor >= 1) {
        const data = Skia.Data.fromBytes(
          new Uint8Array(rgbaData.buffer, rgbaData.byteOffset, rgbaData.byteLength),
        );
        return Skia.Image.MakeImage(
          {
            width: imgWidth,
            height: imgHeight,
            alphaType: AlphaType.Unpremul,
            colorType: ColorType.RGBA_8888,
          },
          data,
          imgWidth * 4,
        );
      }
      const dstW = Math.max(1, Math.round(imgWidth * scaleFactor));
      const dstH = Math.max(1, Math.round(imgHeight * scaleFactor));
      const downsampled = new Uint8ClampedArray(dstW * dstH * 4);
      for (let dy = 0; dy < dstH; dy++) {
        const sy = Math.floor(dy / scaleFactor);
        for (let dx = 0; dx < dstW; dx++) {
          const sx = Math.floor(dx / scaleFactor);
          const srcIdx = (sy * imgWidth + sx) * 4;
          const dstIdx = (dy * dstW + dx) * 4;
          downsampled[dstIdx] = rgbaData[srcIdx];
          downsampled[dstIdx + 1] = rgbaData[srcIdx + 1];
          downsampled[dstIdx + 2] = rgbaData[srcIdx + 2];
          downsampled[dstIdx + 3] = rgbaData[srcIdx + 3];
        }
      }
      const data = Skia.Data.fromBytes(
        new Uint8Array(downsampled.buffer, downsampled.byteOffset, downsampled.byteLength),
      );
      return Skia.Image.MakeImage(
        {
          width: dstW,
          height: dstH,
          alphaType: AlphaType.Unpremul,
          colorType: ColorType.RGBA_8888,
        },
        data,
        dstW * 4,
      );
    } catch {
      return null;
    }
  }, [rgbaData, imgWidth, imgHeight]);
  const isDragging = useRef(false);

  // --- Paints (cached, never change) ---
  const borderPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("rgba(255, 255, 255, 0.5)"));
    p.setStrokeWidth(1);
    p.setStyle(PaintStyle.Stroke);
    return p;
  }, []);

  const viewportPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("rgba(59, 130, 246, 0.6)"));
    p.setStrokeWidth(1.5);
    p.setStyle(PaintStyle.Stroke);
    return p;
  }, []);

  const viewportFillPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("rgba(59, 130, 246, 0.1)"));
    p.setStyle(PaintStyle.Fill);
    return p;
  }, []);

  // --- Layout calculations (cached) ---
  const layout = useMemo(() => {
    if (imgWidth <= 0 || imgHeight <= 0) return null;
    const aspect = imgWidth / imgHeight;
    const miniW = aspect >= 1 ? size : size * aspect;
    const miniH = aspect >= 1 ? size / aspect : size;
    return { miniW, miniH };
  }, [imgWidth, imgHeight, size]);

  // --- Viewport rect calculation (cached) ---
  const viewport = useMemo(() => {
    if (!layout || viewportScale <= 1 || canvasWidth <= 0 || canvasHeight <= 0) return null;
    const { miniW, miniH } = layout;
    const transform = {
      scale: viewportScale,
      translateX: viewportTranslateX,
      translateY: viewportTranslateY,
      canvasWidth,
      canvasHeight,
    };
    const p0 = screenToImagePoint({ x: 0, y: 0 }, transform, imgWidth, imgHeight);
    const p1 = screenToImagePoint(
      { x: canvasWidth, y: canvasHeight },
      transform,
      imgWidth,
      imgHeight,
    );

    // Map to minimap coordinates
    const scaleX = miniW / imgWidth;
    const scaleY = miniH / imgHeight;
    const vpX = Math.max(0, Math.min(p0.x * scaleX, miniW));
    const vpY = Math.max(0, Math.min(p0.y * scaleY, miniH));
    const vpX1 = Math.max(0, Math.min(p1.x * scaleX, miniW));
    const vpY1 = Math.max(0, Math.min(p1.y * scaleY, miniH));
    const vpW = vpX1 - vpX;
    const vpH = vpY1 - vpY;

    if (vpW <= 0 || vpH <= 0) return null;
    return { vpX, vpY, vpW, vpH };
  }, [
    layout,
    viewportScale,
    viewportTranslateX,
    viewportTranslateY,
    canvasWidth,
    canvasHeight,
    imgWidth,
    imgHeight,
  ]);

  // --- Navigate: convert minimap coords to canvas translate ---
  const navigateToMinimapPoint = useCallback(
    (miniX: number, miniY: number) => {
      if (!layout || !onNavigate || canvasWidth <= 0 || canvasHeight <= 0) return;
      const { miniW, miniH } = layout;

      // Minimap coord → image coord
      const imgX = (miniX / miniW) * imgWidth;
      const imgY = (miniY / miniH) * imgHeight;

      // Image coord → canvas translate (center this point on screen)
      const { fitScale, offsetX, offsetY } = computeFitGeometry(
        imgWidth,
        imgHeight,
        canvasWidth,
        canvasHeight,
      );

      const screenX = imgX * fitScale + offsetX;
      const screenY = imgY * fitScale + offsetY;

      const tx = canvasWidth / 2 - screenX * viewportScale;
      const ty = canvasHeight / 2 - screenY * viewportScale;

      onNavigate(tx, ty);
    },
    [layout, onNavigate, canvasWidth, canvasHeight, imgWidth, imgHeight, viewportScale],
  );

  // --- Gestures ---
  const tapGesture = Gesture.Tap().onEnd((e) => {
    // Account for 2px padding
    navigateToMinimapPoint(e.x - 2, e.y - 2);
  });

  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.current = true;
    })
    .onUpdate((e) => {
      navigateToMinimapPoint(e.x - 2, e.y - 2);
    })
    .onEnd(() => {
      isDragging.current = false;
    })
    .minDistance(2);

  const composedGesture = Gesture.Exclusive(panGesture, tapGesture);

  // --- Render ---
  if (!visible || !skImage || !layout) return null;

  const { miniW, miniH } = layout;
  const showViewport = viewport != null;
  const zoomText = viewportScale > 1 ? `${viewportScale.toFixed(1)}x` : "";

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[
          styles.container,
          {
            width: miniW + 4,
            height: miniH + 4 + (zoomText ? 14 : 0),
          },
        ]}
      >
        <Canvas style={{ width: miniW, height: miniH }}>
          <SkiaImage image={skImage} x={0} y={0} width={miniW} height={miniH} />
          <Rect x={0} y={0} width={miniW} height={miniH} paint={borderPaint} />
          {showViewport && (
            <>
              <Rect
                x={viewport.vpX}
                y={viewport.vpY}
                width={viewport.vpW}
                height={viewport.vpH}
                paint={viewportFillPaint}
              />
              <Rect
                x={viewport.vpX}
                y={viewport.vpY}
                width={viewport.vpW}
                height={viewport.vpH}
                paint={viewportPaint}
              />
            </>
          )}
        </Canvas>
        {zoomText !== "" && <Text style={styles.zoomLabel}>{zoomText}</Text>}
      </Animated.View>
    </GestureDetector>
  );
});

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80,
    right: 12,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "rgba(0,0,0,0.65)",
    padding: 2,
  },
  zoomLabel: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "600",
    textAlign: "center",
    paddingTop: 1,
    paddingBottom: 1,
  },
});
