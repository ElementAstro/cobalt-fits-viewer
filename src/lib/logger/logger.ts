/**
 * 结构化日志服务 - 单例模式，环形缓冲区
 */

import type { LogEntry, LogLevel, LoggerConfig } from "./types";
import { LOG_LEVEL_PRIORITY } from "./types";

const DEFAULT_CONFIG: LoggerConfig = {
  maxEntries: 500,
  minLevel: __DEV__ ? "debug" : "info",
  consoleOutput: __DEV__,
};

let entries: LogEntry[] = [];
let config: LoggerConfig = { ...DEFAULT_CONFIG };
let idCounter = 0;

function generateId(): string {
  return `log_${Date.now()}_${++idCounter}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[config.minLevel];
}

function addEntry(level: LogLevel, tag: string, message: string, data?: unknown): LogEntry {
  const entry: LogEntry = {
    id: generateId(),
    timestamp: Date.now(),
    level,
    tag,
    message,
    data,
  };

  if (level === "error" && data instanceof Error && data.stack) {
    entry.stackTrace = data.stack;
  }

  entries.push(entry);

  // 环形缓冲区：超出最大条目数时移除最早的
  if (entries.length > config.maxEntries) {
    entries = entries.slice(entries.length - config.maxEntries);
  }

  if (config.consoleOutput) {
    const prefix = `[${level.toUpperCase()}][${tag}]`;
    switch (level) {
      case "debug":
        console.debug(prefix, message, data ?? "");
        break;
      case "info":
        console.info(prefix, message, data ?? "");
        break;
      case "warn":
        console.warn(prefix, message, data ?? "");
        break;
      case "error":
        console.error(prefix, message, data ?? "");
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
  },

  /**
   * 导出日志为 JSON 字符串
   */
  exportJSON(): string {
    return JSON.stringify(entries, null, 2);
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
          return `${line}\n  data: ${JSON.stringify(e.data)}`;
        }
        return line;
      })
      .join("\n");
  },

  /**
   * 更新 Logger 配置
   */
  configure(updates: Partial<LoggerConfig>): void {
    config = { ...config, ...updates };
  },

  /**
   * 获取当前配置
   */
  getConfig(): LoggerConfig {
    return { ...config };
  },
};
