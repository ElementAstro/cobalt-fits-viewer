const mockWriteFitsImage = jest.fn();
const mockCreateTiffFrameProvider = jest.fn();
const mockEncodeTiff = jest.fn();
const mockEncodeTiffDocument = jest.fn();

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

import { encodeExportRequest } from "../exportCore";

describe("exportCore.encodeExportRequest", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteFitsImage.mockReturnValue(new Uint8Array([1, 2, 3]));
    mockEncodeTiff.mockReturnValue(new Uint8Array([8, 8, 8]));
    mockEncodeTiffDocument.mockReturnValue(new Uint8Array([9, 9]));
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
});
