/**
 * 日志状态管理
 */

import { create } from "zustand";
import { Logger, collectSystemInfo } from "../lib/logger";
import type { LogLevel, LogEntry, SystemInfo } from "../lib/logger";

interface LogStoreState {
  /** 缓存的系统信息快照 */
  systemInfo: SystemInfo | null;
  /** 系统信息是否正在加载 */
  isCollecting: boolean;
  /** 日志过滤级别 */
  filterLevel: LogLevel | null;
  /** 日志过滤标签 */
  filterTag: string;

  // Actions
  refreshSystemInfo: () => Promise<void>;
  setFilterLevel: (level: LogLevel | null) => void;
  setFilterTag: (tag: string) => void;
  clearLogs: () => void;
  getFilteredEntries: () => LogEntry[];
}

export const useLogStore = create<LogStoreState>((set, get) => ({
  systemInfo: null,
  isCollecting: false,
  filterLevel: null,
  filterTag: "",

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

  clearLogs: () => {
    Logger.clear();
    // 触发 re-render（zustand 不会自动感知 Logger 内部状态变化）
    set({});
  },

  getFilteredEntries: () => {
    const { filterLevel, filterTag } = get();
    return Logger.getEntries({
      level: filterLevel ?? undefined,
      tag: filterTag || undefined,
    });
  },
}));
