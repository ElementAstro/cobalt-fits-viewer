/**
 * 相簿 CRUD 管理
 */

import type { Album, SmartAlbumRule, FitsMetadata, SmartAlbumRuleOperator } from "../fits/types";

/**
 * 创建新相簿
 */
export function createAlbum(
  name: string,
  description?: string,
  isSmart: boolean = false,
  smartRules?: SmartAlbumRule[],
): Album {
  return {
    id: `album_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    name,
    description,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    imageIds: [],
    isSmart,
    smartRules,
  };
}

/**
 * 评估智能相簿规则，返回匹配的文件 ID 列表
 */
export function evaluateSmartRules(rules: SmartAlbumRule[], files: FitsMetadata[]): string[] {
  return files.filter((file) => rules.every((rule) => matchesRule(file, rule))).map((f) => f.id);
}

// Operator implementations
const operators: Record<string, (fieldValue: unknown, ruleValue: unknown) => boolean> = {
  equals: (v, r) => String(v).toLowerCase() === String(r).toLowerCase(),
  contains: (v, r) => String(v).toLowerCase().includes(String(r).toLowerCase()),
  gt: (v, r) => Number(v) > Number(r),
  lt: (v, r) => Number(v) < Number(r),
  between: (v, r) => {
    const [min, max] = r as [number, number];
    const num = Number(v);
    return num >= min && num <= max;
  },
  in: (v, r) => (r as string[]).some((rv) => String(v).toLowerCase() === rv.toLowerCase()),
};

function matchesRule(file: FitsMetadata, rule: SmartAlbumRule): boolean {
  const fieldValue = getFieldValue(file, rule.field);
  if (fieldValue === undefined || fieldValue === null) return false;

  // Handle NOT operators
  const isNegation = rule.operator.startsWith("not");
  const baseOperator = isNegation
    ? (rule.operator.replace("not", "").toLowerCase() as SmartAlbumRuleOperator)
    : rule.operator;

  const operatorFn = operators[baseOperator];
  if (!operatorFn) return false;

  const result = operatorFn(fieldValue, rule.value);
  return isNegation ? !result : result;
}

function getFieldValue(
  file: FitsMetadata,
  field: SmartAlbumRule["field"],
): string | number | undefined {
  switch (field) {
    case "object":
      return file.object;
    case "filter":
      return file.filter;
    case "dateObs":
      return file.dateObs;
    case "exptime":
      return file.exptime;
    case "instrument":
      return file.instrument;
    case "telescope":
      return file.telescope;
    case "tag":
      return file.tags.join(",");
    case "location":
      return file.location?.city ?? file.location?.placeName ?? file.location?.region;
    case "frameType":
      return file.frameType;
    default:
      return undefined;
  }
}

/**
 * 根据文件元数据生成默认智能相簿建议
 */
export function suggestSmartAlbums(files: FitsMetadata[]): Array<{
  name: string;
  rules: SmartAlbumRule[];
}> {
  const suggestions: Array<{ name: string; rules: SmartAlbumRule[] }> = [];

  // 按目标分组
  const objects = [...new Set(files.map((f) => f.object).filter(Boolean))] as string[];
  for (const obj of objects) {
    suggestions.push({
      name: obj,
      rules: [{ field: "object", operator: "equals", value: obj }],
    });
  }

  // 按滤镜分组
  const filters = [...new Set(files.map((f) => f.filter).filter(Boolean))] as string[];
  for (const filter of filters) {
    suggestions.push({
      name: `Filter: ${filter}`,
      rules: [{ field: "filter", operator: "equals", value: filter }],
    });
  }

  // 按位置分组
  const locations = [
    ...new Set(files.map((f) => f.location?.city ?? f.location?.placeName).filter(Boolean)),
  ] as string[];
  for (const loc of locations) {
    suggestions.push({
      name: `📍 ${loc}`,
      rules: [{ field: "location", operator: "contains", value: loc }],
    });
  }

  // 收藏
  const hasFavorites = files.some((f) => f.isFavorite);
  if (hasFavorites) {
    suggestions.push({
      name: "Favorites",
      rules: [{ field: "tag", operator: "contains", value: "favorite" }],
    });
  }

  return suggestions;
}
