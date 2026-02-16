/**
 * 元数据索引 - 用于搜索和筛选
 */

import type { FitsMetadata } from "../fits/types";

export interface MetadataIndexResult {
  objects: string[];
  filters: string[];
  sourceFormats: string[];
  instruments: string[];
  telescopes: string[];
  tags: string[];
  locations: string[];
  dateRange: [string, string] | null;
  exptimeRange: [number, number] | null;
}

/**
 * 从文件列表构建元数据索引
 */
export function buildMetadataIndex(files: FitsMetadata[]): MetadataIndexResult {
  const objects = new Set<string>();
  const filters = new Set<string>();
  const sourceFormats = new Set<string>();
  const instruments = new Set<string>();
  const telescopes = new Set<string>();
  const tags = new Set<string>();
  const locations = new Set<string>();
  let minDate: string | null = null;
  let maxDate: string | null = null;
  let minExptime = Infinity;
  let maxExptime = -Infinity;

  for (const file of files) {
    if (file.object) objects.add(file.object);
    if (file.filter) filters.add(file.filter);
    if (file.sourceFormat) sourceFormats.add(file.sourceFormat);
    if (file.instrument) instruments.add(file.instrument);
    if (file.telescope) telescopes.add(file.telescope);
    for (const tag of file.tags) tags.add(tag);
    const locLabel = file.location?.city ?? file.location?.placeName;
    if (locLabel) locations.add(locLabel);

    if (file.dateObs) {
      if (!minDate || file.dateObs < minDate) minDate = file.dateObs;
      if (!maxDate || file.dateObs > maxDate) maxDate = file.dateObs;
    }
    if (file.exptime !== undefined) {
      if (file.exptime < minExptime) minExptime = file.exptime;
      if (file.exptime > maxExptime) maxExptime = file.exptime;
    }
  }

  return {
    objects: [...objects].sort(),
    filters: [...filters].sort(),
    sourceFormats: [...sourceFormats].sort(),
    instruments: [...instruments].sort(),
    telescopes: [...telescopes].sort(),
    tags: [...tags].sort(),
    locations: [...locations].sort(),
    dateRange: minDate && maxDate ? [minDate, maxDate] : null,
    exptimeRange: minExptime !== Infinity ? [minExptime, maxExptime] : null,
  };
}

/**
 * 全文搜索文件
 */
export function searchFiles(files: FitsMetadata[], query: string): FitsMetadata[] {
  if (!query.trim()) return files;
  const q = query.toLowerCase().trim();

  return files.filter((f) => {
    return (
      f.filename.toLowerCase().includes(q) ||
      f.object?.toLowerCase().includes(q) ||
      f.filter?.toLowerCase().includes(q) ||
      f.instrument?.toLowerCase().includes(q) ||
      f.telescope?.toLowerCase().includes(q) ||
      f.tags.some((t) => t.toLowerCase().includes(q)) ||
      f.location?.city?.toLowerCase().includes(q) ||
      f.location?.placeName?.toLowerCase().includes(q) ||
      f.notes?.toLowerCase().includes(q)
    );
  });
}

/**
 * 按拍摄地点分组
 */
export function groupByLocation(files: FitsMetadata[]): Record<string, FitsMetadata[]> {
  const groups: Record<string, FitsMetadata[]> = {};

  for (const file of files) {
    const loc =
      file.location?.city ?? file.location?.placeName ?? file.location?.region ?? "Unknown";
    if (!groups[loc]) groups[loc] = [];
    groups[loc].push(file);
  }

  return groups;
}

/**
 * 按时间线分组（按日期）
 */
export function groupByDate(files: FitsMetadata[]): Record<string, FitsMetadata[]> {
  const groups: Record<string, FitsMetadata[]> = {};

  for (const file of files) {
    const date = file.dateObs ? file.dateObs.split("T")[0] : "Unknown";
    if (!groups[date]) groups[date] = [];
    groups[date].push(file);
  }

  return groups;
}

/**
 * 按目标分组
 */
export function groupByObject(files: FitsMetadata[]): Record<string, FitsMetadata[]> {
  const groups: Record<string, FitsMetadata[]> = {};

  for (const file of files) {
    const obj = file.object ?? "Unknown";
    if (!groups[obj]) groups[obj] = [];
    groups[obj].push(file);
  }

  return groups;
}
