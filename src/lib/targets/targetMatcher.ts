/**
 * 目标名别名匹配
 * 处理同一天体的不同名称（如 M31 = Andromeda Galaxy = NGC 224）
 */

import type { Target } from "../fits/types";

/**
 * 常见天体别名映射
 */
const COMMON_ALIASES: Record<string, string[]> = {
  // 梅西耶天体
  M1: ["Crab Nebula", "NGC 1952"],
  M8: ["Lagoon Nebula", "NGC 6523"],
  M13: ["Hercules Cluster", "NGC 6205"],
  M16: ["Eagle Nebula", "NGC 6611"],
  M17: ["Omega Nebula", "Swan Nebula", "NGC 6618"],
  M20: ["Trifid Nebula", "NGC 6514"],
  M27: ["Dumbbell Nebula", "NGC 6853"],
  M31: ["Andromeda Galaxy", "NGC 224"],
  M33: ["Triangulum Galaxy", "NGC 598"],
  M42: ["Orion Nebula", "NGC 1976"],
  M43: ["De Mairan's Nebula", "NGC 1982"],
  M44: ["Beehive Cluster", "Praesepe", "NGC 2632"],
  M45: ["Pleiades", "Seven Sisters"],
  M51: ["Whirlpool Galaxy", "NGC 5194"],
  M57: ["Ring Nebula", "NGC 6720"],
  M63: ["Sunflower Galaxy", "NGC 5055"],
  M64: ["Black Eye Galaxy", "NGC 4826"],
  M74: ["Phantom Galaxy", "NGC 628"],
  M76: ["Little Dumbbell Nebula", "NGC 650"],
  M78: ["NGC 2068"],
  M81: ["Bode's Galaxy", "NGC 3031"],
  M82: ["Cigar Galaxy", "NGC 3034"],
  M83: ["Southern Pinwheel Galaxy", "NGC 5236"],
  M97: ["Owl Nebula", "NGC 3587"],
  M101: ["Pinwheel Galaxy", "NGC 5457"],
  M104: ["Sombrero Galaxy", "NGC 4594"],
  M106: ["NGC 4258"],
  M110: ["NGC 205"],
  // NGC 天体
  "NGC 7000": ["North America Nebula"],
  "NGC 7293": ["Helix Nebula"],
  "NGC 2237": ["Rosette Nebula"],
  "NGC 6960": ["Western Veil Nebula", "Witch's Broom"],
  "NGC 6992": ["Eastern Veil Nebula"],
  "NGC 7635": ["Bubble Nebula"],
  "NGC 2024": ["Flame Nebula"],
  "NGC 2264": ["Cone Nebula", "Christmas Tree Cluster"],
  "NGC 1499": ["California Nebula"],
  "NGC 891": ["Silver Sliver Galaxy"],
  "NGC 2392": ["Eskimo Nebula", "Clown-faced Nebula"],
  "NGC 3628": ["Hamburger Galaxy"],
  "NGC 4565": ["Needle Galaxy"],
  "NGC 6946": ["Fireworks Galaxy"],
  "NGC 7331": ["Deer Lick Galaxy"],
  "NGC 869": ["Double Cluster", "NGC 884"],
  "NGC 457": ["Owl Cluster", "ET Cluster"],
  // IC 天体
  "IC 1396": ["Elephant Trunk Nebula"],
  "IC 5070": ["Pelican Nebula"],
  "IC 1805": ["Heart Nebula"],
  "IC 1848": ["Soul Nebula", "Embryo Nebula"],
  "IC 434": ["Horsehead Nebula", "B33"],
  "IC 5146": ["Cocoon Nebula"],
  "IC 2118": ["Witch Head Nebula"],
  "IC 1318": ["Butterfly Nebula", "Sadr Region"],
  "IC 342": ["Hidden Galaxy"],
  // Sharpless 天体
  "SH2-129": ["Flying Bat Nebula"],
  "SH2-155": ["Cave Nebula"],
  "SH2-171": ["NGC 7822"],
  "SH2-240": ["Simeis 147", "Spaghetti Nebula"],
  "SH2-308": ["Dolphin Head Nebula"],
  "SH2-132": ["Lion Nebula"],
  "SH2-115": ["Sharpless 115"],
  "SH2-157": ["Lobster Claw Nebula"],
  "SH2-170": ["Little Rosette Nebula"],
};

/**
 * 规范化目标名（去除空格、统一大小写等）
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(M|NGC|IC)\s*(\d+)/i, (_, prefix, num) => `${prefix.toUpperCase()} ${num}`);
}

/**
 * 查找名称是否匹配已知别名
 */
export function findKnownAliases(name: string): string[] {
  const normalized = normalizeName(name).toUpperCase();

  for (const [key, aliases] of Object.entries(COMMON_ALIASES)) {
    const allNames = [key, ...aliases].map((n) => n.toUpperCase());
    if (allNames.includes(normalized)) {
      return [key, ...aliases].filter((n) => n.toUpperCase() !== normalized);
    }
  }

  return [];
}

/**
 * 尝试将新名称匹配到现有目标
 */
export function matchTargetByName(name: string, targets: Target[]): Target | null {
  const normalized = normalizeName(name).toLowerCase();

  // 直接名称匹配
  for (const target of targets) {
    if (normalizeName(target.name).toLowerCase() === normalized) {
      return target;
    }
    for (const alias of target.aliases) {
      if (normalizeName(alias).toLowerCase() === normalized) {
        return target;
      }
    }
  }

  // 已知别名匹配
  const knownAliases = findKnownAliases(name);
  for (const alias of knownAliases) {
    const aliasLower = alias.toLowerCase();
    for (const target of targets) {
      if (normalizeName(target.name).toLowerCase() === aliasLower) {
        return target;
      }
      for (const tAlias of target.aliases) {
        if (normalizeName(tAlias).toLowerCase() === aliasLower) {
          return target;
        }
      }
    }
  }

  return null;
}

/**
 * 合并两个目标（将 source 合并到 dest）
 */
export function mergeTargets(dest: Target, source: Target): Target {
  const allAliases = new Set([...dest.aliases, ...source.aliases, source.name]);
  allAliases.delete(dest.name);

  const mergedExposure = { ...dest.plannedExposure };
  for (const [filter, seconds] of Object.entries(source.plannedExposure)) {
    mergedExposure[filter] = Math.max(mergedExposure[filter] ?? 0, seconds);
  }

  return {
    ...dest,
    aliases: [...allAliases],
    imageIds: [...new Set([...dest.imageIds, ...source.imageIds])],
    plannedFilters: [...new Set([...dest.plannedFilters, ...source.plannedFilters])],
    plannedExposure: mergedExposure,
    updatedAt: Date.now(),
  };
}
