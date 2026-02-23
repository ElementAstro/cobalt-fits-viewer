import { useEffect, useState } from "react";
import { Animated, View } from "react-native";

interface AnimatedProgressBarProps {
  progress: number;
  color?: string;
  className?: string;
}

export function AnimatedProgressBar({ progress, color, className }: AnimatedProgressBarProps) {
  const [animValue] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.timing(animValue, {
      toValue: progress,
      duration: 400,
      useNativeDriver: false,
    }).start();
  }, [progress, animValue]);

  const width = animValue.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
    extrapolate: "clamp",
  });

  return (
    <View className={className ?? "mt-2 h-1.5 rounded-full bg-surface-secondary overflow-hidden"}>
      <Animated.View
        className={`h-full rounded-full${color ? "" : " bg-accent"}`}
        style={{ width, ...(color ? { backgroundColor: color } : {}) }}
      />
    </View>
  );
}
