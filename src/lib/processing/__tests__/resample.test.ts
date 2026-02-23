import { integerBin, resampleImage } from "../resample";

describe("integerBin", () => {
  it("2x2 average bin halves dimensions", () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const result = integerBin(pixels, 4, 4, 2, "average");
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
    expect(result.pixels.length).toBe(4);
    expect(result.pixels[0]).toBeCloseTo((1 + 2 + 5 + 6) / 4, 4);
  });

  it("2x2 sum bin preserves total flux", () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const result = integerBin(pixels, 4, 4, 2, "sum");
    expect(result.pixels[0]).toBeCloseTo(1 + 2 + 5 + 6, 4);
  });

  it("2x2 median bin returns median of block", () => {
    const pixels = new Float32Array([1, 2, 5, 6, 3, 4, 7, 8, 9, 10, 13, 14, 11, 12, 15, 16]);
    const result = integerBin(pixels, 4, 4, 2, "median");
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });
});

describe("resampleImage", () => {
  it("upscale 2x with bilinear", () => {
    const pixels = new Float32Array([1, 2, 3, 4]);
    const result = resampleImage(pixels, 2, 2, 4, 4, "bilinear");
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.pixels.length).toBe(16);
  });

  it("downscale with lanczos3", () => {
    const pixels = new Float32Array(256).fill(0.5);
    const result = resampleImage(pixels, 16, 16, 8, 8, "lanczos3");
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
    // Values should be close to 0.5
    for (let i = 0; i < result.pixels.length; i++) {
      expect(result.pixels[i]).toBeCloseTo(0.5, 1);
    }
  });

  it("identity scale returns copy", () => {
    const pixels = new Float32Array([10, 20, 30, 40]);
    const result = resampleImage(pixels, 2, 2, 2, 2, "bicubic");
    expect(result.width).toBe(2);
    expect(result.height).toBe(2);
  });
});
