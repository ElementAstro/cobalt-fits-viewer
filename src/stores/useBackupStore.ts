/**
 * 备份状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { CloudProvider, BackupProgress, ProviderConnectionState } from "../lib/backup/types";

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
  lastAutoBackupCheck: number;
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
  setLastAutoBackupCheck: (timestamp: number) => void;
  setLastError: (error: string | null) => void;
  getConnection: (provider: CloudProvider) => ProviderConnectionState | undefined;
  resetProgress: () => void;
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
      lastAutoBackupCheck: 0,
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

      setLastAutoBackupCheck: (timestamp) => set({ lastAutoBackupCheck: timestamp }),

      setLastError: (error) => set({ lastError: error }),

      getConnection: (provider) => get().connections.find((c) => c.provider === provider),

      resetProgress: () => set({ progress: IDLE_PROGRESS }),
    }),
    {
      name: "backup-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        connections: state.connections,
        activeProvider: state.activeProvider,
        autoBackupEnabled: state.autoBackupEnabled,
        autoBackupIntervalHours: state.autoBackupIntervalHours,
        lastAutoBackupCheck: state.lastAutoBackupCheck,
      }),
    },
  ),
);
