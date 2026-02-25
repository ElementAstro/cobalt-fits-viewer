import { memo } from "react";
import { Text } from "react-native";
import { Card } from "heroui-native";

interface StatsOverlayProps {
  width: number;
  height: number;
  isDataCube?: boolean;
  depth?: number;
  bitpix?: number;
  currentHDU?: number;
  currentFrame?: number;
  totalFrames?: number;
  min: number;
  max: number;
  mean: number;
  median?: number;
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
  bitpix,
  currentHDU,
  currentFrame,
  totalFrames,
  min,
  max,
  mean,
  median,
  stddev,
}: StatsOverlayProps) {
  const headerParts = [
    `${width}×${height}`,
    isDataCube && depth != null ? `×${depth}f` : null,
    typeof bitpix === "number" ? `BITPIX:${bitpix}` : null,
    typeof currentHDU === "number" ? `HDU:${currentHDU + 1}` : null,
    typeof totalFrames === "number" && totalFrames > 1 && typeof currentFrame === "number"
      ? `F:${currentFrame + 1}/${totalFrames}`
      : null,
  ].filter((p): p is string => Boolean(p));

  return (
    <Card variant="secondary" className="absolute top-2 left-2 bg-black/70">
      <Card.Body className="px-2 py-1">
        <Text className="text-[9px] text-neutral-300">{headerParts.join(" ")}</Text>
        <Text className="text-[9px] text-neutral-400">
          Min:{formatStatValue(min)}
          {typeof median === "number" && ` Med:${formatStatValue(median)}`} Max:
          {formatStatValue(max)}
        </Text>
        <Text className="text-[9px] text-neutral-500">
          Mean:{formatStatValue(mean)}
          {typeof stddev === "number" && ` Std:${formatStatValue(stddev)}`}
        </Text>
      </Card.Body>
    </Card>
  );
});
