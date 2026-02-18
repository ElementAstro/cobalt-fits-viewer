/**
 * 目标统计计算
 */

import type { Target, FitsMetadata } from "../fits/types";
import { buildTargetIndexes, type TargetIndexes } from "./targetIndexes";

export interface TargetStatistics {
  totalTargets: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  totalExposureSeconds: number;
  totalFrames: number;
  favoritesCount: number;
  pinnedCount: number;
  withCoordinates: number;
  withImages: number;
  categoryBreakdown: Record<string, number>;
  tagBreakdown: Record<string, number>;
  exposureLeaderboard: Array<{
    target: Target;
    totalSeconds: number;
    frameCount: number;
  }>;
  monthlyActivity: Record<string, number>; // YYYY-MM -> target count first observed
  averageExposurePerTarget: number;
  averageFramesPerTarget: number;
}

export interface MonthlyStats {
  month: string; // YYYY-MM
  targetsCount: number;
  framesCount: number;
  exposureSeconds: number;
}

/**
 * 计算所有目标的统计数据
 */
export function calculateTargetStatistics(
  targets: Target[],
  files: FitsMetadata[],
  indexes: TargetIndexes = buildTargetIndexes(targets, files),
): TargetStatistics {
  const byStatus: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const categoryBreakdown: Record<string, number> = {};
  const tagBreakdown: Record<string, number> = {};
  const monthlyActivity: Record<string, number> = {};

  let totalExposureSeconds = 0;
  let totalFrames = 0;
  let favoritesCount = 0;
  let pinnedCount = 0;
  let withCoordinates = 0;
  let withImages = 0;

  // 曝光排行榜
  const exposureList: Array<{ target: Target; totalSeconds: number; frameCount: number }> = [];

  for (const target of targets) {
    // 状态统计
    const status = target.status ?? "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    // 类型统计
    const type = target.type ?? "unknown";
    byType[type] = (byType[type] ?? 0) + 1;

    // 分类统计
    if (target.category) {
      categoryBreakdown[target.category] = (categoryBreakdown[target.category] ?? 0) + 1;
    }

    // 标签统计
    for (const tag of target.tags ?? []) {
      tagBreakdown[tag] = (tagBreakdown[tag] ?? 0) + 1;
    }

    // 收藏/置顶
    if (target.isFavorite) favoritesCount++;
    if (target.isPinned) pinnedCount++;

    // 坐标
    if (target.ra !== undefined && target.dec !== undefined) {
      withCoordinates++;
    }

    // 图片
    const imageCount = target.imageIds?.length ?? 0;
    if (imageCount > 0) {
      withImages++;
      totalFrames += imageCount;
    }

    // 曝光计算
    const cachedStats = indexes.targetStatsCache.get(target.id);
    const totalExposure = cachedStats?.totalExposureSeconds ?? 0;
    totalExposureSeconds += totalExposure;

    exposureList.push({
      target,
      totalSeconds: totalExposure,
      frameCount: cachedStats?.frameCount ?? imageCount,
    });

    // 月度活动（首次创建目标）
    const month = new Date(target.createdAt).toISOString().slice(0, 7);
    monthlyActivity[month] = (monthlyActivity[month] ?? 0) + 1;
  }

  // 排序曝光排行榜
  exposureList.sort((a, b) => b.totalSeconds - a.totalSeconds);

  return {
    totalTargets: targets.length,
    byStatus,
    byType,
    totalExposureSeconds,
    totalFrames,
    favoritesCount,
    pinnedCount,
    withCoordinates,
    withImages,
    categoryBreakdown,
    tagBreakdown,
    exposureLeaderboard: exposureList.slice(0, 10),
    monthlyActivity,
    averageExposurePerTarget: targets.length > 0 ? totalExposureSeconds / targets.length : 0,
    averageFramesPerTarget: targets.length > 0 ? totalFrames / targets.length : 0,
  };
}

/**
 * 获取月度统计数据
 */
export function getMonthlyStatistics(
  targets: Target[],
  files: FitsMetadata[],
  months: number = 12,
  indexes: TargetIndexes = buildTargetIndexes(targets, files),
): MonthlyStats[] {
  const result: MonthlyStats[] = [];
  const now = new Date();
  const monthToStats = new Map<
    string,
    { targetsCount: number; framesCount: number; exposure: number }
  >();

  for (const target of targets) {
    const month = new Date(target.createdAt).toISOString().slice(0, 7);
    const entry = monthToStats.get(month) ?? { targetsCount: 0, framesCount: 0, exposure: 0 };
    const cachedStats = indexes.targetStatsCache.get(target.id);
    entry.targetsCount += 1;
    entry.framesCount += cachedStats?.frameCount ?? target.imageIds.length;
    entry.exposure += cachedStats?.totalExposureSeconds ?? 0;
    monthToStats.set(month, entry);
  }

  for (let i = 0; i < months; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = date.toISOString().slice(0, 7);
    const stats = monthToStats.get(month);

    result.push({
      month,
      targetsCount: stats?.targetsCount ?? 0,
      framesCount: stats?.framesCount ?? 0,
      exposureSeconds: stats?.exposure ?? 0,
    });
  }

  return result.reverse();
}

/**
 * 格式化曝光时间为小时
 */
export function formatExposureHours(seconds: number): string {
  const hours = seconds / 3600;
  if (hours < 1) {
    return `${Math.round(seconds / 60)}m`;
  }
  if (hours < 10) {
    return `${hours.toFixed(1)}h`;
  }
  return `${Math.round(hours)}h`;
}

/**
 * 获取进度概览
 */
export function getProgressOverview(targets: Target[]): {
  planned: number;
  acquiring: number;
  completed: number;
  processed: number;
} {
  return {
    planned: targets.filter((t) => t.status === "planned").length,
    acquiring: targets.filter((t) => t.status === "acquiring").length,
    completed: targets.filter((t) => t.status === "completed").length,
    processed: targets.filter((t) => t.status === "processed").length,
  };
}
