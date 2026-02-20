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
import {
  useSettingsStore,
  getSettingsBackupData,
  normalizeSettingsBackupPatch,
} from "../stores/useSettingsStore";
import { useFileGroupStore } from "../stores/useFileGroupStore";
import { useAstrometryStore } from "../stores/useAstrometryStore";
import { useTrashStore } from "../stores/useTrashStore";
import {
  performBackup,
  performRestore,
  getBackupInfo as getBackupInfoService,
} from "../lib/backup/backupService";
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
  RestoreConflictStrategy,
} from "../lib/backup/types";
import { DEFAULT_BACKUP_OPTIONS } from "../lib/backup/types";
import type { BackupDataSource, RestoreTarget } from "../lib/backup/backupService";
import { normalizeTargetMatch } from "../lib/targets/targetRelations";
import { reconcileAllStores } from "../lib/targets/targetIntegrity";
import { computeAlbumFileConsistencyPatches } from "../lib/gallery/albumSync";
import { resolveTargetId, resolveTargetName } from "../lib/targets/targetRefs";
import { mergeSessionLike } from "../lib/sessions/sessionNormalization";

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

  const buildDataSource = useCallback((): BackupDataSource => {
    return {
      getFiles: () => fitsStore.getState().files,
      getAlbums: () => albumStore.getState().albums,
      getTargets: () => targetStore.getState().targets,
      getTargetGroups: () => targetGroupStore.getState().groups,
      getSessions: () => sessionStore.getState().sessions,
      getPlans: () => sessionStore.getState().plans,
      getLogEntries: () => sessionStore.getState().logEntries,
      getSettings: () => getSettingsBackupData(settingsStore.getState()),
      getFileGroups: () => ({
        groups: fileGroupStore.getState().groups,
        fileGroupMap: fileGroupStore.getState().fileGroupMap,
      }),
      getAstrometry: () => ({
        config: astrometryStore.getState().config,
        jobs: astrometryStore.getState().jobs,
      }),
      getTrash: () => trashStore.getState().items,
      getActiveSession: () => sessionStore.getState().activeSession,
      getBackupPrefs: () => {
        const state = useBackupStore.getState();
        return {
          activeProvider: state.activeProvider,
          autoBackupEnabled: state.autoBackupEnabled,
          autoBackupIntervalHours: state.autoBackupIntervalHours,
          autoBackupNetwork: state.autoBackupNetwork,
        };
      },
    };
  }, [
    fitsStore,
    albumStore,
    targetStore,
    targetGroupStore,
    sessionStore,
    settingsStore,
    fileGroupStore,
    astrometryStore,
    trashStore,
  ]);

  const buildRestoreTarget = useCallback((): RestoreTarget => {
    const resolveStrategy = (
      strategy: RestoreConflictStrategy | undefined,
    ): RestoreConflictStrategy => strategy ?? "skip-existing";

    return {
      setFiles: (files, strategy) => {
        const mode = resolveStrategy(strategy);
        const store = fitsStore.getState();
        for (const file of files) {
          const existing = store.files.find((f) => f.id === file.id);
          if (!existing) {
            store.addFile(file);
            continue;
          }

          if (mode === "skip-existing") continue;
          if (mode === "overwrite-existing") {
            store.updateFile(file.id, file);
            continue;
          }

          const mergedTags = [...new Set([...(existing.tags ?? []), ...(file.tags ?? [])])];
          const mergedAlbumIds = [
            ...new Set([...(existing.albumIds ?? []), ...(file.albumIds ?? [])]),
          ];
          store.updateFile(file.id, { ...file, tags: mergedTags, albumIds: mergedAlbumIds });
        }
      },
      setAlbums: (albums, strategy) => {
        const mode = resolveStrategy(strategy);
        const store = albumStore.getState();
        for (const album of albums) {
          const existing = store.albums.find((a) => a.id === album.id);
          if (!existing) {
            store.addAlbum(album);
            continue;
          }

          if (mode === "skip-existing") continue;
          if (mode === "overwrite-existing") {
            store.updateAlbum(album.id, album);
            continue;
          }

          store.updateAlbum(album.id, {
            ...album,
            imageIds: [...new Set([...(existing.imageIds ?? []), ...(album.imageIds ?? [])])],
            coverImageId: existing.coverImageId ?? album.coverImageId,
          });
        }
      },
      setTargets: (targets, strategy) => {
        const mode = resolveStrategy(strategy);
        const store = targetStore.getState();
        for (const target of targets) {
          const currentTargets = targetStore.getState().targets;
          const existingById = currentTargets.find((t) => t.id === target.id);
          const existingByName =
            existingById ??
            normalizeTargetMatch({
              name: target.name,
              aliases: target.aliases,
              targets: currentTargets,
            });
          const existing = existingById ?? existingByName;

          if (!existing) {
            store.addTarget(target);
            continue;
          }

          if (mode === "skip-existing") continue;
          if (mode === "overwrite-existing") {
            store.updateTarget(existing.id, { ...target, id: existing.id });
            continue;
          }

          const mergedExposure: Record<string, number> = { ...(existing.plannedExposure ?? {}) };
          for (const [filter, seconds] of Object.entries(target.plannedExposure ?? {})) {
            mergedExposure[filter] = Math.max(mergedExposure[filter] ?? 0, seconds);
          }

          store.updateTarget(existing.id, {
            ...target,
            id: existing.id,
            aliases: [...new Set([...(existing.aliases ?? []), ...(target.aliases ?? [])])],
            tags: [...new Set([...(existing.tags ?? []), ...(target.tags ?? [])])],
            imageIds: [...new Set([...(existing.imageIds ?? []), ...(target.imageIds ?? [])])],
            plannedFilters: [
              ...new Set([...(existing.plannedFilters ?? []), ...(target.plannedFilters ?? [])]),
            ],
            plannedExposure: mergedExposure,
            imageRatings: { ...(existing.imageRatings ?? {}), ...(target.imageRatings ?? {}) },
            bestImageId: existing.bestImageId ?? target.bestImageId,
            recommendedEquipment: existing.recommendedEquipment ?? target.recommendedEquipment,
          });
        }
      },
      setTargetGroups: (groups, strategy) => {
        const mode = resolveStrategy(strategy);
        const store = targetGroupStore.getState();
        for (const group of groups) {
          const existing = store.groups.find((g) => g.id === group.id);
          if (!existing) {
            store.upsertGroup({ ...group, targetIds: [...new Set(group.targetIds ?? [])] });
            continue;
          }
          if (mode === "skip-existing") continue;
          if (mode === "overwrite-existing") {
            store.updateGroup(existing.id, group);
            continue;
          }
          store.updateGroup(existing.id, {
            ...group,
            targetIds: [...new Set([...(existing.targetIds ?? []), ...(group.targetIds ?? [])])],
          });
        }
      },
      setSessions: (sessions, strategy) => {
        const mode = resolveStrategy(strategy);
        const store = sessionStore.getState();
        for (const session of sessions) {
          const existing = store.sessions.find((s) => s.id === session.id);
          if (!existing) {
            store.addSession(session);
            continue;
          }
          if (mode === "skip-existing") continue;
          if (mode === "overwrite-existing") {
            store.updateSession(session.id, session);
            continue;
          }
          const merged = mergeSessionLike(existing, session, targetStore.getState().targets);
          store.updateSession(session.id, merged);
        }
      },
      setPlans: (plans, strategy) => {
        const mode = resolveStrategy(strategy);
        const store = sessionStore.getState();
        const targets = targetStore.getState().targets;
        for (const plan of plans) {
          const resolvedTargetId = plan.targetId
            ? resolveTargetId({ targetId: plan.targetId, name: plan.targetName }, targets)
            : resolveTargetId({ name: plan.targetName }, targets);
          const normalizedPlan = {
            ...plan,
            targetId: resolvedTargetId,
            targetName: resolveTargetName(
              { targetId: resolvedTargetId, name: plan.targetName },
              targets,
            ),
          };
          const existing = store.plans.find((p) => p.id === normalizedPlan.id);
          if (!existing) {
            store.addPlan(normalizedPlan);
            continue;
          }
          if (mode === "skip-existing") continue;
          if (mode === "overwrite-existing") {
            store.updatePlan(existing.id, normalizedPlan);
            continue;
          }
          store.updatePlan(existing.id, {
            ...normalizedPlan,
            targetId: existing.targetId ?? normalizedPlan.targetId,
            targetName: normalizedPlan.targetName || existing.targetName,
            notes: [existing.notes, normalizedPlan.notes].filter(Boolean).join("\n") || undefined,
          });
        }
      },
      setLogEntries: (entries, strategy) => {
        const mode = resolveStrategy(strategy);
        const store = sessionStore.getState();
        for (const entry of entries) {
          const existing = store.logEntries.find((log) => log.id === entry.id);
          if (!existing) {
            store.addLogEntry(entry);
            continue;
          }
          if (mode === "skip-existing") continue;
          if (mode === "overwrite-existing") {
            store.updateLogEntry(existing.id, entry);
            continue;
          }
          store.updateLogEntry(existing.id, {
            ...entry,
            notes: [existing.notes, entry.notes].filter(Boolean).join("\n") || undefined,
          });
        }
      },
      setSettings: (settings) => {
        const patch = normalizeSettingsBackupPatch(settings);
        if (Object.keys(patch).length > 0) {
          settingsStore.getState().applySettingsPatch(patch);
        }
      },
      setFileGroups: (data, strategy) => {
        const mode = resolveStrategy(strategy);
        const state = fileGroupStore.getState();
        if (mode === "overwrite-existing") {
          useFileGroupStore.setState(
            {
              groups: data.groups,
              fileGroupMap: data.fileGroupMap,
            },
            false,
          );
          return;
        }

        const nextGroups = [...state.groups];
        const seenGroups = new Set(nextGroups.map((group) => group.id));
        for (const group of data.groups) {
          if (!seenGroups.has(group.id)) {
            nextGroups.push(group);
            seenGroups.add(group.id);
          } else if (mode === "merge") {
            const idx = nextGroups.findIndex((g) => g.id === group.id);
            if (idx >= 0) nextGroups[idx] = { ...nextGroups[idx], ...group };
          }
        }

        const nextMap: Record<string, string[]> = { ...state.fileGroupMap };
        for (const [fileId, groupIds] of Object.entries(data.fileGroupMap)) {
          if (!nextMap[fileId]) {
            nextMap[fileId] = [...groupIds];
            continue;
          }
          if (mode === "merge") {
            nextMap[fileId] = [...new Set([...(nextMap[fileId] ?? []), ...groupIds])];
          }
        }

        useFileGroupStore.setState({ groups: nextGroups, fileGroupMap: nextMap }, false);
      },
      setAstrometry: (data, strategy) => {
        const mode = resolveStrategy(strategy);
        const state = astrometryStore.getState();
        if (mode === "overwrite-existing") {
          useAstrometryStore.setState({ config: data.config, jobs: data.jobs }, false);
          return;
        }

        const jobMap = new Map(state.jobs.map((job) => [job.id, job]));
        for (const job of data.jobs) {
          if (!jobMap.has(job.id)) {
            jobMap.set(job.id, job);
          } else if (mode === "merge") {
            jobMap.set(job.id, { ...jobMap.get(job.id)!, ...job });
          }
        }

        useAstrometryStore.setState(
          {
            config: mode === "merge" ? { ...state.config, ...data.config } : state.config,
            jobs: [...jobMap.values()],
          },
          false,
        );
      },
      setTrash: (items, strategy) => {
        const mode = resolveStrategy(strategy);
        if (mode === "overwrite-existing") {
          useTrashStore.setState({ items: [...items] }, false);
          return;
        }
        const current = trashStore.getState().items;
        const map = new Map(current.map((item) => [item.trashId, item]));
        for (const item of items) {
          if (!map.has(item.trashId) || mode === "merge") {
            map.set(item.trashId, item);
          }
        }
        useTrashStore.setState({ items: [...map.values()] }, false);
      },
      setActiveSession: (activeSession, strategy) => {
        const mode = resolveStrategy(strategy);
        const current = sessionStore.getState().activeSession;
        if (mode === "skip-existing" && current) return;
        if (mode === "merge" && current) return;
        useSessionStore.setState({ activeSession }, false);
      },
      setBackupPrefs: (prefs) => {
        setAutoBackupEnabled(prefs.autoBackupEnabled);
        setAutoBackupIntervalHours(prefs.autoBackupIntervalHours);
        setAutoBackupNetwork(prefs.autoBackupNetwork);
        if (prefs.activeProvider) {
          setActiveProvider(prefs.activeProvider);
        }
      },
    };
  }, [
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
  ]);

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
        resetProgress();
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Backup failed";
        setLastError(msg);
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
        resetProgress();
        return { success: true };
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Restore failed";
        setLastError(msg);
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
        if (!result.success) setLastError(result.error ?? "Export failed");
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Export failed";
        setLastError(msg);
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
        }
        resetProgress();
        if (!result.success) setLastError(result.error ?? "Import failed");
        return result;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Import failed";
        setLastError(msg);
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
  };
}
