import type { FitsMetadata, ObservationLogEntry, ObservationSession, Target } from "../fits/types";
import { buildMissingLogEntries, deriveSessionMetadataFromFiles } from "./sessionLinking";

export interface SessionReconcileSummary {
  requested: number;
  processed: number;
  updated: number;
  cleared: number;
  unchanged: number;
  logsAdded: number;
  logsRemoved: number;
  changed: boolean;
  sessionIds: string[];
}

export interface ReconcileSessionsFromLinkedFilesInput {
  sessionIds?: string[];
  sessions: ObservationSession[];
  files: FitsMetadata[];
  logEntries: ObservationLogEntry[];
  targetCatalog?: Target[];
}

export interface ReconcileSessionsFromLinkedFilesOutput {
  sessions: ObservationSession[];
  logEntries: ObservationLogEntry[];
  summary: SessionReconcileSummary;
}

function dedupeSessionIds(
  sessionIds: string[] | undefined,
  sessions: ObservationSession[],
): string[] {
  if (!sessionIds || sessionIds.length === 0) {
    return sessions.map((session) => session.id);
  }
  return [...new Set(sessionIds.map((id) => id?.trim()).filter((id): id is string => Boolean(id)))];
}

function stableEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function reconcileSessionsFromLinkedFilesGraph({
  sessionIds,
  sessions,
  files,
  logEntries,
  targetCatalog = [],
}: ReconcileSessionsFromLinkedFilesInput): ReconcileSessionsFromLinkedFilesOutput {
  const normalizedIds = dedupeSessionIds(sessionIds, sessions);
  const idSet = new Set(normalizedIds);
  const filesBySessionId = new Map<string, FitsMetadata[]>();

  for (const sessionId of normalizedIds) {
    filesBySessionId.set(
      sessionId,
      files.filter((file) => file.sessionId === sessionId),
    );
  }

  let processed = 0;
  let updated = 0;
  let cleared = 0;
  let unchanged = 0;

  const nextSessions = sessions.map((session) => {
    if (!idSet.has(session.id)) return session;
    processed++;

    const linkedFiles = filesBySessionId.get(session.id) ?? [];
    if (linkedFiles.length === 0) {
      const clearedSession: ObservationSession = {
        ...session,
        imageIds: [],
        targetRefs: [],
        equipment: {},
        location: undefined,
      };

      if (stableEquals(session, clearedSession)) {
        unchanged++;
      } else {
        updated++;
        cleared++;
      }
      return clearedSession;
    }

    const derived = deriveSessionMetadataFromFiles(linkedFiles, targetCatalog);
    const nextFilters =
      derived.equipment.filters && derived.equipment.filters.length > 0
        ? derived.equipment.filters
        : session.equipment.filters;
    const nextEquipment = {
      ...session.equipment,
      ...derived.equipment,
      ...(nextFilters && nextFilters.length > 0 ? { filters: nextFilters } : {}),
    };

    const nextSession: ObservationSession = {
      ...session,
      imageIds: derived.imageIds,
      targetRefs: derived.targetRefs,
      equipment: nextEquipment,
      location: derived.location ?? session.location,
    };

    if (stableEquals(session, nextSession)) {
      unchanged++;
    } else {
      updated++;
    }
    return nextSession;
  });

  const validImageIdsBySession = new Map(
    nextSessions.map((session) => [session.id, new Set(session.imageIds)]),
  );
  const filteredLogEntries = logEntries.filter((entry) => {
    if (!idSet.has(entry.sessionId)) return true;
    const validImageIds = validImageIdsBySession.get(entry.sessionId);
    return validImageIds ? validImageIds.has(entry.imageId) : false;
  });

  let logsAdded = 0;
  const nextLogEntries = [...filteredLogEntries];
  for (const sessionId of normalizedIds) {
    const sessionFiles = filesBySessionId.get(sessionId) ?? [];
    if (sessionFiles.length === 0) continue;
    const missingLogs = buildMissingLogEntries(sessionFiles, sessionId, nextLogEntries);
    if (missingLogs.length > 0) {
      nextLogEntries.push(...missingLogs);
      logsAdded += missingLogs.length;
    }
  }

  const logsRemoved = logEntries.length - filteredLogEntries.length;
  const changed = updated > 0 || logsAdded > 0 || logsRemoved > 0;

  return {
    sessions: nextSessions,
    logEntries: nextLogEntries,
    summary: {
      requested: normalizedIds.length,
      processed,
      updated,
      cleared,
      unchanged,
      logsAdded,
      logsRemoved,
      changed,
      sessionIds: normalizedIds,
    },
  };
}
