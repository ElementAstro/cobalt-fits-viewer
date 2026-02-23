import { debayer } from "../debayer";

function makeBayerRGGB(width: number, height: number): Float32Array {
  const raw = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const px = x & 1;
      const py = y & 1;
      if (px === 0 && py === 0)
        raw[y * width + x] = 1000; // R
      else if (px === 1 && py === 1)
        raw[y * width + x] = 500; // B
      else raw[y * width + x] = 800; // G
    }
  }
  return raw;
}

describe("debayer", () => {
  it("bilinear produces 3 channels with correct dimensions", () => {
    const raw = makeBayerRGGB(16, 16);
    const result = debayer(raw, 16, 16, "RGGB", "bilinear");
    expect(result.r.length).toBe(256);
    expect(result.g.length).toBe(256);
    expect(result.b.length).toBe(256);
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
  });

  it("superPixel halves dimensions", () => {
    const raw = makeBayerRGGB(16, 16);
    const result = debayer(raw, 16, 16, "RGGB", "superPixel");
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
    expect(result.r.length).toBe(64);
  });

  it("vng produces same dimensions as bilinear", () => {
    const raw = makeBayerRGGB(16, 16);
    const result = debayer(raw, 16, 16, "RGGB", "vng");
    expect(result.width).toBe(16);
    expect(result.height).toBe(16);
  });

  it("bilinear preserves channel separation", () => {
    const raw = makeBayerRGGB(8, 8);
    const result = debayer(raw, 8, 8, "RGGB", "bilinear");
    // R channel should average higher than B channel
    let rAvg = 0;
    let bAvg = 0;
    for (let i = 0; i < result.r.length; i++) {
      rAvg += result.r[i];
      bAvg += result.b[i];
    }
    rAvg /= result.r.length;
    bAvg /= result.b.length;
    expect(rAvg).toBeGreaterThan(bAvg);
  });

  it("supports all Bayer patterns", () => {
    const raw = new Float32Array(64).fill(100);
    for (const pattern of ["RGGB", "BGGR", "GRBG", "GBRG"] as const) {
      const result = debayer(raw, 8, 8, pattern, "bilinear");
      expect(result.r.length).toBe(64);
    }
  });
});
