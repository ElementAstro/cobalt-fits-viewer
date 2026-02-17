const mockSecureStore = {
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

jest.mock("expo-secure-store", () => ({
  __esModule: true,
  ...mockSecureStore,
  default: mockSecureStore,
}));
jest.mock("expo-file-system", () => ({
  Paths: { cache: "/cache" },
  File: class {
    uri: string;
    exists = false;
    constructor(path: string) {
      this.uri = path;
    }
    async bytes() {
      return new Uint8Array();
    }
    write() {}
    delete() {}
    async text() {
      return "{}";
    }
  },
}));
jest.mock("../../manifest", () => ({
  parseManifest: jest.fn((x: string) => JSON.parse(x)),
  serializeManifest: jest.fn((m: unknown) => JSON.stringify(m)),
}));
jest.mock("../../../logger", () => ({
  __esModule: true,
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

import { OneDriveProvider } from "../onedrive";

describe("backup OneDriveProvider", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
  });

  it("connects with config and persisted tokens", async () => {
    const provider = new OneDriveProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    await provider.connect({
      provider: "onedrive",
      accessToken: "a1",
      refreshToken: "r1",
      tokenExpiry: Date.now() + 1000,
    });
    expect(provider.isConnected()).toBe(true);
  });

  it("restores saved tokens and refreshes with client id", async () => {
    const provider = new OneDriveProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    (provider as unknown as { loadTokens: () => Promise<unknown> }).loadTokens = jest
      .fn()
      .mockResolvedValue({
        accessToken: "old",
        refreshToken: "refresh",
        tokenExpiry: Date.now() - 10_000,
      });
    provider.setClientId("client-1");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "new", refresh_token: "new-r", expires_in: 120 }),
    });

    await provider.connect();
    expect(provider.isConnected()).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("tests connection state and refresh guard", async () => {
    const provider = new OneDriveProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    await provider.connect({ provider: "onedrive", accessToken: "a1" });
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(provider.testConnection()).resolves.toBe(true);

    // no clientId/refreshToken means no refresh request needed
    await expect(provider.refreshTokenIfNeeded()).resolves.toBeUndefined();
  });

  it("checks file existence and parses quota/user info", async () => {
    const provider = new OneDriveProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    await provider.connect({ provider: "onedrive", accessToken: "a1" });

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(provider.fileExists("backup/manifest.json")).resolves.toBe(true);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ quota: { used: 12, total: 50 } }),
    });
    await expect(provider.getQuota()).resolves.toEqual({ used: 12, total: 50 });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ displayName: "User A", userPrincipalName: "user@example.com" }),
    });
    await expect(provider.getUserInfo()).resolves.toEqual({
      name: "User A",
      email: "user@example.com",
    });
  });
});
