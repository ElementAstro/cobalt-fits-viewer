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

      copy(target: { uri: string }) {
        const data = mockFiles.get(this.uri);
        if (data !== undefined) {
          mockFiles.set(target.uri, data);
        }
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
    resolveThumbnailUri: (fileId: string, thumbnailUri?: string) => string | null;
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
    copyThumbnailToCache: (fileId: string, sourceUri: string) => string | null;
    generateVideoThumbnailToCache: (
      fileId: string,
      filepath: string,
      timeMs: number,
      qualityPercent: number,
    ) => Promise<string | null>;
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

  it("resolves thumbnail uri from persisted uri or shared cache path", () => {
    const mod = loadThumbnailCacheModule();

    mockFiles.set("/cache/custom/persisted.jpg", new Uint8Array([1]));
    expect(mod.resolveThumbnailUri("f1", "/cache/custom/persisted.jpg")).toBe(
      "/cache/custom/persisted.jpg",
    );

    mockFiles.set("/cache/thumbnails/f2.jpg", new Uint8Array([2]));
    expect(mod.resolveThumbnailUri("f2", "/cache/missing/old.jpg")).toBe(
      "/cache/thumbnails/f2.jpg",
    );

    expect(mod.resolveThumbnailUri("f3")).toBeNull();
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

  it("prunes cache when over max size, keeping newest files", () => {
    const mod = loadThumbnailCacheModule();
    mockDirs.add("/cache/thumbnails");

    // 3 files totaling 9 bytes
    mockFiles.set("/cache/thumbnails/aaa.jpg", new Uint8Array([1, 2, 3]));
    mockFiles.set("/cache/thumbnails/bbb.jpg", new Uint8Array([4, 5, 6]));
    mockFiles.set("/cache/thumbnails/ccc.jpg", new Uint8Array([7, 8, 9]));

    expect(mod.getThumbnailCacheSize()).toBe(9);

    // Prune to max 6 bytes => should remove oldest (alphabetically first) until <= 6
    const pruned = (
      require("../thumbnailCache") as { pruneThumbnailCache: (max: number) => number }
    ).pruneThumbnailCache(6);

    expect(pruned).toBe(1);
    expect(mod.getThumbnailCacheSize()).toBe(6);
    expect(mockFiles.has("/cache/thumbnails/aaa.jpg")).toBe(false);
    expect(mockFiles.has("/cache/thumbnails/bbb.jpg")).toBe(true);
    expect(mockFiles.has("/cache/thumbnails/ccc.jpg")).toBe(true);
  });

  it("prune does nothing when under max size", () => {
    const mod = loadThumbnailCacheModule();
    mockDirs.add("/cache/thumbnails");
    mockFiles.set("/cache/thumbnails/a.jpg", new Uint8Array([1]));

    const pruned = (
      require("../thumbnailCache") as { pruneThumbnailCache: (max: number) => number }
    ).pruneThumbnailCache(100);

    expect(pruned).toBe(0);
    expect(mod.getThumbnailCacheSize()).toBe(1);
  });

  it("downsamples 1x1 image correctly with area-average", () => {
    const mod = loadThumbnailCacheModule();
    const src = new Uint8ClampedArray([100, 150, 200, 255]);
    const result = mod.downsampleRGBA(src, 1, 1, 256);
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
    expect(result.data[0]).toBe(100);
    expect(result.data[1]).toBe(150);
    expect(result.data[2]).toBe(200);
    expect(result.data[3]).toBe(255);
  });

  it("downsamples RGBA using area-average and does not upscale above original size", () => {
    const mod = loadThumbnailCacheModule();

    // 4x2 image, each pixel has R channel = 10,20,30,40 / 50,60,70,80
    const src = new Uint8ClampedArray([
      10, 0, 0, 255, 20, 0, 0, 255, 30, 0, 0, 255, 40, 0, 0, 255, 50, 0, 0, 255, 60, 0, 0, 255, 70,
      0, 0, 255, 80, 0, 0, 255,
    ]);

    const reduced = mod.downsampleRGBA(src, 4, 2, 2);
    expect(reduced.width).toBe(2);
    expect(reduced.height).toBe(1);
    // Area-average: left block averages pixels (10,20,50,60)/4=35, right block (30,40,70,80)/4=55
    expect(reduced.data[0]).toBe(35);
    expect(reduced.data[4]).toBe(55);

    const noUpscale = mod.downsampleRGBA(src, 4, 2, 100);
    expect(noUpscale.width).toBe(4);
    expect(noUpscale.height).toBe(2);
  });

  it("copies external thumbnail to cache directory", () => {
    const mod = loadThumbnailCacheModule();

    mockFiles.set("/tmp/video_thumb.jpg", new Uint8Array([10, 20, 30]));

    const result = mod.copyThumbnailToCache("vid-1", "/tmp/video_thumb.jpg");

    expect(result).toBe("/cache/thumbnails/vid-1.jpg");
    expect(mockFiles.has("/cache/thumbnails/vid-1.jpg")).toBe(true);
  });

  it("copyThumbnailToCache returns null when source does not exist", () => {
    const mod = loadThumbnailCacheModule();

    const result = mod.copyThumbnailToCache("vid-2", "/tmp/nonexistent.jpg");

    expect(result).toBeNull();
  });

  it("copyThumbnailToCache overwrites existing cached thumbnail", () => {
    const mod = loadThumbnailCacheModule();

    mockFiles.set("/cache/thumbnails/vid-3.jpg", new Uint8Array([1]));
    mockFiles.set("/tmp/new_thumb.jpg", new Uint8Array([99, 88]));

    const result = mod.copyThumbnailToCache("vid-3", "/tmp/new_thumb.jpg");

    expect(result).toBe("/cache/thumbnails/vid-3.jpg");
  });

  it("resolves http thumbnailUri without checking file existence", () => {
    const mod = loadThumbnailCacheModule();

    const result = mod.resolveThumbnailUri("web-1", "https://example.com/thumb.jpg");
    expect(result).toBe("https://example.com/thumb.jpg");
  });
});
