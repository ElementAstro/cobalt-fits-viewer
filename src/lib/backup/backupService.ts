/**
 * 备份/恢复核心服务
 * Provider 无关的备份逻辑
 */

import { File } from "expo-file-system";
import type { ICloudProvider } from "./cloudProvider";
import { createManifest } from "./manifest";
import { LOG_TAGS, Logger } from "../logger";
import {
  toSafeRemoteFilename,
  toSafeThumbnailFilename,
  computeSha256Hex,
  inferMediaKind,
  resolveRestoreStrategy,
  restoreMetadataDomains,
  withRetry,
} from "./backupUtils";
import type {
  CloudProvider,
  BackupOptions,
  BackupProgress,
  BackupInfo,
  RestoreConflictStrategy,
  BackupThumbnailRecord,
} from "./types";
import {
  DEFAULT_BACKUP_OPTIONS,
  BACKUP_DIR,
  FITS_SUBDIR,
  THUMBNAIL_SUBDIR,
  type BackupFileRecord,
} from "./types";
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
import { getFitsDir } from "../utils/fileManager";
import { ensureThumbnailDir, getThumbnailPath, hasThumbnail } from "../gallery/thumbnailCache";

const TAG = LOG_TAGS.BackupService;

export interface BackupDataSource {
  getFiles(): FitsMetadata[];
  getAlbums(): Album[];
  getTargets(): Target[];
  getTargetGroups(): TargetGroup[];
  getSessions(): ObservationSession[];
  getPlans(): ObservationPlan[];
  getLogEntries(): ObservationLogEntry[];
  getSettings(): Record<string, unknown>;
  getFileGroups(): { groups: FileGroup[]; fileGroupMap: Record<string, string[]> };
  getAstrometry(): { config: AstrometryConfig; jobs: AstrometryJob[] };
  getTrash(): TrashedFitsRecord[];
  getActiveSession(): {
    id: string;
    startedAt: number;
    pausedAt?: number;
    totalPausedMs: number;
    notes: { timestamp: number; text: string }[];
    status: "running" | "paused";
  } | null;
  getBackupPrefs(): {
    activeProvider: CloudProvider | null;
    autoBackupEnabled: boolean;
    autoBackupIntervalHours: number;
    autoBackupNetwork: "wifi" | "any";
  };
}

export interface RestoreTarget {
  setFiles(files: FitsMetadata[], strategy?: RestoreConflictStrategy): void;
  setAlbums(albums: Album[], strategy?: RestoreConflictStrategy): void;
  setTargets(targets: Target[], strategy?: RestoreConflictStrategy): void;
  setTargetGroups(groups: TargetGroup[], strategy?: RestoreConflictStrategy): void;
  setSessions(sessions: ObservationSession[], strategy?: RestoreConflictStrategy): void;
  setPlans(plans: ObservationPlan[], strategy?: RestoreConflictStrategy): void;
  setLogEntries(entries: ObservationLogEntry[], strategy?: RestoreConflictStrategy): void;
  setSettings(settings: Record<string, unknown>): void;
  setFileGroups(
    data: { groups: FileGroup[]; fileGroupMap: Record<string, string[]> },
    strategy?: RestoreConflictStrategy,
  ): void;
  setAstrometry(
    data: { config: AstrometryConfig; jobs: AstrometryJob[] },
    strategy?: RestoreConflictStrategy,
  ): void;
  setTrash(items: TrashedFitsRecord[], strategy?: RestoreConflictStrategy): void;
  setActiveSession(
    activeSession: {
      id: string;
      startedAt: number;
      pausedAt?: number;
      totalPausedMs: number;
      notes: { timestamp: number; text: string }[];
      status: "running" | "paused";
    } | null,
    strategy?: RestoreConflictStrategy,
  ): void;
  setBackupPrefs(prefs: {
    activeProvider: CloudProvider | null;
    autoBackupEnabled: boolean;
    autoBackupIntervalHours: number;
    autoBackupNetwork: "wifi" | "any";
  }): void;
}

function getLeafName(path: string): string {
  return path.split("/").filter(Boolean).pop() ?? path;
}

function normalizeRestoredMeta(meta: FitsMetadata, filepath: string): FitsMetadata {
  return {
    ...meta,
    filepath,
    mediaKind: meta.mediaKind ?? inferMediaKind(meta),
  };
}

function shouldDownloadBinary(strategy: RestoreConflictStrategy, localExists: boolean): boolean {
  if (!localExists) return true;
  if (strategy === "overwrite-existing") return true;
  return false;
}

async function verifyBinary(
  file: File,
  meta: BackupFileRecord | BackupThumbnailRecord,
): Promise<boolean> {
  const binaryInfo = "binary" in meta ? meta.binary : undefined;
  const expectedSize = ("size" in meta ? meta.size : undefined) ?? binaryInfo?.size;
  const expectedHash =
    ("contentHash" in meta ? meta.contentHash : undefined) ?? binaryInfo?.contentHash;
  if (expectedSize != null && file.size != null && file.size !== expectedSize) {
    return false;
  }
  if (expectedHash) {
    const hash = await computeSha256Hex(await file.bytes());
    if (hash !== expectedHash) return false;
  }
  return true;
}

async function pruneRemoteDirectory(
  provider: ICloudProvider,
  remoteDirPath: string,
  keepLeafNames: Set<string>,
): Promise<void> {
  try {
    const remoteFiles = await provider.listFiles(remoteDirPath);
    for (const remoteFile of remoteFiles) {
      if (remoteFile.isDirectory) continue;
      if (keepLeafNames.has(remoteFile.name)) continue;
      const remotePath = `${remoteDirPath}/${remoteFile.name}`;
      try {
        await provider.deleteFile(remotePath);
      } catch (error) {
        Logger.warn(TAG, `Failed to prune stale remote file: ${remotePath}`, { error });
      }
    }
  } catch (error) {
    Logger.warn(TAG, `Failed to list remote directory for pruning: ${remoteDirPath}`, { error });
  }
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

  await provider.ensureBackupDir();

  // Fetch existing remote manifest for incremental backup
  let remoteManifest: Awaited<ReturnType<ICloudProvider["downloadManifest"]>> = null;
  try {
    remoteManifest = await provider.downloadManifest();
  } catch {
    // First backup or manifest unavailable — full upload
  }

  const remoteFileHashes = new Map<string, { hash: string; remotePath: string; size: number }>();
  const remoteThumbHashes = new Map<string, { hash: string; remotePath: string; size: number }>();
  if (remoteManifest) {
    for (const file of remoteManifest.files) {
      if (file.binary?.contentHash && file.binary.remotePath) {
        remoteFileHashes.set(file.id, {
          hash: file.binary.contentHash,
          remotePath: file.binary.remotePath,
          size: file.binary.size ?? 0,
        });
      }
    }
    for (const thumb of remoteManifest.thumbnails) {
      if (thumb.contentHash) {
        remoteThumbHashes.set(thumb.fileId, {
          hash: thumb.contentHash,
          remotePath: thumb.remotePath,
          size: thumb.size ?? 0,
        });
      }
    }
  }

  const manifest = createManifest(
    {
      files: dataSource.getFiles(),
      albums: dataSource.getAlbums(),
      targets: dataSource.getTargets(),
      targetGroups: dataSource.getTargetGroups(),
      sessions: dataSource.getSessions(),
      plans: dataSource.getPlans(),
      logEntries: dataSource.getLogEntries(),
      settings: dataSource.getSettings(),
      fileGroups: dataSource.getFileGroups(),
      astrometry: dataSource.getAstrometry(),
      trash: dataSource.getTrash(),
      sessionRuntime: {
        activeSession: dataSource.getActiveSession(),
      },
      backupPrefs: dataSource.getBackupPrefs(),
    },
    options,
  );

  const filesToUpload: BackupFileRecord[] = options.includeFiles
    ? manifest.files.filter((f) => {
        const file = new File(f.filepath);
        return file.exists;
      })
    : [];

  const thumbsToUpload: Array<{ fileId: string; localPath: string; filename: string }> =
    options.includeThumbnails
      ? manifest.files
          .map((file) => ({
            fileId: file.id,
            localPath: getThumbnailPath(file.id),
            filename: toSafeThumbnailFilename(file.id),
          }))
          .filter((thumb) => hasThumbnail(thumb.fileId))
      : [];

  const total = filesToUpload.length + thumbsToUpload.length + 1;
  let current = 0;
  let skippedFiles = 0;

  // Pre-calculate byte totals for progress tracking
  let bytesTotal = 0;
  let bytesTransferred = 0;
  for (const meta of filesToUpload) {
    const f = new File(meta.filepath);
    bytesTotal += f.size ?? 0;
  }
  for (const thumb of thumbsToUpload) {
    const f = new File(thumb.localPath);
    bytesTotal += f.size ?? 0;
  }

  const fileRecordMap = new Map(manifest.files.map((f) => [f.id, f]));

  for (const meta of filesToUpload) {
    if (abortSignal?.aborted) throw new Error("Backup cancelled");

    const remotePath = `${BACKUP_DIR}/${FITS_SUBDIR}/${toSafeRemoteFilename(meta)}`;
    const fileObj = new File(meta.filepath);
    const fileSize = fileObj.size ?? 0;

    // Check if file is unchanged on remote — skip upload when hash matches
    const remoteInfo = remoteFileHashes.get(meta.id);
    if (remoteInfo) {
      const bytes = await fileObj.bytes();
      const hash = await computeSha256Hex(bytes);
      const size = fileObj.size ?? bytes.length;

      if (remoteInfo.hash === hash) {
        const item = fileRecordMap.get(meta.id);
        if (item) {
          item.binary = {
            remotePath: remoteInfo.remotePath,
            size: remoteInfo.size,
            contentHash: remoteInfo.hash,
            hashAlgorithm: "SHA-256",
          };
        }
        skippedFiles += 1;
        bytesTransferred += fileSize;
        current += 1;
        onProgress?.({
          phase: "uploading",
          current,
          total,
          currentFile: meta.filename,
          bytesTransferred,
          bytesTotal,
        });
        continue;
      }

      // Hash changed — upload needed, reuse computed hash for manifest
      await withRetry(
        () =>
          provider.uploadFile(
            meta.filepath,
            remotePath,
            (fraction) => {
              onProgress?.({
                phase: "uploading",
                current,
                total,
                currentFile: meta.filename,
                bytesTransferred: bytesTransferred + Math.round(fraction * fileSize),
                bytesTotal,
              });
            },
            abortSignal,
          ),
        `upload ${meta.filename}`,
      );

      const item = fileRecordMap.get(meta.id);
      if (item) {
        item.binary = {
          remotePath,
          size,
          contentHash: hash,
          hashAlgorithm: "SHA-256",
        };
      }
    } else {
      // No remote entry — first upload, compute hash after upload
      await withRetry(
        () =>
          provider.uploadFile(
            meta.filepath,
            remotePath,
            (fraction) => {
              onProgress?.({
                phase: "uploading",
                current,
                total,
                currentFile: meta.filename,
                bytesTransferred: bytesTransferred + Math.round(fraction * fileSize),
                bytesTotal,
              });
            },
            abortSignal,
          ),
        `upload ${meta.filename}`,
      );

      const bytes = await fileObj.bytes();
      const hash = await computeSha256Hex(bytes);
      const size = fileObj.size ?? bytes.length;

      const item = fileRecordMap.get(meta.id);
      if (item) {
        item.binary = {
          remotePath,
          size,
          contentHash: hash,
          hashAlgorithm: "SHA-256",
        };
      }
    }

    bytesTransferred += fileSize;
    current += 1;
    onProgress?.({
      phase: "uploading",
      current,
      total,
      currentFile: meta.filename,
      bytesTransferred,
      bytesTotal,
    });
  }

  for (const thumb of thumbsToUpload) {
    if (abortSignal?.aborted) throw new Error("Backup cancelled");

    const remotePath = `${BACKUP_DIR}/${THUMBNAIL_SUBDIR}/${thumb.filename}`;
    const thumbFileObj = new File(thumb.localPath);
    const thumbSize = thumbFileObj.size ?? 0;

    // Compute hash first for incremental comparison
    const bytes = await thumbFileObj.bytes();
    const hash = await computeSha256Hex(bytes);
    const size = thumbFileObj.size ?? bytes.length;

    // Check if thumbnail is unchanged on remote — skip upload
    const remoteThumb = remoteThumbHashes.get(thumb.fileId);
    if (remoteThumb && remoteThumb.hash === hash) {
      manifest.thumbnails.push({
        fileId: thumb.fileId,
        filename: thumb.filename,
        remotePath: remoteThumb.remotePath,
        size: remoteThumb.size,
        contentHash: remoteThumb.hash,
        hashAlgorithm: "SHA-256",
      });
      skippedFiles += 1;
      bytesTransferred += thumbSize;
      current += 1;
      onProgress?.({
        phase: "uploading",
        current,
        total,
        currentFile: thumb.filename,
        bytesTransferred,
        bytesTotal,
      });
      continue;
    }

    await withRetry(
      () =>
        provider.uploadFile(
          thumb.localPath,
          remotePath,
          (fraction) => {
            onProgress?.({
              phase: "uploading",
              current,
              total,
              currentFile: thumb.filename,
              bytesTransferred: bytesTransferred + Math.round(fraction * thumbSize),
              bytesTotal,
            });
          },
          abortSignal,
        ),
      `upload thumbnail ${thumb.filename}`,
    );

    manifest.thumbnails.push({
      fileId: thumb.fileId,
      filename: thumb.filename,
      remotePath,
      size,
      contentHash: hash,
      hashAlgorithm: "SHA-256",
    });

    bytesTransferred += thumbSize;
    current += 1;
    onProgress?.({
      phase: "uploading",
      current,
      total,
      currentFile: thumb.filename,
      bytesTransferred,
      bytesTotal,
    });
  }

  onProgress?.({
    phase: "finalizing",
    current,
    total,
  });

  await provider.uploadManifest(manifest);

  // Keep only latest snapshot objects remotely.
  const keepFileNames = new Set(
    manifest.files
      .map(
        (file) =>
          file.binary?.remotePath ?? `${BACKUP_DIR}/${FITS_SUBDIR}/${toSafeRemoteFilename(file)}`,
      )
      .map((path) => getLeafName(path)),
  );
  const keepThumbNames = new Set(manifest.thumbnails.map((thumb) => getLeafName(thumb.remotePath)));

  await pruneRemoteDirectory(provider, `${BACKUP_DIR}/${FITS_SUBDIR}`, keepFileNames);
  await pruneRemoteDirectory(provider, `${BACKUP_DIR}/${THUMBNAIL_SUBDIR}`, keepThumbNames);

  onProgress?.({
    phase: "idle",
    current: total,
    total,
  });

  Logger.info(
    TAG,
    `Backup complete: ${filesToUpload.length} files, ${thumbsToUpload.length} thumbnails (${skippedFiles} skipped, incremental)`,
  );
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

  const manifest = await provider.downloadManifest();
  if (!manifest) {
    throw new Error("No backup found or manifest is invalid");
  }

  restoreMetadataDomains(restoreTarget, manifest, options);

  const strategy = resolveRestoreStrategy(options.restoreConflictStrategy);

  const downloadTotal =
    (options.includeFiles ? manifest.files.length : 0) +
    (options.includeThumbnails ? manifest.thumbnails.length : 0);
  let current = 0;

  // Pre-calculate byte totals from manifest for progress tracking
  let bytesTotal = 0;
  let bytesTransferred = 0;
  if (options.includeFiles) {
    for (const meta of manifest.files) {
      bytesTotal += meta.binary?.size ?? meta.fileSize ?? 0;
    }
  }
  if (options.includeThumbnails) {
    for (const thumb of manifest.thumbnails) {
      bytesTotal += thumb.size ?? 0;
    }
  }

  const restoredFiles: FitsMetadata[] = [];
  if (options.includeFiles && manifest.files.length > 0) {
    const fitsDir = getFitsDir();

    onProgress?.({
      phase: "downloading",
      current,
      total: downloadTotal,
      bytesTransferred: 0,
      bytesTotal,
    });

    for (const meta of manifest.files) {
      if (abortSignal?.aborted) throw new Error("Restore cancelled");

      const localPath = new File(fitsDir, meta.filename).uri;
      const localFile = new File(localPath);
      const localExists = localFile.exists;
      const needDownload = shouldDownloadBinary(strategy, localExists);
      const expectedSize = meta.binary?.size ?? meta.fileSize ?? 0;

      if (needDownload) {
        const preferredPath =
          meta.binary?.remotePath ?? `${BACKUP_DIR}/${FITS_SUBDIR}/${toSafeRemoteFilename(meta)}`;
        const legacyRemotePath = `${BACKUP_DIR}/${FITS_SUBDIR}/${meta.filename}`;

        const dlProgress = (fraction: number) => {
          onProgress?.({
            phase: "downloading",
            current,
            total: downloadTotal,
            currentFile: meta.filename,
            bytesTransferred: bytesTransferred + Math.round(fraction * expectedSize),
            bytesTotal,
          });
        };

        try {
          await withRetry(
            () => provider.downloadFile(preferredPath, localPath, dlProgress, abortSignal),
            `download ${meta.filename}`,
          );
        } catch {
          await withRetry(
            () => provider.downloadFile(legacyRemotePath, localPath, dlProgress, abortSignal),
            `download ${meta.filename} (legacy)`,
          );
        }

        const verified = await verifyBinary(new File(localPath), meta);
        if (!verified) {
          Logger.warn(TAG, `Skipped file due to integrity mismatch: ${meta.filename}`);
          bytesTransferred += expectedSize;
          current += 1;
          onProgress?.({
            phase: "downloading",
            current,
            total: downloadTotal,
            currentFile: meta.filename,
            bytesTransferred,
            bytesTotal,
          });
          continue;
        }
      } else if (!localExists) {
        bytesTransferred += expectedSize;
        current += 1;
        onProgress?.({
          phase: "downloading",
          current,
          total: downloadTotal,
          currentFile: meta.filename,
          bytesTransferred,
          bytesTotal,
        });
        continue;
      }

      restoredFiles.push(normalizeRestoredMeta(meta, localPath));
      bytesTransferred += expectedSize;
      current += 1;
      onProgress?.({
        phase: "downloading",
        current,
        total: downloadTotal,
        currentFile: meta.filename,
        bytesTransferred,
        bytesTotal,
      });
    }

    restoreTarget.setFiles(restoredFiles, strategy);
  }

  if (options.includeThumbnails && manifest.thumbnails.length > 0) {
    ensureThumbnailDir();
    for (const thumb of manifest.thumbnails) {
      if (abortSignal?.aborted) throw new Error("Restore cancelled");
      const localPath = getThumbnailPath(thumb.fileId);
      const localFile = new File(localPath);
      const localExists = localFile.exists;
      const needDownload = shouldDownloadBinary(strategy, localExists);
      const thumbExpectedSize = thumb.size ?? 0;

      if (needDownload) {
        const preferredPath =
          thumb.remotePath ??
          `${BACKUP_DIR}/${THUMBNAIL_SUBDIR}/${toSafeThumbnailFilename(thumb.fileId)}`;
        const fallbackPath = `${BACKUP_DIR}/${THUMBNAIL_SUBDIR}/${thumb.filename}`;

        const dlProgress = (fraction: number) => {
          onProgress?.({
            phase: "downloading",
            current,
            total: downloadTotal,
            currentFile: thumb.filename,
            bytesTransferred: bytesTransferred + Math.round(fraction * thumbExpectedSize),
            bytesTotal,
          });
        };

        try {
          await withRetry(
            () => provider.downloadFile(preferredPath, localPath, dlProgress, abortSignal),
            `download thumbnail ${thumb.fileId}`,
          );
        } catch {
          await withRetry(
            () => provider.downloadFile(fallbackPath, localPath, dlProgress, abortSignal),
            `download thumbnail ${thumb.fileId} (fallback)`,
          );
        }
        const verified = await verifyBinary(new File(localPath), thumb);
        if (!verified) {
          Logger.warn(TAG, `Skipped thumbnail due to integrity mismatch: ${thumb.fileId}`);
        }
      }

      bytesTransferred += thumbExpectedSize;
      current += 1;
      onProgress?.({
        phase: "downloading",
        current,
        total: downloadTotal,
        currentFile: thumb.filename,
        bytesTransferred,
        bytesTotal,
      });
    }
  }

  onProgress?.({
    phase: "idle",
    current: 0,
    total: 0,
  });

  Logger.info(TAG, "Restore complete");
}

export interface BackupVerifyResult {
  valid: boolean;
  totalFiles: number;
  totalThumbnails: number;
  missingFiles: string[];
  missingThumbnails: string[];
}

/**
 * 独立校验远端备份完整性
 * 下载 manifest，逐一检查远端文件是否存在且 hash 匹配
 */
export async function verifyBackupIntegrity(
  provider: ICloudProvider,
  onProgress?: (current: number, total: number) => void,
): Promise<BackupVerifyResult> {
  const manifest = await provider.downloadManifest();
  if (!manifest) {
    return {
      valid: false,
      totalFiles: 0,
      totalThumbnails: 0,
      missingFiles: [],
      missingThumbnails: [],
    };
  }

  const missingFiles: string[] = [];
  const missingThumbnails: string[] = [];
  const total = manifest.files.length + manifest.thumbnails.length;
  let current = 0;

  const remoteFileSet = new Set<string>();
  try {
    const filesInDir = await provider.listFiles(`${BACKUP_DIR}/${FITS_SUBDIR}`);
    for (const f of filesInDir) {
      if (!f.isDirectory) remoteFileSet.add(f.name);
    }
  } catch {
    // directory may not exist
  }

  const remoteThumbSet = new Set<string>();
  try {
    const thumbsInDir = await provider.listFiles(`${BACKUP_DIR}/${THUMBNAIL_SUBDIR}`);
    for (const f of thumbsInDir) {
      if (!f.isDirectory) remoteThumbSet.add(f.name);
    }
  } catch {
    // directory may not exist
  }

  for (const file of manifest.files) {
    const remotePath = file.binary?.remotePath;
    const leafName = remotePath ? getLeafName(remotePath) : toSafeRemoteFilename(file);
    if (!remoteFileSet.has(leafName)) {
      missingFiles.push(file.filename);
    }
    current += 1;
    onProgress?.(current, total);
  }

  for (const thumb of manifest.thumbnails) {
    const leafName = thumb.remotePath
      ? getLeafName(thumb.remotePath)
      : toSafeThumbnailFilename(thumb.fileId);
    if (!remoteThumbSet.has(leafName)) {
      missingThumbnails.push(thumb.filename);
    }
    current += 1;
    onProgress?.(current, total);
  }

  const valid = missingFiles.length === 0 && missingThumbnails.length === 0;

  Logger.info(
    TAG,
    `Backup verification: ${valid ? "PASSED" : "FAILED"} — ${missingFiles.length} missing files, ${missingThumbnails.length} missing thumbs`,
  );

  return {
    valid,
    totalFiles: manifest.files.length,
    totalThumbnails: manifest.thumbnails.length,
    missingFiles,
    missingThumbnails,
  };
}

/**
 * 获取远端备份信息
 */
export async function getBackupInfo(provider: ICloudProvider): Promise<BackupInfo | null> {
  try {
    const manifest = await provider.downloadManifest();
    if (!manifest) return null;

    let totalSize = 0;
    for (const file of manifest.files) {
      totalSize += file.binary?.size ?? file.fileSize ?? 0;
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
