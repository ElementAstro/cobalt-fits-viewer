/**
 * 曝光整合统计报告
 * 按目标→滤镜维度汇总曝光数据
 */

import type { FitsMetadata } from "../fits/types";

export interface FilterSummary {
  name: string;
  frameCount: number;
  totalExposure: number;
  avgExposure: number;
  avgQuality: number | null;
}

export interface TargetReport {
  target: string;
  filters: FilterSummary[];
  totalFrames: number;
  totalExposure: number;
  avgQuality: number | null;
}

export interface IntegrationReport {
  targets: TargetReport[];
  totalFrames: number;
  totalExposure: number;
  uniqueFilters: string[];
  dateRange: [string, string] | null;
}

/**
 * 生成曝光整合统计报告
 * 仅统计 light 帧
 */
export function generateIntegrationReport(files: FitsMetadata[]): IntegrationReport {
  const lights = files.filter((f) => f.frameType === "light");

  const targetMap = new Map<string, FitsMetadata[]>();
  for (const f of lights) {
    const target = f.object || "Unknown";
    const group = targetMap.get(target);
    if (group) {
      group.push(f);
    } else {
      targetMap.set(target, [f]);
    }
  }

  const allFilters = new Set<string>();
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const f of lights) {
    if (f.filter) allFilters.add(f.filter);
    if (f.dateObs) {
      if (!minDate || f.dateObs < minDate) minDate = f.dateObs;
      if (!maxDate || f.dateObs > maxDate) maxDate = f.dateObs;
    }
  }

  const targets: TargetReport[] = [];

  for (const [target, targetFiles] of targetMap) {
    const filterMap = new Map<string, FitsMetadata[]>();
    for (const f of targetFiles) {
      const filter = f.filter || "No Filter";
      const group = filterMap.get(filter);
      if (group) {
        group.push(f);
      } else {
        filterMap.set(filter, [f]);
      }
    }

    const filters: FilterSummary[] = [];
    for (const [filterName, filterFiles] of filterMap) {
      const totalExp = filterFiles.reduce((sum, f) => sum + (f.exptime ?? 0), 0);
      const qualityScores = filterFiles
        .map((f) => f.qualityScore)
        .filter((s): s is number => s != null);

      filters.push({
        name: filterName,
        frameCount: filterFiles.length,
        totalExposure: totalExp,
        avgExposure: filterFiles.length > 0 ? totalExp / filterFiles.length : 0,
        avgQuality:
          qualityScores.length > 0
            ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
            : null,
      });
    }

    filters.sort((a, b) => a.name.localeCompare(b.name));

    const totalExp = filters.reduce((sum, f) => sum + f.totalExposure, 0);
    const totalFrames = filters.reduce((sum, f) => sum + f.frameCount, 0);
    const allQuality = filters.map((f) => f.avgQuality).filter((q): q is number => q != null);

    targets.push({
      target,
      filters,
      totalFrames,
      totalExposure: totalExp,
      avgQuality:
        allQuality.length > 0 ? allQuality.reduce((a, b) => a + b, 0) / allQuality.length : null,
    });
  }

  targets.sort((a, b) => b.totalExposure - a.totalExposure);

  return {
    targets,
    totalFrames: lights.length,
    totalExposure: lights.reduce((sum, f) => sum + (f.exptime ?? 0), 0),
    uniqueFilters: [...allFilters].sort(),
    dateRange: minDate && maxDate ? [minDate, maxDate] : null,
  };
}

/**
 * 格式化秒数为可读时间
 */
export function formatExposureTime(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(0)}s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
}

/**
 * 导出报告为 Markdown 文本
 */
export function exportReportAsMarkdown(report: IntegrationReport): string {
  const lines: string[] = [];
  lines.push("# Integration Report\n");

  if (report.dateRange) {
    lines.push(
      `**Date range:** ${report.dateRange[0].split("T")[0]} — ${report.dateRange[1].split("T")[0]}`,
    );
  }
  lines.push(`**Total lights:** ${report.totalFrames}`);
  lines.push(`**Total exposure:** ${formatExposureTime(report.totalExposure)}`);
  lines.push(`**Filters:** ${report.uniqueFilters.join(", ") || "None"}\n`);

  for (const target of report.targets) {
    lines.push(`## ${target.target}\n`);
    lines.push(`| Filter | Frames | Total | Avg Exp | Quality |`);
    lines.push(`|--------|--------|-------|---------|---------|`);

    for (const f of target.filters) {
      const q = f.avgQuality != null ? f.avgQuality.toFixed(0) : "—";
      lines.push(
        `| ${f.name} | ${f.frameCount} | ${formatExposureTime(f.totalExposure)} | ${f.avgExposure.toFixed(0)}s | ${q} |`,
      );
    }

    lines.push(
      `| **Total** | **${target.totalFrames}** | **${formatExposureTime(target.totalExposure)}** | | ${target.avgQuality != null ? target.avgQuality.toFixed(0) : "—"} |\n`,
    );
  }

  return lines.join("\n");
}
