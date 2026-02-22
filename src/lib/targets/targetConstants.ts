/**
 * 目标相关常量 - 集中管理，避免各文件重复定义
 */

import type { TargetType, TargetStatus } from "../fits/types";

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
