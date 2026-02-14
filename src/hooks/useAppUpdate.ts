/**
 * App update hook using expo-updates
 * Provides OTA update checking, downloading, and applying functionality.
 * Uses the native useUpdates() hook for reactive state management.
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import * as Updates from "expo-updates";
import { Logger } from "../lib/logger";
import { getAppVersionInfo } from "../lib/version";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "ready"
  | "upToDate"
  | "error";

export interface AppUpdateState {
  /** Current update status */
  status: UpdateStatus;
  /** Error message if status is 'error' */
  error: string | null;
  /** Whether an update is available for download */
  isUpdateAvailable: boolean;
  /** Whether an update has been downloaded and is pending restart */
  isUpdatePending: boolean;
  /** Whether a check or download is in progress */
  isLoading: boolean;
  /** Timestamp of last successful check */
  lastCheckedAt: number | null;
  /** App version (native binary version) */
  appVersion: string;
  /** Runtime version */
  runtimeVersion: string | null;
  /** Whether currently running embedded (built-in) code */
  isEmbeddedLaunch: boolean;
  /** Check for available updates */
  checkForUpdate: () => Promise<void>;
  /** Download the available update */
  downloadUpdate: () => Promise<void>;
  /** Apply the downloaded update (restarts the app) */
  applyUpdate: () => Promise<void>;
  /** Check, download, and apply in one step */
  updateAndRestart: () => Promise<void>;
  /** Reset error state */
  clearError: () => void;
}

export function useAppUpdate(): AppUpdateState {
  const {
    currentlyRunning,
    isUpdateAvailable: nativeUpdateAvailable,
    isUpdatePending: nativeUpdatePending,
  } = Updates.useUpdates();

  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);

  const versionInfo = useMemo(() => getAppVersionInfo(), []);

  // Sync native hook state → local status
  useEffect(() => {
    if (nativeUpdatePending && status !== "ready") {
      setStatus("ready");
      Logger.info("AppUpdate", "Update downloaded, ready to apply");
    } else if (
      nativeUpdateAvailable &&
      status !== "available" &&
      status !== "downloading" &&
      status !== "ready"
    ) {
      setStatus("available");
      Logger.info("AppUpdate", "Update available");
    }
  }, [nativeUpdateAvailable, nativeUpdatePending, status]);

  const isUpdateAvailable = status === "available" || nativeUpdateAvailable;
  const isUpdatePending = status === "ready" || nativeUpdatePending;
  const isLoading = status === "checking" || status === "downloading";

  const checkForUpdate = useCallback(async () => {
    if (__DEV__) {
      setStatus("upToDate");
      setLastCheckedAt(Date.now());
      return;
    }

    try {
      setStatus("checking");
      setError(null);

      const result = await Updates.checkForUpdateAsync();

      if (result.isAvailable) {
        setStatus("available");
        Logger.info("AppUpdate", "Update available");
      } else {
        setStatus("upToDate");
        Logger.info("AppUpdate", "App is up to date");
      }
      setLastCheckedAt(Date.now());
    } catch (e) {
      Logger.error("AppUpdate", "Update check failed", e);
      setStatus("error");
      setError(e instanceof Error ? e.message : "Unknown error");
    }
  }, []);

  const downloadUpdate = useCallback(async () => {
    if (__DEV__) return;

    try {
      setStatus("downloading");
      setError(null);

      await Updates.fetchUpdateAsync();

      setStatus("ready");
      Logger.info("AppUpdate", "Update downloaded, ready to apply");
    } catch (e) {
      Logger.error("AppUpdate", "Update download failed", e);
      setStatus("error");
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (__DEV__) return;

    try {
      await Updates.reloadAsync();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Restart failed");
    }
  }, []);

  const updateAndRestart = useCallback(async () => {
    if (__DEV__) {
      setStatus("upToDate");
      setLastCheckedAt(Date.now());
      return;
    }

    try {
      setStatus("checking");
      setError(null);

      const checkResult = await Updates.checkForUpdateAsync();

      if (!checkResult.isAvailable) {
        setStatus("upToDate");
        setLastCheckedAt(Date.now());
        return;
      }

      setStatus("downloading");
      await Updates.fetchUpdateAsync();

      setStatus("ready");
      await Updates.reloadAsync();
    } catch (e) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Update failed");
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  return {
    status,
    error,
    isUpdateAvailable,
    isUpdatePending,
    isLoading,
    lastCheckedAt,
    appVersion: versionInfo.nativeVersion,
    runtimeVersion: versionInfo.runtimeVersion,
    isEmbeddedLaunch: currentlyRunning.isEmbeddedLaunch,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    updateAndRestart,
    clearError,
  };
}
