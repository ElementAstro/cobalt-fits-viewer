/**
 * 目标导出工具函数
 */

import { Share } from "react-native";
import type { Target } from "../fits/types";
import { formatCoordinates } from "./coordinates";
import { formatExposureTime } from "./exposureStats";

/**
 * 将目标格式化为可分享的文本
 */
export function formatTargetAsText(
  target: Target,
  stats?: {
    frameCount: number;
    totalExposure: number;
    filterBreakdown: Record<string, { count: number; totalSeconds: number }>;
  },
): string {
  const lines: string[] = [];

  lines.push(`🔭 ${target.name}`);

  if (target.aliases.length > 0) {
    lines.push(`   Aliases: ${target.aliases.join(", ")}`);
  }

  lines.push(`   Type: ${target.type}`);
  lines.push(`   Status: ${target.status}`);

  const coords = formatCoordinates(target.ra, target.dec);
  if (coords) {
    lines.push(`   Coordinates: ${coords}`);
  }

  if (stats) {
    lines.push("");
    lines.push(`📊 Statistics`);
    lines.push(`   Frames: ${stats.frameCount}`);
    lines.push(`   Total Exposure: ${formatExposureTime(stats.totalExposure)}`);

    const filters = Object.entries(stats.filterBreakdown);
    if (filters.length > 0) {
      lines.push(`   Filters:`);
      for (const [filter, data] of filters) {
        lines.push(
          `     ${filter}: ${data.count} frames, ${formatExposureTime(data.totalSeconds)}`,
        );
      }
    }
  }

  if (target.plannedFilters.length > 0) {
    lines.push("");
    lines.push(`📋 Observation Plan`);
    for (const filter of target.plannedFilters) {
      const planned = target.plannedExposure[filter];
      if (planned) {
        lines.push(`   ${filter}: ${formatExposureTime(planned)}`);
      } else {
        lines.push(`   ${filter}`);
      }
    }
  }

  if (target.notes) {
    lines.push("");
    lines.push(`📝 Notes: ${target.notes}`);
  }

  return lines.join("\n");
}

/**
 * 将目标导出为 JSON 字符串
 */
export function formatTargetAsJSON(target: Target): string {
  const exportData = {
    name: target.name,
    aliases: target.aliases,
    type: target.type,
    status: target.status,
    ra: target.ra,
    dec: target.dec,
    plannedFilters: target.plannedFilters,
    plannedExposure: target.plannedExposure,
    notes: target.notes,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * 使用系统分享功能分享目标
 */
export async function shareTarget(
  target: Target,
  stats?: {
    frameCount: number;
    totalExposure: number;
    filterBreakdown: Record<string, { count: number; totalSeconds: number }>;
  },
): Promise<boolean> {
  try {
    const text = formatTargetAsText(target, stats);
    const result = await Share.share({
      message: text,
      title: target.name,
    });
    return result.action === Share.sharedAction;
  } catch {
    return false;
  }
}
