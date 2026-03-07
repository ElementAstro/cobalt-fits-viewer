/**
 * BackupDataSource 工厂函数
 * 从 useBackup.ts 中提取，可独立于 React 测试
 */

import type { BackupDataSource } from "./backupService";
import type { useFitsStore } from "../../stores/files/useFitsStore";
import type { useAlbumStore } from "../../stores/gallery/useAlbumStore";
import type { useTargetStore } from "../../stores/observation/useTargetStore";
import type { useTargetGroupStore } from "../../stores/observation/useTargetGroupStore";
import type { useSessionStore } from "../../stores/observation/useSessionStore";
import type { useSettingsStore } from "../../stores/app/useSettingsStore";
import type { useFileGroupStore } from "../../stores/files/useFileGroupStore";
import type { useAstrometryStore } from "../../stores/processing/useAstrometryStore";
import type { useTrashStore } from "../../stores/files/useTrashStore";
import type { useBackupStore } from "../../stores/app/useBackupStore";
import { getSettingsBackupData } from "../../stores/app/useSettingsStore";

interface DataSourceStores {
  fitsStore: typeof useFitsStore;
  albumStore: typeof useAlbumStore;
  targetStore: typeof useTargetStore;
  targetGroupStore: typeof useTargetGroupStore;
  sessionStore: typeof useSessionStore;
  settingsStore: typeof useSettingsStore;
  fileGroupStore: typeof useFileGroupStore;
  astrometryStore: typeof useAstrometryStore;
  trashStore: typeof useTrashStore;
  backupStore: typeof useBackupStore;
}

export function createDataSource(stores: DataSourceStores): BackupDataSource {
  const {
    fitsStore,
    albumStore,
    targetStore,
    targetGroupStore,
    sessionStore,
    settingsStore,
    fileGroupStore,
    astrometryStore,
    trashStore,
    backupStore,
  } = stores;

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
      const state = backupStore.getState();
      return {
        activeProvider: state.activeProvider,
        autoBackupEnabled: state.autoBackupEnabled,
        autoBackupIntervalHours: state.autoBackupIntervalHours,
        autoBackupNetwork: state.autoBackupNetwork,
      };
    },
  };
}
