import { memo } from "react";
import { Text } from "react-native";
import { Card } from "heroui-native";

interface StatsOverlayProps {
  width: number;
  height: number;
  isDataCube?: boolean;
  depth?: number;
  min: number;
  max: number;
  mean: number;
  stddev?: number;
}

function formatStatValue(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-3)) return value.toExponential(2);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(3);
  return value.toFixed(5);
}

export const StatsOverlay = memo(function StatsOverlay({
  width,
  height,
  isDataCube,
  depth,
  min,
  max,
  mean,
  stddev,
}: StatsOverlayProps) {
  return (
    <Card variant="secondary" className="absolute top-2 left-2 bg-black/70">
      <Card.Body className="px-2 py-1">
        <Text className="text-[9px] text-neutral-300">
          {width}×{height}
          {isDataCube && depth != null && ` ×${depth}f`}
        </Text>
        <Text className="text-[9px] text-neutral-400">
          Min:{formatStatValue(min)} Max:{formatStatValue(max)} Mean:{formatStatValue(mean)}
        </Text>
        {typeof stddev === "number" && (
          <Text className="text-[9px] text-neutral-500">Std:{formatStatValue(stddev)}</Text>
        )}
      </Card.Body>
    </Card>
  );
});
