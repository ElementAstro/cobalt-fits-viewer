/**
 * 备份 Manifest 生成与解析
 */

import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import type { BackupManifest, BackupOptions } from "./types";
import { MANIFEST_VERSION } from "./types";
import type { FitsMetadata, Album, Target, ObservationSession } from "../fits/types";

/**
 * 生成备份 Manifest
 */
export function createManifest(
  data: {
    files: FitsMetadata[];
    albums: Album[];
    targets: Target[];
    sessions: ObservationSession[];
    settings: Record<string, unknown>;
  },
  options: BackupOptions,
): BackupManifest {
  return {
    version: MANIFEST_VERSION,
    appVersion: Application.nativeApplicationVersion ?? "unknown",
    createdAt: new Date().toISOString(),
    deviceName: Device.deviceName ?? Device.modelName ?? "Unknown Device",
    platform: Platform.OS,
    files: options.includeFiles ? data.files : [],
    albums: options.includeAlbums ? data.albums : [],
    targets: options.includeTargets ? data.targets : [],
    sessions: options.includeSessions ? data.sessions : [],
    settings: options.includeSettings ? data.settings : {},
  };
}

/**
 * 解析并验证 Manifest
 */
export function parseManifest(json: string): BackupManifest | null {
  try {
    const data = JSON.parse(json) as Partial<BackupManifest>;
    if (!data.version || !data.createdAt) {
      return null;
    }
    if (data.version > MANIFEST_VERSION) {
      return null;
    }
    // Fill defaults for missing fields to handle older manifests gracefully
    return {
      version: data.version,
      appVersion: data.appVersion ?? "unknown",
      createdAt: data.createdAt,
      deviceName: data.deviceName ?? "Unknown Device",
      platform: data.platform ?? "unknown",
      files: Array.isArray(data.files) ? data.files : [],
      albums: Array.isArray(data.albums) ? data.albums : [],
      targets: Array.isArray(data.targets) ? data.targets : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      settings: data.settings && typeof data.settings === "object" ? data.settings : {},
    };
  } catch {
    return null;
  }
}

/**
 * 序列化 Manifest 为 JSON
 */
export function serializeManifest(manifest: BackupManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * 获取 Manifest 摘要信息
 */
export function getManifestSummary(manifest: BackupManifest): {
  fileCount: number;
  albumCount: number;
  targetCount: number;
  sessionCount: number;
  hasSettings: boolean;
  createdAt: string;
  deviceName: string;
  appVersion: string;
} {
  return {
    fileCount: manifest.files.length,
    albumCount: manifest.albums.length,
    targetCount: manifest.targets.length,
    sessionCount: manifest.sessions.length,
    hasSettings: Object.keys(manifest.settings).length > 0,
    createdAt: manifest.createdAt,
    deviceName: manifest.deviceName,
    appVersion: manifest.appVersion,
  };
}
