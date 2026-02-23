import { bilateralFilter } from "../bilateralFilter";

describe("bilateralFilter", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64).fill(0.5);
    const result = bilateralFilter(pixels, 8, 8, 1, 0.1);
    expect(result.length).toBe(64);
  });

  it("preserves flat image", () => {
    const pixels = new Float32Array(64).fill(0.5);
    const result = bilateralFilter(pixels, 8, 8, 1, 0.1);
    for (let i = 0; i < 64; i++) {
      expect(result[i]).toBeCloseTo(0.5, 4);
    }
  });

  it("smooths noise while preserving edges", () => {
    // Create image with sharp edge: left half 0.2, right half 0.8
    const w = 16;
    const h = 16;
    const pixels = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        pixels[y * w + x] = x < w / 2 ? 0.2 : 0.8;
      }
    }
    // Add noise
    for (let i = 0; i < pixels.length; i++) {
      pixels[i] += (Math.random() - 0.5) * 0.02;
    }

    const result = bilateralFilter(pixels, w, h, 2, 0.05);

    // Edge should be preserved: left side should stay near 0.2, right near 0.8
    expect(result[4 * w + 2]).toBeCloseTo(0.2, 1);
    expect(result[4 * w + 13]).toBeCloseTo(0.8, 1);
  });

  it("handles zero-range image", () => {
    const pixels = new Float32Array(16).fill(42);
    const result = bilateralFilter(pixels, 4, 4, 1, 0.1);
    expect(result.length).toBe(16);
    for (let i = 0; i < 16; i++) {
      expect(result[i]).toBeCloseTo(42, 4);
    }
  });
});
