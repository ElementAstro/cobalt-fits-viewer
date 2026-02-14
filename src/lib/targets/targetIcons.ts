/**
 * 天体类型到 Ionicons 图标名的映射
 */

import type { TargetType } from "../fits/types";

export const TARGET_TYPE_ICONS: Record<TargetType, string> = {
  galaxy: "planet-outline",
  nebula: "cloud-outline",
  cluster: "ellipse-outline",
  planet: "globe-outline",
  moon: "moon-outline",
  sun: "sunny-outline",
  comet: "flash-outline",
  other: "star-outline",
};

export const TARGET_TYPE_COLORS: Record<TargetType, string> = {
  galaxy: "#a78bfa",
  nebula: "#f472b6",
  cluster: "#60a5fa",
  planet: "#34d399",
  moon: "#fbbf24",
  sun: "#fb923c",
  comet: "#22d3ee",
  other: "#94a3b8",
};

export function getTargetIcon(type: TargetType) {
  return {
    name: TARGET_TYPE_ICONS[type],
    color: TARGET_TYPE_COLORS[type],
  };
}
