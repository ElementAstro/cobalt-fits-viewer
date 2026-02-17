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

jest.mock("@shopify/react-native-skia", () => ({
  AlphaType: { Unpremul: "Unpremul" },
  ColorType: { RGBA_8888: "RGBA_8888" },
  ImageFormat: { PNG: "PNG", JPEG: "JPEG", WEBP: "WEBP" },
  Skia: {
    Data: { fromBytes: (...args: unknown[]) => mockFromBytes(...args) },
    Image: { MakeImage: (...args: unknown[]) => mockMakeImage(...args) },
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
  printAsync: (...args: unknown[]) => mockPrintAsync(...args),
  printToFileAsync: (...args: unknown[]) => mockPrintToFileAsync(...args),
  Orientation: {
    landscape: "landscape",
    portrait: "portrait",
  },
}));

jest.mock("../../lib/utils/imageExport", () => ({
  shareFile: (...args: unknown[]) => mockShareFile(...args),
  saveToMediaLibrary: (...args: unknown[]) => mockSaveToMediaLibrary(...args),
  getExportDir: () => mockGetExportDir(),
  getExtension: (...args: unknown[]) => mockGetExtension(...args),
}));

jest.mock("../../lib/logger", () => ({
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
    mockGetExtension.mockReturnValue("png");
    mockSaveToMediaLibrary.mockResolvedValue("asset://x");
    mockShareFile.mockResolvedValue(undefined);
    mockPrintAsync.mockResolvedValue(undefined);
    mockPrintToFileAsync.mockResolvedValue({ uri: "file:///exports/x.pdf" });
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
  });

  it("exports, shares and saves image successfully", async () => {
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
