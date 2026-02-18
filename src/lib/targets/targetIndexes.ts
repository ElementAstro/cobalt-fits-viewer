import type { FitsMetadata, Target } from "../fits/types";
import { normalizeName } from "./targetMatcher";

export interface TargetStatsCacheEntry {
  targetId: string;
  frameCount: number;
  totalExposureSeconds: number;
  filterExposure: Record<string, { count: number; totalSeconds: number }>;
  files: FitsMetadata[];
}

export interface TargetIndexes {
  fileById: Map<string, FitsMetadata>;
  targetById: Map<string, Target>;
  nameNormalizedIndex: Map<string, string>;
  targetStatsCache: Map<string, TargetStatsCacheEntry>;
}

function normalizeLookupName(name: string | null | undefined): string {
  return normalizeName(name).toLowerCase();
}

function createEmptyStatsEntry(targetId: string): TargetStatsCacheEntry {
  return {
    targetId,
    frameCount: 0,
    totalExposureSeconds: 0,
    filterExposure: {},
    files: [],
  };
}

export function buildTargetIndexes(targets: Target[], files: FitsMetadata[]): TargetIndexes {
  const fileById = new Map(files.map((file) => [file.id, file]));
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const nameNormalizedIndex = new Map<string, string>();
  const targetStatsCache = new Map<string, TargetStatsCacheEntry>();
  const legacyTargetByFileId = new Map<string, string>();

  for (const target of targets) {
    targetStatsCache.set(target.id, createEmptyStatsEntry(target.id));
    const normalizedName = normalizeLookupName(target.name);
    if (normalizedName) {
      nameNormalizedIndex.set(normalizedName, target.id);
    }
    for (const alias of target.aliases ?? []) {
      const normalizedAlias = normalizeLookupName(alias);
      if (normalizedAlias && !nameNormalizedIndex.has(normalizedAlias)) {
        nameNormalizedIndex.set(normalizedAlias, target.id);
      }
    }
    for (const fileId of target.imageIds ?? []) {
      if (!legacyTargetByFileId.has(fileId)) {
        legacyTargetByFileId.set(fileId, target.id);
      }
    }
  }

  for (const file of files) {
    const linkedTargetId =
      (file.targetId && targetStatsCache.has(file.targetId) ? file.targetId : undefined) ??
      legacyTargetByFileId.get(file.id);
    if (!linkedTargetId) continue;
    const entry = targetStatsCache.get(linkedTargetId);
    if (!entry) continue;
    entry.files.push(file);
    entry.frameCount += 1;
    const exposure = file.exptime ?? 0;
    entry.totalExposureSeconds += exposure;
    const filter = file.filter ?? "Unknown";
    const filterEntry = entry.filterExposure[filter] ?? { count: 0, totalSeconds: 0 };
    filterEntry.count += 1;
    filterEntry.totalSeconds += exposure;
    entry.filterExposure[filter] = filterEntry;
  }

  return {
    fileById,
    targetById,
    nameNormalizedIndex,
    targetStatsCache,
  };
}

export function findTargetIdByName(
  name: string,
  indexes: Pick<TargetIndexes, "nameNormalizedIndex">,
) {
  return indexes.nameNormalizedIndex.get(normalizeLookupName(name));
}
