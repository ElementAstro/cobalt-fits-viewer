let mockImageFactoryResult: {
  makeNonTextureImage: () => {
    width: () => number;
    height: () => number;
    readPixels: () => Uint8Array | Float32Array | null;
  };
} | null = null;

const mockMakeFromEncoded = jest.fn(() => mockImageFactoryResult);
const mockFromBytes = jest.fn((bytes: Uint8Array) => ({ bytes }));
const mockClassifyFrameType = jest.fn(() => "light");

jest.mock("../../gallery/frameClassifier", () => ({
  classifyFrameType: (...args: unknown[]) => mockClassifyFrameType(...args),
}));

jest.mock("@shopify/react-native-skia", () => ({
  Skia: {
    Data: {
      fromBytes: (...args: unknown[]) => mockFromBytes(...args),
    },
    Image: {
      MakeImageFromEncoded: (...args: unknown[]) => mockMakeFromEncoded(...args),
    },
  },
  AlphaType: { Unpremul: "Unpremul" },
  ColorType: { RGBA_8888: "RGBA_8888" },
}));

import { extractRasterMetadata, parseRasterFromBuffer } from "../rasterParser";

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
    });
    expect(mockClassifyFrameType).toHaveBeenCalledWith(undefined, undefined, "M42.png");
  });
});
