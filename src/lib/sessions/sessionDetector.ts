/**
 * 观测会话自动检测 - 按时间间隔将图像分组为会话
 */

import type {
  FitsMetadata,
  ObservationSession,
  ObservationLogEntry,
  SessionEquipment,
} from "../fits/types";
import { dedupeTargetRefs, toTargetRef } from "../targets/targetRefs";
import { LOG_TAGS, Logger } from "../logger";
import { toLocalDateKey } from "./planUtils";

function parseDateObsToTimestamp(dateObs: string | undefined, fileId?: string): number | undefined {
  if (!dateObs) return undefined;

  const timestamp = Date.parse(dateObs);
  if (!Number.isFinite(timestamp)) {
    Logger.warn(LOG_TAGS.Sessions, `Invalid DATE-OBS skipped${fileId ? `: ${fileId}` : ""}`, {
      dateObs,
      fileId,
    });
    return undefined;
  }

  return timestamp;
}

/**
 * 从 FITS 元数据自动检测观测会话
 * 按时间间隔分组（默认 120 分钟内的图像属于同一会话）
 */
export function detectSessions(
  files: FitsMetadata[],
  gapMinutes: number = 120,
): ObservationSession[] {
  const filesWithDate = files
    .map((file) => {
      const timestamp = parseDateObsToTimestamp(file.dateObs, file.id);
      if (!Number.isFinite(timestamp)) return undefined;
      return {
        ...file,
        timestamp,
      };
    })
    .filter((file): file is FitsMetadata & { timestamp: number } => Boolean(file))
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

    const targetNames = [...new Set(group.map((f) => f.object).filter(Boolean))] as string[];
    const imageIds = group.map((f) => f.id);

    const equipment = extractEquipment(group);
    const dateStr = toLocalDateKey(new Date(startTime));

    return {
      id: `session_${dateStr}_${startTime}`,
      date: dateStr,
      startTime,
      endTime: endTime + lastExptime * 1000,
      duration: Math.round((endTime - startTime) / 1000) + lastExptime,
      targetRefs: dedupeTargetRefs(targetNames.map((name) => toTargetRef(name))),
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
    .map((file) => ({
      file,
      timestamp: parseDateObsToTimestamp(file.dateObs, file.id),
    }))
    .filter((entry): entry is { file: FitsMetadata; timestamp: number } =>
      Number.isFinite(entry.timestamp),
    )
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ file }) => ({
      id: `log_${file.id}`,
      sessionId,
      imageId: file.id,
      dateTime: file.dateObs!,
      object: file.object ?? "Unknown",
      filter: file.filter ?? "Unknown",
      exptime: file.exptime ?? 0,
      gain: file.gain,
      telescope: file.telescope,
      camera: file.instrument ?? file.detector,
      ccdTemp: file.ccdTemp,
    }));
}

/**
 * 判断 candidate 是否与已有 sessions 中的某个重复
 * 规则：同日期+同开始时间，或 >50% 图像重叠
 */
export function isSessionDuplicate(
  candidate: ObservationSession,
  existingSessions: ObservationSession[],
): boolean {
  return existingSessions.some((s) => {
    if (s.date === candidate.date && s.startTime === candidate.startTime) return true;
    if (candidate.imageIds.length === 0) return false;
    const overlap = candidate.imageIds.filter((id) => s.imageIds.includes(id)).length;
    return overlap > candidate.imageIds.length * 0.5;
  });
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
    const timestamp = parseDateObsToTimestamp(file.dateObs, file.id);
    if (timestamp === undefined) continue;
    const d = new Date(timestamp);
    if (d.getFullYear() === year && d.getMonth() === month) {
      dates.add(d.getDate());
    }
  }

  return [...dates].sort((a, b) => a - b);
}
