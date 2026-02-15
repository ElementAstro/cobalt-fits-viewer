/**
 * 本地备份/恢复服务
 * 使用 expo-file-system + expo-sharing + expo-document-picker
 * 仅备份元数据和设置（不包含 FITS 原始文件）
 */

import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { createManifest, serializeManifest, parseManifest, getManifestSummary } from "./manifest";
import { Logger } from "../logger";
import type { BackupOptions, BackupProgress } from "./types";
import { DEFAULT_BACKUP_OPTIONS } from "./types";
import type { BackupDataSource, RestoreTarget } from "./backupService";

const TAG = "LocalBackup";

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

    // Build manifest (exclude files option for local backup since we don't export FITS binaries)
    const localOptions: BackupOptions = {
      ...options,
      includeFiles: false,
      includeThumbnails: false,
    };
    const manifest = createManifest(
      {
        files: dataSource.getFiles(),
        albums: dataSource.getAlbums(),
        targets: dataSource.getTargets(),
        sessions: dataSource.getSessions(),
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
): Promise<{ success: boolean; error?: string }> {
  try {
    onProgress?.({ phase: "preparing", current: 0, total: 0 });

    // Let user pick a backup file
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { success: false, error: "No file selected" };
    }

    const fileUri = result.assets[0].uri;

    onProgress?.({
      phase: "downloading",
      current: 1,
      total: 3,
      currentFile: result.assets[0].name ?? "backup.json",
    });

    // Read and parse manifest
    const file = new File(fileUri);
    if (!file.exists) {
      return { success: false, error: "Selected file not found" };
    }

    const content = await file.text();
    const manifest = parseManifest(content);

    if (!manifest) {
      return { success: false, error: "Invalid backup file format" };
    }

    onProgress?.({ phase: "downloading", current: 2, total: 3, currentFile: "Restoring data..." });

    // Restore metadata based on options
    if (options.includeAlbums && manifest.albums.length > 0) {
      restoreTarget.setAlbums(manifest.albums);
    }
    if (options.includeTargets && manifest.targets.length > 0) {
      restoreTarget.setTargets(manifest.targets);
    }
    if (options.includeSessions && manifest.sessions.length > 0) {
      restoreTarget.setSessions(manifest.sessions);
    }
    if (options.includeSettings && Object.keys(manifest.settings).length > 0) {
      restoreTarget.setSettings(manifest.settings);
    }
    // Note: files metadata is restored but actual FITS binaries are not in local backup
    if (options.includeFiles && manifest.files.length > 0) {
      restoreTarget.setFiles(manifest.files);
    }

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
  error?: string;
  summary?: ReturnType<typeof getManifestSummary>;
}> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/json",
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { success: false, error: "No file selected" };
    }

    const file = new File(result.assets[0].uri);
    if (!file.exists) {
      return { success: false, error: "Selected file not found" };
    }

    const content = await file.text();
    const manifest = parseManifest(content);

    if (!manifest) {
      return { success: false, error: "Invalid backup file format" };
    }

    return { success: true, summary: getManifestSummary(manifest) };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Preview failed";
    return { success: false, error: msg };
  }
}
