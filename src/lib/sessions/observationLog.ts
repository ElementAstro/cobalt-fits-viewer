/**
 * 观测日志生成与管理
 */

import type { FitsMetadata, ObservationLogEntry } from "../fits/types";
import { normalizeSessionTargetRefs } from "../targets/targetRefs";

/**
 * 从单个文件生成日志条目
 */
export function createLogEntry(file: FitsMetadata, sessionId: string): ObservationLogEntry {
  return {
    id: `log_${file.id}`,
    sessionId,
    imageId: file.id,
    dateTime: file.dateObs ?? new Date(file.importDate).toISOString(),
    object: file.object ?? "Unknown",
    filter: file.filter ?? "Unknown",
    exptime: file.exptime ?? 0,
    gain: file.gain,
    telescope: file.telescope,
    camera: file.instrument ?? file.detector,
    ccdTemp: file.ccdTemp,
  };
}

/**
 * 批量从文件列表生成日志
 */
export function generateLogFromFiles(
  files: FitsMetadata[],
  sessionId: string,
): ObservationLogEntry[] {
  return files
    .filter((f) => f.dateObs)
    .sort((a, b) => new Date(a.dateObs!).getTime() - new Date(b.dateObs!).getTime())
    .map((f) => createLogEntry(f, sessionId));
}

/**
 * Escape a value for CSV (RFC 4180)
 */
export function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 导出日志为 CSV
 */
export function exportToCSV(entries: ObservationLogEntry[]): string {
  const headers = [
    "DateTime",
    "Object",
    "Filter",
    "Exposure(s)",
    "Gain",
    "Telescope",
    "Camera",
    "CCD Temp(°C)",
    "Notes",
  ];

  const rows = entries.map((e) =>
    [
      escapeCSV(e.dateTime),
      escapeCSV(e.object),
      escapeCSV(e.filter),
      e.exptime,
      e.gain ?? "",
      escapeCSV(e.telescope),
      escapeCSV(e.camera),
      e.ccdTemp ?? "",
      escapeCSV(e.notes),
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * 导出日志为纯文本
 */
export function exportToText(entries: ObservationLogEntry[]): string {
  const lines: string[] = ["=== Observation Log ===", `Total entries: ${entries.length}`, ""];

  for (const entry of entries) {
    lines.push(
      `[${entry.dateTime}] ${entry.object} | ${entry.filter} | ${entry.exptime}s` +
        (entry.gain != null ? ` | G${entry.gain}` : "") +
        (entry.ccdTemp != null ? ` | ${entry.ccdTemp}°C` : ""),
    );
    if (entry.notes) lines.push(`  Note: ${entry.notes}`);
  }

  return lines.join("\n");
}

/**
 * 导出单个会话为 JSON
 */
export function exportSessionToJSON(
  session: import("../fits/types").ObservationSession,
  entries: ObservationLogEntry[],
): string {
  const targetRefs = normalizeSessionTargetRefs(session);
  const targetNames = targetRefs.map((ref) => ref.name);
  return JSON.stringify(
    {
      session: {
        id: session.id,
        date: session.date,
        startTime: new Date(session.startTime).toISOString(),
        endTime: new Date(session.endTime).toISOString(),
        duration: session.duration,
        targetRefs,
        targets: targetNames,
        imageCount: session.imageIds.length,
        equipment: session.equipment,
        location: session.location,
        weather: session.weather,
        seeing: session.seeing,
        notes: session.notes,
        rating: session.rating,
        bortle: session.bortle,
        tags: session.tags,
      },
      logEntries: entries.map((e) => ({
        dateTime: e.dateTime,
        object: e.object,
        filter: e.filter,
        exptime: e.exptime,
        gain: e.gain,
        telescope: e.telescope,
        camera: e.camera,
        ccdTemp: e.ccdTemp,
        notes: e.notes,
      })),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

function serializeSessionSummary(session: import("../fits/types").ObservationSession) {
  const targetRefs = normalizeSessionTargetRefs(session);
  return {
    id: session.id,
    date: session.date,
    startTime: new Date(session.startTime).toISOString(),
    endTime: new Date(session.endTime).toISOString(),
    duration: session.duration,
    targetRefs,
    targets: targetRefs.map((ref) => ref.name),
    imageCount: session.imageIds.length,
    equipment: session.equipment,
    weather: session.weather,
    seeing: session.seeing,
    notes: session.notes,
    rating: session.rating,
    bortle: session.bortle,
    tags: session.tags,
  };
}

/**
 * 导出所有会话汇总为 JSON
 */
export function exportAllSessionsToJSON(
  sessions: import("../fits/types").ObservationSession[],
): string {
  return JSON.stringify(
    {
      sessions: sessions.map((session) => serializeSessionSummary(session)),
      totalSessions: sessions.length,
      totalDuration: sessions.reduce((sum, s) => sum + s.duration, 0),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
}

/**
 * 搜索日志条目
 */
export function searchLogEntries(
  entries: ObservationLogEntry[],
  query: string,
): ObservationLogEntry[] {
  if (!query.trim()) return entries;
  const q = query.toLowerCase().trim();

  return entries.filter(
    (e) =>
      e.object.toLowerCase().includes(q) ||
      e.filter.toLowerCase().includes(q) ||
      e.dateTime.includes(q) ||
      e.telescope?.toLowerCase().includes(q) ||
      e.camera?.toLowerCase().includes(q) ||
      e.notes?.toLowerCase().includes(q),
  );
}
