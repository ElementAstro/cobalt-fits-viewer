/**
 * 日志系统 Hook
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { useLogStore } from "../stores/useLogStore";
import { Logger, formatSystemInfo, exportLogsToFile, shareLogFile } from "../lib/logger";
import type { LogLevel, LogExportOptions, LogQuery } from "../lib/logger";

const LOG_LEVEL_PRIORITY_MAP: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function toSearchText(data: unknown): string {
  if (data === undefined || data === null) return "";
  if (typeof data === "string") return data.toLowerCase();
  if (typeof data === "number" || typeof data === "boolean") return String(data).toLowerCase();
  try {
    return JSON.stringify(data).toLowerCase();
  } catch {
    return String(data).toLowerCase();
  }
}

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
    if (!systemInfo && !isCollecting) {
      refreshSystemInfo();
    }
  }, [systemInfo, isCollecting, refreshSystemInfo]);

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
  const allEntries = useLogStore((s) => s.entries ?? []);
  const totalCount = useLogStore((s) => s.totalCount);
  const filterLevel = useLogStore((s) => s.filterLevel);
  const filterTag = useLogStore((s) => s.filterTag);
  const filterQuery = useLogStore((s) => s.filterQuery);
  const setFilterLevel = useLogStore((s) => s.setFilterLevel);
  const setFilterTag = useLogStore((s) => s.setFilterTag);
  const setFilterQuery = useLogStore((s) => s.setFilterQuery);
  const clearLogs = useLogStore((s) => s.clearLogs);

  const [isExporting, setIsExporting] = useState(false);

  const entries = useMemo(() => {
    const tagQuery = filterTag.trim().toLowerCase();
    const textQuery = filterQuery.trim().toLowerCase();
    const minPriority = filterLevel ? LOG_LEVEL_PRIORITY_MAP[filterLevel] : null;

    return allEntries.filter((entry) => {
      if (minPriority !== null && LOG_LEVEL_PRIORITY_MAP[entry.level] < minPriority) return false;
      if (tagQuery && !entry.tag.toLowerCase().includes(tagQuery)) return false;
      if (!textQuery) return true;

      const inTag = entry.tag.toLowerCase().includes(textQuery);
      const inMessage = entry.message.toLowerCase().includes(textQuery);
      const inData = toSearchText(entry.data).includes(textQuery);
      const inStack = entry.stackTrace?.toLowerCase().includes(textQuery) ?? false;
      return inTag || inMessage || inData || inStack;
    });
  }, [allEntries, filterLevel, filterTag, filterQuery]);

  const getCurrentQuery = useCallback((): LogQuery => {
    return {
      level: filterLevel ?? undefined,
      tag: filterTag,
      query: filterQuery,
    };
  }, [filterLevel, filterTag, filterQuery]);

  const exportLogs = useCallback(
    (format: "json" | "text" = "text", filteredOnly = false) => {
      const query = filteredOnly ? getCurrentQuery() : undefined;
      return format === "json" ? Logger.exportJSON(query) : Logger.exportText(query);
    },
    [getCurrentQuery],
  );

  const exportToFile = useCallback(
    async (options?: LogExportOptions & { filteredOnly?: boolean }): Promise<string | null> => {
      setIsExporting(true);
      try {
        const filteredOnly = options?.filteredOnly ?? false;
        const rest: LogExportOptions = {
          format: options?.format ?? "text",
          compress: options?.compress,
          includeSystemInfo: options?.includeSystemInfo,
          query: options?.query,
        };
        return await exportLogsToFile({
          ...rest,
          query: filteredOnly ? getCurrentQuery() : options?.query,
        });
      } finally {
        setIsExporting(false);
      }
    },
    [getCurrentQuery],
  );

  const shareLogs = useCallback(
    async (options?: LogExportOptions & { filteredOnly?: boolean }): Promise<boolean> => {
      setIsExporting(true);
      try {
        const filteredOnly = options?.filteredOnly ?? false;
        const rest: LogExportOptions = {
          format: options?.format ?? "text",
          compress: options?.compress,
          includeSystemInfo: options?.includeSystemInfo,
          query: options?.query,
        };
        return await shareLogFile({
          ...rest,
          query: filteredOnly ? getCurrentQuery() : options?.query,
        });
      } finally {
        setIsExporting(false);
      }
    },
    [getCurrentQuery],
  );

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
    filterQuery,
    setFilter,
    setFilterLevel,
    setFilterTag,
    setFilterQuery,
    clearLogs,
    exportLogs,
    exportToFile,
    shareLogs,
    isExporting,
    totalCount,
  };
}
