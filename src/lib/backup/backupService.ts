/**
 * 备份/恢复核心服务
 * Provider 无关的备份逻辑
 */

import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import type { ICloudProvider } from "./cloudProvider";
import { createManifest } from "./manifest";
import { LOG_TAGS, Logger } from "../logger";
import type {
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
    activeProvider: "google-drive" | "onedrive" | "dropbox" | "webdav" | null;
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
    activeProvider: "google-drive" | "onedrive" | "dropbox" | "webdav" | null;
    autoBackupEnabled: boolean;
    autoBackupIntervalHours: number;
    autoBackupNetwork: "wifi" | "any";
  }): void;
}

function inferMediaKind(
  meta: Pick<FitsMetadata, "sourceType">,
): NonNullable<FitsMetadata["mediaKind"]> {
  if (meta.sourceType === "video") return "video";
  if (meta.sourceType === "audio") return "audio";
  return "image";
}

function toSafeRemoteFilename(meta: FitsMetadata): string {
  const safeName = meta.filename.replace(/[^\w.-]/g, "_");
  return `${meta.id}_${safeName}`;
}

function toSafeThumbnailFilename(fileId: string): string {
  return `${fileId}.jpg`;
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

function resolveRestoreStrategy(
  strategy: RestoreConflictStrategy | undefined,
): RestoreConflictStrategy {
  return strategy ?? "skip-existing";
}

function shouldDownloadBinary(strategy: RestoreConflictStrategy, localExists: boolean): boolean {
  if (!localExists) return true;
  if (strategy === "overwrite-existing") return true;
  return false;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function normalizeDigestInput(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(bytes);
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalizeDigestInput(bytes),
  );
  return bytesToHex(digest);
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

  for (const meta of filesToUpload) {
    if (abortSignal?.aborted) throw new Error("Backup cancelled");

    const remotePath = `${BACKUP_DIR}/${FITS_SUBDIR}/${toSafeRemoteFilename(meta)}`;
    await provider.uploadFile(meta.filepath, remotePath);

    const uploaded = new File(meta.filepath);
    const bytes = await uploaded.bytes();
    const hash = await computeSha256Hex(bytes);
    const size = uploaded.size ?? bytes.length;
    const item = manifest.files.find((file) => file.id === meta.id);
    if (item) {
      item.binary = {
        remotePath,
        size,
        contentHash: hash,
        hashAlgorithm: "SHA-256",
      };
    }

    current += 1;
    onProgress?.({
      phase: "uploading",
      current,
      total,
      currentFile: meta.filename,
    });
  }

  for (const thumb of thumbsToUpload) {
    if (abortSignal?.aborted) throw new Error("Backup cancelled");

    const remotePath = `${BACKUP_DIR}/${THUMBNAIL_SUBDIR}/${thumb.filename}`;
    await provider.uploadFile(thumb.localPath, remotePath);

    const thumbFile = new File(thumb.localPath);
    const bytes = await thumbFile.bytes();
    const hash = await computeSha256Hex(bytes);
    const size = thumbFile.size ?? bytes.length;
    manifest.thumbnails.push({
      fileId: thumb.fileId,
      filename: thumb.filename,
      remotePath,
      size,
      contentHash: hash,
      hashAlgorithm: "SHA-256",
    });

    current += 1;
    onProgress?.({
      phase: "uploading",
      current,
      total,
      currentFile: thumb.filename,
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
    `Backup complete: ${filesToUpload.length} files, ${thumbsToUpload.length} thumbnails`,
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

  const strategy = resolveRestoreStrategy(options.restoreConflictStrategy);

  if (options.includeAlbums && manifest.albums.length > 0) {
    restoreTarget.setAlbums(manifest.albums, strategy);
  }
  if (options.includeTargets && manifest.targets.length > 0) {
    restoreTarget.setTargets(manifest.targets, strategy);
  }
  if (options.includeTargets && manifest.targetGroups.length > 0) {
    restoreTarget.setTargetGroups(manifest.targetGroups, strategy);
  }
  if (options.includeSessions && manifest.sessions.length > 0) {
    restoreTarget.setSessions(manifest.sessions, strategy);
  }
  if (options.includeSessions && manifest.plans.length > 0) {
    restoreTarget.setPlans(manifest.plans, strategy);
  }
  if (options.includeSessions && manifest.logEntries.length > 0) {
    restoreTarget.setLogEntries(manifest.logEntries, strategy);
  }
  if (options.includeSettings && Object.keys(manifest.settings).length > 0) {
    restoreTarget.setSettings(manifest.settings);
  }

  restoreTarget.setFileGroups(manifest.fileGroups, strategy);
  restoreTarget.setAstrometry(manifest.astrometry, strategy);
  restoreTarget.setTrash(manifest.trash, strategy);
  restoreTarget.setActiveSession(manifest.sessionRuntime.activeSession, strategy);
  restoreTarget.setBackupPrefs(manifest.backupPrefs);

  const downloadTotal =
    (options.includeFiles ? manifest.files.length : 0) +
    (options.includeThumbnails ? manifest.thumbnails.length : 0);
  let current = 0;

  const restoredFiles: FitsMetadata[] = [];
  if (options.includeFiles && manifest.files.length > 0) {
    const fitsDir = getFitsDir();

    onProgress?.({
      phase: "downloading",
      current,
      total: downloadTotal,
    });

    for (const meta of manifest.files) {
      if (abortSignal?.aborted) throw new Error("Restore cancelled");

      const localPath = new File(fitsDir, meta.filename).uri;
      const localFile = new File(localPath);
      const localExists = localFile.exists;
      const needDownload = shouldDownloadBinary(strategy, localExists);

      if (needDownload) {
        const preferredPath =
          meta.binary?.remotePath ?? `${BACKUP_DIR}/${FITS_SUBDIR}/${toSafeRemoteFilename(meta)}`;
        const legacyRemotePath = `${BACKUP_DIR}/${FITS_SUBDIR}/${meta.filename}`;

        try {
          await provider.downloadFile(preferredPath, localPath);
        } catch {
          await provider.downloadFile(legacyRemotePath, localPath);
        }

        const verified = await verifyBinary(new File(localPath), meta);
        if (!verified) {
          Logger.warn(TAG, `Skipped file due to integrity mismatch: ${meta.filename}`);
          current += 1;
          onProgress?.({
            phase: "downloading",
            current,
            total: downloadTotal,
            currentFile: meta.filename,
          });
          continue;
        }
      } else if (!localExists) {
        current += 1;
        onProgress?.({
          phase: "downloading",
          current,
          total: downloadTotal,
          currentFile: meta.filename,
        });
        continue;
      }

      restoredFiles.push(normalizeRestoredMeta(meta, localPath));
      current += 1;
      onProgress?.({
        phase: "downloading",
        current,
        total: downloadTotal,
        currentFile: meta.filename,
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

      if (needDownload) {
        const preferredPath =
          thumb.remotePath ??
          `${BACKUP_DIR}/${THUMBNAIL_SUBDIR}/${toSafeThumbnailFilename(thumb.fileId)}`;
        const fallbackPath = `${BACKUP_DIR}/${THUMBNAIL_SUBDIR}/${thumb.filename}`;
        try {
          await provider.downloadFile(preferredPath, localPath);
        } catch {
          await provider.downloadFile(fallbackPath, localPath);
        }
        const verified = await verifyBinary(new File(localPath), thumb);
        if (!verified) {
          Logger.warn(TAG, `Skipped thumbnail due to integrity mismatch: ${thumb.fileId}`);
        }
      }

      current += 1;
      onProgress?.({
        phase: "downloading",
        current,
        total: downloadTotal,
        currentFile: thumb.filename,
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
