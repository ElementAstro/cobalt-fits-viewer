/**
 * Dropbox Provider
 * 使用 expo-auth-session + Dropbox HTTP API v2
 */

import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { BaseCloudProvider } from "../cloudProvider";
import { parseManifest, serializeManifest } from "../manifest";
import { LOG_TAGS, Logger } from "../../logger";
import type { BackupManifest, CloudProviderConfig, RemoteFile } from "../types";
import { BACKUP_DIR, MANIFEST_FILENAME, FITS_SUBDIR, THUMBNAIL_SUBDIR } from "../types";

const TAG = LOG_TAGS.DropboxProvider;
const SECURE_STORE_KEY = "backup_dropbox_tokens";

const DROPBOX_API = "https://api.dropboxapi.com/2";
const DROPBOX_CONTENT_API = "https://content.dropboxapi.com/2";

export const DROPBOX_DISCOVERY = {
  authorizationEndpoint: "https://www.dropbox.com/oauth2/authorize",
  tokenEndpoint: "https://api.dropboxapi.com/oauth2/token",
};

export class DropboxProvider extends BaseCloudProvider {
  readonly name = "dropbox" as const;
  readonly displayName = "Dropbox";
  readonly icon = "water-outline";
  readonly capabilities = {
    supportsConditionalWrite: true,
    supportsResumableUpload: true,
    supportsContentHash: true,
  } as const;

  private _appKey: string | null = null;

  async connect(config?: CloudProviderConfig): Promise<void> {
    if (config?.accessToken) {
      this._accessToken = config.accessToken;
      this._refreshToken = config.refreshToken ?? null;
      this._tokenExpiry = config.tokenExpiry ?? null;
      this._connected = true;

      await this.saveTokens();
      Logger.info(TAG, "Connected to Dropbox");
      return;
    }

    const saved = await this.loadTokens();
    if (saved) {
      this._accessToken = saved.accessToken;
      this._refreshToken = saved.refreshToken;
      this._tokenExpiry = saved.tokenExpiry;
      this._connected = true;

      if (this.isTokenExpired()) {
        await this.refreshTokenIfNeeded();
      }
      Logger.info(TAG, "Restored Dropbox connection");
      return;
    }

    throw new Error("Dropbox requires OAuth tokens. Use expo-auth-session to authenticate first.");
  }

  async disconnect(): Promise<void> {
    // Revoke token
    if (this._accessToken) {
      try {
        await fetch(`${DROPBOX_API}/auth/token/revoke`, {
          method: "POST",
          headers: this.getAuthHeaders(),
        });
      } catch {
        // ignore revoke errors
      }
    }

    this._accessToken = null;
    this._refreshToken = null;
    this._tokenExpiry = null;
    this._connected = false;
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    Logger.info(TAG, "Disconnected from Dropbox");
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

      const res = await fetch(`${DROPBOX_API}/users/get_current_account`, {
        method: "POST",
        headers: this.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.isTokenExpired() || !this._refreshToken || !this._appKey) {
      return;
    }

    try {
      const res = await fetch(DROPBOX_DISCOVERY.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this._refreshToken,
          client_id: this._appKey,
        }).toString(),
      });

      if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

      const data = (await res.json()) as {
        access_token: string;
        expires_in: number;
      };

      this._accessToken = data.access_token;
      this._tokenExpiry = Date.now() + data.expires_in * 1000;

      await this.saveTokens();
      Logger.info(TAG, "Token refreshed");
    } catch (error) {
      Logger.error(TAG, "Token refresh failed", { error });
      this._connected = false;
      throw error;
    }
  }

  setAppKey(appKey: string): void {
    this._appKey = appKey;
  }

  async ensureBackupDir(): Promise<void> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    await this.createFolderIfNotExists(`/${BACKUP_DIR}`);
    await this.createFolderIfNotExists(`/${BACKUP_DIR}/${FITS_SUBDIR}`);
    await this.createFolderIfNotExists(`/${BACKUP_DIR}/${THUMBNAIL_SUBDIR}`);
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    const file = new File(localPath);
    if (!file.exists) throw new Error(`Local file not found: ${localPath}`);

    const content = await file.bytes();
    const dropboxPath = this.toDropboxPath(remotePath);

    if (content.length > 150 * 1024 * 1024) {
      await this.largeFileUpload(dropboxPath, content, onProgress);
    } else {
      const res = await fetch(`${DROPBOX_CONTENT_API}/files/upload`, {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            path: dropboxPath,
            mode: "overwrite",
            autorename: false,
            mute: true,
          }),
        },
        body: content,
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Upload failed: ${res.status} ${errText}`);
      }
    }

    onProgress?.(1);
    Logger.debug(TAG, `Uploaded: ${remotePath}`);
  }

  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    const dropboxPath = this.toDropboxPath(remotePath);

    const res = await fetch(`${DROPBOX_CONTENT_API}/files/download`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Dropbox-API-Arg": JSON.stringify({ path: dropboxPath }),
      },
    });

    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const data = new Uint8Array(await res.arrayBuffer());
    const destFile = new File(localPath);
    destFile.write(data);

    onProgress?.(1);
    Logger.debug(TAG, `Downloaded: ${remotePath}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    const dropboxPath = this.toDropboxPath(remotePath);

    await fetch(`${DROPBOX_API}/files/delete_v2`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: dropboxPath }),
    });
  }

  async listFiles(remotePath: string): Promise<RemoteFile[]> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    const dropboxPath = this.toDropboxPath(remotePath);

    const res = await fetch(`${DROPBOX_API}/files/list_folder`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: dropboxPath }),
    });

    if (!res.ok) return [];

    const data = (await res.json()) as {
      entries: Array<{
        ".tag": string;
        name: string;
        path_lower: string;
        size?: number;
        server_modified?: string;
        id: string;
      }>;
      has_more: boolean;
    };

    const results: RemoteFile[] = (data.entries ?? []).map((entry) => ({
      name: entry.name,
      path: entry.path_lower,
      size: entry.size ?? 0,
      lastModified: entry.server_modified,
      isDirectory: entry[".tag"] === "folder",
      id: entry.id,
    }));

    // Handle pagination
    let hasMore = data.has_more;
    let cursor = (data as Record<string, unknown>).cursor as string | undefined;

    while (hasMore && cursor) {
      const continueRes = await fetch(`${DROPBOX_API}/files/list_folder/continue`, {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ cursor }),
      });

      if (!continueRes.ok) break;

      const moreData = (await continueRes.json()) as typeof data & {
        cursor: string;
      };

      for (const entry of moreData.entries ?? []) {
        results.push({
          name: entry.name,
          path: entry.path_lower,
          size: entry.size ?? 0,
          lastModified: entry.server_modified,
          isDirectory: entry[".tag"] === "folder",
          id: entry.id,
        });
      }

      hasMore = moreData.has_more;
      cursor = moreData.cursor;
    }

    return results;
  }

  async fileExists(remotePath: string): Promise<boolean> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    const dropboxPath = this.toDropboxPath(remotePath);

    const res = await fetch(`${DROPBOX_API}/files/get_metadata`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path: dropboxPath }),
    });

    return res.ok;
  }

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

  async getQuota(): Promise<{ used: number; total: number } | null> {
    try {
      if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

      const res = await fetch(`${DROPBOX_API}/users/get_space_usage`, {
        method: "POST",
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        used: number;
        allocation: { allocated: number };
      };

      return {
        used: data.used,
        total: data.allocation.allocated,
      };
    } catch {
      return null;
    }
  }

  async getUserInfo(): Promise<{ name: string; email?: string } | null> {
    try {
      if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

      const res = await fetch(`${DROPBOX_API}/users/get_current_account`, {
        method: "POST",
        headers: this.getAuthHeaders(),
      });

      if (!res.ok) return null;

      const data = (await res.json()) as {
        name: { display_name: string };
        email: string;
      };

      return {
        name: data.name.display_name,
        email: data.email,
      };
    } catch {
      return null;
    }
  }

  // ===== Private helpers =====

  private toDropboxPath(remotePath: string): string {
    let p = remotePath.replace(/^\/+/, "").replace(/\/+$/, "");
    if (!p.startsWith("/")) p = `/${p}`;
    return p;
  }

  private async createFolderIfNotExists(path: string): Promise<void> {
    const res = await fetch(`${DROPBOX_API}/files/create_folder_v2`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ path, autorename: false }),
    });

    // 409 = path/conflict/folder means already exists, which is fine
    if (!res.ok && res.status !== 409) {
      Logger.warn(TAG, `Failed to create folder: ${path} (${res.status})`);
    }
  }

  private async largeFileUpload(
    dropboxPath: string,
    content: Uint8Array,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const chunkSize = 8 * 1024 * 1024; // 8MB chunks
    const totalSize = content.length;

    // Start session
    const startRes = await fetch(`${DROPBOX_CONTENT_API}/files/upload_session/start`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({ close: false }),
      },
      body: content.slice(0, Math.min(chunkSize, totalSize)),
    });

    if (!startRes.ok) {
      throw new Error(`Upload session start failed: ${startRes.status}`);
    }

    const { session_id } = (await startRes.json()) as {
      session_id: string;
    };

    let offset = Math.min(chunkSize, totalSize);
    onProgress?.(offset / totalSize);

    // Append chunks
    while (offset < totalSize - chunkSize) {
      const end = Math.min(offset + chunkSize, totalSize);
      const chunk = content.slice(offset, end);

      const appendRes = await fetch(`${DROPBOX_CONTENT_API}/files/upload_session/append_v2`, {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/octet-stream",
          "Dropbox-API-Arg": JSON.stringify({
            cursor: { session_id, offset },
            close: false,
          }),
        },
        body: chunk,
      });

      if (!appendRes.ok) {
        throw new Error(`Upload session append failed: ${appendRes.status}`);
      }

      offset = end;
      onProgress?.(offset / totalSize);
    }

    // Finish
    const remaining = content.slice(offset);
    const finishRes = await fetch(`${DROPBOX_CONTENT_API}/files/upload_session/finish`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": JSON.stringify({
          cursor: { session_id, offset },
          commit: {
            path: dropboxPath,
            mode: "overwrite",
            autorename: false,
            mute: true,
          },
        }),
      },
      body: remaining,
    });

    if (!finishRes.ok) {
      throw new Error(`Upload session finish failed: ${finishRes.status}`);
    }

    onProgress?.(1);
  }

  private async saveTokens(): Promise<void> {
    await SecureStore.setItemAsync(
      SECURE_STORE_KEY,
      JSON.stringify({
        accessToken: this._accessToken,
        refreshToken: this._refreshToken,
        tokenExpiry: this._tokenExpiry,
      }),
    );
  }

  private async loadTokens(): Promise<{
    accessToken: string;
    refreshToken: string | null;
    tokenExpiry: number | null;
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
