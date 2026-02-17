/**
 * Sync astrometry plate solve results to target management
 * Creates or updates a Target with coordinates and detected objects
 */

import * as Crypto from "expo-crypto";
import { Logger } from "../logger";
import type { AstrometryResult } from "./types";
import type { Target, TargetType } from "../fits/types";

const TAG = "SyncToTarget";

/**
 * 从解析结果中推断目标类型
 */
function inferTargetType(tags: string[]): TargetType {
  const joined = tags.join(" ").toLowerCase();
  if (joined.includes("galaxy") || joined.includes("galaxies")) return "galaxy";
  if (joined.includes("nebula") || joined.includes("emission") || joined.includes("planetary"))
    return "nebula";
  if (joined.includes("cluster") || joined.includes("open cluster") || joined.includes("globular"))
    return "cluster";
  return "other";
}

/**
 * 从解析结果中提取最佳目标名称
 * 优先 Messier > NGC > IC > 其他
 */
function extractBestName(result: AstrometryResult): string | null {
  const annotations = result.annotations;
  if (annotations.length === 0) return null;

  // 优先级排序
  const messier = annotations.find((a) => a.type === "messier" && a.names.length > 0);
  if (messier) return messier.names[0];

  const ngc = annotations.find((a) => a.type === "ngc" && a.names.length > 0);
  if (ngc) return ngc.names[0];

  const ic = annotations.find((a) => a.type === "ic" && a.names.length > 0);
  if (ic) return ic.names[0];

  // 任何有名称的标注
  const named = annotations.find((a) => a.names.length > 0);
  return named ? named.names[0] : null;
}

/**
 * 收集所有天体名称作为别名
 */
function collectAliases(result: AstrometryResult): string[] {
  const names = new Set<string>();
  for (const ann of result.annotations) {
    for (const name of ann.names) {
      names.add(name);
    }
  }
  return Array.from(names);
}

export interface SyncResult {
  action: "created" | "updated";
  targetId: string;
  targetName: string;
}

/**
 * 从解析结果创建新 Target
 */
export function createTargetFromResult(result: AstrometryResult, fileId?: string): Target {
  const name = extractBestName(result) ?? `Field RA${result.calibration.ra.toFixed(2)}`;
  const aliases = collectAliases(result).filter((a) => a !== name);
  const type = inferTargetType(result.tags);
  const now = Date.now();

  const target: Target = {
    id: Crypto.randomUUID(),
    name,
    aliases,
    type,
    tags: [],
    isFavorite: false,
    isPinned: false,
    ra: result.calibration.ra,
    dec: result.calibration.dec,
    imageIds: fileId ? [fileId] : [],
    status: "acquiring",
    plannedFilters: [],
    plannedExposure: {},
    imageRatings: {},
    changeLog: [
      {
        id: `log_${now}_${Math.random().toString(36).substring(2, 9)}`,
        timestamp: now,
        action: "created",
      },
    ],
    createdAt: now,
    updatedAt: now,
  };

  Logger.info(TAG, `Created target: ${name} (${type})`, {
    ra: result.calibration.ra,
    dec: result.calibration.dec,
  });

  return target;
}

/**
 * 判断坐标是否匹配（在半径内）
 */
export function isCoordinateMatch(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
  radiusDeg: number = 0.5,
): boolean {
  const dRa = (ra1 - ra2) * Math.cos((dec1 * Math.PI) / 180);
  const dDec = dec1 - dec2;
  const dist = Math.sqrt(dRa * dRa + dDec * dDec);
  return dist <= radiusDeg;
}

/**
 * 在现有 targets 中找到匹配的 target（按名称或坐标）
 */
export function findMatchingTarget(
  targets: Target[],
  result: AstrometryResult,
): Target | undefined {
  const bestName = extractBestName(result);
  const allNames = collectAliases(result);

  // 1. 精确名称匹配
  if (bestName) {
    const byName = targets.find(
      (t) =>
        t.name.toLowerCase() === bestName.toLowerCase() ||
        t.aliases.some((a) => a.toLowerCase() === bestName.toLowerCase()),
    );
    if (byName) return byName;
  }

  // 2. 别名交集匹配
  for (const target of targets) {
    const targetNames = [target.name, ...target.aliases].map((n) => n.toLowerCase());
    for (const name of allNames) {
      if (targetNames.includes(name.toLowerCase())) return target;
    }
  }

  // 3. 坐标匹配
  if (result.calibration.ra != null && result.calibration.dec != null) {
    const byCoord = targets.find(
      (t) =>
        t.ra != null &&
        t.dec != null &&
        isCoordinateMatch(result.calibration.ra, result.calibration.dec, t.ra, t.dec),
    );
    if (byCoord) return byCoord;
  }

  return undefined;
}
