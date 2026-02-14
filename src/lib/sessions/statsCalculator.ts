/**
 * 观测统计数据计算
 */

import type { FitsMetadata, ObservationSession, ObservationStats } from "../fits/types";

/**
 * 计算总体观测统计
 */
export function calculateObservationStats(
  sessions: ObservationSession[],
  files: FitsMetadata[],
): ObservationStats {
  const totalObservationTime = sessions.reduce((sum, s) => sum + s.duration, 0);
  const totalImages = files.length;

  // 按目标统计
  const targetMap = new Map<string, { count: number; exposure: number }>();
  for (const file of files) {
    const obj = file.object ?? "Unknown";
    const existing = targetMap.get(obj) ?? { count: 0, exposure: 0 };
    existing.count += 1;
    existing.exposure += file.exptime ?? 0;
    targetMap.set(obj, existing);
  }
  const topTargets = [...targetMap.entries()]
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 10);

  // 按月统计
  const byMonth: Record<string, number> = {};
  for (const session of sessions) {
    const month = session.date.substring(0, 7); // YYYY-MM
    byMonth[month] = (byMonth[month] ?? 0) + 1;
  }

  // 按设备统计
  const byEquipment: Record<string, number> = {};
  for (const session of sessions) {
    if (session.equipment.telescope) {
      byEquipment[session.equipment.telescope] =
        (byEquipment[session.equipment.telescope] ?? 0) + 1;
    }
    if (session.equipment.camera) {
      byEquipment[session.equipment.camera] = (byEquipment[session.equipment.camera] ?? 0) + 1;
    }
  }

  // 按滤镜统计曝光
  const exposureByFilter: Record<string, number> = {};
  for (const file of files) {
    const filter = file.filter ?? "Unknown";
    exposureByFilter[filter] = (exposureByFilter[filter] ?? 0) + (file.exptime ?? 0);
  }

  return {
    totalObservationTime,
    totalSessions: sessions.length,
    totalImages,
    topTargets,
    byMonth,
    byEquipment,
    exposureByFilter,
  };
}

/**
 * 获取月度观测时间趋势
 */
export function getMonthlyTrend(
  sessions: ObservationSession[],
  monthCount: number = 12,
): Array<{ month: string; hours: number; sessions: number }> {
  const now = new Date();
  const result: Array<{ month: string; hours: number; sessions: number }> = [];

  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const monthSessions = sessions.filter((s) => s.date.startsWith(key));
    result.push({
      month: key,
      hours: Math.round((monthSessions.reduce((sum, s) => sum + s.duration, 0) / 3600) * 10) / 10,
      sessions: monthSessions.length,
    });
  }

  return result;
}
