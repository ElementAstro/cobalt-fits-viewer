import type { ImageParseResult } from "../../import/imageParsePipeline";
import {
  hydratePixelCacheFromImageSnapshot,
  warmImageCachesFromFile,
  writeImageCachesFromParsed,
} from "../imageLoadWorkflow";
import {
  clearImageLoadCache,
  createImageLoadCacheEntry,
  getImageLoadCache,
  setImageLoadCache,
} from "../imageLoadCache";
import { clearPixelCache, getPixelCache } from "../pixelCache";

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

describe("imageLoadWorkflow", () => {
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

  it("does not write image load or pixel cache when strict cache is unavailable", () => {
    const cacheKey = "/tmp/a.fits::10";
    const sourceBuffer = new ArrayBuffer(8);
    writeImageCachesFromParsed(cacheKey, createFitsParseResult(), sourceBuffer, false);

    expect(getImageLoadCache(cacheKey)).toBeNull();
    expect(getPixelCache(cacheKey)).toBeNull();
  });

  it("hydrates pixel cache from image snapshot when image cache hits and pixel cache misses", async () => {
    const cacheKey = "/tmp/a.fits::10::1700000000000";
    const parsed = createFitsParseResult({
      fits: { cached: true } as any,
      dimensions: { width: 4, height: 3, depth: 1, isDataCube: false },
    });
    const snapshot = createImageLoadCacheEntry(parsed, new ArrayBuffer(8));
    setImageLoadCache(cacheKey, snapshot);

    const result = await warmImageCachesFromFile({
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

  it("writes image load cache and pixel cache after cold parse", async () => {
    const cacheKey = "/tmp/a.fits::10::1700000000000";
    const result = await warmImageCachesFromFile({
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
    expect(mockSetRuntimeDiskCacheBuffer).toHaveBeenCalledWith(cacheKey, expect.any(ArrayBuffer));
  });

  it("hydrates cache path from runtime disk buffer when available", async () => {
    const cacheKey = "/tmp/a.fits::10::1700000000000";
    mockGetRuntimeDiskCacheBuffer.mockResolvedValueOnce(new ArrayBuffer(8));

    const result = await warmImageCachesFromFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 10,
    });

    expect(result).toBe(cacheKey);
    expect(fileManagerMock.readFileAsArrayBuffer).not.toHaveBeenCalled();
    expect(pipelineMock.parseImageBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "a.fits",
        filepath: "/tmp/a.fits",
        fileSize: 10,
      }),
    );
    expect(getImageLoadCache(cacheKey)).not.toBeNull();
  });

  it("deduplicates concurrent warm-up requests for the same cache key", async () => {
    const cacheKey = "/tmp/a.fits::10::1700000000000";
    const parseGateControl: { release: () => void } = { release: () => undefined };
    const parseGate = new Promise<void>((resolve) => {
      parseGateControl.release = () => resolve();
    });
    pipelineMock.parseImageBuffer.mockImplementation(async (): Promise<ImageParseResult> => {
      await parseGate;
      return createFitsParseResult();
    });

    const warmA = warmImageCachesFromFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 10,
    });
    const warmB = warmImageCachesFromFile({
      filepath: "/tmp/a.fits",
      filename: "a.fits",
      fileSize: 10,
    });

    parseGateControl.release();
    const [resultA, resultB] = await Promise.all([warmA, warmB]);

    expect(resultA).toBe(cacheKey);
    expect(resultB).toBe(cacheKey);
    expect(fileManagerMock.readFileAsArrayBuffer).toHaveBeenCalledTimes(1);
    expect(pipelineMock.parseImageBuffer).toHaveBeenCalledTimes(1);
    expect(getImageLoadCache(cacheKey)).not.toBeNull();
  });

  it("does not persist caches when cancelled after file read", async () => {
    let cancelled = false;
    fileManagerMock.readFileAsArrayBuffer.mockImplementation(async () => {
      cancelled = true;
      return new ArrayBuffer(8);
    });

    const result = await warmImageCachesFromFile(
      {
        filepath: "/tmp/a.fits",
        filename: "a.fits",
        fileSize: 10,
      },
      undefined,
      {
        isCancelled: () => cancelled,
      },
    );

    const cacheKey = "/tmp/a.fits::10::1700000000000";
    expect(result).toBeNull();
    expect(pipelineMock.parseImageBuffer).not.toHaveBeenCalled();
    expect(getImageLoadCache(cacheKey)).toBeNull();
    expect(getPixelCache(cacheKey)).toBeNull();
  });

  it("does not persist caches when cancelled after parsing", async () => {
    let cancelled = false;
    pipelineMock.parseImageBuffer.mockImplementation(async () => {
      cancelled = true;
      return createFitsParseResult();
    });

    const result = await warmImageCachesFromFile(
      {
        filepath: "/tmp/a.fits",
        filename: "a.fits",
        fileSize: 10,
      },
      undefined,
      {
        isCancelled: () => cancelled,
      },
    );

    const cacheKey = "/tmp/a.fits::10::1700000000000";
    expect(result).toBeNull();
    expect(getImageLoadCache(cacheKey)).toBeNull();
    expect(getPixelCache(cacheKey)).toBeNull();
  });

  it("checks cancellation before cache write and skips persistence", async () => {
    const isCancelled = jest
      .fn()
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);

    const result = await warmImageCachesFromFile(
      {
        filepath: "/tmp/a.fits",
        filename: "a.fits",
        fileSize: 10,
      },
      undefined,
      { isCancelled },
    );

    const cacheKey = "/tmp/a.fits::10::1700000000000";
    expect(result).toBeNull();
    expect(getImageLoadCache(cacheKey)).toBeNull();
    expect(getPixelCache(cacheKey)).toBeNull();
    expect(isCancelled).toHaveBeenCalledTimes(5);
  });

  it("hydrates pixel cache directly from snapshot helper", async () => {
    const cacheKey = "cache-key";
    const snapshot = createImageLoadCacheEntry(
      createFitsParseResult({ fits: { direct: true } as any }),
      new ArrayBuffer(8),
    );

    const result = await hydratePixelCacheFromImageSnapshot(cacheKey, snapshot);

    expect(result).not.toBeNull();
    expect(fitsParserMock.getImagePixels).toHaveBeenCalledWith({ direct: true });
    expect(getPixelCache(cacheKey)).not.toBeNull();
  });
});
