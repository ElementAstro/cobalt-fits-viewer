/**
 * OneDrive Provider
 * 使用 expo-auth-session + Microsoft Graph REST API v1.0
 */

import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { BaseCloudProvider } from "../cloudProvider";
import { parseManifest, serializeManifest } from "../manifest";
import { LOG_TAGS, Logger } from "../../logger";
import type { BackupManifest, CloudProviderConfig, RemoteFile } from "../types";
import { BACKUP_DIR, MANIFEST_FILENAME, FITS_SUBDIR } from "../types";

const TAG = LOG_TAGS.OneDriveProvider;
const SECURE_STORE_KEY = "backup_onedrive_tokens";
const GRAPH_API = "https://graph.microsoft.com/v1.0";

export const ONEDRIVE_DISCOVERY = {
  authorizationEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
  tokenEndpoint: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
};

export const ONEDRIVE_SCOPES = ["Files.ReadWrite.AppFolder", "offline_access", "User.Read"];

export class OneDriveProvider extends BaseCloudProvider {
  readonly name = "onedrive" as const;
  readonly displayName = "OneDrive";
  readonly icon = "cloud-outline";

  private _clientId: string | null = null;

  async connect(config?: CloudProviderConfig): Promise<void> {
    if (config?.accessToken) {
      this._accessToken = config.accessToken;
      this._refreshToken = config.refreshToken ?? null;
      this._tokenExpiry = config.tokenExpiry ?? null;
      this._connected = true;

      await this.saveTokens();
      Logger.info(TAG, "Connected to OneDrive");
      return;
    }

    // Try to restore saved tokens
    const saved = await this.loadTokens();
    if (saved) {
      this._accessToken = saved.accessToken;
      this._refreshToken = saved.refreshToken;
      this._tokenExpiry = saved.tokenExpiry;
      this._connected = true;

      if (this.isTokenExpired()) {
        await this.refreshTokenIfNeeded();
      }
      Logger.info(TAG, "Restored OneDrive connection");
      return;
    }

    throw new Error("OneDrive requires OAuth tokens. Use expo-auth-session to authenticate first.");
  }

  async disconnect(): Promise<void> {
    this._accessToken = null;
    this._refreshToken = null;
    this._tokenExpiry = null;
    this._connected = false;
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    Logger.info(TAG, "Disconnected from OneDrive");
  }

  async testConnection(): Promise<boolean> {
    try {
      if (this.isTokenExpired()) {
        await this.refreshTokenIfNeeded();
      }
      const res = await fetch(`${GRAPH_API}/me`, {
        headers: this.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<void> {
    if (!this.isTokenExpired() || !this._refreshToken || !this._clientId) {
      return;
    }

    try {
      const res = await fetch(ONEDRIVE_DISCOVERY.tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: this._clientId,
          grant_type: "refresh_token",
          refresh_token: this._refreshToken,
          scope: ONEDRIVE_SCOPES.join(" "),
        }).toString(),
      });

      if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);

      const data = (await res.json()) as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      this._accessToken = data.access_token;
      if (data.refresh_token) this._refreshToken = data.refresh_token;
      this._tokenExpiry = Date.now() + data.expires_in * 1000;

      await this.saveTokens();
      Logger.info(TAG, "Token refreshed");
    } catch (error) {
      Logger.error(TAG, "Token refresh failed", { error });
      this._connected = false;
      throw error;
    }
  }

  setClientId(clientId: string): void {
    this._clientId = clientId;
  }

  async ensureBackupDir(): Promise<void> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    // Create backup dir in app folder
    await this.createFolderIfNotExists(BACKUP_DIR);
    await this.createFolderIfNotExists(`${BACKUP_DIR}/${FITS_SUBDIR}`);
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
    const graphPath = this.toGraphPath(remotePath);

    // Simple upload for files <4MB, otherwise use upload session
    if (content.length > 4 * 1024 * 1024) {
      await this.largeFileUpload(graphPath, content, onProgress);
    } else {
      const res = await fetch(`${GRAPH_API}/me/drive/special/approot:/${graphPath}:/content`, {
        method: "PUT",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/octet-stream",
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

    const graphPath = this.toGraphPath(remotePath);
    const res = await fetch(`${GRAPH_API}/me/drive/special/approot:/${graphPath}:/content`, {
      headers: this.getAuthHeaders(),
      redirect: "follow",
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

    const graphPath = this.toGraphPath(remotePath);
    await fetch(`${GRAPH_API}/me/drive/special/approot:/${graphPath}:`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });
  }

  async listFiles(remotePath: string): Promise<RemoteFile[]> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    const graphPath = this.toGraphPath(remotePath);
    const url =
      graphPath === ""
        ? `${GRAPH_API}/me/drive/special/approot/children`
        : `${GRAPH_API}/me/drive/special/approot:/${graphPath}:/children`;

    const res = await fetch(url, { headers: this.getAuthHeaders() });
    if (!res.ok) return [];

    const data = (await res.json()) as {
      value: Array<{
        id: string;
        name: string;
        size: number;
        lastModifiedDateTime: string;
        folder?: object;
      }>;
    };

    return (data.value ?? []).map((item) => ({
      name: item.name,
      path: `${remotePath}/${item.name}`,
      size: item.size,
      lastModified: item.lastModifiedDateTime,
      isDirectory: !!item.folder,
      id: item.id,
    }));
  }

  async fileExists(remotePath: string): Promise<boolean> {
    if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

    const graphPath = this.toGraphPath(remotePath);
    const res = await fetch(`${GRAPH_API}/me/drive/special/approot:/${graphPath}:`, {
      headers: this.getAuthHeaders(),
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

      const res = await fetch(`${GRAPH_API}/me/drive?$select=quota`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        quota: { used: number; total: number };
      };
      return { used: data.quota.used, total: data.quota.total };
    } catch {
      return null;
    }
  }

  async getUserInfo(): Promise<{ name: string; email?: string } | null> {
    try {
      if (this.isTokenExpired()) await this.refreshTokenIfNeeded();

      const res = await fetch(`${GRAPH_API}/me`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        displayName: string;
        mail?: string;
        userPrincipalName?: string;
      };
      return {
        name: data.displayName,
        email: data.mail ?? data.userPrincipalName,
      };
    } catch {
      return null;
    }
  }

  // ===== Private helpers =====

  private toGraphPath(remotePath: string): string {
    return remotePath.replace(/^\/+/, "").replace(/\/+$/, "");
  }

  private async createFolderIfNotExists(path: string): Promise<void> {
    const graphPath = this.toGraphPath(path);
    const parts = graphPath.split("/");
    let currentPath = "";

    for (const part of parts) {
      const parentUrl =
        currentPath === ""
          ? `${GRAPH_API}/me/drive/special/approot/children`
          : `${GRAPH_API}/me/drive/special/approot:/${currentPath}:/children`;

      const res = await fetch(parentUrl, {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: part,
          folder: {},
          "@microsoft.graph.conflictBehavior": "fail",
        }),
      });

      // 409 = already exists, which is fine
      if (!res.ok && res.status !== 409) {
        Logger.warn(TAG, `Failed to create folder: ${part} (${res.status})`);
      }

      currentPath = currentPath ? `${currentPath}/${part}` : part;
    }
  }

  private async largeFileUpload(
    graphPath: string,
    content: Uint8Array,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    // Create upload session
    const sessionRes = await fetch(
      `${GRAPH_API}/me/drive/special/approot:/${graphPath}:/createUploadSession`,
      {
        method: "POST",
        headers: {
          ...this.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          item: { "@microsoft.graph.conflictBehavior": "replace" },
        }),
      },
    );

    if (!sessionRes.ok) {
      throw new Error(`Failed to create upload session: ${sessionRes.status}`);
    }

    const session = (await sessionRes.json()) as { uploadUrl: string };
    const chunkSize = 3_276_800; // ~3.2MB (must be multiple of 320KB)
    const totalSize = content.length;

    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, totalSize);
      const chunk = content.slice(offset, end);

      const chunkRes = await fetch(session.uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunk.length),
          "Content-Range": `bytes ${offset}-${end - 1}/${totalSize}`,
        },
        body: chunk,
      });

      if (!chunkRes.ok && chunkRes.status !== 202) {
        throw new Error(`Chunk upload failed: ${chunkRes.status}`);
      }

      onProgress?.(end / totalSize);
    }
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
