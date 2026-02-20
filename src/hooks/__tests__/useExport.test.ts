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
const mockEncodeExportRequest = jest.fn();

jest.mock("@shopify/react-native-skia", () => ({
  AlphaType: { Unpremul: "Unpremul" },
  ColorType: { RGBA_8888: "RGBA_8888" },
  ImageFormat: { PNG: "PNG" },
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
}));

jest.mock("../../lib/converter/exportCore", () => ({
  encodeExportRequest: (...args: any[]) => (mockEncodeExportRequest as any)(...args),
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

describe("useExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFromBytes.mockReturnValue("data");
    mockMakeImage.mockReturnValue({
      encodeToBytes: jest.fn(() => new Uint8Array([1, 2, 3])),
    });
    mockGetExportDir.mockReturnValue("/exports");
    mockSaveToMediaLibrary.mockResolvedValue("asset://x");
    mockShareFile.mockResolvedValue(undefined);
    mockPrintAsync.mockResolvedValue(undefined);
    mockPrintToFileAsync.mockResolvedValue({ uri: "file:///exports/x.pdf" });
    mockEncodeExportRequest.mockResolvedValue({
      bytes: new Uint8Array([7, 8, 9]),
      extension: "png",
      diagnostics: {
        fallbackApplied: false,
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      },
    });
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

    expect(mockEncodeExportRequest).toHaveBeenCalled();
    expect(mockShareFile).toHaveBeenCalled();
    expect(mockSaveToMediaLibrary).toHaveBeenCalled();
    expect(result.current.isExporting).toBe(false);
  });

  it("returns detailed diagnostics for scientific fallback cases", async () => {
    mockEncodeExportRequest.mockResolvedValueOnce({
      bytes: new Uint8Array([7, 8, 9]),
      extension: "fits",
      diagnostics: {
        fallbackApplied: true,
        fallbackReasonCode: "scientific_unavailable",
        fallbackReasonMessageKey: "converter.fitsFallbackScientificUnavailable",
        requestedFitsMode: "scientific",
        effectiveFitsMode: "rendered",
        scientificAvailable: false,
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      },
    });

    const { result } = renderHook(() => useExport());
    let detailed: Awaited<ReturnType<typeof result.current.exportImageDetailed>>;
    await act(async () => {
      detailed = await result.current.exportImageDetailed({
        rgbaData: new Uint8ClampedArray([255, 0, 0, 255]),
        width: 1,
        height: 1,
        filename: "x.fits",
        format: "fits",
        fits: { mode: "scientific" },
        renderOptions: { includeWatermark: true },
      });
    });

    expect(detailed!.path).toBe("file:///exports/x_export.fits");
    expect(detailed!.diagnostics.fallbackApplied).toBe(true);
    expect(detailed!.diagnostics.fallbackReasonCode).toBe("scientific_unavailable");
    expect(detailed!.diagnostics.effectiveFitsMode).toBe("rendered");
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
