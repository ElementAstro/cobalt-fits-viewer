/**
 * 云存储 Provider 统一抽象接口
 */

import { File, Paths } from "expo-file-system";
import type {
  CloudProvider,
  CloudProviderCapabilities,
  CloudProviderConfig,
  BackupManifest,
  RemoteFile,
} from "./types";
import { BACKUP_DIR, MANIFEST_FILENAME } from "./types";
import { parseManifest, serializeManifest } from "./manifest";

/**
 * 所有云存储 Provider 需实现此接口
 */
export interface ICloudProvider {
  readonly name: CloudProvider;
  readonly displayName: string;
  readonly icon: string;
  readonly capabilities?: CloudProviderCapabilities;

  /**
   * 连接到云服务（认证）
   */
  connect(config?: CloudProviderConfig): Promise<void>;

  /**
   * 断开连接
   */
  disconnect(): Promise<void>;

  /**
   * 是否已连接
   */
  isConnected(): boolean;

  /**
   * 测试连接是否有效
   */
  testConnection(): Promise<boolean>;

  /**
   * 刷新 token（如需要）
   */
  refreshTokenIfNeeded(): Promise<void>;

  /**
   * 上传文件
   */
  uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * 下载文件
   */
  downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;

  /**
   * 删除远端文件
   */
  deleteFile(remotePath: string): Promise<void>;

  /**
   * 列出远端目录文件
   */
  listFiles(remotePath: string): Promise<RemoteFile[]>;

  /**
   * 检查远端文件是否存在
   */
  fileExists(remotePath: string): Promise<boolean>;

  /**
   * 上传 Manifest
   */
  uploadManifest(manifest: BackupManifest): Promise<void>;

  /**
   * 下载 Manifest
   */
  downloadManifest(): Promise<BackupManifest | null>;

  /**
   * 获取云端空间配额
   */
  getQuota(): Promise<{ used: number; total: number } | null>;

  /**
   * 获取用户信息
   */
  getUserInfo(): Promise<{ name: string; email?: string } | null>;

  /**
   * 确保备份目录存在
   */
  ensureBackupDir(): Promise<void>;
}

/**
 * Provider 基类，提供通用工具方法
 */
export abstract class BaseCloudProvider implements ICloudProvider {
  abstract readonly name: CloudProvider;
  abstract readonly displayName: string;
  abstract readonly icon: string;
  readonly capabilities?: CloudProviderCapabilities;

  protected _connected = false;
  protected _accessToken: string | null = null;
  protected _refreshToken: string | null = null;
  protected _tokenExpiry: number | null = null;

  isConnected(): boolean {
    return this._connected;
  }

  abstract connect(config?: CloudProviderConfig): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract testConnection(): Promise<boolean>;
  abstract refreshTokenIfNeeded(): Promise<void>;
  abstract uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  abstract downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal,
  ): Promise<void>;
  abstract deleteFile(remotePath: string): Promise<void>;
  abstract listFiles(remotePath: string): Promise<RemoteFile[]>;
  abstract fileExists(remotePath: string): Promise<boolean>;
  abstract getQuota(): Promise<{ used: number; total: number } | null>;
  abstract getUserInfo(): Promise<{ name: string; email?: string } | null>;
  abstract ensureBackupDir(): Promise<void>;

  async uploadManifest(manifest: BackupManifest): Promise<void> {
    await this.ensureBackupDir();

    const json = serializeManifest(manifest);
    const tmpFile = new File(Paths.cache, `_manifest_tmp_${Date.now()}.json`);
    tmpFile.write(json);

    try {
      await this.uploadFile(tmpFile.uri, `${BACKUP_DIR}/${MANIFEST_FILENAME}`);
    } finally {
      if (tmpFile.exists) tmpFile.delete();
    }
  }

  async downloadManifest(): Promise<BackupManifest | null> {
    try {
      await this.ensureBackupDir();

      const tmpFile = new File(Paths.cache, `_manifest_dl_${Date.now()}.json`);
      await this.downloadFile(`${BACKUP_DIR}/${MANIFEST_FILENAME}`, tmpFile.uri);

      const content = await tmpFile.text();
      if (tmpFile.exists) tmpFile.delete();

      return parseManifest(content);
    } catch {
      return null;
    }
  }

  /**
   * 检查 token 是否过期
   */
  protected isTokenExpired(): boolean {
    if (!this._tokenExpiry) return false;
    return Date.now() >= this._tokenExpiry - 60_000;
  }

  /**
   * 获取带 Authorization header 的 fetch options
   */
  protected getAuthHeaders(): Record<string, string> {
    if (!this._accessToken) {
      throw new Error("Not authenticated");
    }
    return {
      Authorization: `Bearer ${this._accessToken}`,
    };
  }
}
