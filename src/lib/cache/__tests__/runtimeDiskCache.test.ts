const mockDirs = new Set<string>();
const mockFiles = new Map<string, Uint8Array | string>();
const CACHE_DIR = "/cache/runtime_image_cache";
const INDEX_PATH = `${CACHE_DIR}/index.json`;

function normalize(base: string, child?: string): string {
  const joined = child ? `${base}/${child}` : base;
  return joined.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function loadRuntimeDiskCacheModule() {
  jest.resetModules();

  jest.doMock("expo-file-system", () => {
    const MockFile = class {
      uri: string;
      name: string;
      constructor(base: string | { uri: string }, name?: string) {
        this.uri = typeof base === "string" ? normalize(base, name) : normalize(base.uri, name);
        const segments = this.uri.split("/");
        this.name = segments[segments.length - 1] ?? "";
      }

      get exists() {
        return mockFiles.has(this.uri);
      }

      get size() {
        const data = mockFiles.get(this.uri);
        if (data instanceof Uint8Array) return data.length;
        if (typeof data === "string") return new TextEncoder().encode(data).length;
        return 0;
      }

      write(data: Uint8Array | string) {
        mockFiles.set(this.uri, data);
      }

      async text() {
        const data = mockFiles.get(this.uri);
        if (typeof data === "string") return data;
        if (data instanceof Uint8Array) return new TextDecoder().decode(data);
        return "";
      }

      async arrayBuffer() {
        const data = mockFiles.get(this.uri);
        if (data instanceof Uint8Array) {
          return data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
        }
        if (typeof data === "string") {
          return new TextEncoder().encode(data).buffer;
        }
        return new ArrayBuffer(0);
      }

      delete() {
        mockFiles.delete(this.uri);
      }
    };

    const MockDirectory = class {
      uri: string;
      constructor(base: string | { uri: string }, name?: string) {
        this.uri = typeof base === "string" ? normalize(base, name) : normalize(base.uri, name);
      }

      get exists() {
        return mockDirs.has(this.uri);
      }

      create() {
        mockDirs.add(this.uri);
      }

      delete() {
        const prefix = `${this.uri}/`;
        for (const key of [...mockFiles.keys()]) {
          if (key.startsWith(prefix) || key === this.uri) {
            mockFiles.delete(key);
          }
        }
        mockDirs.delete(this.uri);
      }

      list() {
        const prefix = `${this.uri}/`;
        const items: Array<InstanceType<typeof MockFile>> = [];
        for (const key of mockFiles.keys()) {
          if (!key.startsWith(prefix)) continue;
          const tail = key.slice(prefix.length);
          if (!tail || tail.includes("/")) continue;
          items.push(new MockFile(key));
        }
        return items;
      }
    };

    return {
      __esModule: true,
      Paths: { cache: "/cache" },
      File: MockFile,
      Directory: MockDirectory,
    };
  });

  jest.doMock("../../logger", () => {
    const actual = jest.requireActual("../../logger") as typeof import("../../logger");
    return {
      __esModule: true,
      ...actual,
      Logger: {
        ...actual.Logger,
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    };
  });

  return require("../runtimeDiskCache") as typeof import("../runtimeDiskCache");
}

describe("runtimeDiskCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDirs.clear();
    mockFiles.clear();
  });

  it("stores and restores runtime cache buffers", async () => {
    const mod = loadRuntimeDiskCacheModule();
    mod.configureRuntimeDiskCache({ maxEntries: 4, maxBytes: 16 * 1024 * 1024 });
    await mod.prepareRuntimeDiskCache();

    const payload = new Uint8Array([1, 2, 3, 4]).buffer;
    await mod.setRuntimeDiskCacheBuffer("cache-key-a", payload);
    const restored = await mod.getRuntimeDiskCacheBuffer("cache-key-a");

    expect(restored).not.toBeNull();
    expect(new Uint8Array(restored ?? new ArrayBuffer(0))).toEqual(new Uint8Array([1, 2, 3, 4]));
    expect(mod.getRuntimeDiskCacheStats().entries).toBe(1);
  });

  it("evicts least recently used entry when max entries exceeded", async () => {
    const mod = loadRuntimeDiskCacheModule();
    mod.configureRuntimeDiskCache({ maxEntries: 1, maxBytes: 16 * 1024 * 1024 });
    await mod.prepareRuntimeDiskCache();

    await mod.setRuntimeDiskCacheBuffer("cache-key-a", new Uint8Array([1]).buffer);
    await mod.setRuntimeDiskCacheBuffer("cache-key-b", new Uint8Array([2]).buffer);

    const first = await mod.getRuntimeDiskCacheBuffer("cache-key-a");
    const second = await mod.getRuntimeDiskCacheBuffer("cache-key-b");

    expect(first).toBeNull();
    expect(second).not.toBeNull();
    expect(mod.getRuntimeDiskCacheStats().entries).toBe(1);
  });

  it("clears all runtime disk cache files", async () => {
    const mod = loadRuntimeDiskCacheModule();
    mod.configureRuntimeDiskCache({ maxEntries: 2, maxBytes: 16 * 1024 * 1024 });
    await mod.prepareRuntimeDiskCache();
    await mod.setRuntimeDiskCacheBuffer("cache-key-a", new Uint8Array([9, 9]).buffer);

    expect(mod.getRuntimeDiskCacheStats().entries).toBe(1);
    mod.clearRuntimeDiskCaches();
    expect(mod.getRuntimeDiskCacheStats().entries).toBe(0);
    expect(await mod.getRuntimeDiskCacheBuffer("cache-key-a")).toBeNull();
  });

  it("cleans orphan payload files when index is missing", async () => {
    const mod = loadRuntimeDiskCacheModule();
    mockDirs.add(CACHE_DIR);
    mockFiles.set(`${CACHE_DIR}/orphan.bin`, new Uint8Array([1, 2, 3]));

    await mod.prepareRuntimeDiskCache();

    expect(mod.getRuntimeDiskCacheStats().entries).toBe(0);
    expect(mockFiles.has(`${CACHE_DIR}/orphan.bin`)).toBe(false);
  });

  it("repairs malformed index data without throwing", async () => {
    const mod = loadRuntimeDiskCacheModule();
    mockDirs.add(CACHE_DIR);
    mockFiles.set(INDEX_PATH, "{invalid-json");

    await expect(mod.prepareRuntimeDiskCache()).resolves.toBeUndefined();
    expect(mod.getRuntimeDiskCacheStats().entries).toBe(0);
    expect(typeof mockFiles.get(INDEX_PATH)).toBe("string");
  });

  it("drops index entries whose payload files are missing", async () => {
    const mod = loadRuntimeDiskCacheModule();
    mockDirs.add(CACHE_DIR);
    mockFiles.set(
      INDEX_PATH,
      JSON.stringify({
        schemaVersion: 1,
        entries: [
          {
            cacheKey: "ghost-key",
            payloadFile: "ghost.bin",
            byteSize: 10,
            createdAt: 1,
            lastAccessAt: 1,
          },
        ],
      }),
    );

    await mod.prepareRuntimeDiskCache();

    expect(await mod.getRuntimeDiskCacheBuffer("ghost-key")).toBeNull();
    const rawIndex = mockFiles.get(INDEX_PATH);
    expect(typeof rawIndex).toBe("string");
    const parsed = JSON.parse(String(rawIndex)) as { entries?: unknown[] };
    expect(Array.isArray(parsed.entries)).toBe(true);
    expect(parsed.entries).toHaveLength(0);
  });
});
