/**
 * Google Drive Provider
 * 使用 @react-native-google-signin/google-signin + Drive REST API v3
 */

import { File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import { BaseCloudProvider } from "../cloudProvider";
import { parseManifest, serializeManifest } from "../manifest";
import { Logger } from "../../logger";
import type { BackupManifest, CloudProviderConfig, RemoteFile } from "../types";
import { BACKUP_DIR, MANIFEST_FILENAME, FITS_SUBDIR } from "../types";

const TAG = "GoogleDriveProvider";
const SECURE_STORE_KEY = "backup_google_tokens";

const DRIVE_API = "https://www.googleapis.com/drive/v3";
const DRIVE_UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export class GoogleDriveProvider extends BaseCloudProvider {
  readonly name = "google-drive" as const;
  readonly displayName = "Google Drive";
  readonly icon = "logo-google";

  private _backupFolderId: string | null = null;
  private _fitsFolderId: string | null = null;

  async connect(_config?: CloudProviderConfig): Promise<void> {
    try {
      const { GoogleSignin } = await import("@react-native-google-signin/google-signin");

      GoogleSignin.configure({
        scopes: ["https://www.googleapis.com/auth/drive.appdata"],
      });

      await GoogleSignin.hasPlayServices();
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      this._accessToken = tokens.accessToken;
      this._connected = true;

      await SecureStore.setItemAsync(
        SECURE_STORE_KEY,
        JSON.stringify({ accessToken: tokens.accessToken }),
      );

      Logger.info(TAG, "Connected to Google Drive");
    } catch (error) {
      Logger.error(TAG, "Failed to connect", { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
      await GoogleSignin.signOut();
    } catch {
      // ignore sign out errors
    }

    this._accessToken = null;
    this._connected = false;
    this._backupFolderId = null;
    this._fitsFolderId = null;
    await SecureStore.deleteItemAsync(SECURE_STORE_KEY);
    Logger.info(TAG, "Disconnected from Google Drive");
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.refreshTokenIfNeeded();
      const res = await fetch(`${DRIVE_API}/about?fields=user`, {
        headers: this.getAuthHeaders(),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async refreshTokenIfNeeded(): Promise<void> {
    try {
      const { GoogleSignin } = await import("@react-native-google-signin/google-signin");
      const tokens = await GoogleSignin.getTokens();
      this._accessToken = tokens.accessToken;
    } catch (error) {
      Logger.error(TAG, "Token refresh failed", { error });
      this._connected = false;
      throw error;
    }
  }

  async ensureBackupDir(): Promise<void> {
    await this.refreshTokenIfNeeded();

    // Find or create backup folder in appDataFolder
    this._backupFolderId = await this.findOrCreateFolder(BACKUP_DIR, "appDataFolder");
    this._fitsFolderId = await this.findOrCreateFolder(FITS_SUBDIR, this._backupFolderId);
  }

  async uploadFile(
    localPath: string,
    remotePath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    await this.refreshTokenIfNeeded();
    await this.ensureBackupDir();

    const file = new File(localPath);
    if (!file.exists) throw new Error(`Local file not found: ${localPath}`);

    const fileName = remotePath.split("/").pop() ?? remotePath;
    const isInFitsDir = remotePath.includes(FITS_SUBDIR);
    const parentId = isInFitsDir ? this._fitsFolderId! : this._backupFolderId!;

    // Check if file already exists, delete it first
    const existingId = await this.findFileId(fileName, parentId);
    if (existingId) {
      await fetch(`${DRIVE_API}/files/${existingId}`, {
        method: "DELETE",
        headers: this.getAuthHeaders(),
      });
    }

    const content = await file.bytes();
    const metadata = JSON.stringify({
      name: fileName,
      parents: [parentId],
    });

    const boundary = "cobalt_backup_boundary";
    const body = [
      `--${boundary}\r\n`,
      "Content-Type: application/json; charset=UTF-8\r\n\r\n",
      metadata,
      `\r\n--${boundary}\r\n`,
      "Content-Type: application/octet-stream\r\n\r\n",
    ].join("");

    const bodyEnd = `\r\n--${boundary}--`;

    const encoder = new TextEncoder();
    const bodyStart = encoder.encode(body);
    const bodyEndBytes = encoder.encode(bodyEnd);

    const combined = new Uint8Array(bodyStart.length + content.length + bodyEndBytes.length);
    combined.set(bodyStart, 0);
    combined.set(content, bodyStart.length);
    combined.set(bodyEndBytes, bodyStart.length + content.length);

    const res = await fetch(`${DRIVE_UPLOAD_API}/files?uploadType=multipart`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body: combined,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Upload failed: ${res.status} ${errText}`);
    }

    onProgress?.(1);
    Logger.debug(TAG, `Uploaded: ${fileName}`);
  }

  async downloadFile(
    remotePath: string,
    localPath: string,
    onProgress?: (p: number) => void,
  ): Promise<void> {
    await this.refreshTokenIfNeeded();
    await this.ensureBackupDir();

    const fileName = remotePath.split("/").pop() ?? remotePath;
    const isInFitsDir = remotePath.includes(FITS_SUBDIR);
    const parentId = isInFitsDir ? this._fitsFolderId! : this._backupFolderId!;

    const fileId = await this.findFileId(fileName, parentId);
    if (!fileId) throw new Error(`Remote file not found: ${remotePath}`);

    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: this.getAuthHeaders(),
    });

    if (!res.ok) throw new Error(`Download failed: ${res.status}`);

    const data = new Uint8Array(await res.arrayBuffer());
    const destFile = new File(localPath);
    destFile.write(data);

    onProgress?.(1);
    Logger.debug(TAG, `Downloaded: ${fileName}`);
  }

  async deleteFile(remotePath: string): Promise<void> {
    await this.refreshTokenIfNeeded();
    await this.ensureBackupDir();

    const fileName = remotePath.split("/").pop() ?? remotePath;
    const isInFitsDir = remotePath.includes(FITS_SUBDIR);
    const parentId = isInFitsDir ? this._fitsFolderId! : this._backupFolderId!;

    const fileId = await this.findFileId(fileName, parentId);
    if (!fileId) return;

    await fetch(`${DRIVE_API}/files/${fileId}`, {
      method: "DELETE",
      headers: this.getAuthHeaders(),
    });
  }

  async listFiles(remotePath: string): Promise<RemoteFile[]> {
    await this.refreshTokenIfNeeded();
    await this.ensureBackupDir();

    const isInFitsDir = remotePath.includes(FITS_SUBDIR) || remotePath === FITS_SUBDIR;
    const parentId = isInFitsDir ? this._fitsFolderId! : this._backupFolderId!;

    const query = `'${parentId}' in parents and trashed = false`;
    const res = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id,name,size,modifiedTime,mimeType)`,
      { headers: this.getAuthHeaders() },
    );

    if (!res.ok) return [];

    const data = (await res.json()) as {
      files: Array<{
        id: string;
        name: string;
        size?: string;
        modifiedTime?: string;
        mimeType: string;
      }>;
    };

    return (data.files ?? []).map((f) => ({
      name: f.name,
      path: `${remotePath}/${f.name}`,
      size: parseInt(f.size ?? "0", 10),
      lastModified: f.modifiedTime,
      isDirectory: f.mimeType === "application/vnd.google-apps.folder",
      id: f.id,
    }));
  }

  async fileExists(remotePath: string): Promise<boolean> {
    await this.refreshTokenIfNeeded();
    await this.ensureBackupDir();

    const fileName = remotePath.split("/").pop() ?? remotePath;
    const isInFitsDir = remotePath.includes(FITS_SUBDIR);
    const parentId = isInFitsDir ? this._fitsFolderId! : this._backupFolderId!;

    const fileId = await this.findFileId(fileName, parentId);
    return fileId !== null;
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
      await this.refreshTokenIfNeeded();
      const res = await fetch(`${DRIVE_API}/about?fields=storageQuota`, {
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        storageQuota: { usage: string; limit: string };
      };
      return {
        used: parseInt(data.storageQuota.usage, 10),
        total: parseInt(data.storageQuota.limit, 10),
      };
    } catch {
      return null;
    }
  }

  async getUserInfo(): Promise<{ name: string; email?: string } | null> {
    try {
      await this.refreshTokenIfNeeded();
      const res = await fetch(`${DRIVE_API}/about?fields=user`, { headers: this.getAuthHeaders() });
      if (!res.ok) return null;

      const data = (await res.json()) as {
        user: { displayName: string; emailAddress?: string };
      };
      return {
        name: data.user.displayName,
        email: data.user.emailAddress,
      };
    } catch {
      return null;
    }
  }

  // ===== Private helpers =====

  private async findOrCreateFolder(name: string, parent: string): Promise<string> {
    const query =
      parent === "appDataFolder"
        ? `name = '${name}' and 'appDataFolder' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
        : `name = '${name}' and '${parent}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

    const spaces = parent === "appDataFolder" ? "&spaces=appDataFolder" : "";

    const searchRes = await fetch(
      `${DRIVE_API}/files?q=${encodeURIComponent(query)}${spaces}&fields=files(id)`,
      { headers: this.getAuthHeaders() },
    );

    if (searchRes.ok) {
      const data = (await searchRes.json()) as {
        files: Array<{ id: string }>;
      };
      if (data.files?.length > 0) return data.files[0].id;
    }

    // Create folder
    const createRes = await fetch(`${DRIVE_API}/files`, {
      method: "POST",
      headers: {
        ...this.getAuthHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        mimeType: "application/vnd.google-apps.folder",
        parents: [parent],
      }),
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create folder: ${name}`);
    }

    const folder = (await createRes.json()) as { id: string };
    return folder.id;
  }

  private async findFileId(name: string, parentId: string): Promise<string | null> {
    const query = `name = '${name}' and '${parentId}' in parents and trashed = false`;
    const res = await fetch(`${DRIVE_API}/files?q=${encodeURIComponent(query)}&fields=files(id)`, {
      headers: this.getAuthHeaders(),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as { files: Array<{ id: string }> };
    return data.files?.[0]?.id ?? null;
  }
}
