/**
 * Astrometry 标注共享常量
 */

import type { AstrometryAnnotationType } from "./types";

/** 各标注类型的显示颜色 */
export const ANNOTATION_TYPE_COLORS: Record<AstrometryAnnotationType, string> = {
  messier: "#ff4444",
  ngc: "#ffaa00",
  ic: "#44aaff",
  hd: "#aaaaaa",
  bright_star: "#44ff88",
  star: "#cccccc",
  other: "#888888",
};

/** 各标注类型的显示名称 (用于 UI label) */
export const ANNOTATION_TYPE_LABELS: Record<AstrometryAnnotationType, string> = {
  messier: "Messier",
  ngc: "NGC",
  ic: "IC",
  hd: "HD",
  bright_star: "Bright Stars",
  star: "Stars",
  other: "Other",
};

/** 所有标注类型的有序列表 (UI 展示顺序) */
export const ANNOTATION_TYPES_ORDERED: AstrometryAnnotationType[] = [
  "messier",
  "ngc",
  "ic",
  "bright_star",
  "hd",
  "star",
  "other",
];

/** 各标注类型对应的 HeroUI Chip 颜色变体 */
export const ANNOTATION_CHIP_COLORS: Record<
  AstrometryAnnotationType,
  "default" | "accent" | "success" | "danger"
> = {
  messier: "danger",
  ngc: "accent",
  ic: "accent",
  hd: "default",
  bright_star: "success",
  star: "default",
  other: "default",
};

/** 叠加层默认颜色 */
export const OVERLAY_COLORS = {
  coordinateGrid: "#6688cc",
  constellationLines: "#44ff88",
} as const;
