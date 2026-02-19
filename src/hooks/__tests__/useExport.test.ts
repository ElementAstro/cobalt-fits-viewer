import { act, renderHook } from "@testing-library/react-native";
import { Platform } from "react-native";
import { useExport } from "../useExport";

const mockFromBytes = jest.fn();
const mockMakeImage = jest.fn();
const mockPrintAsync = jest.fn();
const mockPrintToFileAsync = jest.fn();
const mockShareFile = jest.fn();
const mockSaveToMediaLibrary = jest.fn();
const mockGetExportDir = jest.fn();
const mockGetExtension = jest.fn();
const mockWriteFitsImage = jest.fn(() => new Uint8Array([7, 8, 9]));
const mockGzipFitsBytes = jest.fn((bytes: Uint8Array) => bytes);
const mockNormalizeFitsCompression = jest.fn((bytes: ArrayBuffer | Uint8Array) =>
  bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
);
const mockCreateTiffFrameProvider = jest.fn();
const mockEncodeTiff = jest.fn(() => new Uint8Array([1, 2, 3]));
const mockEncodeTiffDocument = jest.fn(() => new Uint8Array([3, 2, 1]));

jest.mock("@shopify/react-native-skia", () => ({
  AlphaType: { Unpremul: "Unpremul" },
  ColorType: { RGBA_8888: "RGBA_8888" },
  ImageFormat: { PNG: "PNG", JPEG: "JPEG", WEBP: "WEBP" },
  Skia: {
    Data: { fromBytes: (...args: any[]) => (mockFromBytes as any)(...args) },
    Image: { MakeImage: (...args: any[]) => (mockMakeImage as any)(...args) },
  },
}));

jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    write = jest.fn();
    constructor(_dir: string, name: string) {
      this.uri = `file:///exports/${name}`;
    }
  },
}));

jest.mock("expo-print", () => ({
  printAsync: (...args: any[]) => (mockPrintAsync as any)(...args),
  printToFileAsync: (...args: any[]) => (mockPrintToFileAsync as any)(...args),
  Orientation: {
    landscape: "landscape",
    portrait: "portrait",
  },
}));

jest.mock("../../lib/utils/imageExport", () => ({
  shareFile: (...args: any[]) => (mockShareFile as any)(...args),
  saveToMediaLibrary: (...args: any[]) => (mockSaveToMediaLibrary as any)(...args),
  getExportDir: () => mockGetExportDir(),
  getExtension: (...args: any[]) => (mockGetExtension as any)(...args),
}));

jest.mock("../../lib/fits/writer", () => ({
  writeFitsImage: (...args: any[]) => (mockWriteFitsImage as any)(...args),
}));

jest.mock("../../lib/fits/compression", () => ({
  gzipFitsBytes: (...args: any[]) => (mockGzipFitsBytes as any)(...args),
  normalizeFitsCompression: (...args: any[]) => (mockNormalizeFitsCompression as any)(...args),
}));

jest.mock("../../lib/image/encoders/tiff", () => ({
  encodeTiff: (...args: any[]) => (mockEncodeTiff as any)(...args),
  encodeTiffDocument: (...args: any[]) => (mockEncodeTiffDocument as any)(...args),
}));

jest.mock("../../lib/image/tiff/decoder", () => ({
  createTiffFrameProvider: (...args: any[]) => (mockCreateTiffFrameProvider as any)(...args),
}));

jest.mock("../../lib/image/encoders/bmp", () => ({
  encodeBmp24: jest.fn(() => new Uint8Array([4, 5, 6])),
}));

jest.mock("../../lib/import/fileFormat", () => ({
  splitFilenameExtension: (filename: string) => {
    const fitGz = filename.toLowerCase().endsWith(".fits.gz");
    if (fitGz) {
      return { baseName: filename.slice(0, -8), extension: ".fits.gz" };
    }
    const dot = filename.lastIndexOf(".");
    return {
      baseName: dot > 0 ? filename.slice(0, dot) : filename,
      extension: dot > 0 ? filename.slice(dot) : "",
    };
  },
}));

jest.mock("../../lib/logger", () => ({
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

const loggerMock = jest.requireMock("../../lib/logger") as {
  Logger: {
    warn: jest.Mock;
  };
};

describe("useExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromBytes.mockReturnValue("data");
    mockMakeImage.mockReturnValue({
      encodeToBytes: jest.fn(() => new Uint8Array([1, 2, 3])),
    });
    mockGetExportDir.mockReturnValue("/exports");
    mockGetExtension.mockReturnValue("png");
    mockSaveToMediaLibrary.mockResolvedValue("asset://x");
    mockShareFile.mockResolvedValue(undefined);
    mockPrintAsync.mockResolvedValue(undefined);
    mockPrintToFileAsync.mockResolvedValue({ uri: "file:///exports/x.pdf" });
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  });

  it("exports, shares and saves image successfully (legacy signature)", async () => {
    const { result } = renderHook(() => useExport());
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);

    await act(async () => {
      const path = await result.current.exportImage(rgba, 1, 1, "a.fits", "png", 90);
      expect(path).toBe("file:///exports/a_export.png");
    });
    await act(async () => {
      await result.current.shareImage(rgba, 1, 1, "a.fits", "png", 90);
      const uri = await result.current.saveImage(rgba, 1, 1, "a.fits", "png", 90);
      expect(uri).toBe("asset://x");
    });
    expect(mockShareFile).toHaveBeenCalled();
    expect(mockSaveToMediaLibrary).toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
  });

  it("supports request-object signature with FITS export", async () => {
    const { result } = renderHook(() => useExport());
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const original = new Uint8Array([0x53, 0x49, 0x4d, 0x50, 0x4c, 0x45]).buffer;

    await act(async () => {
      const path = await result.current.exportImage({
        rgbaData: rgba,
        width: 1,
        height: 1,
        filename: "x.fits.gz",
        format: "fits",
        fits: { mode: "scientific", compression: "gzip" },
        source: {
          sourceType: "fits",
          originalBuffer: original,
          metadata: { bitpix: 16 },
        },
      });
      expect(path).toBe("file:///exports/x_export.fits.gz");
    });

    expect(mockNormalizeFitsCompression).toHaveBeenCalled();
  });

  it("preserves multipage TIFF with compression options during TIFF export", async () => {
    const { result } = renderHook(() => useExport());
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const original = new Uint8Array([0x49, 0x49, 0x2b, 0x00, 0x08, 0x00]).buffer;
    mockGetExtension.mockReturnValue("tiff");
    const frame = {
      index: 0,
      width: 1,
      height: 1,
      bitDepth: 16,
      sampleFormat: "uint",
      photometric: 1,
      compression: 5,
      orientation: 1,
      rgba: new Uint8Array([255, 255, 255, 255]),
      pixels: new Float32Array([0.5]),
      channels: null,
      headers: [],
    };
    mockCreateTiffFrameProvider.mockResolvedValue({
      pageCount: 2,
      pages: [],
      getHeaders: () => [],
      getFrame: jest.fn(async () => frame),
    });

    await act(async () => {
      const path = await result.current.exportImage({
        rgbaData: rgba,
        width: 1,
        height: 1,
        filename: "x.tiff",
        format: "tiff",
        tiff: { compression: "deflate", multipage: "preserve" },
        source: {
          sourceType: "raster",
          sourceFormat: "tiff",
          originalBuffer: original,
        },
      });
      expect(path).toBe("file:///exports/x_export.tiff");
    });

    expect(mockEncodeTiffDocument).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        compression: "deflate",
      }),
    );
    expect(mockEncodeTiff).not.toHaveBeenCalled();
  });

  it("preserves multipage mono TIFF structure when exporting FITS", async () => {
    const { result } = renderHook(() => useExport());
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const original = new Uint8Array([0x49, 0x49, 0x2b, 0x00, 0x08, 0x00]).buffer;
    mockGetExtension.mockReturnValue("fits");
    const frameProvider = {
      pageCount: 2,
      pages: [],
      getHeaders: () => [],
      getFrame: jest.fn(async (index: number) => ({
        index,
        width: 2,
        height: 1,
        bitDepth: 16,
        sampleFormat: "uint",
        photometric: 1,
        compression: 5,
        orientation: 1,
        rgba: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]),
        pixels: new Float32Array(index === 0 ? [0.1, 0.2] : [0.3, 0.4]),
        channels: null,
        headers: [],
      })),
    };
    mockCreateTiffFrameProvider.mockResolvedValue(frameProvider);

    await act(async () => {
      const path = await result.current.exportImage({
        rgbaData: rgba,
        width: 2,
        height: 1,
        filename: "mono.tiff",
        format: "fits",
        fits: { mode: "scientific", compression: "none", colorLayout: "mono2d" },
        tiff: { multipage: "preserve" },
        source: {
          sourceType: "raster",
          sourceFormat: "tiff",
          originalBuffer: original,
        },
      });
      expect(path).toBe("file:///exports/mono_export.fits");
    });

    expect(mockWriteFitsImage).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({
          kind: "monoCube3d",
          width: 2,
          height: 1,
          depth: 2,
        }),
      }),
    );
  });

  it("logs warning and degrades when multipage TIFF cannot map losslessly to FITS", async () => {
    const { result } = renderHook(() => useExport());
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const original = new Uint8Array([0x49, 0x49, 0x2b, 0x00, 0x08, 0x00]).buffer;
    mockGetExtension.mockReturnValue("fits");
    const frameProvider = {
      pageCount: 2,
      pages: [],
      getHeaders: () => [],
      getFrame: jest.fn(async (index: number) => ({
        index,
        width: 2,
        height: 1,
        bitDepth: 16,
        sampleFormat: "uint",
        photometric: 1,
        compression: 5,
        orientation: 1,
        rgba: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255]),
        pixels: new Float32Array([0.1, 0.2]),
        channels:
          index === 1
            ? {
                r: new Float32Array([0.1, 0.2]),
                g: new Float32Array([0.3, 0.4]),
                b: new Float32Array([0.5, 0.6]),
              }
            : null,
        headers: [],
      })),
    };
    mockCreateTiffFrameProvider.mockResolvedValue(frameProvider);

    await act(async () => {
      await result.current.exportImage({
        rgbaData: rgba,
        width: 2,
        height: 1,
        filename: "rgb-multi.tiff",
        format: "fits",
        fits: { mode: "scientific", compression: "none", colorLayout: "mono2d" },
        tiff: { multipage: "preserve" },
        source: {
          sourceType: "raster",
          sourceFormat: "tiff",
          originalBuffer: original,
        },
      });
    });

    expect(mockWriteFitsImage).toHaveBeenCalledWith(
      expect.objectContaining({
        image: expect.objectContaining({
          kind: "mono2d",
        }),
      }),
    );
    expect(loggerMock.Logger.warn).toHaveBeenCalledWith(
      "export",
      expect.stringContaining("not fully representable"),
    );
  });

  it("returns null when skia image creation or encode fails", async () => {
    const { result } = renderHook(() => useExport());
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);

    mockMakeImage.mockReturnValueOnce(null);
    await act(async () => {
      const path = await result.current.exportImage(rgba, 1, 1, "a.fits", "png", 90);
      expect(path).toBeNull();
    });

    mockMakeImage.mockReturnValueOnce({
      encodeToBytes: jest.fn(() => new Uint8Array([])),
    });
    await act(async () => {
      const path = await result.current.exportImage(rgba, 1, 1, "a.fits", "png", 90);
      expect(path).toBeNull();
    });
  });

  it("prints image and pdf with iOS orientation and shared pdf", async () => {
    const { result } = renderHook(() => useExport());
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);

    await act(async () => {
      await result.current.printImage(rgba, 100, 50, "wide.fits");
    });
    expect(mockPrintAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.any(String),
        orientation: "landscape",
      }),
    );

    await act(async () => {
      await result.current.printToPdf(rgba, 100, 50, "wide.fits");
    });
    expect(mockPrintToFileAsync).toHaveBeenCalled();
    expect(mockShareFile).toHaveBeenCalledWith("file:///exports/x.pdf");
  });
});
