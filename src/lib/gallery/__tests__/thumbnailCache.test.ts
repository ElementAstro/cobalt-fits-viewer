const mockDirs = new Set<string>();
const mockFiles = new Map<string, Uint8Array | string>();

const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

const mockSkiaFromBytes = jest.fn();
const mockSkiaMakeImage = jest.fn();

function mockNormalize(base: string, child?: string): string {
  const joined = child ? `${base}/${child}` : base;
  return joined.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/\/$/, "");
}

function loadThumbnailCacheModule() {
  jest.resetModules();

  jest.doMock("expo-file-system", () => {
    const mockFileClass = class {
      uri: string;
      constructor(base: string | { uri: string }, name?: string) {
        if (typeof base === "string") {
          this.uri = mockNormalize(base, name);
        } else {
          this.uri = mockNormalize(base.uri, name);
        }
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

      delete() {
        mockFiles.delete(this.uri);
      }
    };

    const mockDirectoryClass = class {
      uri: string;
      constructor(base: string | { uri: string }, name?: string) {
        if (typeof base === "string") {
          this.uri = mockNormalize(base, name);
        } else {
          this.uri = mockNormalize(base.uri, name);
        }
      }

      get exists() {
        return mockDirs.has(this.uri);
      }

      create() {
        mockDirs.add(this.uri);
      }

      delete() {
        const prefix = `${this.uri}/`;
        for (const filePath of [...mockFiles.keys()]) {
          if (filePath === this.uri || filePath.startsWith(prefix)) {
            mockFiles.delete(filePath);
          }
        }
        mockDirs.delete(this.uri);
      }

      list() {
        const prefix = `${this.uri}/`;
        const items: Array<InstanceType<typeof mockFileClass>> = [];
        for (const filePath of mockFiles.keys()) {
          if (!filePath.startsWith(prefix)) continue;
          const tail = filePath.slice(prefix.length);
          if (!tail || tail.includes("/")) continue;
          items.push(new mockFileClass(filePath));
        }
        return items;
      }
    };

    return {
      __esModule: true,
      Paths: { cache: "/cache" },
      File: mockFileClass,
      Directory: mockDirectoryClass,
    };
  });

  jest.doMock("@shopify/react-native-skia", () => ({
    Skia: {
      Data: {
        fromBytes: (...args: unknown[]) => mockSkiaFromBytes(...args),
      },
      Image: {
        MakeImage: (...args: unknown[]) => mockSkiaMakeImage(...args),
      },
    },
    AlphaType: { Unpremul: 2 },
    ColorType: { RGBA_8888: 0 },
    ImageFormat: { JPEG: 2 },
  }));

  jest.doMock("../../logger", () => {
    const actual = jest.requireActual("../../logger") as typeof import("../../logger");
    return {
      __esModule: true,
      ...actual,
      Logger: {
        ...actual.Logger,
        ...mockLogger,
      },
    };
  });

  return require("../thumbnailCache") as {
    ensureThumbnailDir: () => void;
    getThumbnailPath: (id: string) => string;
    hasThumbnail: (id: string) => boolean;
    clearThumbnailCache: () => void;
    getThumbnailCacheSize: () => number;
    deleteThumbnail: (id: string) => void;
    deleteThumbnails: (ids: string[]) => void;
    generateAndSaveThumbnail: (
      fileId: string,
      rgba: Uint8ClampedArray,
      srcWidth: number,
      srcHeight: number,
      targetSize?: number,
      quality?: number,
    ) => string | null;
    downsampleRGBA: (
      rgba: Uint8ClampedArray,
      srcWidth: number,
      srcHeight: number,
      targetSize: number,
    ) => { data: Uint8ClampedArray; width: number; height: number };
  };
}

describe("thumbnailCache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDirs.clear();
    mockFiles.clear();
  });

  it("manages thumbnail paths and basic cache operations", () => {
    const mod = loadThumbnailCacheModule();

    mod.ensureThumbnailDir();
    expect(mockDirs.has("/cache/thumbnails")).toBe(true);

    const path = mod.getThumbnailPath("file-1");
    expect(path).toBe("/cache/thumbnails/file-1.jpg");

    expect(mod.hasThumbnail("file-1")).toBe(false);
    mockFiles.set(path, new Uint8Array([1, 2, 3]));
    expect(mod.hasThumbnail("file-1")).toBe(true);

    mod.deleteThumbnail("file-1");
    expect(mod.hasThumbnail("file-1")).toBe(false);

    mockFiles.set("/cache/thumbnails/a.jpg", new Uint8Array([1]));
    mockFiles.set("/cache/thumbnails/b.jpg", new Uint8Array([2]));
    mod.deleteThumbnails(["a", "b"]);
    expect(mockFiles.size).toBe(0);
  });

  it("computes cache size and clears directory", () => {
    const mod = loadThumbnailCacheModule();

    expect(mod.getThumbnailCacheSize()).toBe(0);

    mockDirs.add("/cache/thumbnails");
    mockFiles.set("/cache/thumbnails/a.jpg", new Uint8Array([1, 2, 3]));
    mockFiles.set("/cache/thumbnails/b.jpg", new Uint8Array([4, 5]));

    expect(mod.getThumbnailCacheSize()).toBe(5);

    mod.clearThumbnailCache();
    expect(mockDirs.has("/cache/thumbnails")).toBe(true);
    expect(mod.getThumbnailCacheSize()).toBe(0);
  });

  it("generates and saves thumbnail when skia encoding succeeds", () => {
    const mod = loadThumbnailCacheModule();

    const mockEncodeToBytes = jest.fn(() => new Uint8Array([9, 8, 7]));
    mockSkiaFromBytes.mockReturnValue({ ok: true });
    mockSkiaMakeImage.mockReturnValue({ encodeToBytes: mockEncodeToBytes });

    const rgba = new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255, 7, 8, 9, 255, 10, 11, 12, 255]);

    const uri = mod.generateAndSaveThumbnail("thumb-1", rgba, 2, 2, 2, 70);

    expect(uri).toBe("/cache/thumbnails/thumb-1.jpg");
    expect(mockFiles.get("/cache/thumbnails/thumb-1.jpg")).toEqual(new Uint8Array([9, 8, 7]));
    expect(mockEncodeToBytes).toHaveBeenCalledWith(2, 70);
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it("returns null and logs warnings when skia image creation fails", () => {
    const mod = loadThumbnailCacheModule();

    mockSkiaFromBytes.mockReturnValue({ ok: true });
    mockSkiaMakeImage.mockReturnValue(null);

    const rgba = new Uint8ClampedArray([1, 2, 3, 255]);
    const uri = mod.generateAndSaveThumbnail("thumb-fail", rgba, 1, 1);

    expect(uri).toBeNull();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it("downsamples RGBA and does not upscale above original size", () => {
    const mod = loadThumbnailCacheModule();

    const src = new Uint8ClampedArray([
      10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255, 50, 0, 0, 255, 60, 0, 0, 255, 70,
      0, 0, 255, 80, 0, 0, 255,
    ]);

    const reduced = mod.downsampleRGBA(src, 4, 2, 2);
    expect(reduced.width).toBe(2);
    expect(reduced.height).toBe(1);
    expect(reduced.data[0]).toBe(10);
    expect(reduced.data[4]).toBe(30);

    const noUpscale = mod.downsampleRGBA(src, 4, 2, 100);
    expect(noUpscale.width).toBe(4);
    expect(noUpscale.height).toBe(2);
  });
});
