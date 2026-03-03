/**
 * 存储分析 — 纯函数模块
 */

import type { FitsMetadata, FileGroup } from "../fits/types";
import { getFreeDiskBytes } from "../utils/diskSpace";

export interface MediaTypeBreakdown {
  type: string;
  count: number;
  size: number;
}

export interface FrameTypeBreakdown {
  type: string;
  count: number;
  size: number;
}

export interface MonthlyBreakdown {
  month: string;
  count: number;
  size: number;
}

export interface GroupBreakdown {
  groupId: string;
  name: string;
  count: number;
  size: number;
}

export interface StorageAnalyticsResult {
  totalFiles: number;
  totalSize: number;
  byMediaType: MediaTypeBreakdown[];
  byFrameType: FrameTypeBreakdown[];
  byMonth: MonthlyBreakdown[];
  byGroup: GroupBreakdown[];
  ungroupedCount: number;
  ungroupedSize: number;
}

export function analyzeStorage(
  files: FitsMetadata[],
  fileGroupMap: Record<string, string[]>,
  groups: FileGroup[],
): StorageAnalyticsResult {
  const mediaMap = new Map<string, { count: number; size: number }>();
  const frameMap = new Map<string, { count: number; size: number }>();
  const monthMap = new Map<string, { count: number; size: number }>();
  const groupMap = new Map<string, { count: number; size: number }>();

  let totalSize = 0;
  let ungroupedCount = 0;
  let ungroupedSize = 0;

  for (const file of files) {
    totalSize += file.fileSize;

    // By media type
    const mediaType = file.sourceType ?? "unknown";
    const mediaEntry = mediaMap.get(mediaType) ?? { count: 0, size: 0 };
    mediaEntry.count++;
    mediaEntry.size += file.fileSize;
    mediaMap.set(mediaType, mediaEntry);

    // By frame type
    const frameType = file.frameType ?? "unknown";
    const frameEntry = frameMap.get(frameType) ?? { count: 0, size: 0 };
    frameEntry.count++;
    frameEntry.size += file.fileSize;
    frameMap.set(frameType, frameEntry);

    // By month
    const month = file.importDate ? new Date(file.importDate).toISOString().slice(0, 7) : "unknown";
    const monthEntry = monthMap.get(month) ?? { count: 0, size: 0 };
    monthEntry.count++;
    monthEntry.size += file.fileSize;
    monthMap.set(month, monthEntry);

    // By group
    const groupIds = fileGroupMap[file.id];
    if (!groupIds || groupIds.length === 0) {
      ungroupedCount++;
      ungroupedSize += file.fileSize;
    } else {
      for (const groupId of groupIds) {
        const gEntry = groupMap.get(groupId) ?? { count: 0, size: 0 };
        gEntry.count++;
        gEntry.size += file.fileSize;
        groupMap.set(groupId, gEntry);
      }
    }
  }

  const groupNameMap = new Map(groups.map((g) => [g.id, g.name]));

  return {
    totalFiles: files.length,
    totalSize,
    byMediaType: [...mediaMap.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.size - a.size),
    byFrameType: [...frameMap.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.size - a.size),
    byMonth: [...monthMap.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => b.month.localeCompare(a.month)),
    byGroup: [...groupMap.entries()]
      .map(([groupId, v]) => ({
        groupId,
        name: groupNameMap.get(groupId) ?? groupId,
        ...v,
      }))
      .sort((a, b) => b.size - a.size),
    ungroupedCount,
    ungroupedSize,
  };
}

export async function getDiskUsage(): Promise<{
  free: number | null;
}> {
  const free = await getFreeDiskBytes();
  return { free };
}
