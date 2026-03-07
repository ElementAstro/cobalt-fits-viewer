/**
 * 局域网传输 Hook
 * 管理发送端/接收端状态，复用现有备份数据源和恢复目标
 */

import { useState, useCallback, useRef } from "react";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { useAlbumStore } from "../../stores/gallery/useAlbumStore";
import { useTargetStore } from "../../stores/observation/useTargetStore";
import { useTargetGroupStore } from "../../stores/observation/useTargetGroupStore";
import { useSessionStore } from "../../stores/observation/useSessionStore";
import { useSettingsStore } from "../../stores/app/useSettingsStore";
import { useFileGroupStore } from "../../stores/files/useFileGroupStore";
import { useAstrometryStore } from "../../stores/processing/useAstrometryStore";
import { useTrashStore } from "../../stores/files/useTrashStore";
import { useBackupStore } from "../../stores/app/useBackupStore";
import { createDataSource } from "../../lib/backup/dataSourceFactory";
import { createRestoreTarget } from "../../lib/backup/restoreTargetFactory";
import { createManifest } from "../../lib/backup/manifest";
import { buildFullPackage, importFromPackage } from "../../lib/backup/localBackup";
import { reconcileAllStores } from "../../lib/targets/targetIntegrity";
import { computeAlbumFileConsistencyPatches } from "../../lib/gallery/albumSync";
import type { BackupOptions, BackupProgress } from "../../lib/backup/types";
import { DEFAULT_BACKUP_OPTIONS } from "../../lib/backup/types";
import {
  startLANServer,
  downloadFromLAN,
  type LANServerHandle,
  type LANServerInfo,
} from "../../lib/backup/lanTransfer";

export type LANSendStatus = "idle" | "preparing" | "ready" | "error";
export type LANReceiveStatus =
  | "idle"
  | "connecting"
  | "downloading"
  | "importing"
  | "done"
  | "error";

export function useLANTransfer() {
  const [sendStatus, setSendStatus] = useState<LANSendStatus>("idle");
  const [sendInfo, setSendInfo] = useState<LANServerInfo | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const serverRef = useRef<LANServerHandle | null>(null);

  const [receiveStatus, setReceiveStatus] = useState<LANReceiveStatus>("idle");
  const [receiveProgress, setReceiveProgress] = useState<BackupProgress>({
    phase: "idle",
    current: 0,
    total: 0,
  });
  const [receiveError, setReceiveError] = useState<string | null>(null);

  const fitsStore = useFitsStore;
  const albumStore = useAlbumStore;
  const targetStore = useTargetStore;
  const targetGroupStore = useTargetGroupStore;
  const sessionStore = useSessionStore;
  const settingsStore = useSettingsStore;
  const fileGroupStore = useFileGroupStore;
  const astrometryStore = useAstrometryStore;
  const trashStore = useTrashStore;

  const addHistoryEntry = useBackupStore((s) => s.addHistoryEntry);
  const setAutoBackupEnabled = useBackupStore((s) => s.setAutoBackupEnabled);
  const setAutoBackupIntervalHours = useBackupStore((s) => s.setAutoBackupIntervalHours);
  const setAutoBackupNetwork = useBackupStore((s) => s.setAutoBackupNetwork);
  const setActiveProvider = useBackupStore((s) => s.setActiveProvider);

  const buildDataSource = useCallback(
    () =>
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
    () =>
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

  /**
   * 发送端：打包并启动 HTTP Server
   */
  const startSending = useCallback(
    async (options: BackupOptions = DEFAULT_BACKUP_OPTIONS): Promise<boolean> => {
      try {
        setSendStatus("preparing");
        setSendError(null);
        setSendInfo(null);

        const dataSource = buildDataSource();
        const manifest = createManifest(
          {
            files: dataSource.getFiles(),
            albums: dataSource.getAlbums(),
            targets: dataSource.getTargets(),
            targetGroups: dataSource.getTargetGroups(),
            sessions: dataSource.getSessions(),
            plans: dataSource.getPlans(),
            logEntries: dataSource.getLogEntries(),
            settings: dataSource.getSettings(),
            fileGroups: dataSource.getFileGroups(),
            astrometry: dataSource.getAstrometry(),
            trash: dataSource.getTrash(),
            sessionRuntime: { activeSession: dataSource.getActiveSession() },
            backupPrefs: dataSource.getBackupPrefs(),
          },
          options,
        );

        const fullPackage = await buildFullPackage(manifest, options);

        const handle = await startLANServer(fullPackage.zipFile.uri, manifest);
        serverRef.current = handle;
        setSendInfo(handle.info);
        setSendStatus("ready");
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : "Failed to start LAN server";
        setSendError(msg);
        setSendStatus("error");
        return false;
      }
    },
    [buildDataSource],
  );

  /**
   * 发送端：停止 Server
   */
  const stopSending = useCallback(() => {
    serverRef.current?.stop();
    serverRef.current = null;
    setSendStatus("idle");
    setSendInfo(null);
    setSendError(null);
  }, []);

  /**
   * 接收端：连接并下载备份
   */
  const startReceiving = useCallback(
    async (
      host: string,
      port: number,
      pin: string,
      options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        setReceiveStatus("connecting");
        setReceiveError(null);

        setReceiveStatus("downloading");
        const result = await downloadFromLAN(host, port, pin, (p) => setReceiveProgress(p));

        if (!result.success || !result.zipPath) {
          setReceiveError(result.error ?? "Download failed");
          setReceiveStatus("error");
          addHistoryEntry({
            type: "lan-receive",
            provider: "local",
            result: "failed",
            error: result.error,
          });
          return { success: false, error: result.error };
        }

        setReceiveStatus("importing");
        const restoreTarget = buildRestoreTarget();
        const importResult = await importFromPackage(restoreTarget, result.zipPath, options, (p) =>
          setReceiveProgress(p),
        );

        if (importResult.success) {
          reconcileAlbumFileConsistency();
          reconcileAllStores();
          addHistoryEntry({ type: "lan-receive", provider: "local", result: "success" });
          setReceiveStatus("done");
          return { success: true };
        } else {
          setReceiveError(importResult.error ?? "Import failed");
          setReceiveStatus("error");
          addHistoryEntry({
            type: "lan-receive",
            provider: "local",
            result: "failed",
            error: importResult.error,
          });
          return { success: false, error: importResult.error };
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : "LAN receive failed";
        setReceiveError(msg);
        setReceiveStatus("error");
        addHistoryEntry({ type: "lan-receive", provider: "local", result: "failed", error: msg });
        return { success: false, error: msg };
      }
    },
    [buildRestoreTarget, reconcileAlbumFileConsistency, addHistoryEntry],
  );

  const resetReceive = useCallback(() => {
    setReceiveStatus("idle");
    setReceiveProgress({ phase: "idle", current: 0, total: 0 });
    setReceiveError(null);
  }, []);

  return {
    // Send
    sendStatus,
    sendInfo,
    sendError,
    startSending,
    stopSending,
    // Receive
    receiveStatus,
    receiveProgress,
    receiveError,
    startReceiving,
    resetReceive,
  };
}
