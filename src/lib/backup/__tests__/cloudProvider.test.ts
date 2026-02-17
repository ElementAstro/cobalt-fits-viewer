import type { BackupManifest, CloudProviderConfig, RemoteFile } from "../types";
import { BaseCloudProvider } from "../cloudProvider";

class TestCloudProvider extends BaseCloudProvider {
  readonly name = "webdav" as const;
  readonly displayName = "Test";
  readonly icon = "test";

  async connect(config?: CloudProviderConfig): Promise<void> {
    if (config?.accessToken) {
      this._accessToken = config.accessToken;
    }
    this._connected = true;
  }
  async disconnect(): Promise<void> {
    this._connected = false;
  }
  async testConnection(): Promise<boolean> {
    return true;
  }
  async refreshTokenIfNeeded(): Promise<void> {}
  async uploadFile(): Promise<void> {}
  async downloadFile(): Promise<void> {}
  async deleteFile(): Promise<void> {}
  async listFiles(): Promise<RemoteFile[]> {
    return [];
  }
  async fileExists(): Promise<boolean> {
    return false;
  }
  async uploadManifest(_manifest: BackupManifest): Promise<void> {}
  async downloadManifest(): Promise<BackupManifest | null> {
    return null;
  }
  async getQuota(): Promise<{ used: number; total: number } | null> {
    return null;
  }
  async getUserInfo(): Promise<{ name: string; email?: string } | null> {
    return null;
  }
  async ensureBackupDir(): Promise<void> {}

  setTokenExpiry(ts: number | null) {
    this._tokenExpiry = ts;
  }
  setAccessToken(token: string | null) {
    this._accessToken = token;
  }
  readTokenExpired(): boolean {
    return this.isTokenExpired();
  }
  readAuthHeaders(): Record<string, string> {
    return this.getAuthHeaders();
  }
}

describe("backup cloudProvider base", () => {
  it("tracks connected state", async () => {
    const provider = new TestCloudProvider();
    expect(provider.isConnected()).toBe(false);
    await provider.connect({ provider: "webdav", accessToken: "abc" });
    expect(provider.isConnected()).toBe(true);
    await provider.disconnect();
    expect(provider.isConnected()).toBe(false);
  });

  it("checks token expiry with safety window", () => {
    const provider = new TestCloudProvider();
    provider.setTokenExpiry(null);
    expect(provider.readTokenExpired()).toBe(false);

    provider.setTokenExpiry(Date.now() + 120_000);
    expect(provider.readTokenExpired()).toBe(false);

    provider.setTokenExpiry(Date.now() + 30_000);
    expect(provider.readTokenExpired()).toBe(true);
  });

  it("builds auth header and throws when token is absent", () => {
    const provider = new TestCloudProvider();
    provider.setAccessToken("token-1");
    expect(provider.readAuthHeaders()).toEqual({ Authorization: "Bearer token-1" });
    provider.setAccessToken(null);
    expect(() => provider.readAuthHeaders()).toThrow("Not authenticated");
  });
});
