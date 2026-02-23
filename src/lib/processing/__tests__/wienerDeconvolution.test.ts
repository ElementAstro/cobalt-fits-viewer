import { wienerDeconvolution } from "../wienerDeconvolution";

describe("wienerDeconvolution", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64).fill(0.5);
    const result = wienerDeconvolution(pixels, 8, 8, { psfSigma: 1, noiseRatio: 0.01 });
    expect(result.length).toBe(64);
  });

  it("preserves flat image", () => {
    const pixels = new Float32Array(64).fill(100);
    const result = wienerDeconvolution(pixels, 8, 8, { psfSigma: 1, noiseRatio: 0.01 });
    for (let i = 0; i < 64; i++) {
      expect(result[i]).toBeCloseTo(100, -1);
    }
  });

  it("handles non-power-of-2 dimensions", () => {
    const pixels = new Float32Array(12 * 10).fill(50);
    const result = wienerDeconvolution(pixels, 12, 10, { psfSigma: 1.5, noiseRatio: 0.01 });
    expect(result.length).toBe(120);
  });
});
