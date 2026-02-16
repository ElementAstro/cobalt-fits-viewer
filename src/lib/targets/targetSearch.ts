/**
 * 高级目标搜索逻辑
 */

import type { Target } from "../fits/types";

export interface SearchConditions {
  query?: string;
  raMin?: number;
  raMax?: number;
  decMin?: number;
  decMax?: number;
  types?: string[];
  statuses?: string[];
  categories?: string[];
  tags?: string[];
  isFavorite?: boolean;
  isPinned?: boolean;
  hasCoordinates?: boolean;
  hasImages?: boolean;
  notes?: string;
}

export interface SearchResult {
  targets: Target[];
  matchCount: number;
  conditions: SearchConditions;
}

/**
 * 执行高级搜索
 */
export function searchTargets(targets: Target[], conditions: SearchConditions): SearchResult {
  let result = [...targets];

  // 文本搜索（名称、别名、备注）
  if (conditions.query?.trim()) {
    const q = conditions.query.toLowerCase().trim();
    result = result.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.aliases.some((a) => a.toLowerCase().includes(q)) ||
        t.notes?.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)),
    );
  }

  // RA 范围过滤
  if (conditions.raMin !== undefined || conditions.raMax !== undefined) {
    result = result.filter((t) => {
      if (t.ra === undefined) return false;
      if (conditions.raMin !== undefined && t.ra < conditions.raMin) return false;
      if (conditions.raMax !== undefined && t.ra > conditions.raMax) return false;
      return true;
    });
  }

  // Dec 范围过滤
  if (conditions.decMin !== undefined || conditions.decMax !== undefined) {
    result = result.filter((t) => {
      if (t.dec === undefined) return false;
      if (conditions.decMin !== undefined && t.dec < conditions.decMin) return false;
      if (conditions.decMax !== undefined && t.dec > conditions.decMax) return false;
      return true;
    });
  }

  // 类型过滤
  if (conditions.types && conditions.types.length > 0) {
    result = result.filter((t) => conditions.types!.includes(t.type));
  }

  // 状态过滤
  if (conditions.statuses && conditions.statuses.length > 0) {
    result = result.filter((t) => conditions.statuses!.includes(t.status));
  }

  // 分类过滤
  if (conditions.categories && conditions.categories.length > 0) {
    result = result.filter((t) => t.category && conditions.categories!.includes(t.category));
  }

  // 标签过滤
  if (conditions.tags && conditions.tags.length > 0) {
    result = result.filter((t) => conditions.tags!.some((tag) => t.tags.includes(tag)));
  }

  // 收藏过滤
  if (conditions.isFavorite !== undefined) {
    result = result.filter((t) => t.isFavorite === conditions.isFavorite);
  }

  // 置顶过滤
  if (conditions.isPinned !== undefined) {
    result = result.filter((t) => t.isPinned === conditions.isPinned);
  }

  // 有坐标过滤
  if (conditions.hasCoordinates === true) {
    result = result.filter((t) => t.ra !== undefined && t.dec !== undefined);
  } else if (conditions.hasCoordinates === false) {
    result = result.filter((t) => t.ra === undefined || t.dec === undefined);
  }

  // 有图片过滤
  if (conditions.hasImages === true) {
    result = result.filter((t) => t.imageIds.length > 0);
  } else if (conditions.hasImages === false) {
    result = result.filter((t) => t.imageIds.length === 0);
  }

  // 备注搜索
  if (conditions.notes?.trim()) {
    const noteQuery = conditions.notes.toLowerCase().trim();
    result = result.filter((t) => t.notes?.toLowerCase().includes(noteQuery));
  }

  return {
    targets: result,
    matchCount: result.length,
    conditions,
  };
}

/**
 * 快速搜索（仅名称和别名）
 */
export function quickSearch(targets: Target[], query: string): Target[] {
  if (!query.trim()) return targets;

  const q = query.toLowerCase().trim();
  return targets.filter(
    (t) => t.name.toLowerCase().includes(q) || t.aliases.some((a) => a.toLowerCase().includes(q)),
  );
}

/**
 * 获取搜索建议
 */
export function getSearchSuggestions(targets: Target[], query: string): string[] {
  if (!query.trim()) return [];

  const q = query.toLowerCase().trim();
  const suggestions = new Set<string>();

  for (const t of targets) {
    // 名称匹配
    if (t.name.toLowerCase().includes(q)) {
      suggestions.add(t.name);
    }
    // 别名匹配
    for (const alias of t.aliases) {
      if (alias.toLowerCase().includes(q)) {
        suggestions.add(alias);
      }
    }
    // 标签匹配
    for (const tag of t.tags) {
      if (tag.toLowerCase().includes(q)) {
        suggestions.add(tag);
      }
    }
    // 分类匹配
    if (t.category?.toLowerCase().includes(q)) {
      suggestions.add(t.category);
    }
  }

  return Array.from(suggestions).slice(0, 10);
}
