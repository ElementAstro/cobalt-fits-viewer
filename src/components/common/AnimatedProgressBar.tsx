import { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Extrapolation,
} from "react-native-reanimated";

interface AnimatedProgressBarProps {
  progress: number;
  color?: string;
  className?: string;
}

export function AnimatedProgressBar({ progress, color, className }: AnimatedProgressBarProps) {
  const animValue = useSharedValue(0);

  useEffect(() => {
    animValue.value = withTiming(progress, { duration: 400 });
  }, [progress, animValue]);

  const animStyle = useAnimatedStyle(() => {
    const widthPercent = interpolate(animValue.value, [0, 100], [0, 100], Extrapolation.CLAMP);
    return { width: `${widthPercent}%` };
  });

  return (
    <View className={className ?? "mt-2 h-1.5 rounded-full bg-surface-secondary overflow-hidden"}>
      <Animated.View
        className={`h-full rounded-full${color ? "" : " bg-accent"}`}
        style={[animStyle, color ? { backgroundColor: color } : undefined]}
      />
    </View>
  );
}
