/**
 * 目标管理 - CRUD + 自动从 FITS header 提取目标
 */

import type { Target, TargetType, FitsMetadata } from "../fits/types";

/**
 * 从 FITS 元数据自动提取目标名
 */
export function extractTargetName(metadata: FitsMetadata): string | null {
  return metadata.object?.trim() || null;
}

/**
 * 创建新目标
 */
export function createTarget(name: string, type: TargetType = "other"): Target {
  const now = Date.now();
  return {
    id: generateId(),
    name,
    aliases: [],
    type,
    tags: [],
    isFavorite: false,
    isPinned: false,
    imageIds: [],
    status: "planned",
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
}

/**
 * 从 FITS 元数据自动检测或创建目标
 */
export function autoDetectTarget(
  metadata: FitsMetadata,
  existingTargets: Target[],
): { target: Target; isNew: boolean; coordinateUpdates?: { ra?: number; dec?: number } } | null {
  const name = extractTargetName(metadata);
  if (!name) return null;

  const existing = findTargetByNameOrAlias(name, existingTargets);
  if (existing) {
    const coordinateUpdates: { ra?: number; dec?: number } = {};
    if (existing.ra === undefined && metadata.ra !== undefined) {
      coordinateUpdates.ra = metadata.ra;
    }
    if (existing.dec === undefined && metadata.dec !== undefined) {
      coordinateUpdates.dec = metadata.dec;
    }
    return {
      target: existing,
      isNew: false,
      coordinateUpdates: Object.keys(coordinateUpdates).length > 0 ? coordinateUpdates : undefined,
    };
  }

  const newTarget = createTarget(name, guessTargetType(name));
  if (metadata.ra !== undefined) newTarget.ra = metadata.ra;
  if (metadata.dec !== undefined) newTarget.dec = metadata.dec;
  return { target: newTarget, isNew: true };
}

/**
 * 按名称或别名查找目标
 */
export function findTargetByNameOrAlias(name: string, targets: Target[]): Target | undefined {
  const lower = name.toLowerCase().trim();
  return targets.find(
    (t) => t.name.toLowerCase() === lower || t.aliases.some((a) => a.toLowerCase() === lower),
  );
}

/**
 * 根据名称猜测天体类型
 */
export function guessTargetType(name: string): TargetType {
  const upper = name.toUpperCase().trim();

  // 梅西耶天体 - 需要查表确定具体类型
  if (/^M\s?\d+$/i.test(upper)) {
    const num = parseInt(upper.replace(/^M\s?/, ""), 10);
    if (MESSIER_GALAXIES.includes(num)) return "galaxy";
    if (MESSIER_NEBULAE.includes(num)) return "nebula";
    if (MESSIER_CLUSTERS.includes(num)) return "cluster";
    return "other";
  }

  // NGC/IC 天体 - 尝试已知分类
  if (/^(NGC|IC)\s?\d+/i.test(upper)) {
    const num = parseInt(upper.replace(/^(NGC|IC)\s?/, ""), 10);
    const prefix = upper.startsWith("NGC") ? "NGC" : "IC";
    const key = `${prefix}${num}`;
    if (NGC_IC_TYPES[key]) return NGC_IC_TYPES[key];
    return "other";
  }

  // Sharpless 天体 - 发射星云
  if (/^SH\s?2[-\s]?\d+/i.test(upper)) return "nebula";

  // Caldwell 天体
  if (/^C(ALDWELL)?\s?\d+/i.test(upper) && !/^C\/\d/.test(upper)) return "other";

  // Abell 天体 - 行星状星云或星系团
  if (/^ABELL\s?\d+/i.test(upper)) return "nebula";

  // 行星
  const planets = ["MERCURY", "VENUS", "MARS", "JUPITER", "SATURN", "URANUS", "NEPTUNE"];
  if (planets.includes(upper)) return "planet";

  // 月球
  if (upper === "MOON" || upper === "LUNA") return "moon";

  // 太阳
  if (upper === "SUN" || upper === "SOL") return "sun";

  // 包含 nebula/galaxy 等关键词
  if (/NEBULA|NEB\b/i.test(upper)) return "nebula";
  if (/GALAXY|GAL\b/i.test(upper)) return "galaxy";
  if (/CLUSTER|CL\b/i.test(upper)) return "cluster";
  if (/COMET|C\/\d/i.test(upper)) return "comet";

  return "other";
}

/**
 * 计算目标的曝光统计
 */
export function calculateTargetExposure(
  target: Target,
  files: FitsMetadata[],
): Record<string, { count: number; totalSeconds: number }> {
  const result: Record<string, { count: number; totalSeconds: number }> = {};

  const targetFiles = files.filter((f) => target.imageIds.includes(f.id));
  for (const file of targetFiles) {
    const filter = file.filter ?? "Unknown";
    if (!result[filter]) {
      result[filter] = { count: 0, totalSeconds: 0 };
    }
    result[filter].count += 1;
    result[filter].totalSeconds += file.exptime ?? 0;
  }

  return result;
}

// ===== Helpers =====

function generateId(): string {
  return `target_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// 梅西耶天体分类 (部分)
const MESSIER_GALAXIES = [
  31, 32, 33, 49, 51, 58, 59, 60, 61, 63, 64, 65, 66, 74, 77, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  90, 91, 94, 95, 96, 98, 99, 100, 101, 104, 105, 106, 108, 109, 110,
];

const MESSIER_NEBULAE = [1, 8, 16, 17, 20, 27, 42, 43, 57, 76, 78, 97];

const MESSIER_CLUSTERS = [
  2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 18, 19, 21, 22, 23, 24, 25, 26, 28, 29, 30, 34, 35,
  36, 37, 38, 39, 41, 44, 45, 46, 47, 48, 50, 52, 53, 54, 55, 56, 62, 67, 68, 69, 70, 71, 72, 73,
  75, 79, 80, 92, 93, 107,
];

const NGC_IC_TYPES: Record<string, TargetType> = {
  // 星云
  NGC1499: "nebula",
  NGC1952: "nebula",
  NGC1976: "nebula",
  NGC2024: "nebula",
  NGC2237: "nebula",
  NGC2264: "nebula",
  NGC6514: "nebula",
  NGC6523: "nebula",
  NGC6618: "nebula",
  NGC6720: "nebula",
  NGC6853: "nebula",
  NGC6960: "nebula",
  NGC6992: "nebula",
  NGC7000: "nebula",
  NGC7293: "nebula",
  NGC7635: "nebula",
  NGC3587: "nebula",
  NGC6611: "nebula",
  NGC2392: "nebula",
  NGC7027: "nebula",
  IC1396: "nebula",
  IC1805: "nebula",
  IC1848: "nebula",
  IC1318: "nebula",
  IC2118: "nebula",
  IC5070: "nebula",
  IC5146: "nebula",
  IC434: "nebula",
  // 星系
  NGC224: "galaxy",
  NGC598: "galaxy",
  NGC3031: "galaxy",
  NGC3034: "galaxy",
  NGC4594: "galaxy",
  NGC4826: "galaxy",
  NGC5055: "galaxy",
  NGC5194: "galaxy",
  NGC5457: "galaxy",
  NGC4258: "galaxy",
  NGC891: "galaxy",
  NGC2903: "galaxy",
  NGC3628: "galaxy",
  NGC4565: "galaxy",
  NGC6946: "galaxy",
  NGC7331: "galaxy",
  IC342: "galaxy",
  IC10: "galaxy",
  // 星团
  NGC869: "cluster",
  NGC884: "cluster",
  NGC6205: "cluster",
  NGC7789: "cluster",
  NGC752: "cluster",
  NGC457: "cluster",
  NGC663: "cluster",
  NGC2244: "cluster",
  IC4665: "cluster",
};
