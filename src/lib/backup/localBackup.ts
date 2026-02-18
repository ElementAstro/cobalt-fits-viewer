/**
 * 本地备份/恢复服务
 * 使用 expo-file-system + expo-sharing + expo-document-picker
 * 本地备份文件仅包含 manifest（元数据），不包含 FITS 原始文件实体
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { createManifest, serializeManifest, parseManifest, getManifestSummary } from "./manifest";
import { LOG_TAGS, Logger } from "../logger";
import type { BackupManifest, BackupOptions, BackupProgress } from "./types";
import { DEFAULT_BACKUP_OPTIONS } from "./types";
import type { BackupDataSource, RestoreTarget } from "./backupService";

const TAG = LOG_TAGS.LocalBackup;

export interface LocalBackupPreview {
  fileName: string;
  manifest: BackupManifest;
  summary: ReturnType<typeof getManifestSummary>;
}

interface PickLocalBackupResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
  preview?: LocalBackupPreview;
}

async function pickLocalBackupManifest(): Promise<PickLocalBackupResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/json",
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) {
    return { success: false, cancelled: true, error: "No file selected" };
  }

  const asset = result.assets[0];
  const file = new File(asset.uri);
  if (!file.exists) {
    return { success: false, error: "Selected file not found" };
  }

  const content = await file.text();
  const manifest = parseManifest(content);

  if (!manifest) {
    return { success: false, error: "Invalid backup file format" };
  }

  return {
    success: true,
    preview: {
      fileName: asset.name ?? "backup.json",
      manifest,
      summary: getManifestSummary(manifest),
    },
  };
}

function restoreFromManifest(
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
  if (options.includeFiles && manifest.files.length > 0) {
    restoreTarget.setFiles(manifest.files, options.restoreConflictStrategy);
  }
}

/**
 * 导出本地备份文件
 * 生成 JSON manifest 文件并通过系统分享面板让用户保存
 */
export async function exportLocalBackup(
  dataSource: BackupDataSource,
  options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
  onProgress?: (progress: BackupProgress) => void,
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress?.({ phase: "preparing", current: 0, total: 0 });

    // Build manifest; local backup does not include FITS binaries, only metadata.
    const localOptions: BackupOptions = {
      ...options,
      includeThumbnails: false,
    };
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
      },
      localOptions,
    );

    onProgress?.({ phase: "uploading", current: 1, total: 2, currentFile: "manifest.json" });

    // Write to temp file
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `cobalt-backup-${timestamp}.json`;
    const tmpFile = new File(Paths.cache, filename);

    const json = serializeManifest(manifest);
    tmpFile.write(json);

    onProgress?.({ phase: "finalizing", current: 2, total: 2 });

    // Share the file so user can save it
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      if (tmpFile.exists) tmpFile.delete();
      return { success: false, error: "Sharing is not available on this device" };
    }

    await Sharing.shareAsync(tmpFile.uri, {
      mimeType: "application/json",
      dialogTitle: filename,
      UTI: "public.json",
    });

    // Cleanup temp file after sharing
    if (tmpFile.exists) tmpFile.delete();

    onProgress?.({ phase: "idle", current: 0, total: 0 });
    Logger.info(TAG, `Local backup exported: ${filename}`);
    return { success: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Export failed";
    Logger.error(TAG, "Export failed", { error });
    return { success: false, error: msg };
  }
}

/**
 * 从本地文件导入备份
 * 使用 document picker 让用户选择备份文件，解析后恢复数据
 */
export async function importLocalBackup(
  restoreTarget: RestoreTarget,
  options: BackupOptions = DEFAULT_BACKUP_OPTIONS,
  onProgress?: (progress: BackupProgress) => void,
  source?: LocalBackupPreview,
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress?.({ phase: "preparing", current: 0, total: 0 });

    const picked = source ? { success: true, preview: source } : await pickLocalBackupManifest();
    if (!picked.success) {
      return { success: false, error: picked.error ?? "No file selected" };
    }

    onProgress?.({
      phase: "downloading",
      current: 1,
      total: 3,
      currentFile: picked.preview?.fileName ?? "backup.json",
    });

    const manifest = picked.preview!.manifest;

    onProgress?.({ phase: "downloading", current: 2, total: 3, currentFile: "Restoring data..." });

    restoreFromManifest(restoreTarget, manifest, options);

    onProgress?.({ phase: "idle", current: 0, total: 0 });

    const summary = getManifestSummary(manifest);
    Logger.info(
      TAG,
      `Local backup imported: ${summary.albumCount} albums, ${summary.targetCount} targets, ${summary.sessionCount} sessions`,
    );
    return { success: true };
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
}> {
  try {
    const picked = await pickLocalBackupManifest();
    if (!picked.success) {
      return {
        success: false,
        cancelled: picked.cancelled,
        error: picked.error,
      };
    }

    return {
      success: true,
      summary: picked.preview!.summary,
      fileName: picked.preview!.fileName,
      manifest: picked.preview!.manifest,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Preview failed";
    return { success: false, error: msg };
  }
}
