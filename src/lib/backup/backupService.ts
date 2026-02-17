/**
 * 备份/恢复核心服务
 * Provider 无关的备份逻辑
 */

import { File } from "expo-file-system";
import type { ICloudProvider } from "./cloudProvider";
import { createManifest } from "./manifest";
import { LOG_TAGS, Logger } from "../logger";
import type { BackupOptions, BackupProgress, BackupInfo, RestoreConflictStrategy } from "./types";
import { DEFAULT_BACKUP_OPTIONS, BACKUP_DIR, FITS_SUBDIR } from "./types";
import type { FitsMetadata, Album, Target, ObservationSession } from "../fits/types";
import { getFitsDir } from "../utils/fileManager";

const TAG = LOG_TAGS.BackupService;

export interface BackupDataSource {
  getFiles(): FitsMetadata[];
  getAlbums(): Album[];
  getTargets(): Target[];
  getSessions(): ObservationSession[];
  getSettings(): Record<string, unknown>;
}

export interface RestoreTarget {
  setFiles(files: FitsMetadata[], strategy?: RestoreConflictStrategy): void;
  setAlbums(albums: Album[], strategy?: RestoreConflictStrategy): void;
  setTargets(targets: Target[], strategy?: RestoreConflictStrategy): void;
  setSessions(sessions: ObservationSession[], strategy?: RestoreConflictStrategy): void;
  setSettings(settings: Record<string, unknown>): void;
}

function toSafeRemoteFilename(meta: FitsMetadata): string {
  const safeName = meta.filename.replace(/[^\w.-]/g, "_");
  return `${meta.id}_${safeName}`;
}

/**
 * 执行完整备份
 */
export async function performBackup(
  provider: ICloudProvider,
  dataSource: BackupDataSource,
  options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
  onProgress?: (progress: BackupProgress) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  Logger.info(TAG, `Starting backup to ${provider.displayName}`);

  onProgress?.({
    phase: "preparing",
    current: 0,
    total: 0,
  });

  // Ensure backup directory exists
  await provider.ensureBackupDir();

  // Collect data
  const manifest = createManifest(
    {
      files: dataSource.getFiles(),
      albums: dataSource.getAlbums(),
      targets: dataSource.getTargets(),
      sessions: dataSource.getSessions(),
      settings: dataSource.getSettings(),
    },
    options,
  );

  const filesToUpload: FitsMetadata[] = options.includeFiles
    ? manifest.files.filter((f) => {
        const file = new File(f.filepath);
        return file.exists;
      })
    : [];

  const total = filesToUpload.length + 1; // +1 for manifest
  let current = 0;

  // Upload FITS files
  if (filesToUpload.length > 0) {
    onProgress?.({
      phase: "uploading",
      current: 0,
      total: filesToUpload.length,
    });

    for (const meta of filesToUpload) {
      if (abortSignal?.aborted) {
        throw new Error("Backup cancelled");
      }

      try {
        const remotePath = `${BACKUP_DIR}/${FITS_SUBDIR}/${toSafeRemoteFilename(meta)}`;
        await provider.uploadFile(meta.filepath, remotePath);
        current++;

        onProgress?.({
          phase: "uploading",
          current,
          total,
          currentFile: meta.filename,
        });
      } catch (error) {
        Logger.error(TAG, `Failed to upload: ${meta.filename}`, { error });
        throw error;
      }
    }
  }

  // Upload manifest
  onProgress?.({
    phase: "finalizing",
    current: total - 1,
    total,
  });

  await provider.uploadManifest(manifest);

  onProgress?.({
    phase: "idle",
    current: total,
    total,
  });

  Logger.info(TAG, `Backup complete: ${filesToUpload.length} files`);
}

/**
 * 执行恢复
 */
export async function performRestore(
  provider: ICloudProvider,
  restoreTarget: RestoreTarget,
  options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
  onProgress?: (progress: BackupProgress) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  Logger.info(TAG, `Starting restore from ${provider.displayName}`);

  onProgress?.({
    phase: "preparing",
    current: 0,
    total: 0,
  });

  // Download manifest
  onProgress?.({
    phase: "downloading",
    current: 0,
    total: 1,
    currentFile: "manifest.json",
  });

  const manifest = await provider.downloadManifest();
  if (!manifest) {
    throw new Error("No backup found or manifest is invalid");
  }

  // Restore metadata
  if (options.includeAlbums && manifest.albums.length > 0) {
    restoreTarget.setAlbums(manifest.albums, options.restoreConflictStrategy);
  }
  if (options.includeTargets && manifest.targets.length > 0) {
    restoreTarget.setTargets(manifest.targets, options.restoreConflictStrategy);
  }
  if (options.includeSessions && manifest.sessions.length > 0) {
    restoreTarget.setSessions(manifest.sessions, options.restoreConflictStrategy);
  }
  if (options.includeSettings && Object.keys(manifest.settings).length > 0) {
    restoreTarget.setSettings(manifest.settings);
  }

  // Download FITS files
  if (options.includeFiles && manifest.files.length > 0) {
    const fitsDir = getFitsDir();
    const total = manifest.files.length;
    let current = 0;
    const restoredFiles: FitsMetadata[] = [];

    onProgress?.({
      phase: "downloading",
      current: 0,
      total,
    });

    for (const meta of manifest.files) {
      if (abortSignal?.aborted) {
        throw new Error("Restore cancelled");
      }

      try {
        const remotePath = `${BACKUP_DIR}/${FITS_SUBDIR}/${toSafeRemoteFilename(meta)}`;
        const legacyRemotePath = `${BACKUP_DIR}/${FITS_SUBDIR}/${meta.filename}`;
        const localPath = new File(fitsDir, meta.filename).uri;

        // Skip if file already exists locally
        const localFile = new File(localPath);
        if (localFile.exists) {
          restoredFiles.push({
            ...meta,
            filepath: localPath,
          });
          current++;
          onProgress?.({
            phase: "downloading",
            current,
            total,
            currentFile: meta.filename,
          });
          continue;
        }

        try {
          await provider.downloadFile(remotePath, localPath);
        } catch {
          // Compatibility: old backups used filename as remote key.
          await provider.downloadFile(legacyRemotePath, localPath);
        }
        restoredFiles.push({
          ...meta,
          filepath: localPath,
        });
        current++;

        onProgress?.({
          phase: "downloading",
          current,
          total,
          currentFile: meta.filename,
        });
      } catch (error) {
        Logger.error(TAG, `Failed to download: ${meta.filename}`, { error });
        // Continue with remaining files
      }
    }

    restoreTarget.setFiles(restoredFiles, options.restoreConflictStrategy);
  }

  onProgress?.({
    phase: "idle",
    current: 0,
    total: 0,
  });

  Logger.info(TAG, "Restore complete");
}

/**
 * 获取远端备份信息
 */
export async function getBackupInfo(provider: ICloudProvider): Promise<BackupInfo | null> {
  try {
    const manifest = await provider.downloadManifest();
    if (!manifest) return null;

    let totalSize = 0;
    for (const f of manifest.files) {
      totalSize += f.fileSize;
    }

    return {
      provider: provider.name,
      manifestDate: manifest.createdAt,
      fileCount: manifest.files.length,
      totalSize,
      deviceName: manifest.deviceName,
      appVersion: manifest.appVersion,
    };
  } catch {
    return null;
  }
}
