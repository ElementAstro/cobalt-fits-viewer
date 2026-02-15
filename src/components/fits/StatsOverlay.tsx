import { memo } from "react";
import { View, Text } from "react-native";

interface StatsOverlayProps {
  width: number;
  height: number;
  isDataCube?: boolean;
  depth?: number;
  min: number;
  max: number;
  mean: number;
}

export const StatsOverlay = memo(function StatsOverlay({
  width,
  height,
  isDataCube,
  depth,
  min,
  max,
  mean,
}: StatsOverlayProps) {
  return (
    <View className="absolute top-2 left-2 bg-black/60 rounded-md px-2 py-1">
      <Text className="text-[9px] text-neutral-300">
        {width}×{height}
        {isDataCube && depth != null && ` ×${depth}f`}
      </Text>
      <Text className="text-[9px] text-neutral-400">
        Min:{min.toFixed(1)} Max:{max.toFixed(1)} μ:{mean.toFixed(1)}
      </Text>
    </View>
  );
});
