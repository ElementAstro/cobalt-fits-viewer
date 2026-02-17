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

import { DropboxProvider } from "../dropbox";

describe("backup DropboxProvider", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
  });

  it("connects with explicit config and persists tokens", async () => {
    const provider = new DropboxProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    await provider.connect({
      provider: "dropbox",
      accessToken: "a1",
      refreshToken: "r1",
      tokenExpiry: Date.now() + 3600_000,
    });
    expect(provider.isConnected()).toBe(true);
  });

  it("restores saved tokens and refreshes when expired", async () => {
    const provider = new DropboxProvider();
    const saveTokens = jest.fn().mockResolvedValue(undefined);
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = saveTokens;
    (provider as unknown as { loadTokens: () => Promise<unknown> }).loadTokens = jest
      .fn()
      .mockResolvedValue({
        accessToken: "old-access",
        refreshToken: "refresh-1",
        tokenExpiry: Date.now() - 1000,
      });
    provider.setAppKey("app-key");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ access_token: "new-access", expires_in: 100 }),
    });

    await provider.connect();
    expect(provider.isConnected()).toBe(true);
    expect(mockFetch).toHaveBeenCalled();
    expect(saveTokens).toHaveBeenCalled();
  });

  it("refreshes token and marks disconnected on refresh failure", async () => {
    const provider = new DropboxProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    await provider.connect({
      provider: "dropbox",
      accessToken: "a1",
      refreshToken: "r1",
      tokenExpiry: Date.now() - 1000,
    });
    provider.setAppKey("app-key");
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "" });
    await expect(provider.refreshTokenIfNeeded()).rejects.toBeTruthy();
    expect(provider.isConnected()).toBe(false);
  });

  it("tests connection and checks file existence", async () => {
    const provider = new DropboxProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    await provider.connect({ provider: "dropbox", accessToken: "a1" });
    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(provider.testConnection()).resolves.toBe(true);

    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(provider.fileExists("backup/manifest.json")).resolves.toBe(false);
  });

  it("parses quota and user info responses", async () => {
    const provider = new DropboxProvider();
    (provider as unknown as { saveTokens: () => Promise<void> }).saveTokens = jest
      .fn()
      .mockResolvedValue(undefined);
    await provider.connect({ provider: "dropbox", accessToken: "a1" });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ used: 10, allocation: { allocated: 100 } }),
    });
    await expect(provider.getQuota()).resolves.toEqual({ used: 10, total: 100 });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: { display_name: "Max" }, email: "max@example.com" }),
    });
    await expect(provider.getUserInfo()).resolves.toEqual({
      name: "Max",
      email: "max@example.com",
    });
  });
});
