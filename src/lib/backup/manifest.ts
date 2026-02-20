/**
 * 备份 Manifest 生成与解析
 */

import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Device from "expo-device";
import * as Crypto from "expo-crypto";
import type {
  BackupDomain,
  BackupFileRecord,
  BackupManifest,
  BackupOptions,
  BackupPrefs,
  BackupSessionRuntimeState,
} from "./types";
import { MANIFEST_VERSION } from "./types";
import type {
  FitsMetadata,
  Album,
  Target,
  ObservationSession,
  TargetGroup,
  ObservationPlan,
  ObservationLogEntry,
  FileGroup,
  TrashedFitsRecord,
} from "../fits/types";
import {
  DEFAULT_ASTROMETRY_CONFIG,
  type AstrometryConfig,
  type AstrometryJob,
} from "../astrometry/types";

function inferMediaKind(
  file: Pick<FitsMetadata, "sourceType">,
): NonNullable<FitsMetadata["mediaKind"]> {
  if (file.sourceType === "video") return "video";
  if (file.sourceType === "audio") return "audio";
  return "image";
}

function normalizeManifestFile(file: BackupFileRecord): BackupFileRecord {
  if (file.mediaKind) return file;
  return {
    ...file,
    mediaKind: inferMediaKind(file),
  };
}

function createSnapshotId(): string {
  try {
    return Crypto.randomUUID();
  } catch {
    return `snapshot-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
}

function buildDomains(options: BackupOptions): BackupDomain[] {
  const domains: BackupDomain[] = [];
  if (options.includeFiles) domains.push("files");
  if (options.includeThumbnails) domains.push("thumbnails");
  if (options.includeAlbums) domains.push("albums");
  if (options.includeTargets) domains.push("targets", "targetGroups");
  if (options.includeSessions) domains.push("sessions", "plans", "logEntries");
  if (options.includeSettings) domains.push("settings");
  domains.push("fileGroups", "astrometry", "trash", "sessionRuntime", "backupPrefs");
  return domains;
}

interface ManifestDataInput {
  files: FitsMetadata[];
  albums: Album[];
  targets: Target[];
  targetGroups: TargetGroup[];
  sessions: ObservationSession[];
  plans: ObservationPlan[];
  logEntries: ObservationLogEntry[];
  settings: Record<string, unknown>;
  fileGroups: {
    groups: FileGroup[];
    fileGroupMap: Record<string, string[]>;
  };
  astrometry: {
    config: AstrometryConfig;
    jobs: AstrometryJob[];
  };
  trash: TrashedFitsRecord[];
  sessionRuntime: BackupSessionRuntimeState;
  backupPrefs: BackupPrefs;
}

/**
 * 生成备份 Manifest
 */
export function createManifest(data: ManifestDataInput, options: BackupOptions): BackupManifest {
  const domains = buildDomains(options);
  const fileGroups = data.fileGroups ?? {
    groups: [],
    fileGroupMap: {},
  };
  const astrometry = data.astrometry ?? {
    config: {} as AstrometryConfig,
    jobs: [],
  };
  const backupPrefs: BackupPrefs = data.backupPrefs ?? {
    activeProvider: null,
    autoBackupEnabled: false,
    autoBackupIntervalHours: 24,
    autoBackupNetwork: "wifi",
  };

  return {
    version: MANIFEST_VERSION,
    snapshotId: createSnapshotId(),
    appVersion: Application.nativeApplicationVersion ?? "unknown",
    createdAt: new Date().toISOString(),
    deviceName: Device.deviceName ?? Device.modelName ?? "Unknown Device",
    platform: Platform.OS,
    capabilities: {
      supportsBinary: options.includeFiles,
      supportsThumbnails: options.includeThumbnails,
      localPayloadMode: options.localPayloadMode,
      encryptedLocalPackage: options.localEncryption.enabled,
    },
    domains,
    files: options.includeFiles ? data.files.map((file) => normalizeManifestFile(file)) : [],
    thumbnails: options.includeThumbnails ? [] : [],
    albums: options.includeAlbums ? data.albums : [],
    targets: options.includeTargets ? data.targets : [],
    targetGroups: options.includeTargets ? data.targetGroups : [],
    sessions: options.includeSessions ? data.sessions : [],
    plans: options.includeSessions ? data.plans : [],
    logEntries: options.includeSessions ? data.logEntries : [],
    settings: options.includeSettings ? data.settings : {},
    fileGroups: {
      groups: fileGroups.groups ?? [],
      fileGroupMap: fileGroups.fileGroupMap ?? {},
    },
    astrometry: {
      config: astrometry.config,
      jobs: astrometry.jobs ?? [],
    },
    trash: data.trash ?? [],
    sessionRuntime: data.sessionRuntime ?? { activeSession: null },
    backupPrefs,
  };
}

function parseObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseAstrometryConfig(value: unknown): AstrometryConfig {
  const config = parseObject(value);
  if (!config) return { ...DEFAULT_ASTROMETRY_CONFIG };

  const scaleUnits =
    config.defaultScaleUnits === "degwidth" ||
    config.defaultScaleUnits === "arcminwidth" ||
    config.defaultScaleUnits === "arcsecperpix"
      ? config.defaultScaleUnits
      : DEFAULT_ASTROMETRY_CONFIG.defaultScaleUnits;

  return {
    apiKey: typeof config.apiKey === "string" ? config.apiKey : DEFAULT_ASTROMETRY_CONFIG.apiKey,
    serverUrl:
      typeof config.serverUrl === "string" ? config.serverUrl : DEFAULT_ASTROMETRY_CONFIG.serverUrl,
    useCustomServer:
      typeof config.useCustomServer === "boolean"
        ? config.useCustomServer
        : DEFAULT_ASTROMETRY_CONFIG.useCustomServer,
    maxConcurrent:
      typeof config.maxConcurrent === "number"
        ? config.maxConcurrent
        : DEFAULT_ASTROMETRY_CONFIG.maxConcurrent,
    autoSolve:
      typeof config.autoSolve === "boolean"
        ? config.autoSolve
        : DEFAULT_ASTROMETRY_CONFIG.autoSolve,
    defaultScaleUnits: scaleUnits,
    defaultScaleLower:
      typeof config.defaultScaleLower === "number" ? config.defaultScaleLower : undefined,
    defaultScaleUpper:
      typeof config.defaultScaleUpper === "number" ? config.defaultScaleUpper : undefined,
  };
}

function validateCrossReferences(manifest: BackupManifest): boolean {
  const fileIds = new Set(manifest.files.map((file) => file.id));
  const groupIds = new Set(manifest.fileGroups.groups.map((group) => group.id));

  for (const album of manifest.albums) {
    for (const imageId of album.imageIds ?? []) {
      if (!fileIds.has(imageId)) return false;
    }
  }

  for (const [fileId, mappedGroupIds] of Object.entries(manifest.fileGroups.fileGroupMap)) {
    if (!fileIds.has(fileId)) return false;
    for (const groupId of mappedGroupIds) {
      if (!groupIds.has(groupId)) return false;
    }
  }

  for (const job of manifest.astrometry.jobs) {
    if (!job.fileId || !fileIds.has(job.fileId)) return false;
  }

  for (const thumb of manifest.thumbnails) {
    if (!fileIds.has(thumb.fileId)) return false;
  }

  return true;
}

/**
 * 解析并验证 Manifest
 */
export function parseManifest(json: string): BackupManifest | null {
  try {
    const data = JSON.parse(json) as Partial<BackupManifest>;
    if (!data.version || !data.createdAt) return null;
    if (data.version > MANIFEST_VERSION) return null;

    const fileGroupsRaw = parseObject(data.fileGroups) ?? {};
    const astrometryRaw = parseObject(data.astrometry) ?? {};
    const sessionRuntimeRaw = parseObject(data.sessionRuntime) ?? {};
    const backupPrefsRaw = parseObject(data.backupPrefs) ?? {};

    const manifest: BackupManifest = {
      version: data.version,
      snapshotId: data.snapshotId ?? `legacy-${data.createdAt}`,
      appVersion: data.appVersion ?? "unknown",
      createdAt: data.createdAt,
      deviceName: data.deviceName ?? "Unknown Device",
      platform: data.platform ?? "unknown",
      capabilities: {
        supportsBinary: true,
        supportsThumbnails: Array.isArray(data.thumbnails) && data.thumbnails.length > 0,
        localPayloadMode: "metadata-only",
        encryptedLocalPackage: false,
        ...(parseObject(data.capabilities) as BackupManifest["capabilities"] | null),
      },
      domains: Array.isArray(data.domains) ? data.domains : [],
      files: Array.isArray(data.files) ? data.files.map((file) => normalizeManifestFile(file)) : [],
      thumbnails: Array.isArray(data.thumbnails) ? data.thumbnails : [],
      albums: Array.isArray(data.albums) ? data.albums : [],
      targets: Array.isArray(data.targets) ? data.targets : [],
      targetGroups: Array.isArray(data.targetGroups) ? data.targetGroups : [],
      sessions: Array.isArray(data.sessions) ? data.sessions : [],
      plans: Array.isArray(data.plans) ? data.plans : [],
      logEntries: Array.isArray(data.logEntries) ? data.logEntries : [],
      settings: data.settings && typeof data.settings === "object" ? data.settings : {},
      fileGroups: {
        groups: Array.isArray(fileGroupsRaw.groups) ? (fileGroupsRaw.groups as FileGroup[]) : [],
        fileGroupMap:
          (parseObject(fileGroupsRaw.fileGroupMap) as Record<string, string[]> | null) ?? {},
      },
      astrometry: {
        config: parseAstrometryConfig(astrometryRaw.config),
        jobs: Array.isArray(astrometryRaw.jobs) ? (astrometryRaw.jobs as AstrometryJob[]) : [],
      },
      trash: Array.isArray(data.trash) ? data.trash : [],
      sessionRuntime: {
        activeSession:
          parseObject(sessionRuntimeRaw.activeSession) === null
            ? null
            : (sessionRuntimeRaw.activeSession as BackupSessionRuntimeState["activeSession"]),
      },
      backupPrefs: {
        activeProvider:
          backupPrefsRaw.activeProvider === "google-drive" ||
          backupPrefsRaw.activeProvider === "onedrive" ||
          backupPrefsRaw.activeProvider === "dropbox" ||
          backupPrefsRaw.activeProvider === "webdav"
            ? backupPrefsRaw.activeProvider
            : null,
        autoBackupEnabled: backupPrefsRaw.autoBackupEnabled === true,
        autoBackupIntervalHours:
          typeof backupPrefsRaw.autoBackupIntervalHours === "number"
            ? backupPrefsRaw.autoBackupIntervalHours
            : 24,
        autoBackupNetwork: backupPrefsRaw.autoBackupNetwork === "any" ? "any" : "wifi",
      },
    };

    if (manifest.version >= 4 && !validateCrossReferences(manifest)) {
      return null;
    }
    return manifest;
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
  thumbnailCount: number;
  albumCount: number;
  targetCount: number;
  targetGroupCount: number;
  sessionCount: number;
  planCount: number;
  logEntryCount: number;
  fileGroupCount: number;
  trashCount: number;
  astrometryJobCount: number;
  hasSettings: boolean;
  createdAt: string;
  deviceName: string;
  appVersion: string;
} {
  return {
    fileCount: manifest.files.length,
    thumbnailCount: manifest.thumbnails.length,
    albumCount: manifest.albums.length,
    targetCount: manifest.targets.length,
    targetGroupCount: manifest.targetGroups.length,
    sessionCount: manifest.sessions.length,
    planCount: manifest.plans.length,
    logEntryCount: manifest.logEntries.length,
    fileGroupCount: manifest.fileGroups.groups.length,
    trashCount: manifest.trash.length,
    astrometryJobCount: manifest.astrometry.jobs.length,
    hasSettings: Object.keys(manifest.settings).length > 0,
    createdAt: manifest.createdAt,
    deviceName: manifest.deviceName,
    appVersion: manifest.appVersion,
  };
}
