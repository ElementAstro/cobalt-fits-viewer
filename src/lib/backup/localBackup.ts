/**
 * 本地备份/恢复服务
 * 支持:
 * - 元数据 JSON 备份
 * - 完整 ZIP 包备份（实体 + manifest + 缩略图）
 * - 可选口令加密封装（AES-GCM + PBKDF2）
 */

import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { createManifest, serializeManifest, parseManifest, getManifestSummary } from "./manifest";
import { LOG_TAGS, Logger } from "../logger";
import type { BackupManifest, BackupOptions, BackupProgress, BackupFileRecord } from "./types";
import { DEFAULT_BACKUP_OPTIONS } from "./types";
import type { BackupDataSource, RestoreTarget } from "./backupService";
import type { FitsMetadata } from "../fits/types";
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedEnvelope,
  type EncryptedBackupEnvelope,
} from "./localCrypto";
import { getFitsDir } from "../utils/fileManager";
import { ensureThumbnailDir, getThumbnailPath } from "../gallery/thumbnailCache";

const TAG = LOG_TAGS.LocalBackup;

type LocalBackupSourceType = "manifest-json" | "full-package" | "encrypted-package";

export interface LocalBackupPreview {
  fileName: string;
  sourceUri: string;
  sourceType: LocalBackupSourceType;
  encrypted: boolean;
  summary: ReturnType<typeof getManifestSummary>;
  manifest?: BackupManifest;
  encryptedEnvelope?: EncryptedBackupEnvelope;
}

interface PickLocalBackupResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  preview?: LocalBackupPreview;
}

function toSafeRemoteFilename(meta: BackupFileRecord): string {
  const safeName = meta.filename.replace(/[^\w.-]/g, "_");
  return `${meta.id}_${safeName}`;
}

function toSafeThumbnailFilename(fileId: string): string {
  return `${fileId}.jpg`;
}

function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  return bytesToHex(digest);
}

function createTempDirectory(prefix: string): Directory {
  const dir = new Directory(
    Paths.cache,
    `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  );
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

function cleanupPath(path: File | Directory | null | undefined): void {
  if (!path) return;
  try {
    if (path.exists) path.delete();
  } catch {
    // ignore cleanup failure
  }
}

type ZipModule = {
  zip: (source: string, target: string) => Promise<string>;
  unzip: (source: string, target: string) => Promise<string>;
};

function loadZipModule(): ZipModule {
  const mod = require("react-native-zip-archive") as ZipModule;
  if (!mod?.zip || !mod?.unzip) {
    throw new Error("zip module unavailable");
  }
  return mod;
}

function resolveManifestFromSummary(
  summary: Record<string, unknown> | undefined,
): ReturnType<typeof getManifestSummary> {
  return {
    fileCount: typeof summary?.fileCount === "number" ? summary.fileCount : 0,
    thumbnailCount: typeof summary?.thumbnailCount === "number" ? summary.thumbnailCount : 0,
    albumCount: typeof summary?.albumCount === "number" ? summary.albumCount : 0,
    targetCount: typeof summary?.targetCount === "number" ? summary.targetCount : 0,
    targetGroupCount: typeof summary?.targetGroupCount === "number" ? summary.targetGroupCount : 0,
    sessionCount: typeof summary?.sessionCount === "number" ? summary.sessionCount : 0,
    planCount: typeof summary?.planCount === "number" ? summary.planCount : 0,
    logEntryCount: typeof summary?.logEntryCount === "number" ? summary.logEntryCount : 0,
    fileGroupCount: typeof summary?.fileGroupCount === "number" ? summary.fileGroupCount : 0,
    trashCount: typeof summary?.trashCount === "number" ? summary.trashCount : 0,
    astrometryJobCount:
      typeof summary?.astrometryJobCount === "number" ? summary.astrometryJobCount : 0,
    hasSettings: summary?.hasSettings === true,
    createdAt:
      typeof summary?.createdAt === "string" ? summary.createdAt : new Date().toISOString(),
    deviceName: typeof summary?.deviceName === "string" ? summary.deviceName : "Unknown Device",
    appVersion: typeof summary?.appVersion === "string" ? summary.appVersion : "unknown",
  };
}

async function tryParsePreviewFromJsonFile(
  file: File,
  sourceUri: string,
  fileName: string,
): Promise<LocalBackupPreview | null> {
  const content = await file.text();
  const manifest = parseManifest(content);
  if (manifest) {
    return {
      fileName,
      sourceUri,
      sourceType: "manifest-json",
      encrypted: false,
      manifest,
      summary: getManifestSummary(manifest),
    };
  }

  const json = JSON.parse(content) as unknown;
  if (isEncryptedEnvelope(json)) {
    return {
      fileName,
      sourceUri,
      sourceType: "encrypted-package",
      encrypted: true,
      encryptedEnvelope: json,
      summary: resolveManifestFromSummary(json.summary),
    };
  }
  return null;
}

async function tryParsePreviewFromZipFile(
  sourceUri: string,
  fileName: string,
): Promise<LocalBackupPreview | null> {
  const zip = loadZipModule();
  const tmpExtractDir = createTempDirectory("backup_preview");
  try {
    await zip.unzip(sourceUri, tmpExtractDir.uri);
    const manifestFile = new File(tmpExtractDir, "manifest.json");
    if (!manifestFile.exists) return null;
    const content = await manifestFile.text();
    const manifest = parseManifest(content);
    if (!manifest) return null;
    return {
      fileName,
      sourceUri,
      sourceType: "full-package",
      encrypted: false,
      manifest,
      summary: getManifestSummary(manifest),
    };
  } finally {
    cleanupPath(tmpExtractDir);
  }
}

async function pickLocalBackup(): Promise<PickLocalBackupResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ["application/json", "application/zip", "application/octet-stream"],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { success: false, cancelled: true, error: "No file selected" };
  }

  const asset = result.assets[0];
  const sourceUri = asset.uri;
  const fileName = asset.name ?? "backup";
  const file = new File(sourceUri);
  if (!file.exists) {
    return { success: false, error: "Selected file not found" };
  }

  try {
    if (fileName.toLowerCase().endsWith(".zip")) {
      const preview = await tryParsePreviewFromZipFile(sourceUri, fileName);
      if (preview) return { success: true, preview };
    }

    const previewFromJson = await tryParsePreviewFromJsonFile(file, sourceUri, fileName);
    if (previewFromJson) return { success: true, preview: previewFromJson };

    // Last fallback: try zip if extension is unknown.
    const previewFromZip = await tryParsePreviewFromZipFile(sourceUri, fileName);
    if (previewFromZip) return { success: true, preview: previewFromZip };

    return { success: false, error: "Invalid backup file format" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid backup file format",
    };
  }
}

function restoreMetadataDomains(
  restoreTarget: RestoreTarget,
  manifest: BackupManifest,
  options: BackupOptions,
): void {
  if (options.includeAlbums && manifest.albums.length > 0) {
    restoreTarget.setAlbums(manifest.albums, options.restoreConflictStrategy);
  }
  if (options.includeTargets && manifest.targets.length > 0) {
    restoreTarget.setTargets(manifest.targets, options.restoreConflictStrategy);
  }
  if (options.includeTargets && manifest.targetGroups.length > 0) {
    restoreTarget.setTargetGroups(manifest.targetGroups, options.restoreConflictStrategy);
  }
  if (options.includeSessions && manifest.sessions.length > 0) {
    restoreTarget.setSessions(manifest.sessions, options.restoreConflictStrategy);
  }
  if (options.includeSessions && manifest.plans.length > 0) {
    restoreTarget.setPlans(manifest.plans, options.restoreConflictStrategy);
  }
  if (options.includeSessions && manifest.logEntries.length > 0) {
    restoreTarget.setLogEntries(manifest.logEntries, options.restoreConflictStrategy);
  }
  if (options.includeSettings && Object.keys(manifest.settings).length > 0) {
    restoreTarget.setSettings(manifest.settings);
  }
  restoreTarget.setFileGroups(manifest.fileGroups, options.restoreConflictStrategy);
  restoreTarget.setAstrometry(manifest.astrometry, options.restoreConflictStrategy);
  restoreTarget.setTrash(manifest.trash, options.restoreConflictStrategy);
  restoreTarget.setActiveSession(
    manifest.sessionRuntime.activeSession,
    options.restoreConflictStrategy,
  );
  restoreTarget.setBackupPrefs(manifest.backupPrefs);
}

async function restoreBinariesFromPackage(
  restoreTarget: RestoreTarget,
  packageDir: Directory,
  manifest: BackupManifest,
  options: BackupOptions,
): Promise<void> {
  const strategy = options.restoreConflictStrategy;
  if (options.includeFiles && manifest.files.length > 0) {
    const fitsDir = getFitsDir();
    const restored: FitsMetadata[] = [];
    for (const meta of manifest.files) {
      const relative = meta.binary?.remotePath
        ? meta.binary.remotePath.replace(/^\/+/, "")
        : `files/${toSafeRemoteFilename(meta)}`;
      const packageFile = new File(packageDir, relative);
      if (!packageFile.exists) continue;

      const targetFile = new File(fitsDir, meta.filename);
      if (targetFile.exists && strategy === "skip-existing") {
        restored.push({
          ...meta,
          filepath: targetFile.uri,
        });
        continue;
      }
      packageFile.copy(targetFile);
      restored.push({
        ...meta,
        filepath: targetFile.uri,
      });
    }
    if (restored.length > 0) {
      restoreTarget.setFiles(restored, options.restoreConflictStrategy);
    }
  }

  if (options.includeThumbnails && manifest.thumbnails.length > 0) {
    ensureThumbnailDir();
    for (const thumb of manifest.thumbnails) {
      const relative = thumb.remotePath
        ? thumb.remotePath.replace(/^\/+/, "")
        : `thumbnails/${thumb.filename}`;
      const packageThumb = new File(packageDir, relative);
      if (!packageThumb.exists) continue;
      const cacheThumb = new File(getThumbnailPath(thumb.fileId));
      if (cacheThumb.exists && options.restoreConflictStrategy === "skip-existing") continue;
      packageThumb.copy(cacheThumb);
    }
  }
}

function isZipPayload(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07) &&
    (bytes[3] === 0x04 || bytes[3] === 0x06 || bytes[3] === 0x08)
  );
}

async function buildFullPackage(
  manifest: BackupManifest,
  options: BackupOptions,
): Promise<{ zipFile: File; workingDir: Directory }> {
  const workingDir = createTempDirectory("backup_pkg");
  const filesDir = new Directory(workingDir, "files");
  const thumbnailsDir = new Directory(workingDir, "thumbnails");
  if (!filesDir.exists) filesDir.create();
  if (!thumbnailsDir.exists) thumbnailsDir.create();

  if (options.includeFiles) {
    for (const fileRecord of manifest.files) {
      const source = new File(fileRecord.filepath);
      if (!source.exists) continue;
      const packagedName = toSafeRemoteFilename(fileRecord);
      const packaged = new File(filesDir, packagedName);
      source.copy(packaged);
      const bytes = await packaged.bytes();
      fileRecord.binary = {
        remotePath: `files/${packagedName}`,
        size: packaged.size ?? bytes.length,
        contentHash: await computeSha256Hex(bytes),
        hashAlgorithm: "SHA-256",
      };
    }
  }

  manifest.thumbnails = [];
  if (options.includeThumbnails) {
    for (const fileRecord of manifest.files) {
      const sourceThumb = new File(getThumbnailPath(fileRecord.id));
      if (!sourceThumb.exists) continue;
      const thumbName = toSafeThumbnailFilename(fileRecord.id);
      const packagedThumb = new File(thumbnailsDir, thumbName);
      sourceThumb.copy(packagedThumb);
      const bytes = await packagedThumb.bytes();
      manifest.thumbnails.push({
        fileId: fileRecord.id,
        filename: thumbName,
        remotePath: `thumbnails/${thumbName}`,
        size: packagedThumb.size ?? bytes.length,
        contentHash: await computeSha256Hex(bytes),
        hashAlgorithm: "SHA-256",
      });
    }
  }

  const manifestFile = new File(workingDir, "manifest.json");
  manifestFile.write(serializeManifest(manifest));

  const zip = loadZipModule();
  const zipFile = new File(Paths.cache, `cobalt-backup-${Date.now()}.zip`);
  await zip.zip(workingDir.uri, zipFile.uri);
  return { zipFile, workingDir };
}

/**
 * 导出本地备份文件
 */
export async function exportLocalBackup(
  dataSource: BackupDataSource,
  options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
  onProgress?: (progress: BackupProgress) => void,
): Promise<{ success: boolean; error?: string }> {
  let tmpWorkingDir: Directory | null = null;
  let tmpOutput: File | null = null;
  try {
    onProgress?.({ phase: "preparing", current: 0, total: 0 });

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
        sessionRuntime: { activeSession: dataSource.getActiveSession() },
        backupPrefs: dataSource.getBackupPrefs(),
      },
      options,
    );

    let payloadBytes: Uint8Array;
    let outputName: string;
    let mimeType = "application/json";
    let uti = "public.json";

    if (options.localPayloadMode === "full") {
      onProgress?.({ phase: "uploading", current: 1, total: 4, currentFile: "packaging.zip" });
      const fullPackage = await buildFullPackage(manifest, options);
      tmpWorkingDir = fullPackage.workingDir;
      tmpOutput = fullPackage.zipFile;
      payloadBytes = await fullPackage.zipFile.bytes();
      outputName = `cobalt-backup-${Date.now()}.zip`;
      mimeType = "application/zip";
      uti = "public.zip-archive";
    } else {
      manifest.capabilities.localPayloadMode = "metadata-only";
      const jsonBytes = new TextEncoder().encode(serializeManifest(manifest));
      payloadBytes = jsonBytes;
      outputName = `cobalt-backup-${Date.now()}.json`;
    }

    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      return { success: false, error: "Sharing is not available on this device" };
    }

    if (options.localEncryption.enabled) {
      if (!options.localEncryption.password) {
        return { success: false, error: "Password required for encrypted backup" };
      }
      onProgress?.({ phase: "finalizing", current: 2, total: 4, currentFile: "encrypting" });
      const summary = getManifestSummary(manifest) as unknown as Record<string, unknown>;
      const envelope = await encryptBackupPayload(
        payloadBytes,
        options.localEncryption.password,
        summary,
      );
      const encryptedFile = new File(Paths.cache, `cobalt-backup-${Date.now()}.cobaltbak`);
      encryptedFile.write(JSON.stringify(envelope));
      tmpOutput = encryptedFile;
      outputName = encryptedFile.name;
      mimeType = "application/json";
      uti = "public.json";
    } else if (options.localPayloadMode === "metadata-only") {
      const jsonFile = new File(Paths.cache, outputName);
      jsonFile.write(new TextDecoder().decode(payloadBytes));
      tmpOutput = jsonFile;
    }

    if (!tmpOutput) {
      return { success: false, error: "Failed to generate local backup" };
    }

    onProgress?.({ phase: "finalizing", current: 3, total: 4, currentFile: outputName });
    await Sharing.shareAsync(tmpOutput.uri, {
      mimeType,
      dialogTitle: outputName,
      UTI: uti,
    });

    onProgress?.({ phase: "idle", current: 0, total: 0 });
    Logger.info(TAG, `Local backup exported: ${outputName}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Export failed";
    Logger.error(TAG, "Export failed", { error });
    return { success: false, error: msg };
  } finally {
    cleanupPath(tmpWorkingDir);
    cleanupPath(tmpOutput);
  }
}

async function importFromPackage(
  restoreTarget: RestoreTarget,
  sourceUri: string,
  options: BackupOptions,
  onProgress?: (progress: BackupProgress) => void,
): Promise<{ success: boolean; error?: string }> {
  const zip = loadZipModule();
  const extractDir = createTempDirectory("backup_import");
  try {
    await zip.unzip(sourceUri, extractDir.uri);
    const manifestFile = new File(extractDir, "manifest.json");
    if (!manifestFile.exists)
      return { success: false, error: "Invalid package: manifest.json missing" };
    const manifest = parseManifest(await manifestFile.text());
    if (!manifest) return { success: false, error: "Invalid manifest in package" };

    onProgress?.({ phase: "downloading", current: 1, total: 3, currentFile: "manifest.json" });
    restoreMetadataDomains(restoreTarget, manifest, options);
    onProgress?.({ phase: "downloading", current: 2, total: 3, currentFile: "entities" });
    await restoreBinariesFromPackage(restoreTarget, extractDir, manifest, options);
    onProgress?.({ phase: "idle", current: 0, total: 0 });
    return { success: true };
  } finally {
    cleanupPath(extractDir);
  }
}

/**
 * 从本地文件导入备份
 */
export async function importLocalBackup(
  restoreTarget: RestoreTarget,
  options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
  onProgress?: (progress: BackupProgress) => void,
  source?: LocalBackupPreview,
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress?.({ phase: "preparing", current: 0, total: 0 });

    const picked = source ? { success: true, preview: source } : await pickLocalBackup();
    if (!picked.success || !picked.preview) {
      return { success: false, error: picked.error ?? "No file selected" };
    }

    const preview = picked.preview;
    onProgress?.({ phase: "downloading", current: 1, total: 3, currentFile: preview.fileName });

    if (preview.sourceType === "manifest-json") {
      if (!preview.manifest) return { success: false, error: "Invalid backup file format" };
      restoreMetadataDomains(restoreTarget, preview.manifest, options);
      if (options.includeFiles && preview.manifest.files.length > 0) {
        restoreTarget.setFiles(preview.manifest.files, options.restoreConflictStrategy);
      }
      onProgress?.({ phase: "idle", current: 0, total: 0 });
      return { success: true };
    }

    if (preview.sourceType === "full-package") {
      return importFromPackage(restoreTarget, preview.sourceUri, options, onProgress);
    }

    if (preview.sourceType === "encrypted-package") {
      const envelope =
        preview.encryptedEnvelope ??
        (() => {
          throw new Error("Encrypted backup payload not found");
        })();
      const password = options.localEncryption.password;
      if (!password) {
        return { success: false, error: "Password required for encrypted backup" };
      }
      onProgress?.({ phase: "downloading", current: 2, total: 4, currentFile: "decrypting" });
      const payload = await decryptBackupPayload(envelope, password);

      if (!isZipPayload(payload)) {
        const json = new TextDecoder().decode(payload);
        const manifest = parseManifest(json);
        if (!manifest) return { success: false, error: "Invalid decrypted backup payload" };
        restoreMetadataDomains(restoreTarget, manifest, options);
        if (options.includeFiles && manifest.files.length > 0) {
          restoreTarget.setFiles(manifest.files, options.restoreConflictStrategy);
        }
        onProgress?.({ phase: "idle", current: 0, total: 0 });
        return { success: true };
      }

      const zipFile = new File(Paths.cache, `cobalt-backup-import-${Date.now()}.zip`);
      try {
        zipFile.write(payload);
        return importFromPackage(restoreTarget, zipFile.uri, options, onProgress);
      } finally {
        cleanupPath(zipFile);
      }
    }

    return { success: false, error: "Unsupported backup format" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Import failed";
    Logger.error(TAG, "Import failed", { error });
    return { success: false, error: msg };
  }
}

/**
 * 预览本地备份文件内容（不执行恢复）
 */
export async function previewLocalBackup(): Promise<{
  success: boolean;
  cancelled?: boolean;
  error?: string;
  summary?: ReturnType<typeof getManifestSummary>;
  fileName?: string;
  manifest?: BackupManifest;
  preview?: LocalBackupPreview;
}> {
  try {
    const picked = await pickLocalBackup();
    if (!picked.success || !picked.preview) {
      return {
        success: false,
        cancelled: picked.cancelled,
        error: picked.error,
      };
    }

    return {
      success: true,
      summary: picked.preview.summary,
      fileName: picked.preview.fileName,
      manifest: picked.preview.manifest,
      preview: picked.preview,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Preview failed";
    return { success: false, error: msg };
  }
}
