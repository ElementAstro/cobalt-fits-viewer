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

export { createManifest, parseManifest, serializeManifest, getManifestSummary } from "./manifest";

export { performBackup, performRestore, getBackupInfo } from "./backupService";
export type { BackupDataSource, RestoreTarget } from "./backupService";

export { GoogleDriveProvider } from "./providers/googleDrive";
export { OneDriveProvider, ONEDRIVE_DISCOVERY, ONEDRIVE_SCOPES } from "./providers/onedrive";
export { DropboxProvider, DROPBOX_DISCOVERY } from "./providers/dropbox";
export { WebDAVProvider } from "./providers/webdav";
