/**
 * 观测日志生成与管理
 */

import type { FitsMetadata, ObservationLogEntry } from "../fits/types";

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
      `"${e.dateTime}"`,
      `"${e.object}"`,
      `"${e.filter}"`,
      e.exptime,
      e.gain ?? "",
      `"${e.telescope ?? ""}"`,
      `"${e.camera ?? ""}"`,
      e.ccdTemp ?? "",
      `"${e.notes ?? ""}"`,
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
