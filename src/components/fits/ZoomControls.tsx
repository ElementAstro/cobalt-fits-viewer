import { memo, useCallback } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { computeOneToOneScale } from "../../lib/viewer/transform";

interface ZoomControlsProps {
  scale: number;
  translateX: number;
  translateY: number;
  canvasWidth: number;
  canvasHeight: number;
  imageWidth?: number;
  imageHeight?: number;
  bottomOffset?: number;
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
  bottomOffset = 12,
  onSetTransform,
}: ZoomControlsProps) {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, fontScale } = useWindowDimensions();
  const isCompact = screenWidth < 360;
  const buttonHeight = fontScale > 1.15 ? 40 : isCompact ? 34 : 36;
  const iconButtonWidth = isCompact ? 34 : 36;
  const labelButtonWidth = fontScale > 1.15 ? 52 : isCompact ? 46 : 48;

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
    <View
      className="absolute items-end gap-1.5"
      style={{ bottom: bottomOffset, right: Math.max(insets.right + 12, 12) }}
    >
      <View className="bg-black/50 rounded-lg px-2 py-0.5">
        <Text className="text-[10px] text-white font-mono text-center" allowFontScaling={false}>
          {Math.round(scale * 100)}%
        </Text>
      </View>
      <View className="flex-row gap-1">
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={handleZoomOut}
          className="bg-black/50 rounded-lg"
          style={{ height: buttonHeight, width: iconButtonWidth }}
        >
          <Ionicons name="remove" size={14} color="#fff" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={handleFit}
          className="bg-black/50 rounded-lg px-0"
          style={{ height: buttonHeight, width: labelButtonWidth }}
        >
          <Text
            className="text-[10px] text-white font-bold text-center"
            numberOfLines={1}
            allowFontScaling={false}
          >
            Fit
          </Text>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onPress={handleOneToOne}
          className="bg-black/50 rounded-lg px-0"
          style={{ height: buttonHeight, width: labelButtonWidth }}
        >
          <Text
            className="text-[10px] text-white font-bold text-center"
            numberOfLines={1}
            allowFontScaling={false}
          >
            1:1
          </Text>
        </Button>
        <Button
          size="sm"
          variant="ghost"
          isIconOnly
          onPress={handleZoomIn}
          className="bg-black/50 rounded-lg"
          style={{ height: buttonHeight, width: iconButtonWidth }}
        >
          <Ionicons name="add" size={14} color="#fff" />
        </Button>
      </View>
    </View>
  );
});
