/**
 * 备份模块共享工具函数
 */

import * as Crypto from "expo-crypto";
import type {
  BackupFileRecord,
  BackupManifest,
  BackupOptions,
  RestoreConflictStrategy,
} from "./types";
import type { RestoreTarget } from "./backupService";

export { inferMediaKind } from "./manifest";

/**
 * 生成安全的远程文件名（fileId + 清理后的文件名）
 */
export function toSafeRemoteFilename(meta: Pick<BackupFileRecord, "id" | "filename">): string {
  const safeName = meta.filename.replace(/[^\w.-]/g, "_");
  return `${meta.id}_${safeName}`;
}

/**
 * 生成安全的缩略图文件名
 */
export function toSafeThumbnailFilename(fileId: string): string {
  return `${fileId}.jpg`;
}

/**
 * ArrayBuffer → hex 字符串
 */
export function bytesToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * 计算 SHA-256 hex 摘要
 */
export async function computeSha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(bytes));
  return bytesToHex(digest);
}

const BACKUP_MAX_RETRIES = 3;
const BACKUP_RETRY_BASE_DELAY = 1000;

/**
 * 通用重试包装器，支持指数退避
 * 网络错误和超时错误自动重试，其他错误直接抛出
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = BACKUP_MAX_RETRIES,
  baseDelay: number = BACKUP_RETRY_BASE_DELAY,
): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const msg = lastError.message.toLowerCase();
      const isRetryable =
        lastError.name === "AbortError" ||
        msg.includes("network") ||
        msg.includes("timeout") ||
        msg.includes("failed to fetch") ||
        msg.includes("econnreset") ||
        msg.includes("socket hang up");

      if (!isRetryable || attempt === maxRetries) break;

      const delayMs = baseDelay * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError ?? new Error(`${label} failed after retries`);
}

/**
 * 解析恢复冲突策略，缺省返回 "skip-existing"
 */
export function resolveRestoreStrategy(
  strategy: RestoreConflictStrategy | undefined,
): RestoreConflictStrategy {
  return strategy ?? "skip-existing";
}

/**
 * 将 manifest 中的元数据域恢复到 RestoreTarget
 * 由 performRestore（云恢复）和 importLocalBackup（本地导入）共享
 */
export function restoreMetadataDomains(
  restoreTarget: RestoreTarget,
  manifest: BackupManifest,
  options: BackupOptions,
): void {
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
}
