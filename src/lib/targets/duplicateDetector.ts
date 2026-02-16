/**
 * 重复目标检测算法
 */

import type { Target } from "../fits/types";
import { normalizeName } from "./targetMatcher";

export interface DuplicateGroup {
  id: string;
  targets: Target[];
  matchReason: "name" | "alias" | "coordinates" | "similar_name";
  confidence: "high" | "medium" | "low";
}

export interface DuplicateDetectionResult {
  groups: DuplicateGroup[];
  totalDuplicates: number;
  potentialSavings: number;
}

/**
 * 检测重复目标
 */
export function detectDuplicates(targets: Target[]): DuplicateDetectionResult {
  const groups: DuplicateGroup[] = [];
  const processed = new Set<string>();

  // 1. 按名称检测
  const nameGroups = new Map<string, Target[]>();
  for (const target of targets) {
    const normalizedName = normalizeName(target.name);
    if (!nameGroups.has(normalizedName)) {
      nameGroups.set(normalizedName, []);
    }
    nameGroups.get(normalizedName)!.push(target);
  }

  // 添加名称匹配组
  for (const [, groupTargets] of nameGroups) {
    if (groupTargets.length > 1) {
      const ids = groupTargets
        .map((t) => t.id)
        .sort()
        .join("-");
      if (!processed.has(ids)) {
        processed.add(ids);
        groups.push({
          id: `name-${groups.length}`,
          targets: groupTargets,
          matchReason: "name",
          confidence: "high",
        });
      }
    }
  }

  // 2. 按别名交叉检测
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const t1 = targets[i];
      const t2 = targets[j];

      // 检查是否已在同一组
      const ids = [t1.id, t2.id].sort().join("-");
      if (processed.has(ids)) continue;

      // 检查别名交集
      const t1Names = new Set([normalizeName(t1.name), ...t1.aliases.map((a) => normalizeName(a))]);
      const t2Names = new Set([normalizeName(t2.name), ...t2.aliases.map((a) => normalizeName(a))]);

      let hasOverlap = false;
      for (const name of t1Names) {
        if (t2Names.has(name)) {
          hasOverlap = true;
          break;
        }
      }

      if (hasOverlap) {
        // 检查是否可以合并到现有组
        let addedToExisting = false;
        for (const group of groups) {
          const groupIds = new Set(group.targets.map((t) => t.id));
          if (groupIds.has(t1.id) || groupIds.has(t2.id)) {
            if (!groupIds.has(t1.id)) group.targets.push(t1);
            if (!groupIds.has(t2.id)) group.targets.push(t2);
            addedToExisting = true;
            break;
          }
        }

        if (!addedToExisting) {
          groups.push({
            id: `alias-${groups.length}`,
            targets: [t1, t2],
            matchReason: "alias",
            confidence: "high",
          });
        }
        processed.add(ids);
      }
    }
  }

  // 3. 按坐标检测（0.5度半径内）
  for (let i = 0; i < targets.length; i++) {
    for (let j = i + 1; j < targets.length; j++) {
      const t1 = targets[i];
      const t2 = targets[j];

      if (t1.ra === undefined || t1.dec === undefined) continue;
      if (t2.ra === undefined || t2.dec === undefined) continue;

      const ids = [t1.id, t2.id].sort().join("-");
      if (processed.has(ids)) continue;

      const distance = angularDistance(t1.ra, t1.dec, t2.ra, t2.dec);
      if (distance <= 0.5) {
        // 检查是否可以合并到现有组
        let addedToExisting = false;
        for (const group of groups) {
          const groupIds = new Set(group.targets.map((t) => t.id));
          if (groupIds.has(t1.id) || groupIds.has(t2.id)) {
            if (!groupIds.has(t1.id)) group.targets.push(t1);
            if (!groupIds.has(t2.id)) group.targets.push(t2);
            addedToExisting = true;
            break;
          }
        }

        if (!addedToExisting) {
          groups.push({
            id: `coord-${groups.length}`,
            targets: [t1, t2],
            matchReason: "coordinates",
            confidence: distance <= 0.1 ? "high" : "medium",
          });
        }
        processed.add(ids);
      }
    }
  }

  // 计算统计数据
  let totalDuplicates = 0;
  for (const group of groups) {
    totalDuplicates += group.targets.length - 1; // 减去一个保留的目标
  }

  return {
    groups,
    totalDuplicates,
    potentialSavings: totalDuplicates,
  };
}

/**
 * 计算角距离（度）
 */
function angularDistance(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const dRa = (ra1 - ra2) * Math.cos((dec1 * Math.PI) / 180);
  const dDec = dec1 - dec2;
  return Math.sqrt(dRa * dRa + dDec * dDec);
}

/**
 * 查找特定目标的重复项
 */
export function findDuplicatesOf(targets: Target[], targetId: string): Target[] {
  const target = targets.find((t) => t.id === targetId);
  if (!target) return [];

  const duplicates: Target[] = [];
  const targetNormalizedName = normalizeName(target.name);
  const targetAliases = new Set(target.aliases.map((a) => normalizeName(a)));

  for (const t of targets) {
    if (t.id === targetId) continue;

    // 名称匹配
    if (normalizeName(t.name) === targetNormalizedName) {
      duplicates.push(t);
      continue;
    }

    // 别名匹配
    const tAliases = new Set(t.aliases.map((a) => normalizeName(a)));
    for (const alias of targetAliases) {
      if (tAliases.has(alias) || normalizeName(t.name) === alias) {
        duplicates.push(t);
        break;
      }
    }

    // 坐标匹配
    if (
      target.ra !== undefined &&
      target.dec !== undefined &&
      t.ra !== undefined &&
      t.dec !== undefined
    ) {
      const distance = angularDistance(target.ra, target.dec, t.ra, t.dec);
      if (distance <= 0.5) {
        duplicates.push(t);
      }
    }
  }

  return duplicates;
}

/**
 * 建议合并策略
 */
export function suggestMergeStrategy(group: DuplicateGroup): {
  primaryTarget: Target;
  mergeData: Partial<Target>;
} | null {
  if (group.targets.length < 2) return null;

  // 选择主目标：优先选择有最多图片的
  const sorted = [...group.targets].sort((a, b) => b.imageIds.length - a.imageIds.length);
  const primary = sorted[0];

  // 收集要合并的数据
  const allAliases = new Set<string>();
  const allTags = new Set<string>();
  const allImageIds = new Set<string>();
  let notes: string | undefined;
  let category: string | undefined;
  let ra: number | undefined;
  let dec: number | undefined;

  for (const t of group.targets) {
    // 别名（排除自己的名称）
    for (const alias of t.aliases) {
      if (normalizeName(alias) !== normalizeName(primary.name)) {
        allAliases.add(alias);
      }
    }
    // 标签
    for (const tag of t.tags) {
      allTags.add(tag);
    }
    // 图片
    for (const imageId of t.imageIds) {
      allImageIds.add(imageId);
    }
    // 备注（合并）
    if (t.notes) {
      notes = notes ? `${notes}\n${t.notes}` : t.notes;
    }
    // 分类（使用第一个有分类的）
    if (!category && t.category) {
      category = t.category;
    }
    // 坐标（使用第一个有坐标的）
    if (ra === undefined && t.ra !== undefined) {
      ra = t.ra;
      dec = t.dec;
    }
  }

  return {
    primaryTarget: primary,
    mergeData: {
      aliases: [...allAliases],
      tags: [...allTags],
      imageIds: [...allImageIds],
      notes,
      category,
      ra,
      dec,
    },
  };
}
