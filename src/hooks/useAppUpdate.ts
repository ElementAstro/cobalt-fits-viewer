/**
 * App update hook using expo-updates
 * Provides OTA update checking, downloading, and applying functionality.
 */

import { useState, useCallback, useEffect, useRef } from "react";
import * as Updates from "expo-updates";
import Constants from "expo-constants";

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
  /** App version from expo-constants */
  appVersion: string;
  /** Runtime version */
  runtimeVersion: string | null;
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
  const [status, setStatus] = useState<UpdateStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.manifest2?.extra?.expoClient?.version ?? "1.0.0";

  const runtimeVersion =
    (typeof Constants.expoConfig?.runtimeVersion === "string"
      ? Constants.expoConfig.runtimeVersion
      : null) ?? null;

  const isUpdateAvailable = status === "available";
  const isUpdatePending = status === "ready";
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

      if (!isMounted.current) return;

      if (result.isAvailable) {
        setStatus("available");
      } else {
        setStatus("upToDate");
      }
      setLastCheckedAt(Date.now());
    } catch (e) {
      if (!isMounted.current) return;
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

      if (!isMounted.current) return;
      setStatus("ready");
    } catch (e) {
      if (!isMounted.current) return;
      setStatus("error");
      setError(e instanceof Error ? e.message : "Download failed");
    }
  }, []);

  const applyUpdate = useCallback(async () => {
    if (__DEV__) return;

    try {
      await Updates.reloadAsync();
    } catch (e) {
      if (!isMounted.current) return;
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
      if (!isMounted.current) return;

      if (!checkResult.isAvailable) {
        setStatus("upToDate");
        setLastCheckedAt(Date.now());
        return;
      }

      setStatus("downloading");
      await Updates.fetchUpdateAsync();
      if (!isMounted.current) return;

      setStatus("ready");
      await Updates.reloadAsync();
    } catch (e) {
      if (!isMounted.current) return;
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
    appVersion,
    runtimeVersion,
    checkForUpdate,
    downloadUpdate,
    applyUpdate,
    updateAndRestart,
    clearError,
  };
}
