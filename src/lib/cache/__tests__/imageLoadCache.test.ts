import {
  clearImageLoadCache,
  configureImageLoadCache,
  getImageLoadCache,
  getImageLoadCacheStats,
  setImageLoadCache,
} from "../imageLoadCache";

function makeEntry(byteLength: number) {
  return {
    sourceType: "raster" as const,
    sourceFormat: "tiff" as const,
    fits: null,
    rasterFrameProvider: null,
    headers: [],
    comments: [],
    history: [],
    dimensions: { width: 1, height: 1, depth: 1, isDataCube: false },
    hduList: [],
    metadataBase: {
      filename: "a.tiff",
      filepath: "file:///a.tiff",
      fileSize: byteLength,
      frameType: "light",
      frameTypeSource: "filename",
    } as any,
    decodeStatus: "ready" as const,
    sourceBuffer: new ArrayBuffer(byteLength),
  };
}

describe("imageLoadCache", () => {
  beforeEach(() => {
    clearImageLoadCache();
    configureImageLoadCache({
      maxEntries: 2,
      maxBytes: 512 * 1024 * 1024,
    });
  });

  it("stores and returns cache entries", () => {
    const key = "file:///a.tiff::1::1";
    setImageLoadCache(key, makeEntry(16));

    const cached = getImageLoadCache(key);
    expect(cached).not.toBeNull();
    expect(cached?.sourceBuffer.byteLength).toBe(16);
    expect(getImageLoadCacheStats().entries).toBe(1);
  });

  it("evicts by max entries and max bytes", () => {
    configureImageLoadCache({ maxEntries: 2, maxBytes: 24 });
    setImageLoadCache("a", makeEntry(8));
    setImageLoadCache("b", makeEntry(8));
    setImageLoadCache("c", makeEntry(8));

    const stats = getImageLoadCacheStats();
    expect(stats.entries).toBe(2);
    expect(stats.totalBytes).toBe(16);
    expect(getImageLoadCache("a")).toBeNull();
    expect(getImageLoadCache("b")).not.toBeNull();
    expect(getImageLoadCache("c")).not.toBeNull();
  });
});
