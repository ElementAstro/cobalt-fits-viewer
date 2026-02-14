/**
 * 日志系统 Hook
 */

import { useCallback, useEffect } from "react";
import { useLogStore } from "../stores/useLogStore";
import { Logger, formatSystemInfo } from "../lib/logger";
import type { LogLevel } from "../lib/logger";

/**
 * 提供模块级别的日志记录能力
 */
export function useLogger(tag: string) {
  const debug = useCallback(
    (message: string, data?: unknown) => Logger.debug(tag, message, data),
    [tag],
  );
  const info = useCallback(
    (message: string, data?: unknown) => Logger.info(tag, message, data),
    [tag],
  );
  const warn = useCallback(
    (message: string, data?: unknown) => Logger.warn(tag, message, data),
    [tag],
  );
  const error = useCallback(
    (message: string, data?: unknown) => Logger.error(tag, message, data),
    [tag],
  );

  return { debug, info, warn, error };
}

/**
 * 提供系统信息和日志管理能力
 */
export function useSystemInfo() {
  const systemInfo = useLogStore((s) => s.systemInfo);
  const isCollecting = useLogStore((s) => s.isCollecting);
  const refreshSystemInfo = useLogStore((s) => s.refreshSystemInfo);

  useEffect(() => {
    if (!systemInfo) {
      refreshSystemInfo();
    }
  }, [systemInfo, refreshSystemInfo]);

  const getFormattedInfo = useCallback(() => {
    if (!systemInfo) return "";
    return formatSystemInfo(systemInfo);
  }, [systemInfo]);

  return {
    systemInfo,
    isCollecting,
    refreshSystemInfo,
    getFormattedInfo,
  };
}

/**
 * 提供日志查看与过滤能力
 */
export function useLogViewer() {
  const filterLevel = useLogStore((s) => s.filterLevel);
  const filterTag = useLogStore((s) => s.filterTag);
  const setFilterLevel = useLogStore((s) => s.setFilterLevel);
  const setFilterTag = useLogStore((s) => s.setFilterTag);
  const clearLogs = useLogStore((s) => s.clearLogs);
  const getFilteredEntries = useLogStore((s) => s.getFilteredEntries);

  const entries = getFilteredEntries();

  const exportLogs = useCallback((format: "json" | "text" = "text") => {
    return format === "json" ? Logger.exportJSON() : Logger.exportText();
  }, []);

  const setFilter = useCallback(
    (level: LogLevel | null, tag?: string) => {
      setFilterLevel(level);
      if (tag !== undefined) setFilterTag(tag);
    },
    [setFilterLevel, setFilterTag],
  );

  return {
    entries,
    filterLevel,
    filterTag,
    setFilter,
    setFilterLevel,
    setFilterTag,
    clearLogs,
    exportLogs,
    totalCount: Logger.getCount(),
  };
}
