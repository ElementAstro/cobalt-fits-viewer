/**
 * 小地图组件 - 显示缩略图和当前可视区域
 */

import { View } from "react-native";
import { Canvas, Image as SkiaImage, Rect, Skia } from "@shopify/react-native-skia";
import { useMemo } from "react";
import { useSkImage } from "../../hooks/useSkImage";

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
}

export function Minimap({
  rgbaData,
  imgWidth,
  imgHeight,
  visible,
  size = 100,
  viewportScale = 1,
  viewportTranslateX = 0,
  viewportTranslateY = 0,
  canvasWidth = 0,
  canvasHeight = 0,
}: MinimapProps) {
  const skImage = useSkImage(rgbaData, imgWidth, imgHeight);

  const borderPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("rgba(255, 255, 255, 0.5)"));
    p.setStrokeWidth(1);
    p.setStyle(1); // Stroke
    return p;
  }, []);

  const viewportPaint = useMemo(() => {
    const p = Skia.Paint();
    p.setColor(Skia.Color("rgba(59, 130, 246, 0.6)"));
    p.setStrokeWidth(1.5);
    p.setStyle(1); // Stroke
    return p;
  }, []);

  if (!visible || !skImage) return null;

  const aspect = imgWidth / imgHeight;
  const miniW = aspect >= 1 ? size : size * aspect;
  const miniH = aspect >= 1 ? size / aspect : size;

  // Calculate viewport rect on minimap
  const scaleX = miniW / imgWidth;
  const scaleY = miniH / imgHeight;
  const showViewport = viewportScale > 1 && canvasWidth > 0 && canvasHeight > 0;

  let vpX = 0,
    vpY = 0,
    vpW = miniW,
    vpH = miniH;
  if (showViewport) {
    // Visible area in image coordinates
    vpW = Math.min(miniW, (canvasWidth / viewportScale) * scaleX);
    vpH = Math.min(miniH, (canvasHeight / viewportScale) * scaleY);
    vpX = Math.max(0, Math.min((-viewportTranslateX / viewportScale) * scaleX, miniW - vpW));
    vpY = Math.max(0, Math.min((-viewportTranslateY / viewportScale) * scaleY, miniH - vpH));
  }

  return (
    <View
      className="absolute bottom-20 right-3 rounded-md overflow-hidden"
      style={{
        width: miniW + 4,
        height: miniH + 4,
        backgroundColor: "rgba(0,0,0,0.6)",
        padding: 2,
      }}
    >
      <Canvas style={{ width: miniW, height: miniH }}>
        <SkiaImage image={skImage} x={0} y={0} width={miniW} height={miniH} />
        <Rect x={0} y={0} width={miniW} height={miniH} paint={borderPaint} />
        {showViewport && <Rect x={vpX} y={vpY} width={vpW} height={vpH} paint={viewportPaint} />}
      </Canvas>
    </View>
  );
}
