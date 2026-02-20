/**
 * WebDAV Provider
 * 使用 webdav npm 包 (React Native 入口)
 */

import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { BaseCloudProvider } from "../cloudProvider";
import { parseManifest, serializeManifest } from "../manifest";
import { LOG_TAGS, Logger } from "../../logger";
import type { BackupManifest, CloudProviderConfig, RemoteFile } from "../types";
import { BACKUP_DIR, MANIFEST_FILENAME, FITS_SUBDIR, THUMBNAIL_SUBDIR } from "../types";

const TAG = LOG_TAGS.WebDAVProvider;
const SECURE_STORE_KEY = "backup_webdav_config";

export class WebDAVProvider extends BaseCloudProvider {
  readonly name = "webdav" as const;
  readonly displayName = "WebDAV";
  readonly icon = "server-outline";
  readonly capabilities = {
    supportsConditionalWrite: true,
    supportsResumableUpload: false,
    supportsContentHash: false,
  } as const;

  private _serverUrl: string | null = null;
  private _username: string | null = null;
  private _password: string | null = null;

  async connect(config?: CloudProviderConfig): Promise<void> {
    if (config?.webdavUrl && config?.webdavUsername) {
      this._serverUrl = config.webdavUrl.replace(/\/+$/, "");
      this._username = config.webdavUsername;
      this._password = config.webdavPassword ?? "";
      this._connected = true;

      await this.saveConfig();
      Logger.info(TAG, "Connected to WebDAV");
      return;
    }

    const saved = await this.loadConfig();
    if (saved) {
      this._serverUrl = saved.url;
      this._username = saved.username;
      this._password = saved.password;
      this._connected = true;
      Logger.info(TAG, "Restored WebDAV connection");
      return;
    }

    throw new Error("WebDAV requires server URL and credentials.");
  }

  async disconnect(): Promise<void> {
    this._serverUrl = null;
    this._username = null;
    this._password = null;
    this._connected = false;
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    Logger.info(TAG, "Disconnected from WebDAV");
  }

  async testConnection(): Promise<boolean> {
    try {
      const res = await this.davRequest("PROPFIND", "/", {
        Depth: "0",
      });
      return res.ok || res.status === 207;
    } catch {
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<void> {
    // WebDAV uses basic auth, no token refresh needed
  }

  async ensureBackupDir(): Promise<void> {
    await this.createDirIfNotExists(`/${BACKUP_DIR}`);
    await this.createDirIfNotExists(`/${BACKUP_DIR}/${FITS_SUBDIR}`);
    await this.createDirIfNotExists(`/${BACKUP_DIR}/${THUMBNAIL_SUBDIR}`);
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const file = new File(localPath);
    if (!file.exists) throw new Error(`Local file not found: ${localPath}`);

    const content = await file.bytes();
    const davPath = this.toDavPath(remotePath);

    const res = await this.davRequest(
      "PUT",
      davPath,
      {
        "Content-Type": "application/octet-stream",
      },
      content,
    );

    if (!res.ok && res.status !== 201 && res.status !== 204) {
      const errText = await res.text();
      throw new Error(`Upload failed: ${res.status} ${errText}`);
    }

    onProgress?.(1);
    Logger.debug(TAG, `Uploaded: ${remotePath}`);
  }

  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    const davPath = this.toDavPath(remotePath);

    const res = await this.davRequest("GET", davPath);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const data = new Uint8Array(await res.arrayBuffer());
    const destFile = new File(localPath);
    destFile.write(data);

    onProgress?.(1);
    Logger.debug(TAG, `Downloaded: ${remotePath}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    const davPath = this.toDavPath(remotePath);
    await this.davRequest("DELETE", davPath);
  }

  async listFiles(remotePath: string): Promise<RemoteFile[]> {
    const davPath = this.toDavPath(remotePath);

    const res = await this.davRequest("PROPFIND", davPath + "/", {
      Depth: "1",
      "Content-Type": "application/xml",
    });

    if (!res.ok && res.status !== 207) return [];

    const xml = await res.text();
    return this.parseMultiStatus(xml, davPath);
  }

  async fileExists(remotePath: string): Promise<boolean> {
    const davPath = this.toDavPath(remotePath);

    const res = await this.davRequest("PROPFIND", davPath, {
      Depth: "0",
    });

    return res.ok || res.status === 207;
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
      const body = `<?xml version="1.0" encoding="UTF-8"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:quota-used-bytes/>
    <d:quota-available-bytes/>
  </d:prop>
</d:propfind>`;

      const res = await this.davRequest(
        "PROPFIND",
        "/",
        {
          Depth: "0",
          "Content-Type": "application/xml",
        },
        body,
      );

      if (!res.ok && res.status !== 207) return null;

      const xml = await res.text();
      const usedMatch = xml.match(/<d:quota-used-bytes>(\d+)<\/d:quota-used-bytes>/i);
      const availMatch = xml.match(/<d:quota-available-bytes>(\d+)<\/d:quota-available-bytes>/i);

      if (!usedMatch || !availMatch) return null;

      const used = parseInt(usedMatch[1], 10);
      const available = parseInt(availMatch[1], 10);

      return { used, total: used + available };
    } catch {
      return null;
    }
  }

  async getUserInfo(): Promise<{ name: string; email?: string } | null> {
    if (!this._username || !this._serverUrl) return null;
    return {
      name: this._username,
      email: undefined,
    };
  }

  // ===== Public accessors =====

  getServerUrl(): string | null {
    return this._serverUrl;
  }

  // ===== Private helpers =====

  private toDavPath(remotePath: string): string {
    const p = remotePath.replace(/^\/+/, "");
    return `/${p}`;
  }

  private getBasicAuth(): string {
    const credentials = `${this._username}:${this._password}`;
    return `Basic ${btoa(credentials)}`;
  }

  private async davRequest(
    method: string,
    path: string,
    extraHeaders?: Record<string, string>,
    body?: string | Uint8Array,
  ): Promise<Response> {
    if (!this._serverUrl) throw new Error("WebDAV not configured");

    const url = `${this._serverUrl}${path}`;
    const headers: Record<string, string> = {
      Authorization: this.getBasicAuth(),
      ...extraHeaders,
    };

    return fetch(url, {
      method,
      headers,
      body: body as BodyInit | undefined,
    });
  }

  private async createDirIfNotExists(path: string): Promise<void> {
    const res = await this.davRequest("MKCOL", path);
    // 405 = already exists, 301 = redirect (already exists)
    if (!res.ok && res.status !== 405 && res.status !== 301) {
      Logger.warn(TAG, `Failed to create dir: ${path} (${res.status})`);
    }
  }

  private parseMultiStatus(xml: string, basePath: string): RemoteFile[] {
    const results: RemoteFile[] = [];

    // Simple XML parsing for DAV:response elements
    const responseRegex = /<d:response>([\s\S]*?)<\/d:response>/gi;
    let match;

    while ((match = responseRegex.exec(xml)) !== null) {
      const response = match[1];

      const hrefMatch = response.match(/<d:href>(.*?)<\/d:href>/i);
      if (!hrefMatch) continue;

      const href = decodeURIComponent(hrefMatch[1]);

      // Skip the directory itself
      const normalizedHref = href.replace(/\/+$/, "");
      const normalizedBase = basePath.replace(/\/+$/, "");
      if (normalizedHref === normalizedBase || normalizedHref.endsWith(normalizedBase)) {
        continue;
      }

      const name = href.split("/").filter(Boolean).pop() ?? "";
      const isDirectory = response.includes("<d:collection") || response.includes("d:collection/>");

      const sizeMatch = response.match(/<d:getcontentlength>(\d+)<\/d:getcontentlength>/i);
      const modifiedMatch = response.match(/<d:getlastmodified>(.*?)<\/d:getlastmodified>/i);

      results.push({
        name,
        path: href,
        size: sizeMatch ? parseInt(sizeMatch[1], 10) : 0,
        lastModified: modifiedMatch?.[1],
        isDirectory,
      });
    }

    return results;
  }

  private async saveConfig(): Promise<void> {
    await SecureStore.setItemAsync(
      SECURE_STORE_KEY,
      JSON.stringify({
        url: this._serverUrl,
        username: this._username,
        password: this._password,
      }),
    );
  }

  private async loadConfig(): Promise<{
    url: string;
    username: string;
    password: string;
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
