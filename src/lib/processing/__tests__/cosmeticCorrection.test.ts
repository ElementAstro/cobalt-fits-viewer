import { cosmeticCorrection } from "../cosmeticCorrection";

/** Create image with gaussian noise so MAD > 0 */
function makeNoisyImage(width: number, height: number, mean: number, noise: number): Float32Array {
  const n = width * height;
  const pixels = new Float32Array(n);
  // Use deterministic pseudo-noise based on index
  for (let i = 0; i < n; i++) {
    const t = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    pixels[i] = mean + (t - Math.floor(t) - 0.5) * 2 * noise;
  }
  return pixels;
}

describe("cosmeticCorrection", () => {
  it("returns unchanged pixels when no outliers exist", () => {
    const pixels = new Float32Array(64).fill(100);
    const result = cosmeticCorrection(pixels, 8, 8);
    expect(result.hotCount).toBe(0);
    expect(result.coldCount).toBe(0);
    expect(result.pixels.length).toBe(64);
  });

  it("detects and repairs hot pixels", () => {
    const pixels = makeNoisyImage(16, 16, 100, 5);
    pixels[120] = 10000; // inject extreme hot pixel
    const result = cosmeticCorrection(pixels, 16, 16, { hotSigma: 5 });
    expect(result.hotCount).toBeGreaterThanOrEqual(1);
    expect(result.pixels[120]).toBeLessThan(10000);
  });

  it("detects and repairs cold pixels", () => {
    const pixels = makeNoisyImage(16, 16, 100, 5);
    pixels[120] = -5000; // inject extreme cold pixel
    const result = cosmeticCorrection(pixels, 16, 16, { coldSigma: 5 });
    expect(result.coldCount).toBeGreaterThanOrEqual(1);
    expect(result.pixels[120]).toBeGreaterThan(-5000);
  });

  it("uses linear interpolation when useMedian is false", () => {
    const pixels = makeNoisyImage(16, 16, 100, 5);
    pixels[120] = 10000;
    const result = cosmeticCorrection(pixels, 16, 16, { hotSigma: 5, useMedian: false });
    expect(result.hotCount).toBeGreaterThanOrEqual(1);
    expect(result.pixels[120]).toBeLessThan(10000);
  });

  it("detects bad columns when enabled", () => {
    const pixels = makeNoisyImage(16, 16, 100, 5);
    // Make column 3 all hot
    for (let y = 0; y < 16; y++) pixels[y * 16 + 3] = 10000;
    const result = cosmeticCorrection(pixels, 16, 16, {
      hotSigma: 5,
      detectColumns: true,
      lineDefectRatio: 0.3,
    });
    expect(result.columnCount).toBeGreaterThanOrEqual(1);
  });

  it("detects bad rows when enabled", () => {
    const pixels = makeNoisyImage(16, 16, 100, 5);
    // Make row 5 all hot
    for (let x = 0; x < 16; x++) pixels[5 * 16 + x] = 10000;
    const result = cosmeticCorrection(pixels, 16, 16, {
      hotSigma: 5,
      detectRows: true,
      lineDefectRatio: 0.3,
    });
    expect(result.rowCount).toBeGreaterThanOrEqual(1);
  });

  it("preserves dimensions", () => {
    const pixels = makeNoisyImage(16, 12, 50, 3);
    const result = cosmeticCorrection(pixels, 16, 12);
    expect(result.pixels.length).toBe(16 * 12);
  });
});
