import { memo, useCallback } from "react";
import { View, Text } from "react-native";
import { Button } from "heroui-native";
import { computeOneToOneScale } from "../../lib/viewer/transform";

interface ZoomControlsProps {
  scale: number;
  translateX: number;
  translateY: number;
  canvasWidth: number;
  canvasHeight: number;
  imageWidth?: number;
  imageHeight?: number;
  onSetTransform: (tx: number, ty: number, scale: number) => void;
}

const ZOOM_STEP = 1.5;

export const ZoomControls = memo(function ZoomControls({
  scale,
  translateX,
  translateY,
  canvasWidth,
  canvasHeight,
  imageWidth,
  imageHeight,
  onSetTransform,
}: ZoomControlsProps) {
  const handleFit = useCallback(() => {
    onSetTransform(0, 0, 1);
  }, [onSetTransform]);

  const handleOneToOne = useCallback(() => {
    if (imageWidth && imageHeight && canvasWidth > 0 && canvasHeight > 0) {
      onSetTransform(
        translateX,
        translateY,
        computeOneToOneScale(imageWidth, imageHeight, canvasWidth, canvasHeight),
      );
    }
  }, [imageWidth, imageHeight, canvasWidth, canvasHeight, translateX, translateY, onSetTransform]);

  const handleZoomIn = useCallback(() => {
    onSetTransform(translateX, translateY, scale * ZOOM_STEP);
  }, [scale, translateX, translateY, onSetTransform]);

  const handleZoomOut = useCallback(() => {
    onSetTransform(translateX, translateY, Math.max(0.1, scale / ZOOM_STEP));
  }, [scale, translateX, translateY, onSetTransform]);

  return (
    <View className="absolute bottom-3 right-3 items-end gap-1">
      <View className="bg-black/50 rounded-lg px-2 py-0.5">
        <Text className="text-[10px] text-white font-mono text-center">
          {Math.round(scale * 100)}%
        </Text>
      </View>
      <View className="flex-row gap-1">
        <Button
          size="sm"
          variant="ghost"
          onPress={handleZoomOut}
          className="h-7 w-7 bg-black/50 rounded-lg"
        >
          <Text className="text-[11px] text-white font-bold">−</Text>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={handleFit}
          className="h-7 w-7 bg-black/50 rounded-lg"
        >
          <Text className="text-[9px] text-white font-bold">Fit</Text>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={handleOneToOne}
          className="h-7 w-7 bg-black/50 rounded-lg"
        >
          <Text className="text-[9px] text-white font-bold">1:1</Text>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={handleZoomIn}
          className="h-7 w-7 bg-black/50 rounded-lg"
        >
          <Text className="text-[11px] text-white font-bold">+</Text>
        </Button>
      </View>
    </View>
  );
});
