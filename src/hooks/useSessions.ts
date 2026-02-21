/**
 * 会话管理 Hook
 */

import { useCallback, useMemo } from "react";
import { useSessionStore } from "../stores/useSessionStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useTargetStore } from "../stores/useTargetStore";
import {
  detectSessions,
  findMatchingSession,
  getDatesWithObservations,
} from "../lib/sessions/sessionDetector";
import { generateLogFromFiles } from "../lib/sessions/observationLog";
import {
  exportToCSV,
  exportToText,
  exportSessionToJSON,
  exportAllSessionsToJSON,
} from "../lib/sessions/observationLog";
import { calculateObservationStats, getMonthlyTrend } from "../lib/sessions/statsCalculator";
import { LOG_TAGS, Logger } from "../lib/logger";
import {
  buildMissingLogEntries,
  deriveSessionMetadataFromFiles,
} from "../lib/sessions/sessionLinking";
import { mergeSessionLike } from "../lib/sessions/sessionNormalization";
import {
  reconcileSessionsFromLinkedFilesGraph,
  type SessionReconcileSummary,
} from "../lib/sessions/sessionReconciliation";
import type { ObservationSession } from "../lib/fits/types";

interface EndLiveSessionWithIntegrationResult {
  session: ObservationSession | null;
  linkedFileCount: number;
  linkedLogCount: number;
}

interface AutoDetectSessionsResult {
  newCount: number;
  totalDetected: number;
  updatedCount: number;
  mergedCount: number;
  skippedCount: number;
}

function stableEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useSessions() {
  const sessions = useSessionStore((s) => s.sessions);
  const logEntries = useSessionStore((s) => s.logEntries);
  const addSession = useSessionStore((s) => s.addSession);
  const addLogEntries = useSessionStore((s) => s.addLogEntries);
  const updateSession = useSessionStore((s) => s.updateSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const mergeSessions = useSessionStore((s) => s.mergeSessions);
  const getDatesWithSessions = useSessionStore((s) => s.getDatesWithSessions);
  const endLiveSession = useSessionStore((s) => s.endLiveSession);

  const files = useFitsStore((s) => s.files);
  const batchSetSessionId = useFitsStore((s) => s.batchSetSessionId);
  const sessionGapMinutes = useSettingsStore((s) => s.sessionGapMinutes);
  const targetCatalog = useTargetStore((s) => s.targets);

  const autoDetectSessions = useCallback((): AutoDetectSessionsResult => {
    const detected = detectSessions(files, sessionGapMinutes);
    Logger.info(
      LOG_TAGS.Sessions,
      `Auto-detect: ${detected.length} sessions found from ${files.length} files`,
    );

    let newCount = 0;
    let updatedCount = 0;
    let mergedCount = 0;
    let skippedCount = 0;

    for (const detectedSession of detected) {
      const sessionFiles = files.filter((f) => detectedSession.imageIds.includes(f.id));
      if (sessionFiles.length === 0) {
        skippedCount++;
        continue;
      }

      const derived = deriveSessionMetadataFromFiles(sessionFiles, targetCatalog);
      const integratedSession = mergeSessionLike(detectedSession, {
        targetRefs: derived.targetRefs,
        imageIds: derived.imageIds,
        equipment: {
          ...(detectedSession.equipment ?? {}),
          ...(derived.equipment ?? {}),
        },
        location: derived.location ?? detectedSession.location,
      }) as ObservationSession;

      const existingSessions = useSessionStore.getState().sessions;
      const matchedSession = findMatchingSession(integratedSession, existingSessions);
      if (!matchedSession) {
        addSession(integratedSession);
        batchSetSessionId(integratedSession.imageIds, integratedSession.id);
        const entries = generateLogFromFiles(sessionFiles, integratedSession.id);
        if (entries.length > 0) {
          addLogEntries(entries);
        }
        newCount++;
        continue;
      }

      const mergedStart = Math.min(matchedSession.startTime, integratedSession.startTime);
      const mergedEnd = Math.max(matchedSession.endTime, integratedSession.endTime);
      const mergedDuration = Math.max(0, Math.round((mergedEnd - mergedStart) / 1000));
      const mergedSession = mergeSessionLike(matchedSession, {
        targetRefs: integratedSession.targetRefs,
        imageIds: integratedSession.imageIds,
        equipment: integratedSession.equipment,
        location: integratedSession.location,
        startTime: mergedStart,
        endTime: mergedEnd,
        duration: mergedDuration,
      }) as ObservationSession;

      const nextSessionData = {
        targetRefs: mergedSession.targetRefs,
        imageIds: mergedSession.imageIds,
        equipment: mergedSession.equipment ?? matchedSession.equipment ?? {},
        location: mergedSession.location ?? matchedSession.location,
        startTime: mergedStart,
        endTime: mergedEnd,
        duration: mergedDuration,
        date: matchedSession.date,
      };

      const hasSessionChanges = !stableEquals(
        {
          targetRefs: matchedSession.targetRefs,
          imageIds: matchedSession.imageIds,
          equipment: matchedSession.equipment,
          location: matchedSession.location,
          startTime: matchedSession.startTime,
          endTime: matchedSession.endTime,
          duration: matchedSession.duration,
          date: matchedSession.date,
        },
        nextSessionData,
      );

      const existingLogEntries = useSessionStore.getState().logEntries;
      const missingLogs = buildMissingLogEntries(
        sessionFiles,
        matchedSession.id,
        existingLogEntries,
      );
      if (!hasSessionChanges && missingLogs.length === 0) {
        skippedCount++;
        continue;
      }

      updateSession(matchedSession.id, nextSessionData);
      batchSetSessionId(nextSessionData.imageIds, matchedSession.id);
      if (missingLogs.length > 0) {
        addLogEntries(missingLogs);
      }

      updatedCount++;
      if (
        nextSessionData.imageIds.length > matchedSession.imageIds.length ||
        missingLogs.length > 0
      ) {
        mergedCount++;
      }
    }

    return {
      newCount,
      totalDetected: detected.length,
      updatedCount,
      mergedCount,
      skippedCount,
    };
  }, [
    files,
    sessionGapMinutes,
    addSession,
    addLogEntries,
    batchSetSessionId,
    targetCatalog,
    updateSession,
  ]);

  const reconcileSessionsFromLinkedFiles = useCallback(
    (sessionIds?: string[]): SessionReconcileSummary => {
      const state = useSessionStore.getState();
      const {
        sessions: nextSessions,
        logEntries: nextLogEntries,
        summary,
      } = reconcileSessionsFromLinkedFilesGraph({
        sessionIds,
        sessions: state.sessions,
        files: useFitsStore.getState().files,
        logEntries: state.logEntries,
        targetCatalog: useTargetStore.getState().targets,
      });

      if (summary.changed) {
        useSessionStore.setState({
          sessions: nextSessions,
          logEntries: nextLogEntries,
        });
      }

      return summary;
    },
    [],
  );

  const endLiveSessionWithIntegration = useCallback((): EndLiveSessionWithIntegrationResult => {
    const endedSession = endLiveSession();
    if (!endedSession) {
      return {
        session: null,
        linkedFileCount: 0,
        linkedLogCount: 0,
      };
    }

    const linkedFiles = files.filter((file) => file.sessionId === endedSession.id);
    const derived = deriveSessionMetadataFromFiles(linkedFiles, targetCatalog);
    const integrated = mergeSessionLike(endedSession, {
      targetRefs: derived.targetRefs,
      imageIds: derived.imageIds,
      equipment: derived.equipment,
      location: derived.location,
    }) as ObservationSession;

    updateSession(endedSession.id, {
      targetRefs: integrated.targetRefs,
      imageIds: integrated.imageIds,
      equipment: integrated.equipment,
      location: integrated.location,
    });

    const missingLogs = buildMissingLogEntries(linkedFiles, endedSession.id, logEntries);
    if (missingLogs.length > 0) {
      addLogEntries(missingLogs);
    }

    return {
      session: integrated,
      linkedFileCount: linkedFiles.length,
      linkedLogCount: missingLogs.length,
    };
  }, [addLogEntries, endLiveSession, files, logEntries, targetCatalog, updateSession]);

  const getSessionStats = useCallback(() => {
    return calculateObservationStats(sessions, files);
  }, [sessions, files]);

  const getMonthlyData = useCallback(
    (months: number = 12) => {
      return getMonthlyTrend(sessions, months);
    },
    [sessions],
  );

  const getObservationDates = useCallback(
    (year: number, month: number) => {
      return getDatesWithObservations(files, year, month);
    },
    [files],
  );

  const exportSessionLog = useCallback(
    (sessionId: string, format: "csv" | "text" | "json" = "csv") => {
      const entries = logEntries.filter((e) => e.sessionId === sessionId);
      if (format === "json") {
        const session = sessions.find((s) => s.id === sessionId);
        if (!session) return "";
        return exportSessionToJSON(session, entries);
      }
      return format === "csv" ? exportToCSV(entries) : exportToText(entries);
    },
    [logEntries, sessions],
  );

  const exportAllSessions = useCallback(
    (format: "json" = "json") => {
      if (format === "json") return exportAllSessionsToJSON(sessions);
      return "";
    },
    [sessions],
  );

  return useMemo(
    () => ({
      sessions,
      logEntries,
      addSession,
      updateSession,
      removeSession,
      mergeSessions,
      endLiveSessionWithIntegration,
      autoDetectSessions,
      reconcileSessionsFromLinkedFiles,
      getSessionStats,
      getMonthlyData,
      getObservationDates,
      getDatesWithSessions,
      exportSessionLog,
      exportAllSessions,
    }),
    [
      sessions,
      logEntries,
      addSession,
      updateSession,
      removeSession,
      mergeSessions,
      endLiveSessionWithIntegration,
      autoDetectSessions,
      reconcileSessionsFromLinkedFiles,
      getSessionStats,
      getMonthlyData,
      getObservationDates,
      getDatesWithSessions,
      exportSessionLog,
      exportAllSessions,
    ],
  );
}
