/**
 * 云备份相关类型定义
 */

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
import type { AstrometryConfig, AstrometryJob } from "../astrometry/types";

// ===== 云服务提供商 =====
export type CloudProvider = "google-drive" | "onedrive" | "dropbox" | "webdav";

export interface BackupBinaryInfo {
  remotePath?: string;
  size?: number;
  contentHash?: string;
  hashAlgorithm?: "SHA-256";
}

export interface BackupFileRecord extends FitsMetadata {
  binary?: BackupBinaryInfo;
}

export interface BackupThumbnailRecord {
  fileId: string;
  filename: string;
  remotePath: string;
  size?: number;
  contentHash?: string;
  hashAlgorithm?: "SHA-256";
}

export interface BackupAstrometryState {
  config: AstrometryConfig;
  jobs: AstrometryJob[];
}

export interface BackupFileGroupState {
  groups: FileGroup[];
  fileGroupMap: Record<string, string[]>;
}

export interface BackupSessionRuntimeState {
  activeSession: {
    id: string;
    startedAt: number;
    pausedAt?: number;
    totalPausedMs: number;
    notes: { timestamp: number; text: string }[];
    status: "running" | "paused";
  } | null;
}

export interface BackupPrefs {
  activeProvider: CloudProvider | null;
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoBackupNetwork: "wifi" | "any";
}

export interface BackupCapabilities {
  supportsBinary: boolean;
  supportsThumbnails: boolean;
  localPayloadMode: "full" | "metadata-only";
  encryptedLocalPackage: boolean;
}

export type BackupDomain =
  | "files"
  | "albums"
  | "targets"
  | "targetGroups"
  | "sessions"
  | "plans"
  | "logEntries"
  | "settings"
  | "thumbnails"
  | "fileGroups"
  | "astrometry"
  | "trash"
  | "sessionRuntime"
  | "backupPrefs";

// ===== 备份 Manifest =====
export interface BackupManifest {
  version: number;
  snapshotId: string;
  appVersion: string;
  createdAt: string;
  deviceName: string;
  platform: string;
  capabilities: BackupCapabilities;
  domains: BackupDomain[];
  files: BackupFileRecord[];
  thumbnails: BackupThumbnailRecord[];
  albums: Album[];
  targets: Target[];
  targetGroups: TargetGroup[];
  sessions: ObservationSession[];
  plans: ObservationPlan[];
  logEntries: ObservationLogEntry[];
  settings: Record<string, unknown>;
  fileGroups: BackupFileGroupState;
  astrometry: BackupAstrometryState;
  trash: TrashedFitsRecord[];
  sessionRuntime: BackupSessionRuntimeState;
  backupPrefs: BackupPrefs;
}

// ===== Provider 配置 =====
export interface CloudProviderConfig {
  provider: CloudProvider;
  // OAuth providers (Google Drive / OneDrive / Dropbox)
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: number;
  // WebDAV
  webdavUrl?: string;
  webdavUsername?: string;
  webdavPassword?: string;
}

// ===== 远端文件信息 =====
export interface RemoteFile {
  name: string;
  path: string;
  size: number;
  lastModified?: string;
  isDirectory: boolean;
  id?: string;
}

// ===== 备份进度 =====
export interface BackupProgress {
  phase: "preparing" | "uploading" | "downloading" | "finalizing" | "idle";
  current: number;
  total: number;
  currentFile?: string;
  bytesTransferred?: number;
  bytesTotal?: number;
}

// ===== 备份选项 =====
export interface BackupOptions {
  includeFiles: boolean;
  includeSettings: boolean;
  includeAlbums: boolean;
  includeTargets: boolean;
  includeSessions: boolean;
  includeThumbnails: boolean;
  localPayloadMode: "full" | "metadata-only";
  localEncryption: {
    enabled: boolean;
    password?: string;
  };
  restoreConflictStrategy?: RestoreConflictStrategy;
}

export const DEFAULT_BACKUP_OPTIONS: BackupOptions = {
  includeFiles: true,
  includeSettings: true,
  includeAlbums: true,
  includeTargets: true,
  includeSessions: true,
  includeThumbnails: false,
  localPayloadMode: "full",
  localEncryption: {
    enabled: false,
  },
  restoreConflictStrategy: "skip-existing",
};

export type RestoreConflictStrategy = "skip-existing" | "overwrite-existing" | "merge";

// ===== 备份信息 =====
export interface BackupInfo {
  provider: CloudProvider;
  manifestDate: string;
  fileCount: number;
  totalSize: number;
  deviceName: string;
  appVersion: string;
}

// ===== Provider 连接状态 =====
export interface ProviderConnectionState {
  provider: CloudProvider;
  connected: boolean;
  userName?: string;
  userEmail?: string;
  lastBackupDate?: number;
  quotaUsed?: number;
  quotaTotal?: number;
}

// ===== 备份 Store 状态 =====
export interface BackupStoreState {
  // 已配置的 providers
  connections: ProviderConnectionState[];
  // 当前活跃 provider
  activeProvider: CloudProvider | null;
  // 备份状态
  backupInProgress: boolean;
  restoreInProgress: boolean;
  progress: BackupProgress;
  // 自动备份
  autoBackupEnabled: boolean;
  autoBackupIntervalHours: number;
  autoBackupNetwork: "wifi" | "any";
  lastAutoBackupAttempt: number;
  lastAutoBackupCheck: number;
  // 错误
  lastError: string | null;
}

export interface CloudProviderCapabilities {
  supportsConditionalWrite?: boolean;
  supportsResumableUpload?: boolean;
  supportsContentHash?: boolean;
}

// ===== Provider 显示信息 =====
export const PROVIDER_DISPLAY: Record<
  CloudProvider,
  { name: string; icon: string; color: string }
> = {
  "google-drive": {
    name: "Google Drive",
    icon: "logo-google",
    color: "#4285F4",
  },
  onedrive: {
    name: "OneDrive",
    icon: "cloud-outline",
    color: "#0078D4",
  },
  dropbox: {
    name: "Dropbox",
    icon: "water-outline",
    color: "#0061FF",
  },
  webdav: {
    name: "WebDAV",
    icon: "server-outline",
    color: "#FF6600",
  },
};

export const BACKUP_DIR = "cobalt-backup";
export const MANIFEST_FILENAME = "manifest.json";
export const FITS_SUBDIR = "fits_files";
export const THUMBNAIL_SUBDIR = "thumbnails";
export const MANIFEST_VERSION = 4;
