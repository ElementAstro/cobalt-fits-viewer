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
  getDatesWithObservations,
  isSessionDuplicate,
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
import type { ObservationSession } from "../lib/fits/types";

interface EndLiveSessionWithIntegrationResult {
  session: ObservationSession | null;
  linkedFileCount: number;
  linkedLogCount: number;
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

  const autoDetectSessions = useCallback((): { newCount: number; totalDetected: number } => {
    const detected = detectSessions(files, sessionGapMinutes);
    Logger.info(
      LOG_TAGS.Sessions,
      `Auto-detect: ${detected.length} sessions found from ${files.length} files`,
    );

    let newCount = 0;
    for (const session of detected) {
      if (isSessionDuplicate(session, sessions)) continue;

      const sessionFiles = files.filter((f) => session.imageIds.includes(f.id));
      const derived = deriveSessionMetadataFromFiles(sessionFiles, targetCatalog);
      const integratedSession = mergeSessionLike(session, {
        targetRefs: derived.targetRefs,
        imageIds: derived.imageIds,
        equipment: {
          ...(session.equipment ?? {}),
          ...(derived.equipment ?? {}),
        },
        location: derived.location ?? session.location,
      }) as ObservationSession;

      addSession(integratedSession);
      batchSetSessionId(integratedSession.imageIds, integratedSession.id);

      const entries = generateLogFromFiles(sessionFiles, integratedSession.id);
      addLogEntries(entries);
      newCount++;
    }

    return { newCount, totalDetected: detected.length };
  }, [
    files,
    sessionGapMinutes,
    sessions,
    addSession,
    addLogEntries,
    batchSetSessionId,
    targetCatalog,
  ]);

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
      getSessionStats,
      getMonthlyData,
      getObservationDates,
      getDatesWithSessions,
      exportSessionLog,
      exportAllSessions,
    ],
  );
}
