import type { ConvertOptions, BatchTask } from "../../fits/types";
import {
  DEFAULT_FITS_TARGET_OPTIONS,
  DEFAULT_TIFF_TARGET_OPTIONS,
  DEFAULT_XISF_TARGET_OPTIONS,
  DEFAULT_SER_TARGET_OPTIONS,
} from "../../fits/types";

const mockReadFileAsArrayBuffer = jest.fn();
const mockParseImageBuffer = jest.fn();
const mockFitsToRGBA = jest.fn();
const mockEncodeExportRequest = jest.fn();
const mockWrittenFiles = new Map<string, Uint8Array>();

jest.mock("../../utils/fileManager", () => ({
  readFileAsArrayBuffer: (...args: any[]) => (mockReadFileAsArrayBuffer as any)(...args),
}));

jest.mock("../../import/imageParsePipeline", () => ({
  parseImageBuffer: (...args: any[]) => (mockParseImageBuffer as any)(...args),
}));

jest.mock("../../import/fileFormat", () => ({
  splitFilenameExtension: (name: string) => {
    const lastDot = name.lastIndexOf(".");
    return {
      baseName: lastDot > 0 ? name.slice(0, lastDot) : name,
      extension: lastDot > 0 ? name.slice(lastDot) : "",
    };
  },
}));

jest.mock("../formatConverter", () => ({
  fitsToRGBA: (...args: any[]) => (mockFitsToRGBA as any)(...args),
}));

jest.mock("../exportCore", () => ({
  encodeExportRequest: (...args: any[]) => (mockEncodeExportRequest as any)(...args),
}));

jest.mock("../../utils/imageExport", () => ({
  getExportDir: () => "/exports",
}));

jest.mock("../../logger", () => ({
  LOG_TAGS: {
    Export: "export",
  },
  Logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
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
  tiff: DEFAULT_TIFF_TARGET_OPTIONS,
  fits: DEFAULT_FITS_TARGET_OPTIONS,
  xisf: DEFAULT_XISF_TARGET_OPTIONS,
  ser: DEFAULT_SER_TARGET_OPTIONS,
  stretch: "asinh",
  colormap: "grayscale",
  blackPoint: 0,
  whitePoint: 1,
  gamma: 1,
  brightness: 0,
  contrast: 1,
  mtfMidtone: 0.25,
  curvePreset: "linear",
  profile: "legacy",
  outputBlack: 0,
  outputWhite: 1,
  includeAnnotations: false,
  includeWatermark: true,
  watermarkText: "Test Watermark",
};

describe("batchProcessor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWrittenFiles.clear();
    mockReadFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    mockParseImageBuffer.mockResolvedValue({
      detectedFormat: { id: "fits", sourceType: "fits" },
      sourceType: "fits",
      sourceFormat: "fits",
      fits: { fits: true },
      rasterFrameProvider: null,
      pixels: new Float32Array([0.1, 0.2]),
      rgbChannels: null,
      dimensions: { width: 2, height: 1, depth: 1, isDataCube: false },
      headers: [{ key: "SIMPLE", value: true }],
      comments: [],
      history: [],
      metadataBase: { bitpix: 16 },
      decodeStatus: "ready",
      decodeError: undefined,
    });
    mockFitsToRGBA.mockReturnValue(new Uint8ClampedArray([1, 2, 3, 255, 4, 5, 6, 255]));
    mockEncodeExportRequest.mockResolvedValue({
      bytes: new Uint8Array([9, 8, 7]),
      extension: "jpg",
      diagnostics: {
        fallbackApplied: false,
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      },
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
    expect(task.skipped).toBe(0);
    expect(task.createdAt).toBe(1700000000000);

    jest.restoreAllMocks();
  });

  it("executes conversion and reports completed state", async () => {
    const onProgress = jest.fn();

    await executeBatchConvert(
      "task-1",
      [{ id: "f1", filepath: "/fits/m42.fits", filename: "m42.fits", sourceType: "fits" }],
      defaultOptions,
      onProgress,
    );

    expect(mockParseImageBuffer).toHaveBeenCalled();
    expect(mockFitsToRGBA).toHaveBeenCalledWith(
      expect.any(Float32Array),
      2,
      1,
      expect.objectContaining({
        profile: "legacy",
      }),
    );
    const request = mockEncodeExportRequest.mock.calls[0]?.[0];
    expect(request?.source).toEqual(
      expect.objectContaining({
        sourceType: "fits",
        sourceFormat: "fits",
        metadata: expect.objectContaining({ bitpix: 16 }),
      }),
    );
    expect(mockWrittenFiles.get("/exports/m42.jpg")).toEqual(new Uint8Array([9, 8, 7]));

    const final = onProgress.mock.calls[onProgress.mock.calls.length - 1][1] as Partial<BatchTask>;
    expect(final.status).toBe("completed");
    expect(final.progress).toBe(100);
    expect(final.completed).toBe(1);
    expect(final.failed).toBe(0);
    expect(final.skipped).toBe(0);
  });

  it("encodes raster parse result without fits stretch conversion", async () => {
    mockParseImageBuffer.mockResolvedValueOnce({
      detectedFormat: { id: "png", sourceType: "raster" },
      sourceType: "raster",
      sourceFormat: "png",
      fits: null,
      rasterFrameProvider: null,
      pixels: new Float32Array([0, 1, 2, 3]),
      rgbChannels: null,
      dimensions: { width: 2, height: 2, depth: 1, isDataCube: false },
      headers: [],
      comments: [],
      history: [],
      metadataBase: { frameType: "light" },
      decodeStatus: "ready",
      decodeError: undefined,
      rgba: new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255, 0, 255, 0, 255, 0, 0, 0, 255]),
    });
    const onProgress = jest.fn();

    await executeBatchConvert(
      "task-raster",
      [{ id: "r1", filepath: "/fits/stack.png", filename: "stack.png", sourceType: "raster" }],
      defaultOptions,
      onProgress,
    );

    expect(mockFitsToRGBA).not.toHaveBeenCalled();
    const request = mockEncodeExportRequest.mock.calls[0]?.[0];
    expect(request?.source).toEqual(
      expect.objectContaining({
        sourceType: "raster",
        sourceFormat: "png",
      }),
    );
  });

  it("marks non-image file as skipped (not failed)", async () => {
    const onProgress = jest.fn();

    await executeBatchConvert(
      "task-2",
      [{ id: "v1", filepath: "/fits/bad.mp4", filename: "bad.mp4", sourceType: "video" }],
      defaultOptions,
      onProgress,
    );

    expect(mockReadFileAsArrayBuffer).not.toHaveBeenCalled();
    const final = onProgress.mock.calls[onProgress.mock.calls.length - 1][1] as Partial<BatchTask>;
    expect(final.status).toBe("completed");
    expect(final.completed).toBe(0);
    expect(final.failed).toBe(0);
    expect(final.skipped).toBe(1);
    expect(final.error).toContain("Skipped (1)");
  });

  it("separates failed and skipped counts", async () => {
    const onProgress = jest.fn();
    mockEncodeExportRequest.mockRejectedValueOnce(new Error("encode failed"));
    mockParseImageBuffer.mockRejectedValueOnce(new Error("Unsupported image format"));

    await executeBatchConvert(
      "task-3",
      [
        { filepath: "/fits/a.fits", filename: "a.fits", sourceType: "fits" },
        { filepath: "/fits/b.unknown", filename: "b.unknown", sourceType: "raster" },
      ],
      defaultOptions,
      onProgress,
    );

    const final = onProgress.mock.calls[onProgress.mock.calls.length - 1][1] as Partial<BatchTask>;
    expect(final.status).toBe("completed");
    expect(final.completed).toBe(0);
    expect(final.failed).toBe(1);
    expect(final.skipped).toBe(1);
    expect(final.error).toContain("Failed (1)");
    expect(final.error).toContain("Skipped (1)");
  });

  it("cancels early when abort signal is already aborted", async () => {
    const onProgress = jest.fn();
    const signal = { aborted: true } as AbortSignal;

    await executeBatchConvert(
      "task-4",
      [{ filepath: "/fits/x.fits", filename: "x.fits" }],
      defaultOptions,
      onProgress,
      signal,
    );

    expect(mockReadFileAsArrayBuffer).not.toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalledWith(
      "task-4",
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
    expect(calculateProgress({ total: 8, completed: 5, failed: 1, skipped: 2 } as BatchTask)).toBe(
      100,
    );
  });
});
