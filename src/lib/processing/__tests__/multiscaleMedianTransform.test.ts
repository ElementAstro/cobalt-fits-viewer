import { multiscaleMedianTransform } from "../multiscaleMedianTransform";

describe("multiscaleMedianTransform", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64).fill(0.5);
    const result = multiscaleMedianTransform(pixels, 8, 8);
    expect(result.length).toBe(64);
  });

  it("preserves flat image with no bias", () => {
    const pixels = new Float32Array(64).fill(100);
    const result = multiscaleMedianTransform(pixels, 8, 8, [
      { noiseThreshold: 3, noiseReduction: 0.5, bias: 0 },
    ]);
    for (let i = 0; i < 64; i++) {
      expect(result[i]).toBeCloseTo(100, 0);
    }
  });

  it("reduces noise with high noiseReduction", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      pixels[i] = 100 + (Math.random() - 0.5) * 20;
    }
    const result = multiscaleMedianTransform(pixels, 16, 16, [
      { noiseThreshold: 1, noiseReduction: 1, bias: 0 },
      { noiseThreshold: 1, noiseReduction: 1, bias: 0 },
    ]);
    // Variance should decrease
    let origVar = 0;
    let resultVar = 0;
    for (let i = 0; i < 256; i++) {
      origVar += (pixels[i] - 100) ** 2;
      resultVar += (result[i] - 100) ** 2;
    }
    expect(resultVar).toBeLessThan(origVar);
  });

  it("respects residualEnabled=false", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = i;
    const withResidual = multiscaleMedianTransform(pixels, 8, 8, [
      { noiseThreshold: 3, noiseReduction: 0, bias: 0 },
    ]);
    const withoutResidual = multiscaleMedianTransform(
      pixels,
      8,
      8,
      [{ noiseThreshold: 3, noiseReduction: 0, bias: 0 }],
      { residualEnabled: false },
    );
    // Without residual, result should differ from with residual
    let diff = 0;
    for (let i = 0; i < 64; i++) diff += Math.abs(withResidual[i] - withoutResidual[i]);
    expect(diff).toBeGreaterThan(0);
  });
});
