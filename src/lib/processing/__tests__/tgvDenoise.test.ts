import { tgvDenoise } from "../tgvDenoise";

describe("tgvDenoise", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64).fill(0.5);
    const result = tgvDenoise(pixels, 8, 8, {
      strength: 1,
      smoothness: 2,
      iterations: 10,
      edgeProtection: 0,
    });
    expect(result.length).toBe(64);
  });

  it("preserves flat image", () => {
    const pixels = new Float32Array(64).fill(100);
    const result = tgvDenoise(pixels, 8, 8, {
      strength: 1,
      smoothness: 2,
      iterations: 50,
      edgeProtection: 0,
    });
    for (let i = 0; i < 64; i++) {
      expect(result[i]).toBeCloseTo(100, 0);
    }
  });

  it("modifies noisy image (output differs from input)", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      pixels[i] = 100 + Math.sin(i * 12.9898) * 15;
    }
    const result = tgvDenoise(pixels, 16, 16, {
      strength: 2,
      smoothness: 2,
      iterations: 50,
      edgeProtection: 0,
    });
    let diff = 0;
    for (let i = 0; i < 256; i++) {
      diff += Math.abs(result[i] - pixels[i]);
    }
    // TGV should modify the noisy image
    expect(diff).toBeGreaterThan(0);
  });
});
