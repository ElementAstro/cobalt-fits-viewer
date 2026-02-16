/**
 * 目标统计 Hook
 */

import { useMemo } from "react";
import { useTargetStore } from "../stores/useTargetStore";
import { useFitsStore } from "../stores/useFitsStore";
import {
  calculateTargetStatistics,
  getMonthlyStatistics,
  getProgressOverview,
  formatExposureHours,
  type TargetStatistics,
  type MonthlyStats,
} from "../lib/targets/targetStatistics";

export function useTargetStatistics() {
  const targets = useTargetStore((s) => s.targets);
  const files = useFitsStore((s) => s.files);

  // 计算完整统计
  const statistics = useMemo<TargetStatistics>(() => {
    return calculateTargetStatistics(targets, files);
  }, [targets, files]);

  // 月度统计
  const monthlyStats = useMemo<MonthlyStats[]>(() => {
    return getMonthlyStatistics(targets, files, 12);
  }, [targets, files]);

  // 进度概览
  const progressOverview = useMemo(() => {
    return getProgressOverview(targets);
  }, [targets]);

  // 快速统计
  const quickStats = useMemo(() => {
    return {
      total: targets.length,
      favorites: targets.filter((t) => t.isFavorite).length,
      pinned: targets.filter((t) => t.isPinned).length,
      withImages: targets.filter((t) => t.imageIds.length > 0).length,
      totalExposure: statistics.totalExposureSeconds,
      totalFrames: statistics.totalFrames,
    };
  }, [targets, statistics]);

  return {
    statistics,
    monthlyStats,
    progressOverview,
    quickStats,
    formatExposureHours,
  };
}
