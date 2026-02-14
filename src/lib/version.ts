/**
 * Unified app version info utilities.
 * Single source of truth for version-related data across the app.
 */

import * as Application from "expo-application";
import Constants from "expo-constants";

export interface AppVersionInfo {
  /** Native binary version (e.g. "1.0.0") */
  nativeVersion: string;
  /** Native build number (e.g. "1") */
  buildVersion: string | null;
  /** Runtime version for expo-updates compatibility */
  runtimeVersion: string | null;
  /** Expo SDK version */
  sdkVersion: string | undefined;
}

/**
 * Get unified app version info from native and Expo sources.
 * - `nativeVersion`: from the actual installed binary (Application.nativeApplicationVersion)
 * - `runtimeVersion`: from Constants.expoConfig, used for OTA update compatibility
 */
export function getAppVersionInfo(): AppVersionInfo {
  const runtimeVersion =
    typeof Constants.expoConfig?.runtimeVersion === "string"
      ? Constants.expoConfig.runtimeVersion
      : null;

  return {
    nativeVersion: Application.nativeApplicationVersion ?? "1.0.0",
    buildVersion: Application.nativeBuildVersion,
    runtimeVersion,
    sdkVersion: Constants.expoConfig?.sdkVersion,
  };
}
