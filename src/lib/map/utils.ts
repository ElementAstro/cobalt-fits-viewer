/**
 * 地图模块共享工具函数
 */

import type { FitsMetadata } from "../fits/types";
import type { MapClusterNode } from "./types";

/**
 * 去重排序字符串数组，过滤 undefined 和空白字符串
 */
export function uniqueSorted(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))].sort();
}

/**
 * 将字符串转换为合法的 testID 片段（小写字母数字，其余替换为短横线）
 */
export function toTestIdValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

/**
 * 生成站点聚合 key（精度 0.001°，约 111m）
 */
export function siteKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)}_${lng.toFixed(3)}`;
}

/**
 * 解析 cluster 节点：如果是聚合簇则展开叶子文件
 */
export function resolveNodeForOpen(
  node: MapClusterNode,
  getLeaves: (clusterId: number) => MapClusterNode["files"],
): MapClusterNode {
  if (!node.isCluster || node.clusterId === undefined) return node;
  const files = getLeaves(node.clusterId);
  return {
    ...node,
    files,
    count: files.length,
  };
}

// ===== 观测统计摘要 =====

export interface ObservationSummary {
  totalExposure: number;
  filterCounts: Record<string, number>;
  objects: string[];
  dateRange: { from: string; to: string } | null;
}

/**
 * 从文件列表计算观测摘要（曝光、滤镜分布、目标、日期范围）
 */
export function computeObservationSummary(files: FitsMetadata[]): ObservationSummary | null {
  if (files.length === 0) return null;

  let totalExposure = 0;
  const filterCounts: Record<string, number> = {};
  const objectSet = new Set<string>();
  let minDate = Infinity;
  let maxDate = -Infinity;

  for (const file of files) {
    if (file.exptime) totalExposure += file.exptime;
    if (file.filter) filterCounts[file.filter] = (filterCounts[file.filter] ?? 0) + 1;
    if (file.object) objectSet.add(file.object);
    const ts = file.dateObs ? new Date(file.dateObs).getTime() : file.importDate;
    if (Number.isFinite(ts)) {
      if (ts < minDate) minDate = ts;
      if (ts > maxDate) maxDate = ts;
    }
  }

  const dateRange =
    Number.isFinite(minDate) && Number.isFinite(maxDate)
      ? {
          from: new Date(minDate).toLocaleDateString(),
          to: new Date(maxDate).toLocaleDateString(),
        }
      : null;

  return {
    totalExposure,
    filterCounts,
    objects: [...objectSet].sort(),
    dateRange,
  };
}
