const mockWriteFitsImage = jest.fn();
const mockCreateTiffFrameProvider = jest.fn();
const mockEncodeTiff = jest.fn();
const mockEncodeTiffDocument = jest.fn();
const mockConvertFitsToXisf = jest.fn();
const mockConvertFitsToSer = jest.fn();

jest.mock("../../fits/writer", () => ({
  writeFitsImage: (...args: any[]) => (mockWriteFitsImage as any)(...args),
}));

jest.mock("../../image/tiff/decoder", () => ({
  createTiffFrameProvider: (...args: any[]) => (mockCreateTiffFrameProvider as any)(...args),
}));

jest.mock("../../image/encoders/tiff", () => ({
  encodeTiff: (...args: any[]) => (mockEncodeTiff as any)(...args),
  encodeTiffDocument: (...args: any[]) => (mockEncodeTiffDocument as any)(...args),
}));

jest.mock("fitsjs-ng", () => ({
  convertFitsToXisf: (...args: any[]) => (mockConvertFitsToXisf as any)(...args),
  convertFitsToSer: (...args: any[]) => (mockConvertFitsToSer as any)(...args),
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

import { encodeExportRequest, computeOutputDimensions, compressToTargetSize } from "../exportCore";

describe("exportCore.encodeExportRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFitsImage.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockEncodeTiff.mockReturnValue(new Uint8Array([8, 8, 8]));
    mockEncodeTiffDocument.mockReturnValue(new Uint8Array([9, 9]));
    mockConvertFitsToXisf.mockResolvedValue(new ArrayBuffer(4));
    mockConvertFitsToSer.mockResolvedValue(new ArrayBuffer(6));
  });

  it("falls back to rendered FITS when scientific data is unavailable", async () => {
    const result = await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "x.fits",
      format: "fits",
      fits: { mode: "scientific", compression: "none", colorLayout: "mono2d" },
      source: { sourceType: "raster", sourceFormat: "png" },
    });

    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.extension).toBe("fits");
    expect(result.diagnostics.fallbackApplied).toBe(true);
    expect(result.diagnostics.fallbackReasonCode).toBe("scientific_unavailable");
    expect(result.diagnostics.fallbackReasonMessageKey).toBe(
      "converter.fitsFallbackScientificUnavailable",
    );
    expect(result.diagnostics.requestedFitsMode).toBe("scientific");
    expect(result.diagnostics.effectiveFitsMode).toBe("rendered");
    expect(result.diagnostics.scientificAvailable).toBe(false);
  });

  it("forces rendered FITS when decorations are requested in scientific mode and aggregates warnings", async () => {
    const rgba = new Uint8ClampedArray(80 * 40 * 4);
    for (let i = 0; i < rgba.length; i += 4) rgba[i + 3] = 255;

    const result = await encodeExportRequest({
      rgbaData: rgba,
      width: 80,
      height: 40,
      filename: "m42.fits",
      format: "fits",
      fits: { mode: "scientific", compression: "none", colorLayout: "mono2d" },
      renderOptions: {
        includeAnnotations: true,
        includeWatermark: true,
        watermarkText: "Hello",
      },
      source: {
        sourceType: "fits",
        sourceFormat: "fits",
        originalBuffer: new ArrayBuffer(8),
      },
    });

    expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    expect(result.diagnostics.fallbackApplied).toBe(true);
    expect(result.diagnostics.fallbackReasonCode).toBe(
      "scientific_with_decorations_requires_rendered",
    );
    expect(result.diagnostics.fallbackReasonMessageKey).toBe("converter.fitsFallbackDecorations");
    expect(result.diagnostics.requestedFitsMode).toBe("scientific");
    expect(result.diagnostics.effectiveFitsMode).toBe("rendered");
    expect(result.diagnostics.watermarkApplied).toBe(true);
    expect(result.diagnostics.warnings).toContain("No annotations available for export.");
  });

  it("uses encodeTiffDocument when source multipage TIFF can be preserved", async () => {
    mockCreateTiffFrameProvider.mockResolvedValue({
      pageCount: 2,
      getFrame: jest.fn(async (index: number) => ({
        index,
        width: 2,
        height: 1,
        bitDepth: 16,
        sampleFormat: "uint",
        pixels: new Float32Array([index, index + 1]),
        channels: null,
      })),
    });

    const result = await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]),
      width: 2,
      height: 1,
      filename: "stack.tiff",
      format: "tiff",
      bitDepth: 16,
      tiff: { multipage: "preserve", compression: "lzw" },
      source: { sourceType: "raster", sourceFormat: "tiff", originalBuffer: new ArrayBuffer(8) },
    });

    expect(mockEncodeTiffDocument).toHaveBeenCalled();
    expect(mockEncodeTiff).not.toHaveBeenCalled();
    expect(result.bytes).toEqual(new Uint8Array([9, 9]));
    expect(result.extension).toBe("tiff");
  });

  it("uses encodeTiffDocument with scientific pixels for single-page TIFF at 32-bit", async () => {
    const result = await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "astro.tiff",
      format: "tiff",
      bitDepth: 32,
      tiff: { compression: "lzw", multipage: "firstFrame", bitDepth: 32 },
      source: {
        sourceType: "fits",
        sourceFormat: "fits",
        scientificPixels: new Float32Array([0.42]),
      },
    });

    expect(mockEncodeTiffDocument).toHaveBeenCalled();
    const pages = mockEncodeTiffDocument.mock.calls[0][0];
    expect(pages[0].bitDepth).toBe(32);
    expect(pages[0].sampleFormat).toBe("float");
    expect(pages[0].pixels).toEqual(new Float32Array([0.42]));
    expect(mockEncodeTiff).not.toHaveBeenCalled();
    expect(result.bytes).toEqual(new Uint8Array([9, 9]));
    expect(result.extension).toBe("tiff");
  });

  it("falls back to rgba path for single-page TIFF at 8-bit even with scientific data", async () => {
    const result = await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([128, 128, 128, 255]),
      width: 1,
      height: 1,
      filename: "low.tiff",
      format: "tiff",
      bitDepth: 8,
      tiff: { compression: "none", multipage: "firstFrame", bitDepth: 8 },
      source: {
        sourceType: "fits",
        sourceFormat: "fits",
        scientificPixels: new Float32Array([0.5]),
      },
    });

    expect(mockEncodeTiff).toHaveBeenCalled();
    expect(mockEncodeTiffDocument).not.toHaveBeenCalled();
    expect(result.bytes).toEqual(new Uint8Array([8, 8, 8]));
  });

  it("passes dpi from tiff options through to encoder", async () => {
    await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "hi-res.tiff",
      format: "tiff",
      tiff: { compression: "lzw", multipage: "firstFrame", bitDepth: 8, dpi: 300 },
      source: { sourceType: "raster", sourceFormat: "png" },
    });

    expect(mockEncodeTiff).toHaveBeenCalled();
    const opts = mockEncodeTiff.mock.calls[0][3];
    expect(opts.dpi).toBe(300);
  });

  it("encodes XISF by converting intermediate FITS via fitsjs-ng", async () => {
    const result = await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "x.xisf",
      format: "xisf",
      xisf: { compression: "zlib" },
      source: { sourceType: "raster", sourceFormat: "png" },
    });

    expect(mockWriteFitsImage).toHaveBeenCalled();
    expect(mockConvertFitsToXisf).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({
        writeOptions: { compression: "zlib" },
      }),
    );
    expect(result.bytes).toEqual(new Uint8Array(4));
    expect(result.extension).toBe("xisf");
  });

  it("encodes XISF with null compression when set to none", async () => {
    await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "x.xisf",
      format: "xisf",
      xisf: { compression: "none" },
      source: { sourceType: "raster", sourceFormat: "png" },
    });

    expect(mockConvertFitsToXisf).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({
        writeOptions: { compression: null },
      }),
    );
  });

  it("encodes SER by converting intermediate FITS via fitsjs-ng", async () => {
    const result = await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "x.ser",
      format: "ser",
      ser: { layout: "multi-hdu" },
      source: { sourceType: "raster", sourceFormat: "png" },
    });

    expect(mockWriteFitsImage).toHaveBeenCalled();
    expect(mockConvertFitsToSer).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({ sourceLayout: "multi-hdu" }),
    );
    expect(result.bytes).toEqual(new Uint8Array(6));
    expect(result.extension).toBe("ser");
  });

  it("encodes SER with auto layout for cube mode", async () => {
    await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "x.ser",
      format: "ser",
      ser: { layout: "cube" },
      source: { sourceType: "raster", sourceFormat: "png" },
    });

    expect(mockConvertFitsToSer).toHaveBeenCalledWith(
      expect.any(ArrayBuffer),
      expect.objectContaining({ sourceLayout: "auto" }),
    );
  });
});

describe("computeOutputDimensions", () => {
  it("returns original dimensions when no outputSize is provided", () => {
    expect(computeOutputDimensions(1000, 800)).toEqual({ width: 1000, height: 800 });
    expect(computeOutputDimensions(1000, 800, undefined)).toEqual({ width: 1000, height: 800 });
  });

  it("scales down to fit maxWidth/maxHeight", () => {
    const result = computeOutputDimensions(2000, 1000, { maxWidth: 1000, maxHeight: 1000 });
    expect(result.width).toBe(1000);
    expect(result.height).toBe(500);
  });

  it("does not upscale when maxWidth/maxHeight exceed original", () => {
    const result = computeOutputDimensions(500, 300, { maxWidth: 2000, maxHeight: 2000 });
    expect(result.width).toBe(500);
    expect(result.height).toBe(300);
  });

  it("applies scale factor", () => {
    const result = computeOutputDimensions(1000, 800, { scale: 0.5 });
    expect(result.width).toBe(500);
    expect(result.height).toBe(400);
  });

  it("ignores scale >= 1", () => {
    const result = computeOutputDimensions(1000, 800, { scale: 1.5 });
    expect(result.width).toBe(1000);
    expect(result.height).toBe(800);
  });

  it("maxWidth takes priority over scale", () => {
    const result = computeOutputDimensions(2000, 1000, { maxWidth: 500, scale: 0.9 });
    expect(result.width).toBe(500);
    expect(result.height).toBe(250);
  });

  it("handles maxHeight only", () => {
    const result = computeOutputDimensions(2000, 1000, { maxHeight: 500 });
    expect(result.width).toBe(1000);
    expect(result.height).toBe(500);
  });

  it("ensures minimum dimension of 1", () => {
    const result = computeOutputDimensions(10, 10, { scale: 0.01 });
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});

describe("encodeExportRequest with outputSize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFitsImage.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockEncodeTiff.mockReturnValue(new Uint8Array([8, 8, 8]));
    mockEncodeTiffDocument.mockReturnValue(new Uint8Array([9, 9]));
  });

  it("passes resized RGBA to TIFF encoder when outputSize is set", async () => {
    const rgba = new Uint8ClampedArray(4 * 4 * 4);
    for (let i = 0; i < rgba.length; i += 4) rgba[i + 3] = 255;

    await encodeExportRequest({
      rgbaData: rgba,
      width: 4,
      height: 4,
      filename: "test.tiff",
      format: "tiff",
      tiff: { compression: "none", multipage: "firstFrame" },
      outputSize: { maxWidth: 2, maxHeight: 2 },
    });

    expect(mockEncodeTiff).toHaveBeenCalled();
    const callArgs = mockEncodeTiff.mock.calls[0];
    expect(callArgs[1]).toBeLessThanOrEqual(2);
    expect(callArgs[2]).toBeLessThanOrEqual(2);
  });

  it("passes through unchanged when outputSize is undefined", async () => {
    await encodeExportRequest({
      rgbaData: new Uint8ClampedArray([0, 0, 0, 255]),
      width: 1,
      height: 1,
      filename: "test.fits",
      format: "fits",
      source: { sourceType: "raster", sourceFormat: "png" },
    });

    expect(mockWriteFitsImage).toHaveBeenCalled();
  });
});

describe("compressToTargetSize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is exported and callable", () => {
    expect(typeof compressToTargetSize).toBe("function");
  });
});
