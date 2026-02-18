/**
 * 帧类型自动分类
 * 支持: 内置映射 + 自定义规则 + 分类来源追踪
 */

import type {
  BuiltinFrameType,
  FrameClassificationConfig,
  FrameClassificationRule,
  FrameType,
  FrameTypeDefinition,
  FrameTypeSource,
} from "../fits/types";

export interface FrameClassificationResult {
  type: FrameType;
  source: FrameTypeSource;
  matchedRuleId?: string;
}

const BUILTIN_FRAME_TYPES: FrameTypeDefinition[] = [
  { key: "light", label: "Light", builtin: true },
  { key: "dark", label: "Dark", builtin: true },
  { key: "flat", label: "Flat", builtin: true },
  { key: "bias", label: "Bias", builtin: true },
  { key: "darkflat", label: "Dark Flat", builtin: true },
  { key: "unknown", label: "Unknown", builtin: true },
];

/** IMAGETYP / FRAME header 常见值映射（兼容主流软件同义词） */
const HEADER_VALUE_MAP: Record<string, BuiltinFrameType> = {
  light: "light",
  "light frame": "light",
  "master light": "light",
  science: "light",
  "science frame": "light",
  object: "light",
  "object frame": "light",

  dark: "dark",
  "dark frame": "dark",
  "master dark": "dark",

  flat: "flat",
  "flat frame": "flat",
  "master flat": "flat",
  "flat field": "flat",
  "master flat field": "flat",
  skyflat: "flat",
  "sky flat": "flat",
  domeflat: "flat",
  "dome flat": "flat",
  "twilight flat": "flat",

  bias: "bias",
  "bias frame": "bias",
  "master bias": "bias",
  offset: "bias",
  zero: "bias",
  "zero frame": "bias",

  darkflat: "darkflat",
  "dark flat": "darkflat",
  flatdark: "darkflat",
  "flat dark": "darkflat",
  "dark-flat": "darkflat",
  "flat-dark": "darkflat",
  "dark flat frame": "darkflat",
  "flat dark frame": "darkflat",
  "master dark flat": "darkflat",
  "master flat dark": "darkflat",
};

/** 文件名模式 (优先级从高到低) */
const SEP = "(?:^|[\\s_\\-./])";
const END = "(?:[\\s_\\-./]|$)";
const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: BuiltinFrameType }> = [
  { pattern: new RegExp(`${SEP}(?:darkflat|flatdark)${END}`, "i"), type: "darkflat" },
  {
    pattern: /(?:master[\s_.-]*)?(?:dark[\s_.-]*flat|flat[\s_.-]*dark)/i,
    type: "darkflat",
  },
  { pattern: new RegExp(`${SEP}bias${END}`, "i"), type: "bias" },
  { pattern: new RegExp(`${SEP}offset${END}`, "i"), type: "bias" },
  { pattern: new RegExp(`${SEP}zero${END}`, "i"), type: "bias" },
  { pattern: new RegExp(`${SEP}flat${END}`, "i"), type: "flat" },
  { pattern: /(?:sky|dome|twilight)[\s_.-]*flat/i, type: "flat" },
  { pattern: new RegExp(`${SEP}dark${END}`, "i"), type: "dark" },
  { pattern: new RegExp(`${SEP}light${END}`, "i"), type: "light" },
  { pattern: new RegExp(`${SEP}science${END}`, "i"), type: "light" },
  { pattern: new RegExp(`${SEP}object${END}`, "i"), type: "light" },
];

interface CompiledRule {
  rule: FrameClassificationRule;
  matcher: (value: string) => boolean;
}

const compiledRuleCache = new WeakMap<FrameClassificationConfig, CompiledRule[]>();

export const DEFAULT_FRAME_CLASSIFICATION_CONFIG: FrameClassificationConfig = {
  frameTypes: BUILTIN_FRAME_TYPES.map((item) => ({ ...item })),
  rules: [],
};

function normalizeHeaderValue(value: string): string {
  return value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function ensureBuiltins(frameTypes?: FrameTypeDefinition[]): FrameTypeDefinition[] {
  const map = new Map<string, FrameTypeDefinition>();
  for (const builtin of BUILTIN_FRAME_TYPES) {
    map.set(builtin.key, { ...builtin, builtin: true });
  }

  for (const item of frameTypes ?? []) {
    const key = String(item.key ?? "")
      .trim()
      .toLowerCase();
    if (!key) continue;
    if (map.has(key)) continue;
    map.set(key, {
      key,
      label: String(item.label ?? key).trim() || key,
      builtin: false,
    });
  }

  return [...map.values()];
}

function cloneConfig(config: FrameClassificationConfig): FrameClassificationConfig {
  return {
    frameTypes: config.frameTypes.map((item) => ({ ...item })),
    rules: config.rules.map((item) => ({ ...item })),
  };
}

function parseRule(raw: unknown): FrameClassificationRule | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const id = String(item.id ?? "").trim();
  const pattern = String(item.pattern ?? "").trim();
  const frameType = String(item.frameType ?? "")
    .trim()
    .toLowerCase();
  if (!id || !pattern || !frameType) return null;

  const target = item.target === "filename" ? "filename" : "header";
  const matchType =
    item.matchType === "regex" || item.matchType === "contains" || item.matchType === "exact"
      ? item.matchType
      : "contains";
  const headerField =
    item.headerField === "IMAGETYP" || item.headerField === "FRAME" || item.headerField === "ANY"
      ? item.headerField
      : "ANY";

  const priorityRaw = Number(item.priority);
  const priority = Number.isFinite(priorityRaw) ? priorityRaw : 0;

  return {
    id,
    enabled: item.enabled !== false,
    priority,
    target,
    headerField,
    matchType,
    pattern,
    caseSensitive: item.caseSensitive === true,
    frameType,
  };
}

function resolveUnknownType(config?: FrameClassificationConfig): string {
  const defs = config?.frameTypes ?? BUILTIN_FRAME_TYPES;
  if (defs.some((item) => item.key === "unknown")) return "unknown";
  return defs[0]?.key ?? "unknown";
}

function getCompiledRules(config: FrameClassificationConfig): CompiledRule[] {
  const cached = compiledRuleCache.get(config);
  if (cached) return cached;

  const rules = [...config.rules].sort(
    (a, b) => b.priority - a.priority || a.id.localeCompare(b.id),
  );
  const compiled: CompiledRule[] = [];

  for (const rule of rules) {
    const pattern = rule.pattern;
    if (!pattern) continue;
    const caseSensitive = rule.caseSensitive === true;
    const compareNeedle = caseSensitive ? pattern : pattern.toLowerCase();

    if (rule.matchType === "regex") {
      try {
        const regex = new RegExp(pattern, caseSensitive ? undefined : "i");
        compiled.push({
          rule,
          matcher: (value) => regex.test(value),
        });
      } catch {
        continue;
      }
      continue;
    }

    if (rule.matchType === "exact") {
      compiled.push({
        rule,
        matcher: (value) => (caseSensitive ? value : value.toLowerCase()) === compareNeedle,
      });
      continue;
    }

    compiled.push({
      rule,
      matcher: (value) => (caseSensitive ? value : value.toLowerCase()).includes(compareNeedle),
    });
  }

  compiledRuleCache.set(config, compiled);
  return compiled;
}

function matchCustomRules(
  imageType: string | undefined,
  frameHeader: string | undefined,
  filename: string,
  config: FrameClassificationConfig,
): FrameClassificationResult | null {
  const compiled = getCompiledRules(config);
  if (compiled.length === 0) return null;

  for (const item of compiled) {
    const { rule, matcher } = item;
    if (!rule.enabled) continue;

    if (rule.target === "filename") {
      if (matcher(filename)) {
        return { type: rule.frameType, source: "rule", matchedRuleId: rule.id };
      }
      continue;
    }

    const values: string[] = [];
    if ((rule.headerField ?? "ANY") === "IMAGETYP" || (rule.headerField ?? "ANY") === "ANY") {
      if (imageType) values.push(imageType);
    }
    if ((rule.headerField ?? "ANY") === "FRAME" || (rule.headerField ?? "ANY") === "ANY") {
      if (frameHeader) values.push(frameHeader);
    }

    if (values.some((value) => matcher(value))) {
      return { type: rule.frameType, source: "rule", matchedRuleId: rule.id };
    }
  }

  return null;
}

/**
 * 对外配置清洗：保证默认内置类型存在，并清洗非法规则
 */
export function sanitizeFrameClassificationConfig(
  value: unknown,
  fallback: FrameClassificationConfig = DEFAULT_FRAME_CLASSIFICATION_CONFIG,
): FrameClassificationConfig {
  if (!value || typeof value !== "object") {
    return cloneConfig({
      frameTypes: ensureBuiltins(fallback.frameTypes),
      rules: fallback.rules,
    });
  }

  const raw = value as Record<string, unknown>;
  const frameTypes = ensureBuiltins(
    Array.isArray(raw.frameTypes) ? (raw.frameTypes as FrameTypeDefinition[]) : fallback.frameTypes,
  );
  const validTypeSet = new Set(frameTypes.map((item) => item.key));
  const rulesRaw = Array.isArray(raw.rules) ? raw.rules : fallback.rules;
  const rules: FrameClassificationRule[] = [];
  for (const item of rulesRaw) {
    const parsed = parseRule(item);
    if (!parsed) continue;
    if (!validTypeSet.has(parsed.frameType)) continue;
    rules.push(parsed);
  }

  return {
    frameTypes,
    rules,
  };
}

/**
 * 获取所有可用帧类型定义（含内置补全）
 */
export function getFrameTypeDefinitions(config?: FrameClassificationConfig): FrameTypeDefinition[] {
  return ensureBuiltins(config?.frameTypes);
}

/**
 * 从 IMAGETYP / FRAME header 值推断帧类型（仅内置映射）
 */
export function classifyByHeader(
  headerValue: string | undefined,
  _config?: FrameClassificationConfig,
): FrameType | null {
  if (!headerValue) return null;
  const normalized = normalizeHeaderValue(headerValue);
  return HEADER_VALUE_MAP[normalized] ?? null;
}

/**
 * 从文件名推断帧类型（仅内置映射）
 */
export function classifyByFilename(
  filename: string,
  _config?: FrameClassificationConfig,
): FrameType | null {
  for (const { pattern, type } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) return type;
  }
  return null;
}

/**
 * 综合推断帧类型，返回详细来源信息
 * 优先级: custom rules > builtin header aliases > builtin filename patterns > unknown
 */
export function classifyWithDetail(
  imageType: string | undefined,
  frameHeader: string | undefined,
  filename: string,
  config: FrameClassificationConfig = DEFAULT_FRAME_CLASSIFICATION_CONFIG,
): FrameClassificationResult {
  const normalizedConfig = sanitizeFrameClassificationConfig(config);

  const custom = matchCustomRules(imageType, frameHeader, filename, normalizedConfig);
  if (custom) return custom;

  const byImageType = classifyByHeader(imageType, normalizedConfig);
  if (byImageType) {
    return { type: byImageType, source: "header" };
  }

  const byFrameHeader = classifyByHeader(frameHeader, normalizedConfig);
  if (byFrameHeader) {
    return { type: byFrameHeader, source: "header" };
  }

  const byFilename = classifyByFilename(filename, normalizedConfig);
  if (byFilename) {
    return { type: byFilename, source: "filename" };
  }

  return { type: resolveUnknownType(normalizedConfig), source: "fallback" };
}

/**
 * 综合推断帧类型（兼容旧接口）
 */
export function classifyFrameType(
  imageType: string | undefined,
  frameHeader: string | undefined,
  filename: string,
  config?: FrameClassificationConfig,
): FrameType {
  return classifyWithDetail(imageType, frameHeader, filename, config).type;
}
