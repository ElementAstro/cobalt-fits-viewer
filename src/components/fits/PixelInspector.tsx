import { Text, View } from "react-native";
import { Card } from "heroui-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle } from "react-native-reanimated";
import { useI18n } from "../../i18n/useI18n";

interface PixelInspectorProps {
  x: number;
  y: number;
  value: number | null;
  ra?: string;
  dec?: string;
  visible?: boolean;
  decimalPlaces?: number;
}

export function PixelInspector({
  x,
  y,
  value,
  ra,
  dec,
  visible = true,
  decimalPlaces = 2,
}: PixelInspectorProps) {
  const { t } = useI18n();

  const offsetX = useSharedValue(0);
  const offsetY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const dragGesture = Gesture.Pan()
    .onStart(() => {
      savedX.value = offsetX.value;
      savedY.value = offsetY.value;
    })
    .onUpdate((e) => {
      offsetX.value = savedX.value + e.translationX;
      offsetY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = offsetX.value;
      savedY.value = offsetY.value;
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: offsetX.value }, { translateY: offsetY.value }],
  }));

  if (!visible || value === null) return null;

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View className="absolute bottom-16 left-3" style={animatedStyle}>
        <Card variant="secondary" className="opacity-90">
          <Card.Body className="px-3 py-2">
            <View className="flex-row items-center gap-1">
              <Text className="text-[10px] font-semibold text-foreground">
                {t("viewer.pixelInfo")}
              </Text>
              <Text className="text-[7px] text-muted">⠿</Text>
            </View>
            <Text className="text-[9px] text-muted">
              X: {x} Y: {y}
            </Text>
            <Text className="text-[9px] text-muted">
              {t("viewer.value")}: {value.toFixed(decimalPlaces)}
            </Text>
            {ra && dec && (
              <Text className="text-[9px] text-muted">
                RA: {ra} Dec: {dec}
              </Text>
            )}
          </Card.Body>
        </Card>
      </Animated.View>
    </GestureDetector>
  );
}
