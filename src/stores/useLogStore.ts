/**
 * 日志状态管理
 */

import { create } from "zustand";
import { Logger, LOG_LEVEL_PRIORITY, collectSystemInfo, serializeLogData } from "../lib/logger";
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

export const useLogStore = create<LogStoreState>((set, get) => ({
  ...getLoggerSnapshot(),
  systemInfo: null,
  isCollecting: false,
  filterLevel: null,
  filterTag: "",
  filterQuery: "",

  refreshSystemInfo: async () => {
    set({ isCollecting: true });
    try {
      const info = await collectSystemInfo();
      set({ systemInfo: info, isCollecting: false });
      Logger.info("SystemInfo", "System information collected successfully");
    } catch (e) {
      set({ isCollecting: false });
      Logger.error("SystemInfo", "Failed to collect system information", e);
    }
  },

  setFilterLevel: (level) => set({ filterLevel: level }),
  setFilterTag: (tag) => set({ filterTag: tag }),
  setFilterQuery: (query) => set({ filterQuery: query }),

  clearLogs: () => {
    Logger.clear();
  },

  getFilteredEntries: () => {
    const { entries, filterLevel, filterTag, filterQuery } = get();
    let result = entries;

    if (filterLevel) {
      const levelIndex = LOG_LEVEL_PRIORITY[filterLevel];
      result = result.filter((entry) => LOG_LEVEL_PRIORITY[entry.level] >= levelIndex);
    }

    if (filterTag.trim()) {
      const tagLower = filterTag.trim().toLowerCase();
      result = result.filter((entry) => entry.tag.toLowerCase().includes(tagLower));
    }

    if (filterQuery.trim()) {
      const query = filterQuery.trim().toLowerCase();
      result = result.filter((entry) => {
        const inTag = entry.tag.toLowerCase().includes(query);
        const inMessage = entry.message.toLowerCase().includes(query);
        const inData =
          entry.data !== undefined &&
          serializeLogData(entry.data, { redact: true }).toLowerCase().includes(query);
        return inTag || inMessage || inData;
      });
    }

    return result;
  },
}));

Logger.subscribe(() => {
  useLogStore.setState(getLoggerSnapshot());
});
