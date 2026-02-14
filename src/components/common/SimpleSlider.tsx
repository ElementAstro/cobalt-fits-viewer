/**
 * 简单滑块组件 - 用于 BP/WP/Gamma 等数值调节
 */

import { useState } from "react";
import { View, Text, PanResponder } from "react-native";
import { useThemeColor } from "heroui-native";

interface SimpleSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onValueChange: (value: number) => void;
}

export function SimpleSlider({ label, value, min, max, step, onValueChange }: SimpleSliderProps) {
  const successColor = useThemeColor("success");
  const [trackWidth, setTrackWidth] = useState(200);

  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const x = evt.nativeEvent.locationX;
      const newFraction = Math.max(0, Math.min(1, x / trackWidth));
      const raw = min + newFraction * (max - min);
      const stepped = Math.round(raw / step) * step;
      onValueChange(Math.max(min, Math.min(max, stepped)));
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const newFraction = Math.max(0, Math.min(1, x / trackWidth));
      const raw = min + newFraction * (max - min);
      const stepped = Math.round(raw / step) * step;
      onValueChange(Math.max(min, Math.min(max, stepped)));
    },
  });

  const displayValue =
    step >= 1 ? value.toFixed(0) : step >= 0.1 ? value.toFixed(1) : value.toFixed(2);

  return (
    <View className="flex-row items-center gap-2 mb-1">
      <Text className="text-[9px] text-muted w-16">{label}</Text>
      <View
        className="flex-1 h-5 justify-center"
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
      >
        <View className="h-1.5 rounded-full bg-surface-secondary">
          <View
            className="h-1.5 rounded-full"
            style={{
              width: `${fraction * 100}%`,
              backgroundColor: successColor,
            }}
          />
        </View>
        <View
          className="absolute h-3.5 w-3.5 rounded-full border-2"
          style={{
            left: Math.max(0, fraction * trackWidth - 7),
            borderColor: successColor,
            backgroundColor: "#fff",
          }}
        />
      </View>
      <Text className="text-[9px] text-muted w-8 text-right">{displayValue}</Text>
    </View>
  );
}
