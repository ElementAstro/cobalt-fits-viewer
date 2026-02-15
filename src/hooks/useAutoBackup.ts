/**
 * 自动备份调度 Hook
 * 在 app 前台激活时检查是否需要自动备份
 */

import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import * as Network from "expo-network";
import { useBackupStore } from "../stores/useBackupStore";
import { useBackup } from "./useBackup";
import { Logger } from "../lib/logger";

const TAG = "AutoBackup";

export function useAutoBackup() {
  const runningRef = useRef(false);

  const autoBackupEnabled = useBackupStore((s) => s.autoBackupEnabled);
  const autoBackupIntervalHours = useBackupStore((s) => s.autoBackupIntervalHours);
  const lastAutoBackupCheck = useBackupStore((s) => s.lastAutoBackupCheck);
  const setLastAutoBackupCheck = useBackupStore((s) => s.setLastAutoBackupCheck);
  const connections = useBackupStore((s) => s.connections);
  const activeProvider = useBackupStore((s) => s.activeProvider);

  const { backup, backupInProgress, restoreInProgress } = useBackup();

  useEffect(() => {
    if (!autoBackupEnabled) return;

    const checkAndRunAutoBackup = async () => {
      // Guard against concurrent runs
      if (runningRef.current) return;
      if (backupInProgress || restoreInProgress) return;

      // Check if interval has elapsed
      const now = Date.now();
      const intervalMs = autoBackupIntervalHours * 60 * 60 * 1000;
      if (now - lastAutoBackupCheck < intervalMs) return;

      // Find a connected provider to backup to
      const providerType = activeProvider ?? connections.find((c) => c.connected)?.provider;
      if (!providerType) {
        Logger.debug(TAG, "No connected provider for auto backup");
        return;
      }

      // Check Wi-Fi connectivity
      try {
        const networkState = await Network.getNetworkStateAsync();
        if (networkState.type !== Network.NetworkStateType.WIFI) {
          Logger.debug(TAG, "Skipping auto backup: not on Wi-Fi");
          return;
        }
        if (!networkState.isConnected || !networkState.isInternetReachable) {
          Logger.debug(TAG, "Skipping auto backup: no internet");
          return;
        }
      } catch {
        Logger.debug(TAG, "Skipping auto backup: network check failed");
        return;
      }

      // Run backup
      runningRef.current = true;
      Logger.info(TAG, `Starting auto backup to ${providerType}`);

      try {
        setLastAutoBackupCheck(now);
        const result = await backup(providerType);
        if (result.success) {
          Logger.info(TAG, "Auto backup completed successfully");
        } else {
          Logger.warn(TAG, `Auto backup failed: ${result.error}`);
        }
      } catch (error) {
        Logger.error(TAG, "Auto backup error", { error });
      } finally {
        runningRef.current = false;
      }
    };

    // Check on mount
    checkAndRunAutoBackup();

    // Check when app comes to foreground
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        checkAndRunAutoBackup();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    autoBackupEnabled,
    autoBackupIntervalHours,
    lastAutoBackupCheck,
    setLastAutoBackupCheck,
    connections,
    activeProvider,
    backup,
    backupInProgress,
    restoreInProgress,
  ]);
}
