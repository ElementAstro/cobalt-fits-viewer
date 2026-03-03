/**
 * 目标相关常量 - 集中管理，避免各文件重复定义
 */

import type { TargetType, TargetStatus, TargetChangeLogEntry } from "../fits/types";

export const TARGET_TYPES: TargetType[] = [
  "galaxy",
  "nebula",
  "cluster",
  "planet",
  "moon",
  "sun",
  "comet",
  "other",
];

export const TARGET_STATUSES: TargetStatus[] = ["planned", "acquiring", "completed", "processed"];

export const STATUS_COLORS: Record<TargetStatus, string> = {
  planned: "#6b7280",
  acquiring: "#f59e0b",
  completed: "#22c55e",
  processed: "#3b82f6",
};

export type TargetTypeI18nKey =
  | "targets.types.galaxy"
  | "targets.types.nebula"
  | "targets.types.cluster"
  | "targets.types.planet"
  | "targets.types.moon"
  | "targets.types.sun"
  | "targets.types.comet"
  | "targets.types.other";

export function targetTypeI18nKey(type: TargetType): TargetTypeI18nKey {
  return `targets.types.${type}` as TargetTypeI18nKey;
}

export type TargetStatusI18nKey =
  | "targets.planned"
  | "targets.acquiring"
  | "targets.completed"
  | "targets.processed";

export function targetStatusI18nKey(status: TargetStatus): TargetStatusI18nKey {
  return `targets.${status}` as TargetStatusI18nKey;
}

export const ACTION_ICONS: Record<TargetChangeLogEntry["action"], string> = {
  created: "add-circle-outline",
  updated: "create-outline",
  status_changed: "swap-horizontal-outline",
  image_added: "images-outline",
  image_removed: "trash-outline",
  favorited: "heart",
  unfavorited: "heart-outline",
  pinned: "pin",
  unpinned: "pin-outline",
  tagged: "pricetag-outline",
  untagged: "pricetag-outline",
};

export const ACTION_COLORS: Record<TargetChangeLogEntry["action"], string> = {
  created: "#22c55e",
  updated: "#3b82f6",
  status_changed: "#f59e0b",
  image_added: "#22c55e",
  image_removed: "#ef4444",
  favorited: "#ef4444",
  unfavorited: "#6b7280",
  pinned: "#f59e0b",
  unpinned: "#6b7280",
  tagged: "#8b5cf6",
  untagged: "#6b7280",
};

export const FILTER_COLORS: Record<string, string> = {
  L: "#e5e7eb",
  R: "#ef4444",
  G: "#22c55e",
  B: "#3b82f6",
  Ha: "#dc2626",
  SII: "#f59e0b",
  OIII: "#06b6d4",
  Unknown: "#6b7280",
};

export const DEFAULT_CATEGORIES = [
  "Deep Sky",
  "Solar System",
  "Constellation",
  "Comet",
  "Asteroid",
  "Variable Star",
  "Double Star",
];

export const GROUP_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
  "#0ea5e9",
  "#84cc16",
  "#f43f5e",
  "#a855f7",
  "#78716c",
  "#06b6d4",
  "#d946ef",
];

export const GROUP_ICONS = ["🔭", "🌌", "⭐", "🌙", "☄️", "🪐", "🌟", "💫"];
