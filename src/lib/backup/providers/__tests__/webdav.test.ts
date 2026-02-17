const mockSecureStore = {
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

const mockFileStore = new Map<string, Uint8Array | string>();

interface WebDAVProviderInstance {
  connect: (config?: {
    provider: "webdav";
    webdavUrl?: string;
    webdavUsername?: string;
    webdavPassword?: string;
    accessToken?: string;
  }) => Promise<void>;
  isConnected: () => boolean;
  getServerUrl: () => string | null;
  testConnection: () => Promise<boolean>;
  uploadFile: (localPath: string, remotePath: string) => Promise<void>;
  downloadFile: (remotePath: string, localPath: string) => Promise<void>;
  getQuota: () => Promise<{ used: number; total: number } | null>;
  getUserInfo: () => Promise<{ name: string; email?: string } | null>;
}

function loadWebDAVProvider() {
  jest.resetModules();

  jest.doMock("expo-secure-store", () => ({
    __esModule: true,
    ...mockSecureStore,
    default: mockSecureStore,
  }));

  jest.doMock("expo-file-system", () => {
    const mockFileClass = class {
      uri: string;
      constructor(path: string) {
        this.uri = path;
      }
      get exists() {
        return mockFileStore.has(this.uri);
      }
      async bytes() {
        const data = mockFileStore.get(this.uri);
        if (data instanceof Uint8Array) return data;
        if (typeof data === "string") return new TextEncoder().encode(data);
        return new Uint8Array();
      }
      write(data: Uint8Array | string) {
        mockFileStore.set(this.uri, data);
      }
      delete() {
        mockFileStore.delete(this.uri);
      }
      async text() {
        const data = mockFileStore.get(this.uri);
        if (typeof data === "string") return data;
        if (data instanceof Uint8Array) return new TextDecoder().decode(data);
        return "";
      }
    };

    return {
      __esModule: true,
      Paths: { cache: "/cache" },
      File: mockFileClass,
    };
  });

  jest.doMock("../../manifest", () => ({
    parseManifest: jest.fn((x: string) => JSON.parse(x)),
    serializeManifest: jest.fn((m: unknown) => JSON.stringify(m)),
  }));

  jest.doMock("../../../logger", () => {
    const actual = jest.requireActual("../../../logger") as typeof import("../../../logger");
    return {
      __esModule: true,
      ...actual,
      Logger: {
        ...actual.Logger,
        ...mockLogger,
      },
    };
  });

  return require("../webdav") as { WebDAVProvider: new () => WebDAVProviderInstance };
}

describe("backup WebDAVProvider", () => {
  const mockFetch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockFileStore.clear();
    (global as unknown as { fetch: typeof fetch }).fetch = mockFetch as unknown as typeof fetch;
    (global as unknown as { btoa: (v: string) => string }).btoa = (v: string) =>
      Buffer.from(v, "utf8").toString("base64");
  });

  it("connects with config and restores saved credentials", async () => {
    const { WebDAVProvider } = loadWebDAVProvider();
    const provider = new WebDAVProvider();
    (provider as unknown as { saveConfig: () => Promise<void> }).saveConfig = jest
      .fn()
      .mockResolvedValue(undefined);

    await provider.connect({
      provider: "webdav",
      webdavUrl: "https://dav.example.com/",
      webdavUsername: "max",
      webdavPassword: "pw",
      accessToken: "unused",
    });

    expect(provider.isConnected()).toBe(true);
    expect(provider.getServerUrl()).toBe("https://dav.example.com");

    const restored = new WebDAVProvider();
    (restored as unknown as { loadConfig: () => Promise<unknown> }).loadConfig = jest
      .fn()
      .mockResolvedValue({ url: "https://dav.saved", username: "u", password: "p" });
    await restored.connect();
    expect(restored.getServerUrl()).toBe("https://dav.saved");
  });

  it("tests connection status", async () => {
    const { WebDAVProvider } = loadWebDAVProvider();
    const provider = new WebDAVProvider();
    (provider as unknown as { saveConfig: () => Promise<void> }).saveConfig = jest
      .fn()
      .mockResolvedValue(undefined);

    await provider.connect({
      provider: "webdav",
      webdavUrl: "https://dav.example.com",
      webdavUsername: "max",
      webdavPassword: "pw",
      accessToken: "unused",
    });

    mockFetch.mockResolvedValueOnce({ ok: false, status: 207 });
    await expect(provider.testConnection()).resolves.toBe(true);
  });

  it("uploads and downloads files via WebDAV endpoints", async () => {
    const { WebDAVProvider } = loadWebDAVProvider();
    const provider = new WebDAVProvider();
    (provider as unknown as { saveConfig: () => Promise<void> }).saveConfig = jest
      .fn()
      .mockResolvedValue(undefined);

    await provider.connect({
      provider: "webdav",
      webdavUrl: "https://dav.example.com",
      webdavUsername: "max",
      webdavPassword: "pw",
      accessToken: "unused",
    });

    mockFileStore.set("/tmp/in.bin", new Uint8Array([1, 2, 3]));
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201, text: async () => "" });
    await expect(provider.uploadFile("/tmp/in.bin", "backup/in.bin")).resolves.toBeUndefined();

    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => new Uint8Array([9, 8, 7]).buffer,
    });
    await expect(provider.downloadFile("backup/in.bin", "/tmp/out.bin")).resolves.toBeUndefined();
    expect(mockFileStore.get("/tmp/out.bin")).toEqual(new Uint8Array([9, 8, 7]));
  });

  it("parses quota and user info", async () => {
    const { WebDAVProvider } = loadWebDAVProvider();
    const provider = new WebDAVProvider();
    (provider as unknown as { saveConfig: () => Promise<void> }).saveConfig = jest
      .fn()
      .mockResolvedValue(undefined);

    await provider.connect({
      provider: "webdav",
      webdavUrl: "https://dav.example.com",
      webdavUsername: "max",
      webdavPassword: "pw",
      accessToken: "unused",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () =>
        "<d:quota-used-bytes>20</d:quota-used-bytes><d:quota-available-bytes>80</d:quota-available-bytes>",
    });

    await expect(provider.getQuota()).resolves.toEqual({ used: 20, total: 100 });
    await expect(provider.getUserInfo()).resolves.toEqual({ name: "max", email: undefined });
  });
});
