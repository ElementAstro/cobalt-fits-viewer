const mockGenerateAndSaveThumbnail = jest.fn();
const mockGenerateVideoThumbnailToCache = jest.fn();
const mockCopyThumbnailToCache = jest.fn();
const mockPruneThumbnailCache = jest.fn();
const mockGetSettingsState = jest.fn();

function loadThumbnailWorkflowModule() {
  jest.resetModules();

  jest.doMock("../thumbnailCache", () => ({
    generateAndSaveThumbnail: (...args: unknown[]) => mockGenerateAndSaveThumbnail(...args),
    generateVideoThumbnailToCache: (...args: unknown[]) =>
      mockGenerateVideoThumbnailToCache(...args),
    copyThumbnailToCache: (...args: unknown[]) => mockCopyThumbnailToCache(...args),
    pruneThumbnailCache: (...args: unknown[]) => mockPruneThumbnailCache(...args),
  }));

  jest.doMock("../../../stores/app/useSettingsStore", () => ({
    useSettingsStore: {
      getState: () => mockGetSettingsState(),
    },
  }));

  return require("../thumbnailWorkflow") as {
    getThumbnailPolicy: (overrides?: Record<string, number>) => {
      thumbnailSize: number;
      thumbnailQuality: number;
      videoThumbnailTimeMs: number;
      thumbnailCacheMaxSizeMB: number;
      maxCacheBytes: number;
      pruneThrottleMs: number;
    };
    pruneThumbnailCacheWithPolicy: (
      overrides?: Record<string, number>,
      options?: { force?: boolean },
    ) => number;
    saveThumbnailFromRGBA: (
      fileId: string,
      rgba: Uint8ClampedArray,
      srcWidth: number,
      srcHeight: number,
      overrides?: Record<string, number>,
    ) => string | null;
    saveThumbnailFromVideo: (
      fileId: string,
      filepath: string,
      timeMs?: number,
      overrides?: Record<string, number>,
    ) => Promise<string | null>;
    saveThumbnailFromExternalUri: (
      fileId: string,
      sourceUri: string,
      overrides?: Record<string, number>,
    ) => string | null;
  };
}

describe("thumbnailWorkflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSettingsState.mockReturnValue({
      thumbnailSize: 256,
      thumbnailQuality: 80,
      videoThumbnailTimeMs: 1000,
      thumbnailCacheMaxSizeMB: 200,
    });
    mockPruneThumbnailCache.mockReturnValue(0);
  });

  it("builds policy from settings and overrides", () => {
    const mod = loadThumbnailWorkflowModule();
    const policy = mod.getThumbnailPolicy({
      thumbnailSize: 128,
      thumbnailQuality: 70,
      videoThumbnailTimeMs: 500,
      thumbnailCacheMaxSizeMB: 50,
      pruneThrottleMs: 10,
    });

    expect(policy.thumbnailSize).toBe(128);
    expect(policy.thumbnailQuality).toBe(70);
    expect(policy.videoThumbnailTimeMs).toBe(500);
    expect(policy.thumbnailCacheMaxSizeMB).toBe(50);
    expect(policy.maxCacheBytes).toBe(50 * 1024 * 1024);
    expect(policy.pruneThrottleMs).toBe(10);
  });

  it("saves RGBA thumbnail and prunes with throttle", () => {
    const mod = loadThumbnailWorkflowModule();
    mockGenerateAndSaveThumbnail.mockReturnValue("file:///thumb/a.jpg");
    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValue(100_000);
    const uri1 = mod.saveThumbnailFromRGBA("a", new Uint8ClampedArray([1, 2, 3, 4]), 1, 1);
    expect(uri1).toBe("file:///thumb/a.jpg");
    expect(mockPruneThumbnailCache).toHaveBeenCalledTimes(1);
    expect(mockPruneThumbnailCache).toHaveBeenLastCalledWith(200 * 1024 * 1024);

    nowSpy.mockReturnValue(110_000);
    mod.saveThumbnailFromRGBA("a", new Uint8ClampedArray([1, 2, 3, 4]), 1, 1);
    expect(mockPruneThumbnailCache).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(131_500);
    mod.saveThumbnailFromRGBA("a", new Uint8ClampedArray([1, 2, 3, 4]), 1, 1);
    expect(mockPruneThumbnailCache).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });

  it("saves video thumbnail using policy defaults", async () => {
    const mod = loadThumbnailWorkflowModule();
    mockGenerateVideoThumbnailToCache.mockResolvedValue("file:///thumb/video.jpg");
    const nowSpy = jest.spyOn(Date, "now").mockReturnValue(100_000);

    const uri = await mod.saveThumbnailFromVideo("vid-1", "file:///video.mp4");
    expect(uri).toBe("file:///thumb/video.jpg");
    expect(mockGenerateVideoThumbnailToCache).toHaveBeenCalledWith(
      "vid-1",
      "file:///video.mp4",
      1000,
      80,
    );
    expect(mockPruneThumbnailCache).toHaveBeenCalledTimes(1);
    nowSpy.mockRestore();
  });

  it("copies external thumbnail and supports force prune", () => {
    const mod = loadThumbnailWorkflowModule();
    mockCopyThumbnailToCache.mockReturnValue("file:///thumb/ext.jpg");
    const nowSpy = jest.spyOn(Date, "now");

    nowSpy.mockReturnValue(100_000);
    const uri = mod.saveThumbnailFromExternalUri("ext-1", "file:///tmp/ext.jpg");
    expect(uri).toBe("file:///thumb/ext.jpg");
    expect(mockPruneThumbnailCache).toHaveBeenCalledTimes(1);

    nowSpy.mockReturnValue(100_001);
    mod.pruneThumbnailCacheWithPolicy({}, { force: true });
    expect(mockPruneThumbnailCache).toHaveBeenCalledTimes(2);

    nowSpy.mockRestore();
  });
});
