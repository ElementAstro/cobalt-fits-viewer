import type { ImageParseResult } from "../../import/imageParsePipeline";
import {
  loadScientificImageFromBuffer,
  loadScientificImageFromPath,
} from "../scientificImageLoader";

const mockFileSizes = new Map<string, number>();

jest.mock("expo-file-system", () => ({
  File: class MockFile {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return mockFileSizes.has(this.uri);
    }
    get size() {
      return mockFileSizes.get(this.uri) ?? null;
    }
  },
}));

jest.mock("../../import/imageParsePipeline", () => ({
  parseImageBuffer: jest.fn(),
  parseImageFile: jest.fn(),
}));

const mockWarmImageCachesFromFile = jest.fn();
const mockHydratePixelCacheFromImageSnapshot = jest.fn();

jest.mock("../../cache/imageLoadWorkflow", () => ({
  warmImageCachesFromFile: (...args: unknown[]) => mockWarmImageCachesFromFile(...args),
  hydratePixelCacheFromImageSnapshot: (...args: unknown[]) =>
    mockHydratePixelCacheFromImageSnapshot(...args),
}));

const mockGetImageLoadCache = jest.fn();

jest.mock("../../cache/imageLoadCache", () => ({
  getImageLoadCache: (...args: unknown[]) => mockGetImageLoadCache(...args),
}));

const parsePipelineMock = jest.requireMock("../../import/imageParsePipeline") as {
  parseImageBuffer: jest.Mock;
  parseImageFile: jest.Mock;
};

function createFitsParsed(overrides: Partial<ImageParseResult> = {}): ImageParseResult {
  return {
    detectedFormat: { id: "fits", sourceType: "fits", label: "FITS", extensions: [".fits"] },
    sourceType: "fits",
    sourceFormat: "fits",
    fits: { fits: true } as any,
    rasterFrameProvider: null,
    pixels: new Float32Array([0, 1, 2, 3]),
    rgbChannels: null,
    dimensions: { width: 2, height: 2, depth: 1, isDataCube: false },
    headers: [],
    comments: [],
    history: [],
    metadataBase: {
      filename: "a.fits",
      filepath: "/tmp/a.fits",
      fileSize: 10,
      exptime: 30,
      frameType: "light",
      frameTypeSource: "filename",
    } as any,
    decodeStatus: "ready",
    decodeError: undefined,
    ...overrides,
  };
}

function createRasterParsed(overrides: Partial<ImageParseResult> = {}): ImageParseResult {
  return {
    detectedFormat: { id: "tiff", sourceType: "raster", label: "TIFF", extensions: [".tiff"] },
    sourceType: "raster",
    sourceFormat: "tiff",
    fits: null,
    rasterFrameProvider: null,
    pixels: new Float32Array([10, 11, 12, 13]),
    rgbChannels: null,
    dimensions: { width: 2, height: 2, depth: 1, isDataCube: false },
    headers: [],
    comments: [],
    history: [],
    metadataBase: {
      filename: "a.tiff",
      filepath: "/tmp/a.tiff",
      fileSize: 10,
      exptime: 15,
      frameType: "light",
      frameTypeSource: "filename",
    } as any,
    decodeStatus: "ready",
    decodeError: undefined,
    ...overrides,
  };
}

describe("scientificImageLoader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSizes.clear();
    parsePipelineMock.parseImageBuffer.mockResolvedValue(createFitsParsed());
    parsePipelineMock.parseImageFile.mockResolvedValue(createFitsParsed());
    mockWarmImageCachesFromFile.mockResolvedValue(null);
    mockHydratePixelCacheFromImageSnapshot.mockResolvedValue(null);
    mockGetImageLoadCache.mockReturnValue(null);
  });

  it("loads scientific image from buffer", async () => {
    const result = await loadScientificImageFromBuffer(new ArrayBuffer(8), {
      filename: "from-buffer.fits",
    });

    expect(parsePipelineMock.parseImageBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "from-buffer.fits",
      }),
    );
    expect(result.sourceType).toBe("fits");
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });

  it("uses warm cache snapshot for fits sources before direct parse", async () => {
    const filepath = "/tmp/cached.fits";
    mockFileSizes.set(filepath, 12);
    mockWarmImageCachesFromFile.mockResolvedValue("cache-key");
    mockGetImageLoadCache.mockReturnValue({
      sourceType: "fits",
      sourceFormat: "fits",
      metadataBase: { exptime: "45" },
      fits: { fits: true },
    });
    mockHydratePixelCacheFromImageSnapshot.mockResolvedValue({
      pixels: new Float32Array([1, 2, 3, 4]),
      width: 2,
      height: 2,
      depth: 1,
      rgbChannels: null,
      timestamp: Date.now(),
    });

    const result = await loadScientificImageFromPath(filepath, { filename: "cached.fits" });

    expect(mockWarmImageCachesFromFile).toHaveBeenCalledWith({
      filepath,
      filename: "cached.fits",
      fileSize: 12,
    });
    expect(parsePipelineMock.parseImageFile).not.toHaveBeenCalled();
    expect(result.sourceType).toBe("fits");
    expect(result.exposure).toBe(45);
  });

  it("uses raster frame provider from cache snapshot and respects frame index", async () => {
    const filepath = "/tmp/cached.tiff";
    mockFileSizes.set(filepath, 20);
    const getFrame = jest.fn(async (frameIndex: number) => ({
      index: frameIndex,
      width: 4,
      height: 3,
      bitDepth: 16,
      sampleFormat: "uint",
      photometric: 1,
      compression: 5,
      orientation: 1,
      rgba: new Uint8Array(4 * 4 * 3),
      pixels: new Float32Array(12).fill(frameIndex),
      channels: null,
      headers: [],
    }));
    mockWarmImageCachesFromFile.mockResolvedValue("raster-cache-key");
    mockGetImageLoadCache.mockReturnValue({
      sourceType: "raster",
      sourceFormat: "tiff",
      metadataBase: { exptime: 90 },
      rasterFrameProvider: { getFrame },
    });

    const result = await loadScientificImageFromPath(filepath, {
      filename: "cached.tiff",
      frameIndex: 2,
    });

    expect(getFrame).toHaveBeenCalledWith(2);
    expect(parsePipelineMock.parseImageFile).not.toHaveBeenCalled();
    expect(result.sourceType).toBe("raster");
    expect(result.width).toBe(4);
    expect(result.height).toBe(3);
    expect(result.exposure).toBe(90);
  });

  it("falls back to direct file parse when cache warm-up misses", async () => {
    const filepath = "/tmp/fallback.fits";
    mockFileSizes.set(filepath, 30);
    mockWarmImageCachesFromFile.mockResolvedValue(null);
    parsePipelineMock.parseImageFile.mockResolvedValue(createRasterParsed());

    const result = await loadScientificImageFromPath(filepath, { filename: "fallback.fits" });

    expect(parsePipelineMock.parseImageFile).toHaveBeenCalledWith(
      expect.objectContaining({
        filepath,
        filename: "fallback.fits",
      }),
    );
    expect(result.sourceType).toBe("raster");
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });
});
