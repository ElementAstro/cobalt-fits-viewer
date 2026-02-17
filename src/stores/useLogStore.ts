/**
 * 日志状态管理
 */

import { create } from "zustand";
import { Logger, LOG_TAGS, collectSystemInfo } from "../lib/logger";
import type { LogLevel, LogEntry, SystemInfo } from "../lib/logger";

interface LogStoreState {
  /** Logger 实时快照 */
  entries: LogEntry[];
  /** 日志总条数 */
  totalCount: number;

  /** 缓存的系统信息快照 */
  systemInfo: SystemInfo | null;
  /** 系统信息是否正在加载 */
  isCollecting: boolean;
  /** 日志过滤级别 */
  filterLevel: LogLevel | null;
  /** 日志过滤标签 */
  filterTag: string;
  /** 日志关键词过滤（tag/message/data） */
  filterQuery: string;

  // Actions
  refreshSystemInfo: () => Promise<void>;
  setFilterLevel: (level: LogLevel | null) => void;
  setFilterTag: (tag: string) => void;
  setFilterQuery: (query: string) => void;
  clearLogs: () => void;
  getFilteredEntries: () => LogEntry[];
}

function getLoggerSnapshot() {
  return {
    entries: Logger.getEntries(),
    totalCount: Logger.getCount(),
  };
}

function isSameLoggerSnapshot(
  state: Pick<LogStoreState, "entries" | "totalCount">,
  snapshot: Pick<LogStoreState, "entries" | "totalCount">,
): boolean {
  if (state.totalCount !== snapshot.totalCount) return false;
  if (state.entries.length !== snapshot.entries.length) return false;
  if (state.entries.length === 0) return true;

  const currentFirst = state.entries[0];
  const nextFirst = snapshot.entries[0];
  const currentLast = state.entries[state.entries.length - 1];
  const nextLast = snapshot.entries[snapshot.entries.length - 1];

  return (
    currentFirst?.id === nextFirst?.id &&
    currentFirst?.timestamp === nextFirst?.timestamp &&
    currentLast?.id === nextLast?.id &&
    currentLast?.timestamp === nextLast?.timestamp
  );
}

export const useLogStore = create<LogStoreState>((set, get) => ({
  ...getLoggerSnapshot(),
  systemInfo: null,
  isCollecting: false,
  filterLevel: null,
  filterTag: "",
  filterQuery: "",

  refreshSystemInfo: async () => {
    if (get().isCollecting) return;
    set({ isCollecting: true });
    try {
      const info = await collectSystemInfo();
      set({ systemInfo: info, isCollecting: false });
      Logger.info(LOG_TAGS.SystemInfo, "System information collected successfully");
    } catch (e) {
      set({ isCollecting: false });
      Logger.error(LOG_TAGS.SystemInfo, "Failed to collect system information", e);
    }
  },

  setFilterLevel: (level) =>
    set((state) => (state.filterLevel === level ? state : { filterLevel: level })),
  setFilterTag: (tag) => set((state) => (state.filterTag === tag ? state : { filterTag: tag })),
  setFilterQuery: (query) =>
    set((state) => (state.filterQuery === query ? state : { filterQuery: query })),

  clearLogs: () => {
    Logger.clear();
  },

  getFilteredEntries: () => {
    const { filterLevel, filterTag, filterQuery } = get();
    return Logger.queryEntries({
      level: filterLevel ?? undefined,
      tag: filterTag,
      query: filterQuery,
    });
  },
}));

Logger.subscribe(() => {
  const snapshot = getLoggerSnapshot();
  useLogStore.setState((state) => (isSameLoggerSnapshot(state, snapshot) ? state : snapshot));
});
