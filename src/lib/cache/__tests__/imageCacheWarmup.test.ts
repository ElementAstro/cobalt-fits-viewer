import type { ImageParseResult } from "../../import/imageParsePipeline";
import { hydratePixelCacheFromCachedFits, warmImageCachesForFile } from "../imageCacheWarmup";
import {
  clearImageLoadCache,
  createImageLoadCacheEntry,
  getImageLoadCache,
  setImageLoadCache,
} from "../imageLoadCache";
import { clearPixelCache, getPixelCache, setPixelCache } from "../pixelCache";

jest.mock("../../fits/parser", () => ({
  getImagePixels: jest.fn(),
  getImageChannels: jest.fn(),
  isRgbCube: jest.fn(() => ({ isRgb: false, width: 0, height: 0 })),
  getHDUList: jest.fn(() => [{ index: 0, type: "image", hasData: true }]),
}));

jest.mock("../../import/imageParsePipeline", () => ({
  parseImageBuffer: jest.fn(),
}));

jest.mock("../../utils/fileManager", () => ({
  readFileAsArrayBuffer: jest.fn(),
  getFileCacheFingerprint: jest.fn((filepath: string, fallbackFileSize?: number) => ({
    fileSize: fallbackFileSize ?? 0,
    mtimeMs: 1700000000000,
    cacheKey: `${filepath}::${fallbackFileSize ?? 0}::1700000000000`,
    strictUsable: true,
  })),
}));

const fitsParserMock = jest.requireMock("../../fits/parser") as {
  getImagePixels: jest.Mock;
  getImageChannels: jest.Mock;
  isRgbCube: jest.Mock;
};

const pipelineMock = jest.requireMock("../../import/imageParsePipeline") as {
  parseImageBuffer: jest.Mock;
};

const fileManagerMock = jest.requireMock("../../utils/fileManager") as {
  readFileAsArrayBuffer: jest.Mock;
  getFileCacheFingerprint: jest.Mock;
};

const mockGetRuntimeDiskCacheBuffer = jest.fn();
const mockSetRuntimeDiskCacheBuffer = jest.fn();

jest.mock("../runtimeDiskCache", () => ({
  getRuntimeDiskCacheBuffer: (...args: unknown[]) => mockGetRuntimeDiskCacheBuffer(...args),
  setRuntimeDiskCacheBuffer: (...args: unknown[]) => mockSetRuntimeDiskCacheBuffer(...args),
}));

function createFitsParseResult(overrides: Partial<ImageParseResult> = {}): ImageParseResult {
  return {
    detectedFormat: { id: "fits", sourceType: "fits", label: "FITS", extensions: [".fits"] },
    sourceType: "fits",
    sourceFormat: "fits",
    fits: { fits: true } as any,
    rasterFrameProvider: null,
    pixels: new Float32Array([0, 1, 2, 3]),
    rgbChannels: null,
    dimensions: {
      width: 2,
      height: 2,
      depth: 1,
      isDataCube: false,
    },
    headers: [],
    comments: [],
    history: [],
    metadataBase: {
      filename: "a.fits",
      filepath: "/tmp/a.fits",
      fileSize: 10,
      frameType: "light",
      frameTypeSource: "filename",
    } as any,
    decodeStatus: "ready",
    decodeError: undefined,
    ...overrides,
  };
}

describe("imageCacheWarmup", () => {
  beforeEach(() => {
    clearPixelCache();
    clearImageLoadCache();
    jest.clearAllMocks();
    fileManagerMock.getFileCacheFingerprint.mockImplementation(
      (filepath: string, fallbackFileSize?: number) => ({
        fileSize: fallbackFileSize ?? 0,
        mtimeMs: 1700000000000,
        cacheKey: `${filepath}::${fallbackFileSize ?? 0}::1700000000000`,
        strictUsable: true,
      }),
    );
    fileManagerMock.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    fitsParserMock.getImagePixels.mockResolvedValue(new Float32Array([0, 1, 2, 3]));
    fitsParserMock.getImageChannels.mockResolvedValue(null);
    fitsParserMock.isRgbCube.mockReturnValue({ isRgb: false, width: 0, height: 0 });
    pipelineMock.parseImageBuffer.mockResolvedValue(createFitsParseResult());
    mockGetRuntimeDiskCacheBuffer.mockResolvedValue(null);
    mockSetRuntimeDiskCacheBuffer.mockResolvedValue(undefined);
  });

  it("hydrates pixel cache from a cached fits snapshot on cache hit + pixel miss", async () => {
    const cacheKey = "/tmp/a.fits::10::1700000000000";
    const parsed = createFitsParseResult({
      fits: { cached: true } as any,
      dimensions: { width: 4, height: 3, depth: 1, isDataCube: false },
    });
    const entry = createImageLoadCacheEntry(parsed, new ArrayBuffer(8));
    setImageLoadCache(cacheKey, entry);

    const result = await warmImageCachesForFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 10,
    });

    expect(result).toBe(cacheKey);
    expect(fileManagerMock.readFileAsArrayBuffer).not.toHaveBeenCalled();
    expect(pipelineMock.parseImageBuffer).not.toHaveBeenCalled();
    expect(fitsParserMock.getImagePixels).toHaveBeenCalledWith({ cached: true });

    const pixelEntry = getPixelCache(cacheKey);
    expect(pixelEntry).not.toBeNull();
    expect(pixelEntry?.width).toBe(4);
    expect(pixelEntry?.height).toBe(3);
  });

  it("parses and fills image-load + pixel caches on cache miss", async () => {
    const cacheKey = "/tmp/a.fits::10::1700000000000";
    const result = await warmImageCachesForFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 10,
    });

    expect(result).toBe(cacheKey);
    expect(fileManagerMock.readFileAsArrayBuffer).toHaveBeenCalledWith("/tmp/a.fits");
    expect(pipelineMock.parseImageBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "a.fits",
        filepath: "/tmp/a.fits",
        fileSize: 10,
      }),
    );
    expect(getImageLoadCache(cacheKey)).not.toBeNull();
    expect(getPixelCache(cacheKey)).not.toBeNull();
  });

  it("returns early when cancelled mid-flight", async () => {
    let cancelled = false;
    fileManagerMock.readFileAsArrayBuffer.mockImplementation(async () => {
      cancelled = true;
      return new ArrayBuffer(8);
    });

    const result = await warmImageCachesForFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 10,
      isCancelled: () => cancelled,
    });

    const cacheKey = "/tmp/a.fits::10::1700000000000";
    expect(result).toBeNull();
    expect(pipelineMock.parseImageBuffer).not.toHaveBeenCalled();
    expect(getImageLoadCache(cacheKey)).toBeNull();
    expect(getPixelCache(cacheKey)).toBeNull();
  });

  it("does not pollute caches for non-cacheable parsed source types", async () => {
    pipelineMock.parseImageBuffer.mockResolvedValueOnce({
      sourceType: "video",
    } as any);

    const result = await warmImageCachesForFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 10,
    });

    const cacheKey = "/tmp/a.fits::10::1700000000000";
    expect(result).toBeNull();
    expect(getImageLoadCache(cacheKey)).toBeNull();
    expect(getPixelCache(cacheKey)).toBeNull();
  });

  it("hydrates pixels from cached fits helper and no-ops on cache hit", async () => {
    const cacheKey = "cache-key";
    const cached = {
      pixels: new Float32Array([1, 2, 3, 4]),
      width: 2,
      height: 2,
      depth: 1,
      rgbChannels: null,
      timestamp: Date.now(),
    };
    setPixelCache(cacheKey, cached);

    const result = await hydratePixelCacheFromCachedFits({
      cacheKey,
      fits: { fits: true } as any,
      dimensions: { width: 2, height: 2, depth: 1 },
    });

    expect(result).toBe(cached);
    expect(fitsParserMock.getImagePixels).not.toHaveBeenCalled();
  });
});
