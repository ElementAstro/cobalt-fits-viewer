/**
 * 观测会话自动检测 - 按时间间隔将图像分组为会话
 */

import type {
  FitsMetadata,
  ObservationSession,
  ObservationLogEntry,
  SessionEquipment,
} from "../fits/types";

/**
 * 从 FITS 元数据自动检测观测会话
 * 按时间间隔分组（默认 120 分钟内的图像属于同一会话）
 */
export function detectSessions(
  files: FitsMetadata[],
  gapMinutes: number = 120,
): ObservationSession[] {
  const filesWithDate = files
    .filter((f) => f.dateObs)
    .map((f) => ({
      ...f,
      timestamp: new Date(f.dateObs!).getTime(),
    }))
    .sort((a, b) => a.timestamp - b.timestamp);

  if (filesWithDate.length === 0) return [];

  const gapMs = gapMinutes * 60 * 1000;
  const groups: (typeof filesWithDate)[] = [];
  let currentGroup = [filesWithDate[0]];

  for (let i = 1; i < filesWithDate.length; i++) {
    const diff = filesWithDate[i].timestamp - filesWithDate[i - 1].timestamp;
    if (diff > gapMs) {
      groups.push(currentGroup);
      currentGroup = [filesWithDate[i]];
    } else {
      currentGroup.push(filesWithDate[i]);
    }
  }
  groups.push(currentGroup);

  return groups.map((group) => {
    const startTime = group[0].timestamp;
    const endTime = group[group.length - 1].timestamp;
    const lastExptime = group[group.length - 1].exptime ?? 0;

    const targets = [...new Set(group.map((f) => f.object).filter(Boolean))] as string[];
    const imageIds = group.map((f) => f.id);

    const equipment = extractEquipment(group);
    const dateStr = new Date(startTime).toISOString().split("T")[0];

    return {
      id: `session_${dateStr}_${startTime}`,
      date: dateStr,
      startTime,
      endTime: endTime + lastExptime * 1000,
      duration: Math.round((endTime - startTime) / 1000) + lastExptime,
      targets,
      imageIds,
      equipment,
      createdAt: Date.now(),
    };
  });
}

/**
 * 从文件组提取设备信息
 */
function extractEquipment(files: FitsMetadata[]): SessionEquipment {
  const telescopes = [...new Set(files.map((f) => f.telescope).filter(Boolean))] as string[];
  const cameras = [
    ...new Set(files.map((f) => f.instrument ?? f.detector).filter(Boolean)),
  ] as string[];
  const filters = [...new Set(files.map((f) => f.filter).filter(Boolean))] as string[];

  return {
    telescope: telescopes[0],
    camera: cameras[0],
    filters: filters.length > 0 ? filters : undefined,
  };
}

/**
 * 从 FITS 元数据生成观测日志条目
 */
export function generateLogEntries(
  files: FitsMetadata[],
  sessionId: string,
): ObservationLogEntry[] {
  return files
    .filter((f) => f.dateObs)
    .sort((a, b) => new Date(a.dateObs!).getTime() - new Date(b.dateObs!).getTime())
    .map((f) => ({
      id: `log_${f.id}`,
      sessionId,
      imageId: f.id,
      dateTime: f.dateObs!,
      object: f.object ?? "Unknown",
      filter: f.filter ?? "Unknown",
      exptime: f.exptime ?? 0,
      gain: f.gain,
      telescope: f.telescope,
      camera: f.instrument ?? f.detector,
      ccdTemp: f.ccdTemp,
    }));
}

/**
 * 导出日志为 CSV 格式字符串
 */
export function exportLogToCSV(entries: ObservationLogEntry[]): string {
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
      e.dateTime,
      e.object,
      e.filter,
      e.exptime,
      e.gain ?? "",
      e.telescope ?? "",
      e.camera ?? "",
      e.ccdTemp ?? "",
      e.notes ?? "",
    ].join(","),
  );

  return [headers.join(","), ...rows].join("\n");
}

/**
 * 获取指定月份有观测数据的日期列表
 */
export function getDatesWithObservations(
  files: FitsMetadata[],
  year: number,
  month: number,
): number[] {
  const dates = new Set<number>();

  for (const file of files) {
    if (!file.dateObs) continue;
    const d = new Date(file.dateObs);
    if (d.getFullYear() === year && d.getMonth() === month) {
      dates.add(d.getDate());
    }
  }

  return [...dates].sort((a, b) => a - b);
}
