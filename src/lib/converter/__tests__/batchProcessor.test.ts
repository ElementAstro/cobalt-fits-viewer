import type { ConvertOptions, BatchTask } from "../../fits/types";

const mockReadFileAsArrayBuffer = jest.fn();
const mockLoadFitsFromBuffer = jest.fn();
const mockGetImageDimensions = jest.fn();
const mockGetImagePixels = jest.fn();
const mockFitsToRGBA = jest.fn();
const mockGetExportDir = jest.fn(() => "/exports");
const mockGetExtension = jest.fn(() => "png");
const mockSkiaFromBytes = jest.fn();
const mockSkiaMakeImage = jest.fn();
const mockWrittenFiles = new Map<string, Uint8Array>();

jest.mock("../../utils/fileManager", () => ({
  readFileAsArrayBuffer: (...args: unknown[]) => mockReadFileAsArrayBuffer(...args),
}));

jest.mock("../../fits/parser", () => ({
  loadFitsFromBuffer: (...args: unknown[]) => mockLoadFitsFromBuffer(...args),
  getImageDimensions: (...args: unknown[]) => mockGetImageDimensions(...args),
  getImagePixels: (...args: unknown[]) => mockGetImagePixels(...args),
}));

jest.mock("../formatConverter", () => ({
  fitsToRGBA: (...args: unknown[]) => mockFitsToRGBA(...args),
}));

jest.mock("../../utils/imageExport", () => ({
  getExportDir: (...args: unknown[]) => mockGetExportDir(...args),
  getExtension: (...args: unknown[]) => mockGetExtension(...args),
}));

jest.mock("@shopify/react-native-skia", () => ({
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
    mockLoadFitsFromBuffer.mockReturnValue({});
    mockGetImageDimensions.mockReturnValue({ width: 2, height: 1 });
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
    expect(mockWrittenFiles.get("/exports/m42_converted.jpg")).toEqual(new Uint8Array([9, 8, 7]));

    const final = onProgress.mock.calls[onProgress.mock.calls.length - 1][1] as Partial<BatchTask>;
    expect(final.status).toBe("completed");
    expect(final.progress).toBe(100);
    expect(final.completed).toBe(1);
    expect(final.failed).toBe(0);
  });

  it("marks task as failed when all files error", async () => {
    const onProgress = jest.fn();

    mockReadFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    mockLoadFitsFromBuffer.mockReturnValue({});
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

    expect(calculateProgress({ total: 0, completed: 0, failed: 0 } as BatchTask)).toBe(0);
    expect(calculateProgress({ total: 8, completed: 5, failed: 1 } as BatchTask)).toBe(75);
  });
});
