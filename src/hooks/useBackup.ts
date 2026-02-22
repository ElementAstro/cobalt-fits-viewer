/**
 * 备份/恢复 Hook
 */

import { useCallback, useEffect, useRef } from "react";
import * as Network from "expo-network";
import { Platform } from "react-native";
import { useBackupStore } from "../stores/useBackupStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useTargetGroupStore } from "../stores/useTargetGroupStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import { useFileGroupStore } from "../stores/useFileGroupStore";
import { useAstrometryStore } from "../stores/useAstrometryStore";
import { useTrashStore } from "../stores/useTrashStore";
import {
  performBackup,
  performRestore,
  getBackupInfo as getBackupInfoService,
  verifyBackupIntegrity,
} from "../lib/backup/backupService";
import type { BackupVerifyResult } from "../lib/backup/backupService";
import {
  exportLocalBackup,
  importLocalBackup,
  previewLocalBackup,
  type LocalBackupPreview,
} from "../lib/backup/localBackup";
import { authenticateOneDrive, authenticateDropbox } from "../lib/backup/oauthHelper";
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
import { reconcileAllStores } from "../lib/targets/targetIntegrity";
import { computeAlbumFileConsistencyPatches } from "../lib/gallery/albumSync";
import { createDataSource } from "../lib/backup/dataSourceFactory";
import { createRestoreTarget } from "../lib/backup/restoreTargetFactory";

const providers: Partial<Record<CloudProvider, ICloudProvider>> = {};
let hasAttemptedProviderRehydrate = false;

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

type ConnectMode = "interactive" | "rehydrate";

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
    setActiveProvider,
    addConnection,
    removeConnection,
    updateConnection,
    resetProgress,
    setAutoBackupEnabled,
    setAutoBackupIntervalHours,
    setAutoBackupNetwork,
    addHistoryEntry,
  } = useBackupStore();

  const fitsStore = useFitsStore;
  const albumStore = useAlbumStore;
  const targetStore = useTargetStore;
  const targetGroupStore = useTargetGroupStore;
  const sessionStore = useSessionStore;
  const settingsStore = useSettingsStore;
  const fileGroupStore = useFileGroupStore;
  const astrometryStore = useAstrometryStore;
  const trashStore = useTrashStore;

  const buildDataSource = useCallback(
    (): BackupDataSource =>
      createDataSource({
        fitsStore,
        albumStore,
        targetStore,
        targetGroupStore,
        sessionStore,
        settingsStore,
        fileGroupStore,
        astrometryStore,
        trashStore,
        backupStore: useBackupStore,
      }),
    [
      fitsStore,
      albumStore,
      targetStore,
      targetGroupStore,
      sessionStore,
      settingsStore,
      fileGroupStore,
      astrometryStore,
      trashStore,
    ],
  );

  const buildRestoreTarget = useCallback(
    (): RestoreTarget =>
      createRestoreTarget(
        {
          fitsStore,
          albumStore,
          targetStore,
          targetGroupStore,
          sessionStore,
          settingsStore,
          fileGroupStore,
          astrometryStore,
          trashStore,
        },
        {
          setAutoBackupEnabled,
          setAutoBackupIntervalHours,
          setAutoBackupNetwork,
          setActiveProvider,
        },
      ),
    [
      fitsStore,
      albumStore,
      targetStore,
      targetGroupStore,
      sessionStore,
      settingsStore,
      fileGroupStore,
      astrometryStore,
      trashStore,
      setAutoBackupEnabled,
      setAutoBackupIntervalHours,
      setAutoBackupNetwork,
      setActiveProvider,
    ],
  );

  const reconcileAlbumFileConsistency = useCallback(() => {
    const currentFiles = fitsStore.getState().files;
    const currentFileIds = currentFiles.map((file) => file.id);
    albumStore.getState().reconcileWithFiles(currentFileIds);

    const syncedAlbums = albumStore.getState().albums;
    const syncedFiles = fitsStore.getState().files;
    const patches = computeAlbumFileConsistencyPatches(syncedFiles, syncedAlbums);
    if (patches.length === 0) return;

    const { updateFile } = fitsStore.getState();
    for (const patch of patches) {
      updateFile(patch.fileId, { albumIds: patch.albumIds });
    }
  }, [albumStore, fitsStore]);

  const connectProvider = useCallback(
    async (
      providerType: CloudProvider,
      config?: CloudProviderConfig,
      mode: ConnectMode = "interactive",
    ): Promise<boolean> => {
      try {
        if (Platform.OS === "web" && providerType !== "webdav") {
          setLastError("Provider is not supported on web");
          return false;
        }

        let resolvedConfig = config;

        if (mode === "interactive" && !resolvedConfig?.accessToken) {
          if (providerType === "onedrive") {
            resolvedConfig = await authenticateOneDrive();
          } else if (providerType === "dropbox") {
            resolvedConfig = await authenticateDropbox();
          } else if (providerType === "google-drive") {
            // Explicit marker so provider can decide whether interactive auth is allowed.
            resolvedConfig = { provider: "google-drive" };
          }
        }

        const provider = getOrCreateProvider(providerType);
        await provider.connect(resolvedConfig);

        const userInfo = await provider.getUserInfo();
        const quota = await provider.getQuota();

        addConnection({
          provider: providerType,
          connected: true,
          userName: userInfo?.name,
          userEmail: userInfo?.email,
          quotaUsed: quota?.used,
          quotaTotal: quota?.total,
          lastBackupDate: useBackupStore.getState().getConnection(providerType)?.lastBackupDate,
        });

        if (mode === "interactive" || !useBackupStore.getState().activeProvider) {
          setActiveProvider(providerType);
        }
        return true;
      } catch (error) {
        setLastError(error instanceof Error ? error.message : "Connection failed");
        return false;
      }
    },
    [addConnection, setLastError, setActiveProvider],
  );

  useEffect(() => {
    if (hasAttemptedProviderRehydrate) return;
    const persistedConnections = connections
      .filter((conn) => conn.connected)
      .map((conn) => conn.provider);
    if (persistedConnections.length === 0) return;

    hasAttemptedProviderRehydrate = true;
    const orderedProviders =
      activeProvider && persistedConnections.includes(activeProvider)
        ? [
            activeProvider,
            ...persistedConnections.filter((provider) => provider !== activeProvider),
          ]
        : persistedConnections;

    void (async () => {
      for (const provider of orderedProviders) {
        await connectProvider(provider, undefined, "rehydrate");
      }
    })();
  }, [connections, activeProvider, connectProvider]);

  const disconnectProvider = useCallback(
    async (providerType: CloudProvider): Promise<void> => {
      try {
        const provider = getOrCreateProvider(providerType);
        await provider.disconnect();
      } catch {
        // ignore disconnect errors
      } finally {
        removeConnection(providerType);
        delete providers[providerType];
        const remaining = useBackupStore
          .getState()
          .connections.filter((conn) => conn.provider !== providerType && conn.connected);
        setActiveProvider(remaining[0]?.provider ?? null);
      }
    },
    [removeConnection, setActiveProvider],
  );

  const backup = useCallback(
    async (
      providerType: CloudProvider,
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress) {
        return { success: false, error: "Operation in progress" };
      }

      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) {
        const rehydrateOk = await connectProvider(providerType, undefined, "rehydrate");
        if (!rehydrateOk || !provider.isConnected()) {
          const msg = "Provider not connected";
          setLastError(msg);
          return { success: false, error: msg };
        }
      }

      try {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
          const msg = "No internet connection";
          setLastError(msg);
          return { success: false, error: msg };
        }
      } catch {
        // proceed if check fails
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

        updateConnection(providerType, { lastBackupDate: Date.now() });
        setActiveProvider(providerType);
        addHistoryEntry({
          type: "backup",
          provider: providerType,
          result: "success",
          fileCount: dataSource.getFiles().length,
        });
        resetProgress();
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Backup failed";
        setLastError(msg);
        addHistoryEntry({ type: "backup", provider: providerType, result: "failed", error: msg });
        resetProgress();
        return { success: false, error: msg };
      } finally {
        setBackupInProgress(false);
        abortRef.current = null;
      }
    },
    [
      backupInProgress,
      restoreInProgress,
      connectProvider,
      buildDataSource,
      setBackupInProgress,
      setProgress,
      setLastError,
      updateConnection,
      setActiveProvider,
      resetProgress,
      addHistoryEntry,
    ],
  );

  const restore = useCallback(
    async (
      providerType: CloudProvider,
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress) {
        return { success: false, error: "Operation in progress" };
      }

      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) {
        const rehydrateOk = await connectProvider(providerType, undefined, "rehydrate");
        if (!rehydrateOk || !provider.isConnected()) {
          const msg = "Provider not connected";
          setLastError(msg);
          return { success: false, error: msg };
        }
      }

      try {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
          const msg = "No internet connection";
          setLastError(msg);
          return { success: false, error: msg };
        }
      } catch {
        // proceed if check fails
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

        reconcileAlbumFileConsistency();
        reconcileAllStores();
        setActiveProvider(providerType);
        addHistoryEntry({ type: "restore", provider: providerType, result: "success" });
        resetProgress();
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Restore failed";
        setLastError(msg);
        addHistoryEntry({ type: "restore", provider: providerType, result: "failed", error: msg });
        resetProgress();
        return { success: false, error: msg };
      } finally {
        setRestoreInProgress(false);
        abortRef.current = null;
      }
    },
    [
      backupInProgress,
      restoreInProgress,
      connectProvider,
      buildRestoreTarget,
      reconcileAlbumFileConsistency,
      setRestoreInProgress,
      setProgress,
      setLastError,
      setActiveProvider,
      resetProgress,
      addHistoryEntry,
    ],
  );

  const cancelOperation = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const getBackupInfo = useCallback(
    async (providerType: CloudProvider): Promise<BackupInfo | null> => {
      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) return null;
      return getBackupInfoService(provider);
    },
    [],
  );

  const testConnection = useCallback(async (providerType: CloudProvider): Promise<boolean> => {
    const provider = getOrCreateProvider(providerType);
    return provider.testConnection();
  }, []);

  const verifyBackup = useCallback(
    async (providerType: CloudProvider): Promise<BackupVerifyResult | null> => {
      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) return null;
      try {
        return await verifyBackupIntegrity(provider);
      } catch {
        return null;
      }
    },
    [],
  );

  const localExport = useCallback(
    async (
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress) {
        return { success: false, error: "Operation in progress" };
      }

      try {
        setBackupInProgress(true);
        setLastError(null);
        const dataSource = buildDataSource();
        const result = await exportLocalBackup(dataSource, options, (p: BackupProgress) =>
          setProgress(p),
        );
        resetProgress();
        if (result.success) {
          addHistoryEntry({ type: "local-export", provider: "local", result: "success" });
        } else {
          setLastError(result.error ?? "Export failed");
          addHistoryEntry({
            type: "local-export",
            provider: "local",
            result: "failed",
            error: result.error,
          });
        }
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Export failed";
        setLastError(msg);
        addHistoryEntry({ type: "local-export", provider: "local", result: "failed", error: msg });
        resetProgress();
        return { success: false, error: msg };
      } finally {
        setBackupInProgress(false);
      }
    },
    [
      backupInProgress,
      restoreInProgress,
      buildDataSource,
      setBackupInProgress,
      setLastError,
      setProgress,
      resetProgress,
      addHistoryEntry,
    ],
  );

  const previewLocalImport = useCallback(async (): Promise<{
    success: boolean;
    cancelled?: boolean;
    error?: string;
    preview?: LocalBackupPreview;
  }> => {
    try {
      const result = await previewLocalBackup();
      if (!result.success || !result.preview) {
        return {
          success: false,
          cancelled: result.cancelled,
          error: result.error,
        };
      }
      return { success: true, preview: result.preview };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Preview failed",
      };
    }
  }, []);

  const localImport = useCallback(
    async (
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
      preview?: LocalBackupPreview,
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress) {
        return { success: false, error: "Operation in progress" };
      }

      try {
        setRestoreInProgress(true);
        setLastError(null);
        const restoreTarget = buildRestoreTarget();
        const result = await importLocalBackup(
          restoreTarget,
          options,
          (p: BackupProgress) => setProgress(p),
          preview,
        );
        if (result.success) {
          reconcileAlbumFileConsistency();
          reconcileAllStores();
          addHistoryEntry({ type: "local-import", provider: "local", result: "success" });
        } else {
          setLastError(result.error ?? "Import failed");
          addHistoryEntry({
            type: "local-import",
            provider: "local",
            result: "failed",
            error: result.error,
          });
        }
        resetProgress();
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Import failed";
        setLastError(msg);
        addHistoryEntry({ type: "local-import", provider: "local", result: "failed", error: msg });
        resetProgress();
        return { success: false, error: msg };
      } finally {
        setRestoreInProgress(false);
      }
    },
    [
      backupInProgress,
      restoreInProgress,
      buildRestoreTarget,
      reconcileAlbumFileConsistency,
      setRestoreInProgress,
      setLastError,
      setProgress,
      resetProgress,
      addHistoryEntry,
    ],
  );

  return {
    connections,
    activeProvider,
    backupInProgress,
    restoreInProgress,
    progress,

    connectProvider,
    disconnectProvider,
    backup,
    restore,
    cancelOperation,
    getBackupInfo,
    testConnection,
    localExport,
    localImport,
    previewLocalImport,
    verifyBackup,
  };
}
