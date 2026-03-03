/**
 * 目标导入工具函数
 * 复用 targetManager.createTarget + targetMatcher.normalizeTargetMatch 进行去重
 */

import type { Target, TargetType, TargetStatus } from "../fits/types";
import { createTarget, guessTargetType } from "./targetManager";
import { findTargetByNameOrAlias } from "./targetManager";

export interface ImportPreviewItem {
  target: Partial<Target>;
  action: "create" | "update" | "skip";
  matchedExisting?: Target;
}

export interface ImportResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

interface RawTargetData {
  name?: string;
  type?: string;
  status?: string;
  category?: string;
  tags?: string[] | string;
  ra?: number | string;
  dec?: number | string;
  aliases?: string[] | string;
  notes?: string;
  plannedFilters?: string[];
  plannedExposure?: Record<string, number>;
}

const VALID_TYPES: TargetType[] = [
  "galaxy",
  "nebula",
  "cluster",
  "planet",
  "moon",
  "sun",
  "comet",
  "other",
];
const VALID_STATUSES: TargetStatus[] = ["planned", "acquiring", "completed", "processed"];

function normalizeType(value?: string): TargetType {
  if (!value) return "other";
  const lower = value.toLowerCase().trim();
  return VALID_TYPES.includes(lower as TargetType) ? (lower as TargetType) : "other";
}

function normalizeStatus(value?: string): TargetStatus {
  if (!value) return "planned";
  const lower = value.toLowerCase().trim();
  return VALID_STATUSES.includes(lower as TargetStatus) ? (lower as TargetStatus) : "planned";
}

function normalizeTags(value?: string[] | string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((t) => t.trim()).filter(Boolean);
  return value
    .split(/[;,]/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function normalizeAliases(value?: string[] | string): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((a) => a.trim()).filter(Boolean);
  return value
    .split(/[;,]/)
    .map((a) => a.trim())
    .filter(Boolean);
}

function parseNumber(value?: number | string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const num = typeof value === "number" ? value : parseFloat(value);
  return Number.isFinite(num) ? num : undefined;
}

function rawToPartialTarget(raw: RawTargetData): Partial<Target> | null {
  const name = raw.name?.trim();
  if (!name) return null;

  return {
    name,
    type: normalizeType(raw.type),
    status: normalizeStatus(raw.status),
    category: raw.category?.trim() || undefined,
    tags: normalizeTags(raw.tags),
    ra: parseNumber(raw.ra),
    dec: parseNumber(raw.dec),
    aliases: normalizeAliases(raw.aliases),
    notes: raw.notes?.trim() || undefined,
    plannedFilters: raw.plannedFilters ?? [],
    plannedExposure: raw.plannedExposure ?? {},
  };
}

/**
 * 解析 JSON 字符串为导入预览列表
 */
export function parseTargetsJSON(json: string, existingTargets: Target[]): ImportPreviewItem[] {
  const items: ImportPreviewItem[] = [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return [];
  }

  const rawList = Array.isArray(parsed) ? parsed : [parsed];

  for (const raw of rawList) {
    if (!raw || typeof raw !== "object") continue;
    const partial = rawToPartialTarget(raw as RawTargetData);
    if (!partial || !partial.name) continue;

    const existing = findTargetByNameOrAlias(partial.name, existingTargets);
    if (existing) {
      items.push({ target: partial, action: "update", matchedExisting: existing });
    } else {
      items.push({ target: partial, action: "create" });
    }
  }

  return items;
}

/**
 * 解析 CSV 字符串为导入预览列表
 */
export function parseTargetsCSV(csv: string, existingTargets: Target[]): ImportPreviewItem[] {
  const items: ImportPreviewItem[] = [];
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map((h) => h.toLowerCase().trim());
  const nameIdx = headers.indexOf("name");
  if (nameIdx === -1) return [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const raw: RawTargetData = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j]?.trim() ?? "";
      if (!value) continue;

      switch (header) {
        case "name":
          raw.name = value;
          break;
        case "type":
          raw.type = value;
          break;
        case "status":
          raw.status = value;
          break;
        case "category":
          raw.category = value;
          break;
        case "tags":
          raw.tags = value;
          break;
        case "ra":
          raw.ra = value;
          break;
        case "dec":
          raw.dec = value;
          break;
        case "aliases":
          raw.aliases = value;
          break;
        case "notes":
          raw.notes = value;
          break;
      }
    }

    const partial = rawToPartialTarget(raw);
    if (!partial || !partial.name) continue;

    const existing = findTargetByNameOrAlias(partial.name, existingTargets);
    if (existing) {
      items.push({ target: partial, action: "update", matchedExisting: existing });
    } else {
      items.push({ target: partial, action: "create" });
    }
  }

  return items;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}

/**
 * 执行导入：创建新目标或更新已有目标
 */
export function executeImport(
  items: ImportPreviewItem[],
  addTarget: (target: Target) => void,
  updateTarget: (id: string, updates: Partial<Target>) => void,
): ImportResult {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    if (item.action === "skip") {
      skipped++;
      continue;
    }

    if (item.action === "create" && item.target.name) {
      const newTarget = createTarget(
        item.target.name,
        item.target.type ?? guessTargetType(item.target.name),
      );
      if (item.target.ra !== undefined) newTarget.ra = item.target.ra;
      if (item.target.dec !== undefined) newTarget.dec = item.target.dec;
      if (item.target.status) newTarget.status = item.target.status;
      if (item.target.category) newTarget.category = item.target.category;
      if (item.target.tags && item.target.tags.length > 0) newTarget.tags = item.target.tags;
      if (item.target.aliases && item.target.aliases.length > 0)
        newTarget.aliases = item.target.aliases;
      if (item.target.notes) newTarget.notes = item.target.notes;
      if (item.target.plannedFilters) newTarget.plannedFilters = item.target.plannedFilters;
      if (item.target.plannedExposure) newTarget.plannedExposure = item.target.plannedExposure;
      addTarget(newTarget);
      created++;
    } else if (item.action === "update" && item.matchedExisting) {
      const updates: Partial<Target> = {};
      if (item.target.ra !== undefined && item.matchedExisting.ra === undefined) {
        updates.ra = item.target.ra;
      }
      if (item.target.dec !== undefined && item.matchedExisting.dec === undefined) {
        updates.dec = item.target.dec;
      }
      if (item.target.category && !item.matchedExisting.category) {
        updates.category = item.target.category;
      }
      if (item.target.notes && !item.matchedExisting.notes) {
        updates.notes = item.target.notes;
      }
      if (item.target.tags && item.target.tags.length > 0) {
        updates.tags = [...new Set([...item.matchedExisting.tags, ...item.target.tags])];
      }
      if (item.target.aliases && item.target.aliases.length > 0) {
        updates.aliases = [...new Set([...item.matchedExisting.aliases, ...item.target.aliases])];
      }
      if (Object.keys(updates).length > 0) {
        updateTarget(item.matchedExisting.id, updates);
        updated++;
      } else {
        skipped++;
      }
    }
  }

  return { created, updated, skipped, total: items.length };
}
