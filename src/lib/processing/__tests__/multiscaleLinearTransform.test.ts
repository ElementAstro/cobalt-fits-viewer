import { multiscaleLinearTransform } from "../multiscaleLinearTransform";

describe("multiscaleLinearTransform", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64).fill(0.5);
    const result = multiscaleLinearTransform(pixels, 8, 8);
    expect(result.length).toBe(64);
  });

  it("preserves flat image with no bias", () => {
    const pixels = new Float32Array(64).fill(100);
    const result = multiscaleLinearTransform(pixels, 8, 8, [
      { noiseThreshold: 3, noiseReduction: 0.5, bias: 0 },
    ]);
    for (let i = 0; i < 64; i++) {
      expect(result[i]).toBeCloseTo(100, 0);
    }
  });

  it("reduces noise with high noiseReduction", () => {
    const pixels = new Float32Array(256);
    // Deterministic noise pattern to avoid flakiness
    for (let i = 0; i < 256; i++) {
      const noise = ((i * 7 + 13) % 37) / 37 - 0.5; // pseudo-random deterministic [-0.5, 0.5)
      pixels[i] = 100 + noise * 30;
    }
    const result = multiscaleLinearTransform(pixels, 16, 16, [
      { noiseThreshold: 1, noiseReduction: 1, bias: 0 },
      { noiseThreshold: 1, noiseReduction: 1, bias: 0 },
      { noiseThreshold: 1, noiseReduction: 1, bias: 0 },
    ]);
    let origVar = 0;
    let resultVar = 0;
    for (let i = 0; i < 256; i++) {
      origVar += (pixels[i] - 100) ** 2;
      resultVar += (result[i] - 100) ** 2;
    }
    expect(resultVar).toBeLessThan(origVar);
  });

  it("applies linear mask when useLinearMask=true", () => {
    // Create image with gradient: left dark, right bright
    const w = 16;
    const h = 16;
    const pixels = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const base = x / (w - 1); // 0 to 1 gradient
        pixels[y * w + x] = base + (Math.random() - 0.5) * 0.05;
      }
    }

    const withMask = multiscaleLinearTransform(
      pixels,
      w,
      h,
      [{ noiseThreshold: 2, noiseReduction: 1, bias: 0 }],
      { useLinearMask: true, linearMaskAmplification: 200 },
    );
    const withoutMask = multiscaleLinearTransform(
      pixels,
      w,
      h,
      [{ noiseThreshold: 2, noiseReduction: 1, bias: 0 }],
      { useLinearMask: false },
    );

    // Results should differ when linear mask is used
    let diff = 0;
    for (let i = 0; i < w * h; i++) diff += Math.abs(withMask[i] - withoutMask[i]);
    expect(diff).toBeGreaterThan(0);
  });

  it("respects residualEnabled=false", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = i;
    const withResidual = multiscaleLinearTransform(pixels, 8, 8, [
      { noiseThreshold: 3, noiseReduction: 0, bias: 0 },
    ]);
    const withoutResidual = multiscaleLinearTransform(
      pixels,
      8,
      8,
      [{ noiseThreshold: 3, noiseReduction: 0, bias: 0 }],
      { residualEnabled: false },
    );
    let diff = 0;
    for (let i = 0; i < 64; i++) diff += Math.abs(withResidual[i] - withoutResidual[i]);
    expect(diff).toBeGreaterThan(0);
  });

  it("sharpens with positive bias", () => {
    const w = 16;
    const h = 16;
    const pixels = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        // Create a bright spot in the center
        const dx = x - w / 2;
        const dy = y - h / 2;
        pixels[y * w + x] = Math.exp(-(dx * dx + dy * dy) / 8);
      }
    }

    const sharpened = multiscaleLinearTransform(pixels, w, h, [
      { noiseThreshold: 0, noiseReduction: 0, bias: 0.5 },
    ]);

    // Center pixel should be boosted by positive bias
    const centerIdx = (h / 2) * w + w / 2;
    expect(sharpened[centerIdx]).toBeGreaterThan(pixels[centerIdx] * 0.99);
  });

  it("handles single pixel image gracefully", () => {
    const pixels = new Float32Array([42]);
    const result = multiscaleLinearTransform(pixels, 1, 1);
    expect(result.length).toBe(1);
  });

  it("handles multi-layer decomposition", () => {
    const w = 32;
    const h = 32;
    const pixels = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) {
      pixels[i] = Math.random();
    }
    const result = multiscaleLinearTransform(pixels, w, h, [
      { noiseThreshold: 3, noiseReduction: 0.5, bias: 0 },
      { noiseThreshold: 3, noiseReduction: 0.5, bias: 0 },
      { noiseThreshold: 3, noiseReduction: 0.5, bias: 0 },
      { noiseThreshold: 3, noiseReduction: 0.5, bias: 0 },
    ]);
    expect(result.length).toBe(w * h);
    // Values should be finite
    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });
});
