import { act, renderHook } from "@testing-library/react-native";
import { useFitsFile } from "../useFitsFile";
import type { ImageParseResult } from "../../lib/import/imageParsePipeline";

jest.mock("../../lib/fits/parser", () => ({
  getImagePixels: jest.fn(),
  getImageChannels: jest.fn(),
  isRgbCube: jest.fn(() => ({ isRgb: false, width: 0, height: 0 })),
  getImageDimensions: jest.fn(),
  getHDUList: jest.fn(() => [{ index: 0, type: "image", hasData: true }]),
}));

jest.mock("../../lib/utils/fileManager", () => ({
  readFileAsArrayBuffer: jest.fn(),
  generateFileId: jest.fn(() => "fid-1"),
}));

jest.mock("../../lib/import/imageParsePipeline", () => ({
  parseImageBuffer: jest.fn(),
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

const parserMock = jest.requireMock("../../lib/fits/parser") as {
  getImagePixels: jest.Mock;
  getImageChannels: jest.Mock;
  isRgbCube: jest.Mock;
  getImageDimensions: jest.Mock;
  getHDUList: jest.Mock;
};

const fileMock = jest.requireMock("../../lib/utils/fileManager") as {
  readFileAsArrayBuffer: jest.Mock;
};

const pipelineMock = jest.requireMock("../../lib/import/imageParsePipeline") as {
  parseImageBuffer: jest.Mock;
};

function createFitsParseResult(overrides: Partial<ImageParseResult> = {}): ImageParseResult {
  return {
    detectedFormat: { id: "fits", sourceType: "fits", label: "FITS", extensions: [".fits"] },
    sourceType: "fits",
    sourceFormat: "fits",
    fits: { fits: true } as any,
    rasterFrameProvider: null,
    pixels: new Float32Array([0, 1, 2, 3]),
    rgbChannels: null,
    dimensions: {
      width: 2,
      height: 2,
      depth: 1,
      isDataCube: false,
    },
    headers: [{ key: "SIMPLE", value: true }],
    comments: ["comment"],
    history: ["history"],
    metadataBase: {
      filename: "a.fits",
      filepath: "/tmp/a.fits",
      fileSize: 10,
      frameType: "light",
      frameTypeSource: "filename",
    } as any,
    decodeStatus: "ready",
    decodeError: undefined,
    ...overrides,
  };
}

function createRasterParseResult(overrides: Partial<ImageParseResult> = {}): ImageParseResult {
  return {
    detectedFormat: { id: "tiff", sourceType: "raster", label: "TIFF", extensions: [".tiff"] },
    sourceType: "raster",
    sourceFormat: "tiff",
    fits: null,
    rasterFrameProvider: {
      pageCount: 2,
      pages: [],
      getHeaders: jest.fn(),
      getFrame: jest.fn(async (index: number) => ({
        index,
        width: 2,
        height: 2,
        bitDepth: 16,
        sampleFormat: "uint",
        photometric: 1,
        compression: 5,
        orientation: 1,
        rgba: new Uint8Array([255, 255, 255, 255]),
        pixels: new Float32Array([index, index + 1, index + 2, index + 3]),
        channels: null,
        headers: [{ key: "TIFF_PAGE", value: index }],
      })),
    } as any,
    pixels: new Float32Array([0, 1, 2, 3]),
    rgbChannels: null,
    dimensions: {
      width: 2,
      height: 2,
      depth: 2,
      isDataCube: true,
    },
    headers: [{ key: "TIFF_PAGE", value: 0 }],
    comments: [],
    history: [],
    metadataBase: {
      filename: "a.tiff",
      filepath: "/tmp/a.tiff",
      fileSize: 10,
      frameType: "light",
      frameTypeSource: "filename",
      naxis3: 2,
      bitpix: 16,
    } as any,
    decodeStatus: "ready",
    decodeError: undefined,
    rgba: new Uint8Array([255, 255, 255, 255]),
    ...overrides,
  };
}

describe("useFitsFile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileMock.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    parserMock.getImagePixels.mockResolvedValue(new Float32Array([0, 1, 2, 3]));
    parserMock.getImageDimensions.mockReturnValue({
      width: 2,
      height: 2,
      depth: 1,
      isDataCube: false,
    });
    parserMock.isRgbCube.mockReturnValue({ isRgb: false, width: 0, height: 0 });
    parserMock.getImageChannels.mockResolvedValue(null);
    pipelineMock.parseImageBuffer.mockResolvedValue(createFitsParseResult());
  });

  it("loads fits from path and supports frame loading/reset", async () => {
    const { result } = renderHook(() => useFitsFile());

    await act(async () => {
      await result.current.loadFromPath("/tmp/a.fits", "a.fits", 10);
    });

    expect(pipelineMock.parseImageBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "a.fits",
        filepath: "/tmp/a.fits",
      }),
    );
    expect(result.current.fits).toEqual({ fits: true });
    expect(result.current.metadata).toEqual(
      expect.objectContaining({
        id: "fid-1",
        sourceType: "fits",
        sourceFormat: "fits",
      }),
    );

    await act(async () => {
      await result.current.loadFrame(3, 0);
    });
    expect(parserMock.getImagePixels).toHaveBeenCalledWith({ fits: true }, 0, 3);

    act(() => {
      result.current.reset();
    });
    expect(result.current.fits).toBeNull();
    expect(result.current.metadata).toBeNull();
    expect(result.current.pixels).toBeNull();
    expect(result.current.sourceBuffer).toBeNull();
  });

  it("loads raster from path and supports multipage frame switching", async () => {
    pipelineMock.parseImageBuffer.mockResolvedValueOnce(createRasterParseResult());
    const { result } = renderHook(() => useFitsFile());

    await act(async () => {
      await result.current.loadFromPath("/tmp/a.tiff", "a.tiff", 10);
    });

    expect(result.current.fits).toBeNull();
    expect(result.current.dimensions).toEqual({
      width: 2,
      height: 2,
      depth: 2,
      isDataCube: true,
    });
    expect(result.current.metadata).toEqual(
      expect.objectContaining({
        sourceType: "raster",
        sourceFormat: "tiff",
      }),
    );

    await act(async () => {
      await result.current.loadFrame(1);
    });
    expect(result.current.headers).toEqual([{ key: "TIFF_PAGE", value: 1 }]);
  });

  it("loads from buffer via unified parser", async () => {
    const { result } = renderHook(() => useFitsFile());

    await act(async () => {
      await result.current.loadFromBuffer(new ArrayBuffer(8), "stack.xisf", 8);
    });

    expect(pipelineMock.parseImageBuffer).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "stack.xisf",
        filepath: "memory://stack.xisf",
      }),
    );
    expect(result.current.metadata).toEqual(
      expect.objectContaining({
        sourceType: "fits",
      }),
    );
  });

  it("clears previous state when subsequent load fails", async () => {
    const { result } = renderHook(() => useFitsFile());

    await act(async () => {
      await result.current.loadFromPath("/tmp/a.fits", "a.fits", 10);
    });
    expect(result.current.metadata).not.toBeNull();

    pipelineMock.parseImageBuffer.mockRejectedValueOnce(new Error("Unsupported image format"));
    await act(async () => {
      await result.current.loadFromPath("/tmp/b.bin", "b.bin", 10);
    });

    expect(result.current.error).toBe("Unsupported image format");
    expect(result.current.metadata).toBeNull();
    expect(result.current.pixels).toBeNull();
    expect(result.current.sourceBuffer).toBeNull();
  });
});
