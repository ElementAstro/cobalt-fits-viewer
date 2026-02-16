/**
 * 相簿统计功能
 */

import type { FitsMetadata, Album, AlbumStatistics, FrameType } from "../fits/types";

/**
 * 计算相簿的统计信息
 */
export function calculateAlbumStatistics(album: Album, files: FitsMetadata[]): AlbumStatistics {
  const albumFiles = files.filter((f) => album.imageIds.includes(f.id));

  const frameBreakdown = { light: 0, dark: 0, flat: 0, bias: 0, unknown: 0 };
  const filterBreakdown: Record<string, number> = {};
  let totalExposure = 0;
  let totalFileSize = 0;
  let minDate: string | null = null;
  let maxDate: string | null = null;

  for (const file of albumFiles) {
    // Frame type breakdown
    frameBreakdown[file.frameType]++;

    // Filter breakdown
    const filter = file.filter ?? "No Filter";
    filterBreakdown[filter] = (filterBreakdown[filter] ?? 0) + 1;

    // Total exposure
    totalExposure += file.exptime ?? 0;

    // Total file size
    totalFileSize += file.fileSize;

    // Date range
    if (file.dateObs) {
      if (!minDate || file.dateObs < minDate) minDate = file.dateObs;
      if (!maxDate || file.dateObs > maxDate) maxDate = file.dateObs;
    }
  }

  return {
    albumId: album.id,
    totalExposure,
    frameBreakdown,
    dateRange: minDate && maxDate ? [minDate, maxDate] : null,
    filterBreakdown,
    totalFileSize,
  };
}

/**
 * 格式化曝光时间用于显示
 */
export function formatExposureTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * 格式化文件大小用于显示
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 获取帧类型的显示名称
 */
export function getFrameTypeLabel(type: FrameType): string {
  const labels: Record<FrameType, string> = {
    light: "Light",
    dark: "Dark",
    flat: "Flat",
    bias: "Bias",
    unknown: "Unknown",
  };
  return labels[type];
}
