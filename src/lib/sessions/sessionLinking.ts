import type {
  FitsMetadata,
  GeoLocation,
  ObservationLogEntry,
  SessionEquipment,
  Target,
  TargetRef,
} from "../fits/types";
import {
  dedupeTargetRefs,
  normalizeSessionTargetRefs,
  resolveTargetName,
  toTargetRef,
} from "../targets/targetRefs";
import { createLogEntry } from "./observationLog";

type ActiveSessionLike =
  | {
      id: string;
      status: "running" | "paused";
    }
  | null
  | undefined;

type SessionTargetLike = {
  targetRefs?: TargetRef[] | null;
  targets?: string[] | null;
};

export interface DerivedSessionMetadata {
  targetRefs: TargetRef[];
  imageIds: string[];
  equipment: SessionEquipment;
  location?: GeoLocation;
}

function dedupeStringArray(values: Array<string | null | undefined>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

function pickMostCommonString(values: Array<string | null | undefined>): string | undefined {
  const counts = new Map<string, number>();
  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    counts.set(trimmed, (counts.get(trimmed) ?? 0) + 1);
  }

  let bestValue: string | undefined;
  let bestCount = 0;
  for (const [value, count] of counts.entries()) {
    if (count > bestCount) {
      bestCount = count;
      bestValue = value;
    }
  }
  return bestValue;
}

function resolveLocationKey(location: GeoLocation): string {
  return (
    location.city ??
    location.placeName ??
    location.region ??
    `${location.latitude.toFixed(6)},${location.longitude.toFixed(6)}`
  );
}

export function resolveImportSessionId(activeSession: ActiveSessionLike): string | undefined {
  if (!activeSession || activeSession.status !== "running") return undefined;
  return activeSession.id;
}

export function resolveSessionTargetNames(session: SessionTargetLike, targets: Target[]): string[] {
  const refs = normalizeSessionTargetRefs(
    {
      targetRefs: session.targetRefs ?? undefined,
      targets: session.targets ?? undefined,
    },
    targets,
  );
  return refs.map((ref) => resolveTargetName(ref, targets));
}

export function deriveSessionMetadataFromFiles(
  files: FitsMetadata[],
  targetCatalog: Target[] = [],
): DerivedSessionMetadata {
  const imageIds = dedupeStringArray(files.map((file) => file.id));
  const targetRefs = dedupeTargetRefs(
    dedupeStringArray(files.map((file) => file.object)).map((name) =>
      toTargetRef(name, targetCatalog),
    ),
    targetCatalog,
  );

  const telescope = pickMostCommonString(files.map((file) => file.telescope));
  const camera = pickMostCommonString(files.map((file) => file.instrument ?? file.detector));
  const filters = dedupeStringArray(files.map((file) => file.filter));

  const locationCounts = new Map<string, { count: number; location: GeoLocation }>();
  for (const file of files) {
    if (!file.location) continue;
    const key = resolveLocationKey(file.location);
    const current = locationCounts.get(key);
    if (current) {
      current.count += 1;
    } else {
      locationCounts.set(key, { count: 1, location: file.location });
    }
  }

  let location: GeoLocation | undefined;
  if (locationCounts.size > 0) {
    location = [...locationCounts.values()].sort((a, b) => b.count - a.count)[0].location;
  }

  return {
    targetRefs,
    imageIds,
    equipment: {
      ...(telescope ? { telescope } : {}),
      ...(camera ? { camera } : {}),
      ...(filters.length > 0 ? { filters } : {}),
    },
    location,
  };
}

export function buildMissingLogEntries(
  files: FitsMetadata[],
  sessionId: string,
  existingLogEntries: ObservationLogEntry[],
): ObservationLogEntry[] {
  const existingImageIds = new Set(
    existingLogEntries
      .filter((entry) => entry.sessionId === sessionId)
      .map((entry) => entry.imageId),
  );
  const existingLogIds = new Set(existingLogEntries.map((entry) => entry.id));

  const missing = dedupeStringArray(files.map((file) => file.id))
    .map((fileId) => files.find((file) => file.id === fileId))
    .filter((file): file is FitsMetadata => Boolean(file))
    .filter((file) => !existingImageIds.has(file.id) && !existingLogIds.has(`log_${file.id}`))
    .map((file) => createLogEntry(file, sessionId));

  return missing.sort((a, b) => {
    const ta = Number.isFinite(Date.parse(a.dateTime)) ? Date.parse(a.dateTime) : 0;
    const tb = Number.isFinite(Date.parse(b.dateTime)) ? Date.parse(b.dateTime) : 0;
    return ta - tb;
  });
}
