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
  parseRasterFromBuffer: jest.fn(),
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
  parseRasterFromBuffer: jest.Mock;
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
    rasterLib.parseRasterFromBuffer.mockReturnValue({
      width: 2,
      height: 2,
      rgba: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
      pixels: new Float32Array([1, 2, 3, 4]),
      channels: {
        r: new Float32Array([1, 0, 0, 1]),
        g: new Float32Array([0, 1, 0, 1]),
        b: new Float32Array([0, 0, 1, 1]),
      },
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
      expect.objectContaining({ width: 2, height: 2 }),
      expect.objectContaining({
        rules: expect.arrayContaining([expect.objectContaining({ id: "focus-name" })]),
      }),
    );

    await act(async () => {
      await result.current.loadFromBuffer(new ArrayBuffer(8), "b.png", 11);
    });
    expect(rasterLib.parseRasterFromBuffer).toHaveBeenCalled();
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
