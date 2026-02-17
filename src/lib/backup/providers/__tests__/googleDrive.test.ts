const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  getTokens: jest.fn(),
};

jest.mock("@react-native-google-signin/google-signin", () => ({
  __esModule: true,
  GoogleSignin: mockGoogleSignin,
}));
jest.mock("expo-secure-store", () => ({
  __esModule: true,
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
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

import { GoogleDriveProvider } from "../googleDrive";

describe("backup GoogleDriveProvider", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockGoogleSignin.getTokens.mockResolvedValue({ accessToken: "token-g" });
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
  });

  it("tests connectivity with a pre-authenticated provider", async () => {
    const provider = new GoogleDriveProvider();
    (provider as unknown as { _accessToken: string; _connected: boolean })._accessToken = "token-g";
    (provider as unknown as { _accessToken: string; _connected: boolean })._connected = true;
    jest.spyOn(provider, "refreshTokenIfNeeded").mockResolvedValue(undefined);

    mockFetch.mockResolvedValueOnce({ ok: true });
    await expect(provider.testConnection()).resolves.toBe(true);
  });

  it("lists files and checks file existence", async () => {
    const provider = new GoogleDriveProvider();
    (provider as unknown as { _accessToken: string; _connected: boolean })._accessToken = "token-g";
    (provider as unknown as { _accessToken: string; _connected: boolean })._connected = true;
    jest.spyOn(provider, "refreshTokenIfNeeded").mockResolvedValue(undefined);
    // ensureBackupDir: findOrCreate backup + fits by existing folders
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "backup-id" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "fits-id" }] }) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          files: [
            {
              id: "f1",
              name: "a.fits",
              size: "10",
              modifiedTime: "2024-01-01",
              mimeType: "application/octet-stream",
            },
          ],
        }),
      });
    const files = await provider.listFiles("fits");
    expect(files).toHaveLength(1);
    expect(files[0].name).toBe("a.fits");

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "backup-id" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "fits-id" }] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ files: [{ id: "file-id" }] }) });
    await expect(provider.fileExists("fits/a.fits")).resolves.toBe(true);
  });

  it("parses quota and user info responses", async () => {
    const provider = new GoogleDriveProvider();
    (provider as unknown as { _accessToken: string; _connected: boolean })._accessToken = "token-g";
    (provider as unknown as { _accessToken: string; _connected: boolean })._connected = true;
    jest.spyOn(provider, "refreshTokenIfNeeded").mockResolvedValue(undefined);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ storageQuota: { usage: "12", limit: "100" } }),
    });
    await expect(provider.getQuota()).resolves.toEqual({ used: 12, total: 100 });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ user: { displayName: "Max", emailAddress: "max@example.com" } }),
    });
    await expect(provider.getUserInfo()).resolves.toEqual({
      name: "Max",
      email: "max@example.com",
    });
  });
});
