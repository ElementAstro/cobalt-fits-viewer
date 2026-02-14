/**
 * 备份/恢复 Hook
 */

import { useCallback, useRef } from "react";
import { useBackupStore } from "../stores/useBackupStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  performBackup,
  performRestore,
  getBackupInfo as getBackupInfoService,
} from "../lib/backup/backupService";
import type { ICloudProvider } from "../lib/backup/cloudProvider";
import { GoogleDriveProvider } from "../lib/backup/providers/googleDrive";
import { OneDriveProvider } from "../lib/backup/providers/onedrive";
import { DropboxProvider } from "../lib/backup/providers/dropbox";
import { WebDAVProvider } from "../lib/backup/providers/webdav";
import type {
  CloudProvider,
  BackupOptions,
  BackupProgress,
  CloudProviderConfig,
  BackupInfo,
} from "../lib/backup/types";
import { DEFAULT_BACKUP_OPTIONS } from "../lib/backup/types";
import type { BackupDataSource, RestoreTarget } from "../lib/backup/backupService";

// Provider singletons
const providers: Partial<Record<CloudProvider, ICloudProvider>> = {};

function getOrCreateProvider(type: CloudProvider): ICloudProvider {
  if (!providers[type]) {
    switch (type) {
      case "google-drive":
        providers[type] = new GoogleDriveProvider();
        break;
      case "onedrive":
        providers[type] = new OneDriveProvider();
        break;
      case "dropbox":
        providers[type] = new DropboxProvider();
        break;
      case "webdav":
        providers[type] = new WebDAVProvider();
        break;
    }
  }
  return providers[type]!;
}

export function useBackup() {
  const abortRef = useRef<AbortController | null>(null);

  const {
    connections,
    activeProvider,
    backupInProgress,
    restoreInProgress,
    progress,
    setBackupInProgress,
    setRestoreInProgress,
    setProgress,
    setLastError,
    addConnection,
    removeConnection,
    updateConnection,
    resetProgress,
  } = useBackupStore();

  const fitsStore = useFitsStore;
  const albumStore = useAlbumStore;
  const targetStore = useTargetStore;
  const sessionStore = useSessionStore;
  const settingsStore = useSettingsStore;

  /**
   * 构建数据源
   */
  const buildDataSource = useCallback((): BackupDataSource => {
    return {
      getFiles: () => fitsStore.getState().files,
      getAlbums: () => albumStore.getState().albums,
      getTargets: () => targetStore.getState().targets,
      getSessions: () => sessionStore.getState().sessions,
      getSettings: () => {
        const s = settingsStore.getState();
        return {
          defaultStretch: s.defaultStretch,
          defaultColormap: s.defaultColormap,
          defaultGridColumns: s.defaultGridColumns,
          thumbnailQuality: s.thumbnailQuality,
          thumbnailSize: s.thumbnailSize,
          defaultExportFormat: s.defaultExportFormat,
          autoGroupByObject: s.autoGroupByObject,
          autoTagLocation: s.autoTagLocation,
          sessionGapMinutes: s.sessionGapMinutes,
          calendarSyncEnabled: s.calendarSyncEnabled,
          defaultReminderMinutes: s.defaultReminderMinutes,
          language: s.language,
          theme: s.theme,
          accentColor: s.accentColor,
          activePreset: s.activePreset,
          fontFamily: s.fontFamily,
          monoFontFamily: s.monoFontFamily,
        };
      },
    };
  }, [fitsStore, albumStore, targetStore, sessionStore, settingsStore]);

  /**
   * 构建恢复目标
   */
  const buildRestoreTarget = useCallback((): RestoreTarget => {
    return {
      setFiles: (files) => {
        const store = fitsStore.getState();
        for (const file of files) {
          const existing = store.files.find((f) => f.id === file.id);
          if (!existing) {
            store.addFile(file);
          }
        }
      },
      setAlbums: (albums) => {
        const store = albumStore.getState();
        for (const album of albums) {
          const existing = store.albums.find((a) => a.id === album.id);
          if (!existing) {
            store.addAlbum(album);
          }
        }
      },
      setTargets: (targets) => {
        const store = targetStore.getState();
        for (const target of targets) {
          const existing = store.targets.find((t) => t.id === target.id);
          if (!existing) {
            store.addTarget(target);
          }
        }
      },
      setSessions: (sessions) => {
        const store = sessionStore.getState();
        for (const session of sessions) {
          const existing = store.sessions.find((s) => s.id === session.id);
          if (!existing) {
            store.addSession(session);
          }
        }
      },
      setSettings: (settings) => {
        const store = settingsStore.getState();
        const s = settings as Record<string, unknown>;
        if (s.language) store.setLanguage(s.language as "en" | "zh");
        if (s.theme) store.setTheme(s.theme as "light" | "dark" | "system");
        if (s.defaultStretch) store.setDefaultStretch(s.defaultStretch as string as never);
        if (s.defaultColormap) store.setDefaultColormap(s.defaultColormap as string as never);
      },
    };
  }, [fitsStore, albumStore, targetStore, sessionStore, settingsStore]);

  /**
   * 连接到云服务
   */
  const connectProvider = useCallback(
    async (providerType: CloudProvider, config?: CloudProviderConfig): Promise<boolean> => {
      try {
        const provider = getOrCreateProvider(providerType);
        await provider.connect(config);

        const userInfo = await provider.getUserInfo();
        const quota = await provider.getQuota();

        addConnection({
          provider: providerType,
          connected: true,
          userName: userInfo?.name,
          userEmail: userInfo?.email,
          quotaUsed: quota?.used,
          quotaTotal: quota?.total,
        });

        return true;
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "Connection failed");
        return false;
      }
    },
    [addConnection, setLastError],
  );

  /**
   * 断开云服务
   */
  const disconnectProvider = useCallback(
    async (providerType: CloudProvider): Promise<void> => {
      try {
        const provider = getOrCreateProvider(providerType);
        await provider.disconnect();
        removeConnection(providerType);
        delete providers[providerType];
      } catch {
        removeConnection(providerType);
      }
    },
    [removeConnection],
  );

  /**
   * 执行备份
   */
  const backup = useCallback(
    async (
      providerType: CloudProvider,
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
    ): Promise<boolean> => {
      if (backupInProgress || restoreInProgress) return false;

      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) {
        setLastError("Provider not connected");
        return false;
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        setBackupInProgress(true);
        setLastError(null);

        const dataSource = buildDataSource();

        await performBackup(
          provider,
          dataSource,
          options,
          (p: BackupProgress) => setProgress(p),
          abortController.signal,
        );

        updateConnection(providerType, {
          lastBackupDate: Date.now(),
        });

        resetProgress();
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Backup failed";
        setLastError(msg);
        resetProgress();
        return false;
      } finally {
        setBackupInProgress(false);
        abortRef.current = null;
      }
    },
    [
      backupInProgress,
      restoreInProgress,
      buildDataSource,
      setBackupInProgress,
      setProgress,
      setLastError,
      updateConnection,
      resetProgress,
    ],
  );

  /**
   * 执行恢复
   */
  const restore = useCallback(
    async (
      providerType: CloudProvider,
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
    ): Promise<boolean> => {
      if (backupInProgress || restoreInProgress) return false;

      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) {
        setLastError("Provider not connected");
        return false;
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        setRestoreInProgress(true);
        setLastError(null);

        const restoreTarget = buildRestoreTarget();

        await performRestore(
          provider,
          restoreTarget,
          options,
          (p: BackupProgress) => setProgress(p),
          abortController.signal,
        );

        resetProgress();
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Restore failed";
        setLastError(msg);
        resetProgress();
        return false;
      } finally {
        setRestoreInProgress(false);
        abortRef.current = null;
      }
    },
    [
      backupInProgress,
      restoreInProgress,
      buildRestoreTarget,
      setRestoreInProgress,
      setProgress,
      setLastError,
      resetProgress,
    ],
  );

  /**
   * 取消操作
   */
  const cancelOperation = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  /**
   * 获取备份信息
   */
  const getBackupInfo = useCallback(
    async (providerType: CloudProvider): Promise<BackupInfo | null> => {
      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) return null;
      return getBackupInfoService(provider);
    },
    [],
  );

  /**
   * 测试连接
   */
  const testConnection = useCallback(async (providerType: CloudProvider): Promise<boolean> => {
    const provider = getOrCreateProvider(providerType);
    return provider.testConnection();
  }, []);

  return {
    // State
    connections,
    activeProvider,
    backupInProgress,
    restoreInProgress,
    progress,

    // Actions
    connectProvider,
    disconnectProvider,
    backup,
    restore,
    cancelOperation,
    getBackupInfo,
    testConnection,
  };
}
