/**
 * 会话管理 Hook
 */

import { useCallback, useMemo } from "react";
import { useSessionStore } from "../stores/useSessionStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useSettingsStore } from "../stores/useSettingsStore";
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
import { Logger } from "../lib/logger";

export function useSessions() {
  const sessions = useSessionStore((s) => s.sessions);
  const logEntries = useSessionStore((s) => s.logEntries);
  const addSession = useSessionStore((s) => s.addSession);
  const addLogEntries = useSessionStore((s) => s.addLogEntries);
  const updateSession = useSessionStore((s) => s.updateSession);
  const removeSession = useSessionStore((s) => s.removeSession);
  const mergeSessions = useSessionStore((s) => s.mergeSessions);
  const getDatesWithSessions = useSessionStore((s) => s.getDatesWithSessions);

  const files = useFitsStore((s) => s.files);
  const batchSetSessionId = useFitsStore((s) => s.batchSetSessionId);
  const sessionGapMinutes = useSettingsStore((s) => s.sessionGapMinutes);

  const autoDetectSessions = useCallback((): { newCount: number; totalDetected: number } => {
    const detected = detectSessions(files, sessionGapMinutes);
    Logger.info(
      "Sessions",
      `Auto-detect: ${detected.length} sessions found from ${files.length} files`,
    );

    let newCount = 0;
    for (const session of detected) {
      if (isSessionDuplicate(session, sessions)) continue;

      // 从 session 内文件中提取众数位置
      const sessionFiles = files.filter((f) => session.imageIds.includes(f.id));
      const locationCounts = new Map<
        string,
        { count: number; location: typeof session.location }
      >();
      for (const f of sessionFiles) {
        if (!f.location) continue;
        const key =
          f.location.city ??
          f.location.placeName ??
          `${f.location.latitude},${f.location.longitude}`;
        const entry = locationCounts.get(key);
        if (entry) {
          entry.count++;
        } else {
          locationCounts.set(key, { count: 1, location: f.location });
        }
      }
      if (locationCounts.size > 0) {
        const top = [...locationCounts.values()].sort((a, b) => b.count - a.count)[0];
        session.location = top.location;
      }

      addSession(session);
      batchSetSessionId(session.imageIds, session.id);

      const entries = generateLogFromFiles(sessionFiles, session.id);
      addLogEntries(entries);
      newCount++;
    }

    return { newCount, totalDetected: detected.length };
  }, [files, sessionGapMinutes, sessions, addSession, addLogEntries, batchSetSessionId]);

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
