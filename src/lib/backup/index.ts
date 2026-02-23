/**
 * 云备份模块 barrel export
 */

export type {
  CloudProvider,
  CloudProviderConfig,
  BackupManifest,
  RemoteFile,
  BackupProgress,
  BackupOptions,
  RestoreConflictStrategy,
  BackupInfo,
  ProviderConnectionState,
  BackupStoreState,
} from "./types";

export {
  DEFAULT_BACKUP_OPTIONS,
  PROVIDER_DISPLAY,
  BACKUP_DIR,
  MANIFEST_FILENAME,
  FITS_SUBDIR,
  THUMBNAIL_SUBDIR,
  MANIFEST_VERSION,
} from "./types";

export type { ICloudProvider } from "./cloudProvider";
export { BaseCloudProvider } from "./cloudProvider";

export {
  createManifest,
  parseManifest,
  serializeManifest,
  getManifestSummary,
  inferMediaKind,
} from "./manifest";

export {
  toSafeRemoteFilename,
  toSafeThumbnailFilename,
  bytesToHex,
  computeSha256Hex,
  resolveRestoreStrategy,
  restoreMetadataDomains,
} from "./backupUtils";

export { performBackup, performRestore, getBackupInfo } from "./backupService";
export type { BackupDataSource, RestoreTarget } from "./backupService";

export {
  exportLocalBackup,
  importLocalBackup,
  previewLocalBackup,
  buildFullPackage,
  importFromPackage,
  type LocalBackupPreview,
} from "./localBackup";
export { authenticateOneDrive, authenticateDropbox } from "./oauthHelper";

export { GoogleDriveProvider } from "./providers/googleDrive";
export { OneDriveProvider, ONEDRIVE_DISCOVERY, ONEDRIVE_SCOPES } from "./providers/onedrive";
export { DropboxProvider, DROPBOX_DISCOVERY } from "./providers/dropbox";
export { WebDAVProvider } from "./providers/webdav";
export { SFTPProvider } from "./providers/sftp";

export {
  startLANServer,
  downloadFromLAN,
  type LANServerInfo,
  type LANServerHandle,
} from "./lanTransfer";
