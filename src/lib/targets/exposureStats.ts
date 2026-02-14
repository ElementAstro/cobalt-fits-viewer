/**
 * 曝光统计计算
 */

import type { FitsMetadata, ExposureStats, Target } from "../fits/types";

/**
 * 计算一组文件的曝光统计
 */
export function calculateExposureStats(files: FitsMetadata[]): ExposureStats {
  const byFilter: Record<string, number> = {};
  const byFilterCount: Record<string, number> = {};
  let totalExposure = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const file of files) {
    const filter = file.filter ?? "Unknown";
    const exptime = file.exptime ?? 0;

    totalExposure += exptime;
    byFilter[filter] = (byFilter[filter] ?? 0) + exptime;
    byFilterCount[filter] = (byFilterCount[filter] ?? 0) + 1;

    if (file.dateObs) {
      if (!minDate || file.dateObs < minDate) minDate = file.dateObs;
      if (!maxDate || file.dateObs > maxDate) maxDate = file.dateObs;
    }
  }

  return {
    totalExposure,
    byFilter,
    frameCount: files.length,
    byFilterCount,
    dateRange: [minDate ?? "", maxDate ?? ""],
  };
}

/**
 * 计算目标的采集完成度
 */
export function calculateCompletionRate(
  target: Target,
  files: FitsMetadata[],
): {
  overall: number;
  byFilter: Record<string, { planned: number; acquired: number; percent: number }>;
} {
  const targetFiles = files.filter((f) => target.imageIds.includes(f.id));
  const stats = calculateExposureStats(targetFiles);
  const byFilter: Record<string, { planned: number; acquired: number; percent: number }> = {};

  let totalPlanned = 0;
  let totalAcquired = 0;

  for (const filter of target.plannedFilters) {
    const planned = target.plannedExposure[filter] ?? 0;
    const acquired = stats.byFilter[filter] ?? 0;
    totalPlanned += planned;
    totalAcquired += acquired;

    byFilter[filter] = {
      planned,
      acquired,
      percent: planned > 0 ? Math.min(100, Math.round((acquired / planned) * 100)) : 0,
    };
  }

  // 包含未计划但已采集的滤镜
  for (const filter of Object.keys(stats.byFilter)) {
    if (!byFilter[filter]) {
      byFilter[filter] = {
        planned: 0,
        acquired: stats.byFilter[filter],
        percent: 100,
      };
      totalAcquired += stats.byFilter[filter];
    }
  }

  return {
    overall:
      totalPlanned > 0
        ? Math.min(100, Math.round((totalAcquired / totalPlanned) * 100))
        : targetFiles.length > 0
          ? 100
          : 0,
    byFilter,
  };
}

/**
 * 格式化曝光时间为可读字符串
 */
export function formatExposureTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
