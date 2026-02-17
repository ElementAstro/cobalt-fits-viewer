/**
 * 结构化日志服务 - 单例模式，环形缓冲区 + 本地持久化
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import type {
  LogEntry,
  LogLevel,
  LoggerConfig,
  LoggerListener,
  LogQuery,
  LogSerializationOptions,
} from "./types";
import { LOG_LEVEL_PRIORITY } from "./types";

const DEFAULT_CONFIG: LoggerConfig = {
  maxEntries: 2000,
  minLevel: __DEV__ ? "debug" : "info",
  consoleOutput: __DEV__,
  persistEnabled: true,
  persistKey: "cobalt_logger_entries_v1",
  persistDebounceMs: 500,
};

const DEFAULT_SERIALIZATION_DEPTH = 6;
const REDACTED_TEXT = "[REDACTED]";
const MAX_DEPTH_TEXT = "[MaxDepth]";
const CIRCULAR_TEXT = "[Circular]";
const PERSIST_VERSION = 1;

const SENSITIVE_KEY_PATTERN =
  /token|api[_-]?key|authorization|cookie|password|secret|session|access[_-]?key|refresh[_-]?token|private[_-]?key|credential|passphrase|client[_-]?secret/i;
const SENSITIVE_VALUE_PATTERNS = [
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/i,
  /\bBasic\s+[A-Za-z0-9+/=]{8,}/i,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+\b/, // JWT-like
  /sk_[a-zA-Z0-9]{20,}/,
];

interface PersistedPayload {
  version: number;
  entries: LogEntry[];
}

let entries: LogEntry[] = [];
let config: LoggerConfig = { ...DEFAULT_CONFIG };
let listeners: LoggerListener[] = [];
let idCounter = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let hydrationPromise: Promise<void> | null = null;

function generateId(): string {
  return `log_${Date.now()}_${++idCounter}`;
}

function isLogLevel(level: unknown): level is LogLevel {
  return level === "debug" || level === "info" || level === "warn" || level === "error";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.minLevel];
}

function trimEntriesToRingBuffer(): void {
  const safeMaxEntries = Number.isFinite(config.maxEntries) ? Math.max(1, config.maxEntries) : 1;
  if (entries.length > safeMaxEntries) {
    entries = entries.slice(entries.length - safeMaxEntries);
  }
}

function emitChange(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // isolate listener failures
    }
  }
}

function shouldRedactKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(key);
}

function shouldRedactValue(value: string): boolean {
  return SENSITIVE_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function extractErrorFromData(data: unknown): Error | null {
  if (data instanceof Error) return data;
  if (!data || typeof data !== "object") return null;

  const maybeError = (data as { error?: unknown }).error;
  return maybeError instanceof Error ? maybeError : null;
}

function normalizePersistEntry(value: unknown): LogEntry | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<LogEntry>;

  if (!isLogLevel(raw.level) || typeof raw.tag !== "string" || typeof raw.message !== "string") {
    return null;
  }

  const timestamp = Number.isFinite(raw.timestamp) ? (raw.timestamp as number) : Date.now();
  const id = typeof raw.id === "string" && raw.id.trim() ? raw.id : generateId();

  return {
    id,
    timestamp,
    level: raw.level,
    tag: raw.tag,
    message: raw.message,
    data: sanitizeLogData(raw.data, { redact: true }),
    stackTrace: typeof raw.stackTrace === "string" ? raw.stackTrace : undefined,
  };
}

function clearPersistTimer() {
  if (!persistTimer) return;
  clearTimeout(persistTimer);
  persistTimer = null;
}

async function persistEntriesNow(): Promise<void> {
  if (!config.persistEnabled) return;
  const payload: PersistedPayload = {
    version: PERSIST_VERSION,
    entries: entries.map((entry) => sanitizeLogEntry(entry, { redact: true })),
  };
  await AsyncStorage.setItem(config.persistKey, JSON.stringify(payload));
}

function schedulePersist(): void {
  if (!config.persistEnabled) return;

  clearPersistTimer();
  const delay = Number.isFinite(config.persistDebounceMs)
    ? Math.max(0, Math.floor(config.persistDebounceMs))
    : DEFAULT_CONFIG.persistDebounceMs;

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void persistEntriesNow();
  }, delay);
}

async function removePersistedEntries(storageKey: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey);
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
    if (valueType === "string") {
      const stringValue = value as string;
      return redact && shouldRedactValue(stringValue) ? REDACTED_TEXT : stringValue;
    }
    if (valueType === "boolean") return value;

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

function queryEntriesInternal(query: LogQuery = {}): LogEntry[] {
  let result = [...entries];

  if (query.level) {
    const minPriority = LOG_LEVEL_PRIORITY[query.level];
    result = result.filter((e) => LOG_LEVEL_PRIORITY[e.level] >= minPriority);
  }

  if (query.tag) {
    const tagLower = query.tag.trim().toLowerCase();
    if (tagLower) {
      result = result.filter((e) => e.tag.toLowerCase().includes(tagLower));
    }
  }

  if (query.query) {
    const q = query.query.trim().toLowerCase();
    if (q) {
      result = result.filter((entry) => {
        const inTag = entry.tag.toLowerCase().includes(q);
        const inMessage = entry.message.toLowerCase().includes(q);
        const inData =
          entry.data !== undefined &&
          serializeLogData(entry.data, { redact: true }).toLowerCase().includes(q);
        const inStack = entry.stackTrace?.toLowerCase().includes(q) ?? false;
        return inTag || inMessage || inData || inStack;
      });
    }
  }

  if (query.limit && query.limit > 0) {
    result = result.slice(-query.limit);
  }

  return result;
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
  schedulePersist();

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

async function hydrateEntriesInternal(): Promise<void> {
  const raw = await AsyncStorage.getItem(config.persistKey);
  if (!raw) return;

  let payload: PersistedPayload | null = null;
  try {
    payload = JSON.parse(raw) as PersistedPayload;
  } catch {
    payload = null;
  }

  if (!payload || payload.version !== PERSIST_VERSION || !Array.isArray(payload.entries)) {
    return;
  }

  const restored: LogEntry[] = [];
  for (const item of payload.entries) {
    const entry = normalizePersistEntry(item);
    if (entry) restored.push(entry);
  }
  entries = restored;
  trimEntriesToRingBuffer();
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

  async hydrate(): Promise<void> {
    if (!config.persistEnabled) return;
    if (hydrationPromise) return hydrationPromise;

    hydrationPromise = (async () => {
      await hydrateEntriesInternal();
      emitChange();
    })();

    try {
      await hydrationPromise;
    } finally {
      hydrationPromise = null;
    }
  },

  /**
   * 获取日志条目（支持过滤）
   */
  getEntries(filter?: { level?: LogLevel; tag?: string; limit?: number }): LogEntry[] {
    return queryEntriesInternal({
      level: filter?.level,
      tag: filter?.tag,
      limit: filter?.limit,
    });
  },

  /**
   * 获取日志条目（支持 level/tag/query/limit）
   */
  queryEntries(query?: LogQuery): LogEntry[] {
    return queryEntriesInternal(query);
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
    schedulePersist();
  },

  /**
   * 导出日志为 JSON 字符串
   */
  exportJSON(query?: LogQuery): string {
    return JSON.stringify(
      queryEntriesInternal(query).map((entry) => sanitizeLogEntry(entry, { redact: true })),
      null,
      2,
    );
  },

  /**
   * 导出日志为可读文本
   */
  exportText(query?: LogQuery): string {
    return queryEntriesInternal(query)
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
    const prevConfig = config;
    const nextConfig = { ...config, ...updates };

    if (!Number.isFinite(nextConfig.maxEntries) || nextConfig.maxEntries <= 0) {
      nextConfig.maxEntries = DEFAULT_CONFIG.maxEntries;
    } else {
      nextConfig.maxEntries = Math.floor(nextConfig.maxEntries);
    }

    if (!isLogLevel(nextConfig.minLevel)) {
      nextConfig.minLevel = DEFAULT_CONFIG.minLevel;
    }

    if (typeof nextConfig.consoleOutput !== "boolean") {
      nextConfig.consoleOutput = DEFAULT_CONFIG.consoleOutput;
    }

    if (typeof nextConfig.persistEnabled !== "boolean") {
      nextConfig.persistEnabled = DEFAULT_CONFIG.persistEnabled;
    }

    if (typeof nextConfig.persistKey !== "string" || !nextConfig.persistKey.trim()) {
      nextConfig.persistKey = DEFAULT_CONFIG.persistKey;
    }

    if (!Number.isFinite(nextConfig.persistDebounceMs) || nextConfig.persistDebounceMs < 0) {
      nextConfig.persistDebounceMs = DEFAULT_CONFIG.persistDebounceMs;
    } else {
      nextConfig.persistDebounceMs = Math.floor(nextConfig.persistDebounceMs);
    }

    config = nextConfig;
    trimEntriesToRingBuffer();
    emitChange();

    if (!nextConfig.persistEnabled) {
      clearPersistTimer();
      void removePersistedEntries(nextConfig.persistKey);
      if (prevConfig.persistKey !== nextConfig.persistKey) {
        void removePersistedEntries(prevConfig.persistKey);
      }
      return;
    }

    if (prevConfig.persistKey !== nextConfig.persistKey) {
      void removePersistedEntries(prevConfig.persistKey);
    }
    schedulePersist();
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

export function createLogger(tag: string) {
  return {
    debug: (message: string, data?: unknown) => Logger.debug(tag, message, data),
    info: (message: string, data?: unknown) => Logger.info(tag, message, data),
    warn: (message: string, data?: unknown) => Logger.warn(tag, message, data),
    error: (message: string, data?: unknown) => Logger.error(tag, message, data),
  };
}
