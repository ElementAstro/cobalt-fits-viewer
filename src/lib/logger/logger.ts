/**
 * 结构化日志服务 - 单例模式，环形缓冲区
 */

import type {
  LogEntry,
  LogLevel,
  LoggerConfig,
  LoggerListener,
  LogSerializationOptions,
} from "./types";
import { LOG_LEVEL_PRIORITY } from "./types";

const DEFAULT_CONFIG: LoggerConfig = {
  maxEntries: 500,
  minLevel: __DEV__ ? "debug" : "info",
  consoleOutput: __DEV__,
};

let entries: LogEntry[] = [];
let config: LoggerConfig = { ...DEFAULT_CONFIG };
let listeners: LoggerListener[] = [];
let idCounter = 0;

const DEFAULT_SERIALIZATION_DEPTH = 6;
const REDACTED_TEXT = "[REDACTED]";
const MAX_DEPTH_TEXT = "[MaxDepth]";
const CIRCULAR_TEXT = "[Circular]";

const SENSITIVE_KEY_PATTERN =
  /token|api[_-]?key|authorization|cookie|password|secret|session|access[_-]?key/i;

function generateId(): string {
  return `log_${Date.now()}_${++idCounter}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.minLevel];
}

function emitChange(): void {
  for (const listener of [...listeners]) {
    listener();
  }
}

function shouldRedactKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function extractErrorFromData(data: unknown): Error | null {
  if (data instanceof Error) return data;
  if (!data || typeof data !== "object") return null;

  const maybeError = (data as { error?: unknown }).error;
  return maybeError instanceof Error ? maybeError : null;
}

function trimEntriesToRingBuffer(): void {
  const safeMaxEntries = Number.isFinite(config.maxEntries) ? Math.max(1, config.maxEntries) : 1;
  if (entries.length > safeMaxEntries) {
    entries = entries.slice(entries.length - safeMaxEntries);
  }
}

export function sanitizeLogData(data: unknown, options: LogSerializationOptions = {}): unknown {
  const maxDepth = options.maxDepth ?? DEFAULT_SERIALIZATION_DEPTH;
  const redact = options.redact ?? true;
  const seen = new WeakSet<object>();

  const walk = (value: unknown, depth: number, key?: string): unknown => {
    if (redact && key && shouldRedactKey(key)) {
      return REDACTED_TEXT;
    }

    if (value === undefined || value === null) return value;

    const valueType = typeof value;
    if (valueType === "string" || valueType === "boolean") return value;

    if (valueType === "number") {
      return Number.isFinite(value) ? value : String(value);
    }

    if (valueType === "bigint" || valueType === "symbol") {
      return String(value);
    }

    if (valueType === "function") {
      const fn = value as (...args: unknown[]) => unknown;
      return `[Function ${fn.name || "anonymous"}]`;
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }

    if (value instanceof ArrayBuffer) {
      return `[ArrayBuffer ${value.byteLength} bytes]`;
    }

    if (ArrayBuffer.isView(value)) {
      return `[${value.constructor.name} ${value.byteLength} bytes]`;
    }

    if (depth >= maxDepth) {
      return MAX_DEPTH_TEXT;
    }

    if (Array.isArray(value)) {
      return value.map((item) => walk(item, depth + 1));
    }

    if (valueType === "object") {
      const objectValue = value as Record<string, unknown>;
      if (seen.has(objectValue)) {
        return CIRCULAR_TEXT;
      }
      seen.add(objectValue);

      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(objectValue)) {
        out[k] = walk(v, depth + 1, k);
      }
      return out;
    }

    return String(value);
  };

  return walk(data, 0);
}

export function serializeLogData(data: unknown, options: LogSerializationOptions = {}): string {
  const sanitized = sanitizeLogData(data, options);
  try {
    return JSON.stringify(sanitized);
  } catch {
    return String(sanitized);
  }
}

export function sanitizeLogEntry(entry: LogEntry, options: LogSerializationOptions = {}): LogEntry {
  const extractedError = extractErrorFromData(entry.data);
  const nextStack = entry.stackTrace ?? extractedError?.stack;
  return {
    ...entry,
    data: sanitizeLogData(entry.data, options),
    stackTrace: nextStack,
  };
}

function addEntry(level: LogLevel, tag: string, message: string, data?: unknown): LogEntry {
  const extractedError = extractErrorFromData(data);

  const entry: LogEntry = {
    id: generateId(),
    timestamp: Date.now(),
    level,
    tag,
    message,
    data: sanitizeLogData(data, { redact: true }),
  };

  if (level === "error" && extractedError?.stack) {
    entry.stackTrace = extractedError.stack;
  }

  entries.push(entry);
  trimEntriesToRingBuffer();
  emitChange();

  if (config.consoleOutput) {
    const prefix = `[${level.toUpperCase()}][${tag}]`;
    switch (level) {
      case "debug":
        console.debug(prefix, message, entry.data ?? "");
        break;
      case "info":
        console.info(prefix, message, entry.data ?? "");
        break;
      case "warn":
        console.warn(prefix, message, entry.data ?? "");
        break;
      case "error":
        console.error(prefix, message, entry.data ?? "");
        break;
    }
  }

  return entry;
}

// ===== Public API =====

export const Logger = {
  debug(tag: string, message: string, data?: unknown): void {
    if (shouldLog("debug")) addEntry("debug", tag, message, data);
  },

  info(tag: string, message: string, data?: unknown): void {
    if (shouldLog("info")) addEntry("info", tag, message, data);
  },

  warn(tag: string, message: string, data?: unknown): void {
    if (shouldLog("warn")) addEntry("warn", tag, message, data);
  },

  error(tag: string, message: string, data?: unknown): void {
    if (shouldLog("error")) addEntry("error", tag, message, data);
  },

  /**
   * 获取日志条目（支持过滤）
   */
  getEntries(filter?: { level?: LogLevel; tag?: string; limit?: number }): LogEntry[] {
    let result = [...entries];

    if (filter?.level) {
      const minPriority = LOG_LEVEL_PRIORITY[filter.level];
      result = result.filter((e) => LOG_LEVEL_PRIORITY[e.level] >= minPriority);
    }

    if (filter?.tag) {
      const tagLower = filter.tag.toLowerCase();
      result = result.filter((e) => e.tag.toLowerCase().includes(tagLower));
    }

    if (filter?.limit && filter.limit > 0) {
      result = result.slice(-filter.limit);
    }

    return result;
  },

  /**
   * 获取日志条目总数
   */
  getCount(): number {
    return entries.length;
  },

  /**
   * 清除所有日志
   */
  clear(): void {
    entries = [];
    emitChange();
  },

  /**
   * 导出日志为 JSON 字符串
   */
  exportJSON(): string {
    return JSON.stringify(
      entries.map((entry) => sanitizeLogEntry(entry, { redact: true })),
      null,
      2,
    );
  },

  /**
   * 导出日志为可读文本
   */
  exportText(): string {
    return entries
      .map((e) => {
        const time = new Date(e.timestamp).toISOString();
        const line = `[${time}][${e.level.toUpperCase()}][${e.tag}] ${e.message}`;
        if (e.data !== undefined) {
          return `${line}\n  data: ${serializeLogData(e.data, { redact: true })}`;
        }
        return line;
      })
      .join("\n");
  },

  /**
   * 更新 Logger 配置
   */
  configure(updates: Partial<LoggerConfig>): void {
    const nextConfig = { ...config, ...updates };
    if (!Number.isFinite(nextConfig.maxEntries) || nextConfig.maxEntries <= 0) {
      nextConfig.maxEntries = DEFAULT_CONFIG.maxEntries;
    } else {
      nextConfig.maxEntries = Math.floor(nextConfig.maxEntries);
    }
    config = nextConfig;
    trimEntriesToRingBuffer();
    emitChange();
  },

  /**
   * 获取当前配置
   */
  getConfig(): LoggerConfig {
    return { ...config };
  },

  /**
   * 订阅日志变化
   */
  subscribe(listener: LoggerListener): () => void {
    listeners = [...listeners, listener];
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  },
};
