import type { ConvertOptions, BatchTask } from "../../fits/types";
import { DEFAULT_FITS_TARGET_OPTIONS } from "../../fits/types";

const mockReadFileAsArrayBuffer = jest.fn();
const mockDetectPreferredSupportedImageFormat = jest.fn();
const mockLoadFitsFromBufferAuto = jest.fn();
const mockGetImageDimensions = jest.fn();
const mockGetImagePixels = jest.fn();
const mockFitsToRGBA = jest.fn();
const mockGetExportDir = jest.fn(() => "/exports");
const mockGetExtension = jest.fn(() => "png");
const mockSkiaFromBytes = jest.fn();
const mockSkiaMakeImage = jest.fn();
const mockWrittenFiles = new Map<string, Uint8Array>();

jest.mock("../../utils/fileManager", () => ({
  readFileAsArrayBuffer: (...args: any[]) => (mockReadFileAsArrayBuffer as any)(...args),
}));

jest.mock("../../import/fileFormat", () => ({
  detectPreferredSupportedImageFormat: (...args: any[]) =>
    (mockDetectPreferredSupportedImageFormat as any)(...args),
  toImageSourceFormat: () => "fits",
  splitFilenameExtension: (name: string) => {
    const lastDot = name.lastIndexOf(".");
    return {
      baseName: lastDot > 0 ? name.slice(0, lastDot) : name,
      extension: lastDot > 0 ? name.slice(lastDot) : "",
    };
  },
}));

jest.mock("../../fits/parser", () => ({
  loadFitsFromBufferAuto: (...args: any[]) => (mockLoadFitsFromBufferAuto as any)(...args),
  getImageDimensions: (...args: any[]) => (mockGetImageDimensions as any)(...args),
  getImagePixels: (...args: any[]) => (mockGetImagePixels as any)(...args),
  isRgbCube: () => ({ isRgb: false, width: 0, height: 0 }),
  getImageChannels: jest.fn(),
  getHeaderKeywords: jest.fn(() => []),
  getCommentsAndHistory: jest.fn(() => ({ comments: [], history: [] })),
  extractMetadata: jest.fn(() => ({ bitpix: 16 })),
}));

jest.mock("../formatConverter", () => ({
  fitsToRGBA: (...args: any[]) => (mockFitsToRGBA as any)(...args),
}));

jest.mock("../../image/rasterParser", () => ({
  parseRasterFromBuffer: jest.fn(),
  extractRasterMetadata: jest.fn(() => ({ frameType: "unknown" })),
}));

jest.mock("../../fits/writer", () => ({
  writeFitsImage: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

jest.mock("../../fits/compression", () => ({
  gzipFitsBytes: jest.fn((bytes: Uint8Array) => bytes),
  normalizeFitsCompression: jest.fn((buffer: ArrayBuffer) => new Uint8Array(buffer)),
}));

jest.mock("../../image/encoders/tiff", () => ({
  encodeTiff: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

jest.mock("../../image/encoders/bmp", () => ({
  encodeBmp24: jest.fn(() => new Uint8Array([1, 2, 3])),
}));

jest.mock("../../utils/imageExport", () => ({
  getExportDir: (...args: any[]) => (mockGetExportDir as any)(...args),
  getExtension: (...args: any[]) => (mockGetExtension as any)(...args),
}));

jest.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Data: {
      fromBytes: (...args: any[]) => (mockSkiaFromBytes as any)(...args),
    },
    Image: {
      MakeImage: (...args: any[]) => (mockSkiaMakeImage as any)(...args),
    },
  },
  AlphaType: { Unpremul: 2 },
  ColorType: { RGBA_8888: 0 },
  ImageFormat: { PNG: 1, JPEG: 2, WEBP: 3 },
}));

jest.mock("expo-file-system", () => {
  const mockFileClass = class {
    uri: string;
    constructor(base: string, name?: string) {
      this.uri = name ? `${base}/${name}` : base;
    }
    write(data: Uint8Array) {
      mockWrittenFiles.set(this.uri, data);
    }
  };

  return {
    __esModule: true,
    File: mockFileClass,
  };
});

import {
  calculateProgress,
  createBatchTask,
  executeBatchConvert,
  generateOutputFilename,
} from "../batchProcessor";

const defaultOptions: ConvertOptions = {
  format: "jpeg",
  quality: 77,
  bitDepth: 8,
  dpi: 72,
  fits: DEFAULT_FITS_TARGET_OPTIONS,
  stretch: "asinh",
  colormap: "grayscale",
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  outputBlack: 0,
  outputWhite: 1,
  includeAnnotations: false,
  includeWatermark: false,
};

describe("batchProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrittenFiles.clear();
    mockDetectPreferredSupportedImageFormat.mockReturnValue({
      id: "fits",
      sourceType: "fits",
    });
  });

  it("creates a pending batch task with expected shape", () => {
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);
    jest.spyOn(Math, "random").mockReturnValue(0.12345);

    const task = createBatchTask(["f1", "f2"], defaultOptions);

    expect(task.id).toMatch(/^batch_1700000000000_/);
    expect(task.type).toBe("convert");
    expect(task.status).toBe("pending");
    expect(task.total).toBe(2);
    expect(task.completed).toBe(0);
    expect(task.failed).toBe(0);
    expect(task.createdAt).toBe(1700000000000);

    jest.restoreAllMocks();
  });

  it("executes conversion and reports completed state", async () => {
    const onProgress = jest.fn();
    const mockEncodeToBytes = jest.fn(() => new Uint8Array([9, 8, 7]));

    mockReadFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    mockLoadFitsFromBufferAuto.mockReturnValue({});
    mockGetImageDimensions.mockReturnValue({ width: 2, height: 1, depth: 1, isDataCube: false });
    mockGetImagePixels.mockResolvedValue(new Float32Array([0.1, 0.2]));
    mockFitsToRGBA.mockReturnValue(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]));
    mockSkiaFromBytes.mockReturnValue({ data: true });
    mockSkiaMakeImage.mockReturnValue({ encodeToBytes: mockEncodeToBytes });
    mockGetExtension.mockReturnValue("jpg");

    await executeBatchConvert(
      "task-1",
      [{ filepath: "/fits/m42.fits", filename: "m42.fits" }],
      defaultOptions,
      onProgress,
    );

    expect(onProgress).toHaveBeenCalledWith(
      "task-1",
      expect.objectContaining({ status: "running" }),
    );
    expect(mockEncodeToBytes).toHaveBeenCalledWith(2, 77);
    expect(mockWrittenFiles.get("/exports/m42.jpg")).toEqual(new Uint8Array([9, 8, 7]));

    const final = onProgress.mock.calls[onProgress.mock.calls.length - 1][1] as Partial<BatchTask>;
    expect(final.status).toBe("completed");
    expect(final.progress).toBe(100);
    expect(final.completed).toBe(1);
    expect(final.failed).toBe(0);
  });

  it("marks task as failed when all files error", async () => {
    const onProgress = jest.fn();

    mockReadFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    mockLoadFitsFromBufferAuto.mockReturnValue({});
    mockGetImageDimensions.mockReturnValue(null);

    await executeBatchConvert(
      "task-2",
      [{ filepath: "/fits/bad.fits", filename: "bad.fits" }],
      { ...defaultOptions, format: "png" },
      onProgress,
    );

    const final = onProgress.mock.calls[onProgress.mock.calls.length - 1][1] as Partial<BatchTask>;
    expect(final.status).toBe("failed");
    expect(final.completed).toBe(0);
    expect(final.failed).toBe(1);
    expect(final.error).toContain("bad.fits: No image data");
  });

  it("cancels early when abort signal is already aborted", async () => {
    const onProgress = jest.fn();
    const signal = { aborted: true } as AbortSignal;

    await executeBatchConvert(
      "task-3",
      [{ filepath: "/fits/x.fits", filename: "x.fits" }],
      defaultOptions,
      onProgress,
      signal,
    );

    expect(mockReadFileAsArrayBuffer).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(
      "task-3",
      expect.objectContaining({ status: "cancelled" }),
    );
  });

  it("builds output filename by rule and calculates progress", () => {
    expect(generateOutputFilename("m42.fits", "png", "original")).toBe("m42.png");
    expect(generateOutputFilename("m42.fits", "jpeg", "prefix", { prefix: "proc" })).toBe(
      "proc_m42.jpeg",
    );
    expect(generateOutputFilename("m42.fits", "webp", "suffix", { suffix: "final" })).toBe(
      "m42_final.webp",
    );
    expect(generateOutputFilename("m42.fits", "png", "sequence", { index: 12 })).toBe(
      "m42_0012.png",
    );
    expect(generateOutputFilename("m42.fits.gz", "fits.gz", "original")).toBe("m42.fits.gz");

    expect(calculateProgress({ total: 0, completed: 0, failed: 0 } as BatchTask)).toBe(0);
    expect(calculateProgress({ total: 8, completed: 5, failed: 1 } as BatchTask)).toBe(75);
  });
});
