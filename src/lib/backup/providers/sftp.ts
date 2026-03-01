/**
 * SFTP Provider
 * 使用 react-native-ssh-sftp 实现 SSH/SFTP 文件传输
 */

import { File } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { BaseCloudProvider } from "../cloudProvider";
import { LOG_TAGS, Logger } from "../../logger";
import type { CloudProviderConfig, RemoteFile } from "../types";
import { BACKUP_DIR, FITS_SUBDIR, THUMBNAIL_SUBDIR } from "../types";

const TAG = LOG_TAGS.SFTPProvider;
const SECURE_STORE_KEY = "backup_sftp_config";
const DEFAULT_PORT = 22;

type SSHClient = {
  connect: (host: string, port: number, username: string, password: string) => Promise<void>;
  disconnect: () => void;
  sftpLs: (path: string) => Promise<SFTPFile[]>;
  sftpMkdir: (path: string) => Promise<void>;
  sftpRm: (path: string) => Promise<void>;
  sftpUpload: (localPath: string, remotePath: string) => Promise<void>;
  sftpDownload: (remotePath: string, localPath: string) => Promise<void>;
  sftpStat: (path: string) => Promise<{ size: number; modifyTime: number } | null>;
};

interface SFTPFile {
  filename: string;
  isDirectory: boolean;
  modificationDate: string;
  lastAccess: string;
  fileSize: number;
}

function loadSSHModule(): { default: new () => SSHClient } {
  // Use indirect require via global so Metro cannot statically resolve this optional dependency
  const dynamicRequire = globalThis.require ?? require;
  return dynamicRequire("@dylankenneally/react-native-ssh-sftp") as {
    default: new () => SSHClient;
  };
}

export class SFTPProvider extends BaseCloudProvider {
  readonly name = "sftp" as const;
  readonly displayName = "SFTP";
  readonly icon = "terminal-outline";
  readonly capabilities = {
    supportsConditionalWrite: false,
    supportsResumableUpload: false,
    supportsContentHash: false,
  } as const;

  private _host: string | null = null;
  private _port: number = DEFAULT_PORT;
  private _username: string | null = null;
  private _password: string | null = null;
  private _remotePath: string = "/";
  private _client: SSHClient | null = null;

  async connect(config?: CloudProviderConfig): Promise<void> {
    if (config?.sftpHost && config?.sftpUsername) {
      this._host = config.sftpHost;
      this._port = config.sftpPort ?? DEFAULT_PORT;
      this._username = config.sftpUsername;
      this._password = config.sftpPassword ?? "";
      this._remotePath = config.sftpRemotePath?.replace(/\/+$/, "") || "/";

      await this.connectSSH();
      await this.saveConfig();
      Logger.info(TAG, "Connected to SFTP");
      return;
    }

    const saved = await this.loadConfig();
    if (saved) {
      this._host = saved.host;
      this._port = saved.port;
      this._username = saved.username;
      this._password = saved.password;
      this._remotePath = saved.remotePath;

      await this.connectSSH();
      Logger.info(TAG, "Restored SFTP connection");
      return;
    }

    throw new Error("SFTP requires host, username, and password.");
  }

  private async connectSSH(): Promise<void> {
    if (!this._host || !this._username) {
      throw new Error("SFTP not configured");
    }

    try {
      const SSHModule = loadSSHModule();
      this._client = new SSHModule.default();
      await this._client.connect(this._host, this._port, this._username, this._password ?? "");
      this._connected = true;
    } catch (error) {
      this._connected = false;
      this._client = null;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      this._client?.disconnect();
    } catch {
      // ignore disconnect errors
    }
    this._client = null;
    this._host = null;
    this._username = null;
    this._password = null;
    this._port = DEFAULT_PORT;
    this._remotePath = "/";
    this._connected = false;
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    Logger.info(TAG, "Disconnected from SFTP");
  }

  async testConnection(): Promise<boolean> {
    try {
      if (!this._client) return false;
      await this._client.sftpLs(this._remotePath || "/");
      return true;
    } catch {
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<void> {
    // SFTP uses password auth, no token refresh needed
    // Reconnect if client was dropped
    if (!this._client && this._host && this._username) {
      await this.connectSSH();
    }
  }

  async ensureBackupDir(): Promise<void> {
    const base = this.toRemotePath("");
    await this.mkdirSafe(`${base}/${BACKUP_DIR}`);
    await this.mkdirSafe(`${base}/${BACKUP_DIR}/${FITS_SUBDIR}`);
    await this.mkdirSafe(`${base}/${BACKUP_DIR}/${THUMBNAIL_SUBDIR}`);
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: (p: number) => void,
    _signal?: AbortSignal,
  ): Promise<void> {
    if (!this._client) throw new Error("SFTP not connected");

    const file = new File(localPath);
    if (!file.exists) throw new Error(`Local file not found: ${localPath}`);

    const fullRemote = this.toRemotePath(remotePath);
    await this._client.sftpUpload(localPath, fullRemote);

    onProgress?.(1);
    Logger.debug(TAG, `Uploaded: ${remotePath}`);
  }

  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (p: number) => void,
    _signal?: AbortSignal,
  ): Promise<void> {
    if (!this._client) throw new Error("SFTP not connected");

    const fullRemote = this.toRemotePath(remotePath);
    await this._client.sftpDownload(fullRemote, localPath);

    onProgress?.(1);
    Logger.debug(TAG, `Downloaded: ${remotePath}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    if (!this._client) throw new Error("SFTP not connected");
    const fullRemote = this.toRemotePath(remotePath);
    await this._client.sftpRm(fullRemote);
  }

  async listFiles(remotePath: string): Promise<RemoteFile[]> {
    if (!this._client) return [];

    try {
      const fullRemote = this.toRemotePath(remotePath);
      const files = await this._client.sftpLs(fullRemote);

      return files
        .filter((f) => f.filename !== "." && f.filename !== "..")
        .map((f) => ({
          name: f.filename,
          path: `${remotePath}/${f.filename}`.replace(/\/+/g, "/"),
          size: f.fileSize ?? 0,
          lastModified: f.modificationDate,
          isDirectory: f.isDirectory,
        }));
    } catch {
      return [];
    }
  }

  async fileExists(remotePath: string): Promise<boolean> {
    if (!this._client) return false;

    try {
      const fullRemote = this.toRemotePath(remotePath);
      const stat = await this._client.sftpStat(fullRemote);
      return stat != null;
    } catch {
      // sftpStat throws if file doesn't exist
      return false;
    }
  }

  async getQuota(): Promise<{ used: number; total: number } | null> {
    // SFTP has no standard quota API
    return null;
  }

  async getUserInfo(): Promise<{ name: string; email?: string } | null> {
    if (!this._username || !this._host) return null;
    return {
      name: `${this._username}@${this._host}`,
      email: undefined,
    };
  }

  // ===== Private helpers =====

  private toRemotePath(relativePath: string): string {
    const base = this._remotePath || "/";
    const rel = relativePath.replace(/^\/+/, "");
    if (!rel) return base;
    return `${base}/${rel}`.replace(/\/+/g, "/");
  }

  private async mkdirSafe(path: string): Promise<void> {
    if (!this._client) return;
    try {
      await this._client.sftpMkdir(path);
    } catch {
      // Directory may already exist
    }
  }

  private async saveConfig(): Promise<void> {
    await SecureStore.setItemAsync(
      SECURE_STORE_KEY,
      JSON.stringify({
        host: this._host,
        port: this._port,
        username: this._username,
        password: this._password,
        remotePath: this._remotePath,
      }),
    );
  }

  private async loadConfig(): Promise<{
    host: string;
    port: number;
    username: string;
    password: string;
    remotePath: string;
  } | null> {
    try {
      const raw = await SecureStore.getItemAsync(SECURE_STORE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
