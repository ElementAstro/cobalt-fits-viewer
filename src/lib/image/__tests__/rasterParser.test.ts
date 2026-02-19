let mockImageFactoryResult: {
  makeNonTextureImage: () => {
    width: () => number;
    height: () => number;
    readPixels: () => Uint8Array | Float32Array | null;
  };
} | null = null;

const mockMakeFromEncoded = jest.fn(() => mockImageFactoryResult);
const mockFromBytes = jest.fn((bytes: Uint8Array) => ({ bytes }));
const mockClassifyWithDetail = jest.fn(() => ({ type: "light", source: "filename" }));
const mockIsTiffLikeBuffer = jest.fn(() => false);
const mockCreateTiffFrameProvider = jest.fn();

jest.mock("../../gallery/frameClassifier", () => ({
  classifyWithDetail: (...args: any[]) => (mockClassifyWithDetail as any)(...args),
}));

jest.mock("../tiff/decoder", () => ({
  isTiffLikeBuffer: (...args: any[]) => (mockIsTiffLikeBuffer as any)(...args),
  createTiffFrameProvider: (...args: any[]) => (mockCreateTiffFrameProvider as any)(...args),
}));

jest.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Data: {
      fromBytes: (...args: any[]) => (mockFromBytes as any)(...args),
    },
    Image: {
      MakeImageFromEncoded: (...args: any[]) => (mockMakeFromEncoded as any)(...args),
    },
  },
  AlphaType: { Unpremul: "Unpremul" },
  ColorType: { RGBA_8888: "RGBA_8888" },
}));

import {
  extractRasterMetadata,
  parseRasterFromBuffer,
  parseRasterFromBufferAsync,
} from "../rasterParser";

function setMockRasterImage({
  width,
  height,
  pixels,
}: {
  width: number;
  height: number;
  pixels: Uint8Array | Float32Array | null;
}) {
  mockImageFactoryResult = {
    makeNonTextureImage: () => ({
      width: () => width,
      height: () => height,
      readPixels: () => pixels,
    }),
  };
}

describe("image rasterParser", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockImageFactoryResult = null;
    mockIsTiffLikeBuffer.mockReturnValue(false);
  });

  it("throws for unsupported or invalid raster content", () => {
    expect(() => parseRasterFromBuffer(new ArrayBuffer(4))).toThrow(
      "Unsupported raster image format",
    );

    setMockRasterImage({ width: 0, height: 10, pixels: new Uint8Array(40) });
    expect(() => parseRasterFromBuffer(new ArrayBuffer(4))).toThrow(
      "Invalid raster image dimensions",
    );

    setMockRasterImage({ width: 2, height: 2, pixels: null });
    expect(() => parseRasterFromBuffer(new ArrayBuffer(4))).toThrow(
      "Failed to read raster image pixels",
    );
  });

  it("parses Uint8 RGBA pixels and generates luma", () => {
    setMockRasterImage({
      width: 2,
      height: 1,
      pixels: new Uint8Array([
        255,
        0,
        0,
        255, // red
        0,
        255,
        0,
        255, // green
      ]),
    });
    const result = parseRasterFromBuffer(new ArrayBuffer(8));
    expect(mockFromBytes).toHaveBeenCalled();
    expect(mockMakeFromEncoded).toHaveBeenCalled();
    expect(result.width).toBe(2);
    expect(result.height).toBe(1);
    expect(result.rgba).toEqual(new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]));
    expect(result.pixels[0]).toBeCloseTo(0.2126, 4);
    expect(result.pixels[1]).toBeCloseTo(0.7152, 4);
    expect(result.channels).not.toBeNull();
    expect(result.channels?.r).toEqual(new Float32Array([1, 0]));
    expect(result.channels?.g).toEqual(new Float32Array([0, 1]));
    expect(result.channels?.b).toEqual(new Float32Array([0, 0]));
  });

  it("converts Float32 pixel buffer to bytes before luma conversion", () => {
    setMockRasterImage({
      width: 2,
      height: 1,
      pixels: new Float32Array([
        1,
        0,
        0,
        1, // normalized [0,1]
        300,
        -5,
        NaN,
        1, // clamp rules
      ]),
    });
    const result = parseRasterFromBuffer(new ArrayBuffer(8));
    expect(Array.from(result.rgba)).toEqual([255, 0, 0, 255, 255, 0, 0, 255]);
    expect(result.pixels[1]).toBeCloseTo(0.2126, 4);
  });

  it("uses TIFF async decoder branch when buffer matches TIFF", async () => {
    mockIsTiffLikeBuffer.mockReturnValue(true);
    const frame = {
      index: 0,
      width: 3,
      height: 2,
      bitDepth: 16,
      sampleFormat: "uint",
      photometric: 1,
      compression: 5,
      orientation: 1,
      rgba: new Uint8Array(3 * 2 * 4).fill(128),
      pixels: new Float32Array(6).fill(0.5),
      channels: null,
      headers: [{ key: "COMPRESSION", value: 5 }],
    };
    mockCreateTiffFrameProvider.mockResolvedValue({
      pageCount: 2,
      pages: [],
      getHeaders: () => frame.headers,
      getFrame: jest.fn(async () => frame),
    });

    const result = await parseRasterFromBufferAsync(new ArrayBuffer(16), { frameIndex: 1 });
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
    expect(result.depth).toBe(2);
    expect(result.isMultiFrame).toBe(true);
    expect(result.bitDepth).toBe(16);
    expect(result.sampleFormat).toBe("uint");
    expect(result.compression).toBe(5);
    expect(result.headers).toEqual([{ key: "COMPRESSION", value: 5 }]);
    expect(mockCreateTiffFrameProvider).toHaveBeenCalled();
  });

  it("extracts raster metadata", () => {
    const meta = extractRasterMetadata(
      { filename: "M42.png", filepath: "/tmp/M42.png", fileSize: 999 },
      { width: 1920, height: 1080 },
    );
    expect(meta).toEqual({
      filename: "M42.png",
      filepath: "/tmp/M42.png",
      fileSize: 999,
      bitpix: 8,
      naxis: 2,
      naxis1: 1920,
      naxis2: 1080,
      naxis3: 1,
      frameType: "light",
      frameTypeSource: "filename",
      decodeStatus: "ready",
      decodeError: undefined,
    });
    expect(mockClassifyWithDetail).toHaveBeenCalledWith(undefined, undefined, "M42.png", undefined);
  });

  it("passes classification config through to classifier", () => {
    const config = {
      frameTypes: [{ key: "focus", label: "Focus", builtin: false }],
      rules: [],
    };
    extractRasterMetadata(
      { filename: "focus_001.png", filepath: "/tmp/focus_001.png", fileSize: 10 },
      { width: 100, height: 100 },
      config as any,
    );
    expect(mockClassifyWithDetail).toHaveBeenCalledWith(
      undefined,
      undefined,
      "focus_001.png",
      config,
    );
  });
});
