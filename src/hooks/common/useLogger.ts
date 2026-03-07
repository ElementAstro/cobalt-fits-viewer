/**
 * 日志系统 Hook
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useLogStore } from "../../stores/app/useLogStore";
import { Logger, formatSystemInfo, exportLogsToFile, shareLogFile } from "../../lib/logger";
import type { LogLevel, LogExportOptions, LogQuery } from "../../lib/logger";

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

type PageLogContext = Record<string, unknown>;

interface PageLoggerOptions {
  screen?: string;
  context?: PageLogContext;
  logLifecycle?: boolean;
}

function normalizeLogError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }
  return error;
}

/**
 * 提供页面级日志记录能力，统一生命周期与关键动作结构
 */
export function usePageLogger(tag: string, options: PageLoggerOptions = {}) {
  const { info, warn, error } = useLogger(tag);
  const screen = options.screen ?? tag;
  const logLifecycle = options.logLifecycle ?? true;
  const contextRef = useRef<PageLogContext | undefined>(options.context);

  useEffect(() => {
    contextRef.current = options.context;
  }, [options.context]);

  const createPayload = useCallback(
    (
      eventType: "page_enter" | "page_leave" | "action" | "success" | "failure",
      action?: string,
      data?: Record<string, unknown>,
    ) => {
      const payload: Record<string, unknown> = { eventType, screen };
      if (action) payload.action = action;
      const context = contextRef.current;
      if (context && Object.keys(context).length > 0) {
        payload.context = context;
      }
      if (data && Object.keys(data).length > 0) {
        Object.assign(payload, data);
      }
      return payload;
    },
    [screen],
  );

  useEffect(() => {
    if (!logLifecycle) return;
    info("page_enter", createPayload("page_enter"));
    return () => {
      info("page_leave", createPayload("page_leave"));
    };
  }, [createPayload, info, logLifecycle]);

  const logAction = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      info(action, createPayload("action", action, data));
    },
    [createPayload, info],
  );

  const logSuccess = useCallback(
    (action: string, data?: Record<string, unknown>) => {
      info(action, createPayload("success", action, data));
    },
    [createPayload, info],
  );

  const logWarning = useCallback(
    (action: string, message: string, data?: Record<string, unknown>) => {
      warn(message, createPayload("action", action, data));
    },
    [createPayload, warn],
  );

  const logFailure = useCallback(
    (action: string, failure: unknown, data?: Record<string, unknown>) => {
      error(
        action,
        createPayload("failure", action, {
          ...data,
          error: normalizeLogError(failure),
        }),
      );
    },
    [createPayload, error],
  );

  return {
    logAction,
    logSuccess,
    logWarning,
    logFailure,
  };
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
  const entries = useLogStore((s) => s.getFilteredEntries());
  const totalCount = useLogStore((s) => s.totalCount);
  const filterLevel = useLogStore((s) => s.filterLevel);
  const filterTag = useLogStore((s) => s.filterTag);
  const filterQuery = useLogStore((s) => s.filterQuery);
  const setFilterLevel = useLogStore((s) => s.setFilterLevel);
  const setFilterTag = useLogStore((s) => s.setFilterTag);
  const setFilterQuery = useLogStore((s) => s.setFilterQuery);
  const clearLogs = useLogStore((s) => s.clearLogs);

  const [isExporting, setIsExporting] = useState(false);

  const levelCounts = useMemo(() => {
    const counts: Record<LogLevel, number> = { debug: 0, info: 0, warn: 0, error: 0 };
    for (const entry of allEntries) {
      counts[entry.level]++;
    }
    return counts;
  }, [allEntries]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const entry of allEntries) {
      tagSet.add(entry.tag);
    }
    return Array.from(tagSet).sort();
  }, [allEntries]);

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
    levelCounts,
    availableTags,
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
