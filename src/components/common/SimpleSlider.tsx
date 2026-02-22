/**
 * 简单滑块组件 - 用于 BP/WP/Gamma 等数值调节
 */

import { useState, useRef, useCallback } from "react";
import { View, Text, PanResponder } from "react-native";
import { useThemeColor } from "heroui-native";

interface SimpleSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue?: number;
  onValueChange: (value: number) => void;
}

const THUMB_SIZE = 20;
const THUMB_HALF = THUMB_SIZE / 2;
const DOUBLE_TAP_MS = 300;

export function SimpleSlider({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  onValueChange,
}: SimpleSliderProps) {
  const [successColor, surfaceColor] = useThemeColor(["success", "surface-secondary"]);
  const [trackWidth, setTrackWidth] = useState(200);
  const lastTapRef = useRef(0);

  const fraction = Math.max(0, Math.min(1, (value - min) / (max - min)));

  const computeValue = useCallback(
    (locationX: number) => {
      const newFraction = Math.max(0, Math.min(1, locationX / trackWidth));
      const raw = min + newFraction * (max - min);
      const stepped = Math.round(raw / step) * step;
      return Math.max(min, Math.min(max, stepped));
    },
    [trackWidth, min, max, step],
  );

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const now = Date.now();
      if (defaultValue != null && now - lastTapRef.current < DOUBLE_TAP_MS) {
        onValueChange(defaultValue);
        lastTapRef.current = 0;
        return;
      }
      lastTapRef.current = now;
      onValueChange(computeValue(evt.nativeEvent.locationX));
    },
    onPanResponderMove: (evt) => {
      onValueChange(computeValue(evt.nativeEvent.locationX));
    },
  });

  const displayValue =
    step >= 1 ? value.toFixed(0) : step >= 0.1 ? value.toFixed(1) : value.toFixed(2);

  return (
    <View className="flex-row items-center gap-2 mb-1">
      <Text className="text-[9px] text-muted w-16">{label}</Text>
      <View
        className="flex-1 h-8 justify-center"
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        {...panResponder.panHandlers}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={label}
        accessibilityValue={{
          min,
          max,
          now: value,
          text: `${displayValue}`,
        }}
      >
        <View className="h-1.5 rounded-full" style={{ backgroundColor: surfaceColor }}>
          <View
            className="h-1.5 rounded-full"
            style={{
              width: `${fraction * 100}%`,
              backgroundColor: successColor,
            }}
          />
        </View>
        <View
          className="absolute rounded-full border-2 bg-background"
          style={{
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            left: Math.max(0, fraction * trackWidth - THUMB_HALF),
            borderColor: successColor,
          }}
        />
      </View>
      <Text className="text-[9px] text-muted w-8 text-right">{displayValue}</Text>
    </View>
  );
}
