import { act, renderHook } from "@testing-library/react-native";
import { useFitsFile } from "../useFitsFile";
import { useSettingsStore } from "../../stores/useSettingsStore";

jest.mock("../../lib/fits/parser", () => ({
  loadFitsFromBufferAuto: jest.fn(),
  extractMetadata: jest.fn(),
  getHeaderKeywords: jest.fn(),
  getCommentsAndHistory: jest.fn(),
  getImagePixels: jest.fn(),
  getImageChannels: jest.fn(),
  isRgbCube: jest.fn(() => ({ isRgb: false, width: 0, height: 0 })),
  getImageDimensions: jest.fn(),
  getHDUList: jest.fn(),
}));
jest.mock("../../lib/utils/fileManager", () => ({
  readFileAsArrayBuffer: jest.fn(),
  generateFileId: jest.fn(() => "fid-1"),
}));
jest.mock("../../lib/import/fileFormat", () => ({
  detectPreferredSupportedImageFormat: jest.fn(),
  detectSupportedImageFormat: jest.fn(),
  toImageSourceFormat: jest.fn(() => "fits"),
}));
jest.mock("../../lib/image/rasterParser", () => ({
  extractRasterMetadata: jest.fn(),
  parseRasterFromBufferAsync: jest.fn(),
}));
jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger") as typeof import("../../lib/logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const parserLib = jest.requireMock("../../lib/fits/parser") as {
  loadFitsFromBufferAuto: jest.Mock;
  extractMetadata: jest.Mock;
  getHeaderKeywords: jest.Mock;
  getCommentsAndHistory: jest.Mock;
  getImagePixels: jest.Mock;
  getImageChannels: jest.Mock;
  isRgbCube: jest.Mock;
  getImageDimensions: jest.Mock;
  getHDUList: jest.Mock;
};
const fileLib = jest.requireMock("../../lib/utils/fileManager") as {
  readFileAsArrayBuffer: jest.Mock;
};
const formatLib = jest.requireMock("../../lib/import/fileFormat") as {
  detectPreferredSupportedImageFormat: jest.Mock;
  toImageSourceFormat: jest.Mock;
};
const rasterLib = jest.requireMock("../../lib/image/rasterParser") as {
  extractRasterMetadata: jest.Mock;
  parseRasterFromBufferAsync: jest.Mock;
};

describe("useFitsFile", () => {
  const classificationConfig = {
    frameTypes: [
      { key: "light", label: "Light", builtin: true },
      { key: "dark", label: "Dark", builtin: true },
      { key: "flat", label: "Flat", builtin: true },
      { key: "bias", label: "Bias", builtin: true },
      { key: "darkflat", label: "Dark Flat", builtin: true },
      { key: "unknown", label: "Unknown", builtin: true },
      { key: "focus", label: "Focus", builtin: false },
    ],
    rules: [
      {
        id: "focus-name",
        enabled: true,
        priority: 10,
        target: "filename",
        matchType: "contains",
        pattern: "focus",
        frameType: "focus",
      },
    ],
  } as const;

  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.setState({ frameClassificationConfig: classificationConfig as any });
    fileLib.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    parserLib.loadFitsFromBufferAuto.mockReturnValue({ fits: true });
    parserLib.extractMetadata.mockReturnValue({
      filename: "a.fits",
      filepath: "/tmp/a.fits",
      fileSize: 10,
    });
    parserLib.getHeaderKeywords.mockReturnValue([{ key: "SIMPLE", value: true }]);
    parserLib.getCommentsAndHistory.mockReturnValue({ comments: [], history: [] });
    parserLib.getHDUList.mockReturnValue([{ index: 0, type: "image", hasData: true }]);
    parserLib.getImageDimensions.mockReturnValue({
      width: 2,
      height: 2,
      depth: 1,
      isDataCube: false,
    });
    parserLib.getImagePixels.mockResolvedValue(new Float32Array([0, 1, 2, 3]));
    formatLib.detectPreferredSupportedImageFormat.mockReturnValue({
      id: "fits",
      sourceType: "fits",
    });
    formatLib.toImageSourceFormat.mockReturnValue("fits");
    rasterLib.parseRasterFromBufferAsync.mockResolvedValue({
      width: 2,
      height: 2,
      depth: 1,
      isMultiFrame: false,
      frameIndex: 0,
      bitDepth: 16,
      sampleFormat: "uint",
      photometric: 1,
      compression: 5,
      orientation: 1,
      rgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
      pixels: new Float32Array([1, 2, 3, 4]),
      channels: {
        r: new Float32Array([1, 0, 0, 1]),
        g: new Float32Array([0, 1, 0, 1]),
        b: new Float32Array([0, 0, 1, 1]),
      },
      headers: [{ key: "TIFF_PAGE", value: 0 }],
      decodeStatus: "ready",
    });
    rasterLib.extractRasterMetadata.mockReturnValue({
      filename: "a.png",
      filepath: "/tmp/a.png",
      fileSize: 10,
    });
  });

  it("loads fits from path and frame, then reset", async () => {
    const { result } = renderHook(() => useFitsFile());

    await act(async () => {
      await result.current.loadFromPath("/tmp/a.fits", "a.fits", 10);
    });

    expect(result.current.fits).toEqual({ fits: true });
    expect(result.current.metadata).toEqual(
      expect.objectContaining({
        id: "fid-1",
        sourceType: "fits",
        sourceFormat: "fits",
      }),
    );
    expect(parserLib.extractMetadata).toHaveBeenCalledWith(
      { fits: true },
      expect.objectContaining({
        filename: "a.fits",
        filepath: "/tmp/a.fits",
        fileSize: 10,
      }),
      expect.objectContaining({
        rules: expect.arrayContaining([expect.objectContaining({ id: "focus-name" })]),
      }),
    );
    expect(result.current.headers).toEqual([{ key: "SIMPLE", value: true }]);
    expect(result.current.sourceBuffer).toBeInstanceOf(ArrayBuffer);

    await act(async () => {
      await result.current.loadFrame(3, 0);
    });
    expect(parserLib.getImagePixels).toHaveBeenCalledWith({ fits: true }, 0, 3);

    act(() => {
      result.current.reset();
    });
    expect(result.current.fits).toBeNull();
    expect(result.current.metadata).toBeNull();
    expect(result.current.pixels).toBeNull();
    expect(result.current.sourceBuffer).toBeNull();
  });

  it("loads raster from path and buffer branches", async () => {
    const { result } = renderHook(() => useFitsFile());
    formatLib.detectPreferredSupportedImageFormat.mockReturnValue({
      id: "png",
      sourceType: "raster",
    });
    formatLib.toImageSourceFormat.mockReturnValue("png");

    await act(async () => {
      await result.current.loadFromPath("/tmp/a.png", "a.png", 10);
    });
    expect(result.current.fits).toBeNull();
    expect(result.current.rgbChannels).not.toBeNull();
    expect(result.current.metadata).toEqual(
      expect.objectContaining({
        sourceType: "raster",
        sourceFormat: "png",
      }),
    );
    expect(rasterLib.extractRasterMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "a.png",
        filepath: "/tmp/a.png",
        fileSize: 10,
      }),
      expect.objectContaining({ width: 2, height: 2, bitDepth: 16, depth: 1 }),
      expect.objectContaining({
        rules: expect.arrayContaining([expect.objectContaining({ id: "focus-name" })]),
      }),
      expect.objectContaining({
        decodeStatus: "ready",
      }),
    );

    await act(async () => {
      await result.current.loadFromBuffer(new ArrayBuffer(8), "b.png", 11);
    });
    expect(rasterLib.parseRasterFromBufferAsync).toHaveBeenCalled();
  });

  it("maps multipage TIFF to frame loading and headers", async () => {
    const { result } = renderHook(() => useFitsFile());
    const frameProvider = {
      pageCount: 2,
      pages: [],
      getHeaders: jest.fn((index: number) => [{ key: "TIFF_PAGE", value: index }]),
      getFrame: jest.fn(async (index: number) => ({
        index,
        width: 2,
        height: 2,
        bitDepth: 16,
        sampleFormat: "uint",
        photometric: 1,
        compression: 5,
        orientation: 1,
        rgba: new Uint8Array([
          255, 255, 255, 255, 0, 0, 0, 255, 20, 20, 20, 255, 200, 200, 200, 255,
        ]),
        pixels: new Float32Array([index, index + 1, index + 2, index + 3]),
        channels: null,
        headers: [{ key: "TIFF_PAGE", value: index }],
      })),
    };

    formatLib.detectPreferredSupportedImageFormat.mockReturnValue({
      id: "tiff",
      sourceType: "raster",
    });
    formatLib.toImageSourceFormat.mockReturnValue("tiff");
    rasterLib.parseRasterFromBufferAsync.mockResolvedValue({
      width: 2,
      height: 2,
      depth: 2,
      isMultiFrame: true,
      frameIndex: 0,
      bitDepth: 16,
      sampleFormat: "uint",
      photometric: 1,
      compression: 5,
      orientation: 1,
      rgba: new Uint8Array([255, 255, 255, 255, 0, 0, 0, 255, 20, 20, 20, 255, 200, 200, 200, 255]),
      pixels: new Float32Array([0, 1, 2, 3]),
      channels: null,
      headers: [{ key: "TIFF_PAGE", value: 0 }],
      frameProvider,
      decodeStatus: "ready",
    });

    await act(async () => {
      await result.current.loadFromPath("/tmp/a.tiff", "a.tiff", 10);
    });

    expect(result.current.dimensions).toEqual({
      width: 2,
      height: 2,
      depth: 2,
      isDataCube: true,
    });
    expect(result.current.headers).toEqual([{ key: "TIFF_PAGE", value: 0 }]);

    await act(async () => {
      await result.current.loadFrame(1);
    });
    expect(frameProvider.getFrame).toHaveBeenCalledWith(1);
    expect(result.current.headers).toEqual([{ key: "TIFF_PAGE", value: 1 }]);
    expect(result.current.metadata).toEqual(
      expect.objectContaining({
        sourceType: "raster",
        sourceFormat: "tiff",
        naxis3: 2,
      }),
    );
  });

  it("handles unsupported format and no-fits loadFrame guard", async () => {
    const { result } = renderHook(() => useFitsFile());
    formatLib.detectPreferredSupportedImageFormat.mockReturnValueOnce(null);

    await act(async () => {
      await result.current.loadFromPath("/tmp/unknown.bin", "unknown.bin", 10);
    });
    expect(result.current.error).toBe("Unsupported image format");

    parserLib.getImagePixels.mockClear();
    await act(async () => {
      await result.current.loadFrame(1, 0);
    });
    expect(parserLib.getImagePixels).not.toHaveBeenCalled();
  });
});
