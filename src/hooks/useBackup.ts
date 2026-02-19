/**
 * 备份/恢复 Hook
 */

import { useCallback, useRef } from "react";
import { useBackupStore } from "../stores/useBackupStore";
import { useFitsStore } from "../stores/useFitsStore";
import { useAlbumStore } from "../stores/useAlbumStore";
import { useTargetStore } from "../stores/useTargetStore";
import { useTargetGroupStore } from "../stores/useTargetGroupStore";
import { useSessionStore } from "../stores/useSessionStore";
import { useSettingsStore } from "../stores/useSettingsStore";
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
import * as Network from "expo-network";
import { normalizeTargetMatch } from "../lib/targets/targetRelations";
import { reconcileAllStores } from "../lib/targets/targetIntegrity";
import { computeAlbumFileConsistencyPatches } from "../lib/gallery/albumSync";
import { resolveTargetId, resolveTargetName } from "../lib/targets/targetRefs";
import { mergeSessionLike } from "../lib/sessions/sessionNormalization";

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
  const targetGroupStore = useTargetGroupStore;
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
      getTargetGroups: () => targetGroupStore.getState().groups,
      getSessions: () => sessionStore.getState().sessions,
      getPlans: () => sessionStore.getState().plans,
      getLogEntries: () => sessionStore.getState().logEntries,
      getSettings: () => {
        const s = settingsStore.getState();
        return {
          // Viewer defaults
          defaultStretch: s.defaultStretch,
          defaultColormap: s.defaultColormap,
          defaultGridColumns: s.defaultGridColumns,
          thumbnailQuality: s.thumbnailQuality,
          thumbnailSize: s.thumbnailSize,
          defaultExportFormat: s.defaultExportFormat,
          // Target / session / location
          autoGroupByObject: s.autoGroupByObject,
          autoDetectDuplicates: s.autoDetectDuplicates,
          autoTagLocation: s.autoTagLocation,
          mapPreset: s.mapPreset,
          mapShowOverlays: s.mapShowOverlays,
          sessionGapMinutes: s.sessionGapMinutes,
          calendarSyncEnabled: s.calendarSyncEnabled,
          defaultReminderMinutes: s.defaultReminderMinutes,
          // Display / theme
          language: s.language,
          theme: s.theme,
          orientationLock: s.orientationLock,
          hapticsEnabled: s.hapticsEnabled,
          confirmDestructiveActions: s.confirmDestructiveActions,
          autoCheckUpdates: s.autoCheckUpdates,
          themeColorMode: s.themeColorMode,
          accentColor: s.accentColor,
          activePreset: s.activePreset,
          customThemeColors: s.customThemeColors,
          fontFamily: s.fontFamily,
          monoFontFamily: s.monoFontFamily,
          // Viewer overlay defaults
          defaultShowGrid: s.defaultShowGrid,
          defaultShowCrosshair: s.defaultShowCrosshair,
          defaultShowPixelInfo: s.defaultShowPixelInfo,
          defaultShowMinimap: s.defaultShowMinimap,
          defaultBlackPoint: s.defaultBlackPoint,
          defaultWhitePoint: s.defaultWhitePoint,
          defaultGamma: s.defaultGamma,
          // Histogram
          defaultHistogramMode: s.defaultHistogramMode,
          histogramHeight: s.histogramHeight,
          pixelInfoDecimalPlaces: s.pixelInfoDecimalPlaces,
          // Gallery sorting
          defaultGallerySortBy: s.defaultGallerySortBy,
          defaultGallerySortOrder: s.defaultGallerySortOrder,
          // Stacking
          defaultStackMethod: s.defaultStackMethod,
          defaultSigmaValue: s.defaultSigmaValue,
          defaultAlignmentMode: s.defaultAlignmentMode,
          defaultEnableQuality: s.defaultEnableQuality,
          stackingDetectionProfile: s.stackingDetectionProfile,
          stackingDetectSigmaThreshold: s.stackingDetectSigmaThreshold,
          stackingDetectMaxStars: s.stackingDetectMaxStars,
          stackingDetectMinArea: s.stackingDetectMinArea,
          stackingDetectMaxArea: s.stackingDetectMaxArea,
          stackingDetectBorderMargin: s.stackingDetectBorderMargin,
          stackingBackgroundMeshSize: s.stackingBackgroundMeshSize,
          stackingDeblendNLevels: s.stackingDeblendNLevels,
          stackingDeblendMinContrast: s.stackingDeblendMinContrast,
          stackingFilterFwhm: s.stackingFilterFwhm,
          stackingMaxFwhm: s.stackingMaxFwhm,
          stackingMaxEllipticity: s.stackingMaxEllipticity,
          stackingRansacMaxIterations: s.stackingRansacMaxIterations,
          stackingAlignmentInlierThreshold: s.stackingAlignmentInlierThreshold,
          // Grid/crosshair styles
          gridColor: s.gridColor,
          gridOpacity: s.gridOpacity,
          crosshairColor: s.crosshairColor,
          crosshairOpacity: s.crosshairOpacity,
          // Canvas
          canvasMinScale: s.canvasMinScale,
          canvasMaxScale: s.canvasMaxScale,
          canvasDoubleTapScale: s.canvasDoubleTapScale,
          canvasPinchSensitivity: s.canvasPinchSensitivity,
          canvasPinchOverzoomFactor: s.canvasPinchOverzoomFactor,
          canvasPanRubberBandFactor: s.canvasPanRubberBandFactor,
          canvasWheelZoomSensitivity: s.canvasWheelZoomSensitivity,
          // Thumbnail overlays
          thumbnailShowFilename: s.thumbnailShowFilename,
          thumbnailShowObject: s.thumbnailShowObject,
          thumbnailShowFilter: s.thumbnailShowFilter,
          thumbnailShowExposure: s.thumbnailShowExposure,
          // File list / converter / editor
          fileListStyle: s.fileListStyle,
          defaultConverterFormat: s.defaultConverterFormat,
          defaultConverterQuality: s.defaultConverterQuality,
          batchNamingRule: s.batchNamingRule,
          defaultBlurSigma: s.defaultBlurSigma,
          defaultSharpenAmount: s.defaultSharpenAmount,
          defaultDenoiseRadius: s.defaultDenoiseRadius,
          editorMaxUndo: s.editorMaxUndo,
          // Timeline / session display
          timelineGrouping: s.timelineGrouping,
          sessionShowExposureCount: s.sessionShowExposureCount,
          sessionShowTotalExposure: s.sessionShowTotalExposure,
          sessionShowFilters: s.sessionShowFilters,
          // Target sorting
          targetSortBy: s.targetSortBy,
          targetSortOrder: s.targetSortOrder,
          // Compose
          defaultComposePreset: s.defaultComposePreset,
          composeRedWeight: s.composeRedWeight,
          composeGreenWeight: s.composeGreenWeight,
          composeBlueWeight: s.composeBlueWeight,
          // Performance
          imageProcessingDebounce: s.imageProcessingDebounce,
          useHighQualityPreview: s.useHighQualityPreview,
        };
      },
    };
  }, [fitsStore, albumStore, targetStore, targetGroupStore, sessionStore, settingsStore]);

  /**
   * 构建恢复目标
   */
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

          store.updateFile(file.id, {
            ...file,
            tags: mergedTags,
            albumIds: mergedAlbumIds,
          });
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
            store.updateTarget(existing.id, {
              ...target,
              id: existing.id,
            });
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
            store.upsertGroup({
              ...group,
              targetIds: [...new Set(group.targetIds ?? [])],
            });
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
        const s = settings as Record<string, unknown>;
        // Bulk-apply all known settings keys via zustand setState
        // This ensures every backed-up setting is restored, not just a subset
        const knownKeys = [
          // Viewer defaults
          "defaultStretch",
          "defaultColormap",
          "defaultGridColumns",
          "thumbnailQuality",
          "thumbnailSize",
          "defaultExportFormat",
          // Target / session / location
          "autoGroupByObject",
          "autoDetectDuplicates",
          "autoTagLocation",
          "mapPreset",
          "mapShowOverlays",
          "sessionGapMinutes",
          "calendarSyncEnabled",
          "defaultReminderMinutes",
          // Display / theme
          "language",
          "theme",
          "orientationLock",
          "hapticsEnabled",
          "confirmDestructiveActions",
          "autoCheckUpdates",
          "themeColorMode",
          "accentColor",
          "activePreset",
          "customThemeColors",
          "fontFamily",
          "monoFontFamily",
          // Viewer overlay defaults
          "defaultShowGrid",
          "defaultShowCrosshair",
          "defaultShowPixelInfo",
          "defaultShowMinimap",
          "defaultBlackPoint",
          "defaultWhitePoint",
          "defaultGamma",
          // Histogram
          "defaultHistogramMode",
          "histogramHeight",
          "pixelInfoDecimalPlaces",
          // Gallery sorting
          "defaultGallerySortBy",
          "defaultGallerySortOrder",
          // Stacking
          "defaultStackMethod",
          "defaultSigmaValue",
          "defaultAlignmentMode",
          "defaultEnableQuality",
          "stackingDetectionProfile",
          "stackingDetectSigmaThreshold",
          "stackingDetectMaxStars",
          "stackingDetectMinArea",
          "stackingDetectMaxArea",
          "stackingDetectBorderMargin",
          "stackingBackgroundMeshSize",
          "stackingDeblendNLevels",
          "stackingDeblendMinContrast",
          "stackingFilterFwhm",
          "stackingMaxFwhm",
          "stackingMaxEllipticity",
          "stackingRansacMaxIterations",
          "stackingAlignmentInlierThreshold",
          // Grid/crosshair styles
          "gridColor",
          "gridOpacity",
          "crosshairColor",
          "crosshairOpacity",
          // Canvas
          "canvasMinScale",
          "canvasMaxScale",
          "canvasDoubleTapScale",
          "canvasPinchSensitivity",
          "canvasPinchOverzoomFactor",
          "canvasPanRubberBandFactor",
          "canvasWheelZoomSensitivity",
          // Thumbnail overlays
          "thumbnailShowFilename",
          "thumbnailShowObject",
          "thumbnailShowFilter",
          "thumbnailShowExposure",
          // File list / converter / editor
          "fileListStyle",
          "defaultConverterFormat",
          "defaultConverterQuality",
          "batchNamingRule",
          "defaultBlurSigma",
          "defaultSharpenAmount",
          "defaultDenoiseRadius",
          "editorMaxUndo",
          // Timeline / session display
          "timelineGrouping",
          "sessionShowExposureCount",
          "sessionShowTotalExposure",
          "sessionShowFilters",
          // Target sorting
          "targetSortBy",
          "targetSortOrder",
          // Compose
          "defaultComposePreset",
          "composeRedWeight",
          "composeGreenWeight",
          "composeBlueWeight",
          // Performance
          "imageProcessingDebounce",
          "useHighQualityPreview",
        ] as const;
        const patch: Record<string, unknown> = {};
        for (const key of knownKeys) {
          if (s[key] !== undefined) {
            patch[key] = s[key];
          }
        }
        if (Object.keys(patch).length > 0) {
          const applyPatch = settingsStore.getState().applySettingsPatch;
          applyPatch(patch as Parameters<typeof applyPatch>[0]);
        }
      },
    };
  }, [fitsStore, albumStore, targetStore, targetGroupStore, sessionStore, settingsStore]);

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

  /**
   * 连接到云服务
   */
  const connectProvider = useCallback(
    async (providerType: CloudProvider, config?: CloudProviderConfig): Promise<boolean> => {
      try {
        let resolvedConfig = config;

        // For OAuth providers without pre-existing tokens, initiate OAuth flow
        if (!resolvedConfig?.accessToken) {
          if (providerType === "onedrive") {
            resolvedConfig = await authenticateOneDrive();
          } else if (providerType === "dropbox") {
            resolvedConfig = await authenticateDropbox();
          }
          // google-drive handles its own sign-in inside connect()
          // webdav requires config with url/username/password
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
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress)
        return { success: false, error: "Operation in progress" };

      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) {
        const msg = "Provider not connected";
        setLastError(msg);
        return { success: false, error: msg };
      }

      // Check network connectivity
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
          const msg = "No internet connection";
          setLastError(msg);
          return { success: false, error: msg };
        }
      } catch {
        /* proceed if check fails */
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
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress)
        return { success: false, error: "Operation in progress" };

      const provider = getOrCreateProvider(providerType);
      if (!provider.isConnected()) {
        const msg = "Provider not connected";
        setLastError(msg);
        return { success: false, error: msg };
      }

      // Check network connectivity
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (!networkState.isConnected || !networkState.isInternetReachable) {
          const msg = "No internet connection";
          setLastError(msg);
          return { success: false, error: msg };
        }
      } catch {
        /* proceed if check fails */
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
      buildRestoreTarget,
      reconcileAlbumFileConsistency,
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

  /**
   * 导出本地备份
   */
  const localExport = useCallback(
    async (
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress)
        return { success: false, error: "Operation in progress" };

      try {
        setBackupInProgress(true);
        setLastError(null);

        const dataSource = buildDataSource();
        const result = await exportLocalBackup(dataSource, options, (p: BackupProgress) =>
          setProgress(p),
        );

        resetProgress();
        if (!result.success) {
          setLastError(result.error ?? "Export failed");
        }
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

  /**
   * 选择并预览本地备份文件（不执行恢复）
   */
  const previewLocalImport = useCallback(async (): Promise<{
    success: boolean;
    cancelled?: boolean;
    error?: string;
    preview?: LocalBackupPreview;
  }> => {
    try {
      const result = await previewLocalBackup();
      if (!result.success) {
        return {
          success: false,
          cancelled: result.cancelled,
          error: result.error,
        };
      }

      if (!result.manifest || !result.summary) {
        return { success: false, error: "Invalid backup file format" };
      }

      return {
        success: true,
        preview: {
          fileName: result.fileName ?? "backup.json",
          manifest: result.manifest,
          summary: result.summary,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Preview failed",
      };
    }
  }, []);

  /**
   * 从本地文件导入备份
   */
  const localImport = useCallback(
    async (
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
      preview?: LocalBackupPreview,
    ): Promise<{ success: boolean; error?: string }> => {
      if (backupInProgress || restoreInProgress)
        return { success: false, error: "Operation in progress" };

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
        if (!result.success) {
          setLastError(result.error ?? "Import failed");
        }
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
    localExport,
    localImport,
    previewLocalImport,
  };
}
