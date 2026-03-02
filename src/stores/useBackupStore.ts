/**
 * 备份状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandAsyncStorage } from "../lib/storage";
import type {
  CloudProvider,
  BackupOptions,
  BackupProgress,
  ProviderConnectionState,
} from "../lib/backup/types";

const MAX_HISTORY_ENTRIES = 50;

export interface BackupHistoryEntry {
  id: string;
  timestamp: number;
  type: "backup" | "restore" | "local-export" | "local-import" | "lan-send" | "lan-receive";
  provider: CloudProvider | "local";
  result: "success" | "failed";
  fileCount?: number;
  totalSize?: number;
  durationMs?: number;
  error?: string;
}

interface BackupStoreState {
  // 已配置的 providers
  connections: ProviderConnectionState[];
  // 当前活跃 provider
  activeProvider: CloudProvider | null;
  // 备份状态
  backupInProgress: boolean;
  restoreInProgress: boolean;
  progress: BackupProgress;
  // 自动备份
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoBackupNetwork: "wifi" | "any";
  lastAutoBackupAttempt: number;
  lastAutoBackupCheck: number;
  lastAutoBackupResult: "success" | "failed" | null;
  lastAutoBackupError: string | null;
  // 历史记录
  history: BackupHistoryEntry[];
  // 一键备份
  lastUsedBackupOptions: BackupOptions | null;
  // 上次成功备份时间
  lastSuccessfulBackupAt: number;
  // 错误
  lastError: string | null;

  // Actions
  setActiveProvider: (provider: CloudProvider | null) => void;
  addConnection: (connection: ProviderConnectionState) => void;
  removeConnection: (provider: CloudProvider) => void;
  updateConnection: (provider: CloudProvider, updates: Partial<ProviderConnectionState>) => void;
  setBackupInProgress: (inProgress: boolean) => void;
  setRestoreInProgress: (inProgress: boolean) => void;
  setProgress: (progress: BackupProgress) => void;
  setAutoBackupEnabled: (enabled: boolean) => void;
  setAutoBackupIntervalHours: (hours: number) => void;
  setAutoBackupNetwork: (network: "wifi" | "any") => void;
  setLastAutoBackupAttempt: (timestamp: number) => void;
  setLastAutoBackupCheck: (timestamp: number) => void;
  setLastAutoBackupResult: (result: "success" | "failed" | null, error?: string | null) => void;
  setLastSuccessfulBackupAt: (timestamp: number) => void;
  setLastError: (error: string | null) => void;
  getConnection: (provider: CloudProvider) => ProviderConnectionState | undefined;
  resetProgress: () => void;
  setLastUsedBackupOptions: (options: BackupOptions) => void;
  addHistoryEntry: (entry: Omit<BackupHistoryEntry, "id" | "timestamp">) => void;
  clearHistory: () => void;
}

const IDLE_PROGRESS: BackupProgress = {
  phase: "idle",
  current: 0,
  total: 0,
};

export const useBackupStore = create<BackupStoreState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeProvider: null,
      backupInProgress: false,
      restoreInProgress: false,
      progress: IDLE_PROGRESS,
      autoBackupEnabled: false,
      autoBackupIntervalHours: 24,
      autoBackupNetwork: "wifi",
      lastAutoBackupAttempt: 0,
      lastAutoBackupCheck: 0,
      lastAutoBackupResult: null,
      lastAutoBackupError: null,
      history: [],
      lastUsedBackupOptions: null,
      lastSuccessfulBackupAt: 0,
      lastError: null,

      setActiveProvider: (provider) => set({ activeProvider: provider }),

      addConnection: (connection) =>
        set((state) => {
          const existing = state.connections.findIndex((c) => c.provider === connection.provider);
          if (existing >= 0) {
            const updated = [...state.connections];
            updated[existing] = connection;
            return { connections: updated };
          }
          return { connections: [...state.connections, connection] };
        }),

      removeConnection: (provider) =>
        set((state) => ({
          connections: state.connections.filter((c) => c.provider !== provider),
          activeProvider: state.activeProvider === provider ? null : state.activeProvider,
        })),

      updateConnection: (provider, updates) =>
        set((state) => ({
          connections: state.connections.map((c) =>
            c.provider === provider ? { ...c, ...updates } : c,
          ),
        })),

      setBackupInProgress: (inProgress) => set({ backupInProgress: inProgress }),

      setRestoreInProgress: (inProgress) => set({ restoreInProgress: inProgress }),

      setProgress: (progress) => set({ progress }),

      setAutoBackupEnabled: (enabled) => set({ autoBackupEnabled: enabled }),

      setAutoBackupIntervalHours: (hours) => set({ autoBackupIntervalHours: hours }),

      setAutoBackupNetwork: (network) => set({ autoBackupNetwork: network }),

      setLastAutoBackupAttempt: (timestamp) => set({ lastAutoBackupAttempt: timestamp }),

      setLastAutoBackupCheck: (timestamp) => set({ lastAutoBackupCheck: timestamp }),

      setLastAutoBackupResult: (result, error) =>
        set({ lastAutoBackupResult: result, lastAutoBackupError: error ?? null }),

      setLastSuccessfulBackupAt: (timestamp) => set({ lastSuccessfulBackupAt: timestamp }),

      setLastError: (error) => set({ lastError: error }),

      getConnection: (provider) => get().connections.find((c) => c.provider === provider),

      resetProgress: () => set({ progress: IDLE_PROGRESS }),

      setLastUsedBackupOptions: (options) => set({ lastUsedBackupOptions: options }),

      addHistoryEntry: (entry) =>
        set((state) => ({
          history: [
            {
              ...entry,
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              timestamp: Date.now(),
            },
            ...state.history,
          ].slice(0, MAX_HISTORY_ENTRIES),
        })),

      clearHistory: () => set({ history: [] }),
    }),
    {
      name: "backup-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({
        connections: state.connections,
        activeProvider: state.activeProvider,
        autoBackupEnabled: state.autoBackupEnabled,
        autoBackupIntervalHours: state.autoBackupIntervalHours,
        autoBackupNetwork: state.autoBackupNetwork,
        lastAutoBackupAttempt: state.lastAutoBackupAttempt,
        lastAutoBackupCheck: state.lastAutoBackupCheck,
        lastAutoBackupResult: state.lastAutoBackupResult,
        lastAutoBackupError: state.lastAutoBackupError,
        history: state.history,
        lastUsedBackupOptions: state.lastUsedBackupOptions,
        lastSuccessfulBackupAt: state.lastSuccessfulBackupAt,
      }),
    },
  ),
);
