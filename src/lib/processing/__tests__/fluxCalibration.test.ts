import { fluxCalibrate } from "../fluxCalibration";

describe("fluxCalibrate", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array([100, 200, 300, 400]);
    const result = fluxCalibrate(pixels);
    expect(result.length).toBe(4);
  });

  it("divides by exptime and gainFactor", () => {
    const pixels = new Float32Array([100, 200, 300]);
    const result = fluxCalibrate(pixels, { exptime: 10, gainFactor: 2, normalize: false });
    expect(result[0]).toBeCloseTo(5, 4);
    expect(result[1]).toBeCloseTo(10, 4);
    expect(result[2]).toBeCloseTo(15, 4);
  });

  it("normalizes output to [0,1] by default", () => {
    const pixels = new Float32Array([100, 200, 300, 400]);
    const result = fluxCalibrate(pixels, { exptime: 1, gainFactor: 1 });
    expect(result[0]).toBeCloseTo(0, 4);
    expect(result[3]).toBeCloseTo(1, 4);
    // Middle values should be between 0 and 1
    expect(result[1]).toBeGreaterThan(0);
    expect(result[1]).toBeLessThan(1);
  });

  it("skips normalization when normalize=false", () => {
    const pixels = new Float32Array([100, 200]);
    const result = fluxCalibrate(pixels, { exptime: 2, gainFactor: 1, normalize: false });
    expect(result[0]).toBeCloseTo(50, 4);
    expect(result[1]).toBeCloseTo(100, 4);
  });

  it("clamps very small exptime to 0.001", () => {
    const pixels = new Float32Array([10, 20]);
    const result = fluxCalibrate(pixels, { exptime: 0, normalize: false });
    // exptime clamped to 0.001
    expect(result[0]).toBeCloseTo(10 / 0.001, -1);
  });

  it("handles flat image gracefully", () => {
    const pixels = new Float32Array(16).fill(42);
    const result = fluxCalibrate(pixels, { exptime: 5 });
    // All same value → range=0 → no normalization change
    expect(result.length).toBe(16);
    for (let i = 0; i < 16; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });

  it("handles empty array", () => {
    const pixels = new Float32Array(0);
    const result = fluxCalibrate(pixels);
    expect(result.length).toBe(0);
  });

  it("defaults to exptime=1, gainFactor=1 when no options", () => {
    const pixels = new Float32Array([0, 50, 100]);
    const result = fluxCalibrate(pixels, { normalize: false });
    expect(result[0]).toBeCloseTo(0, 4);
    expect(result[1]).toBeCloseTo(50, 4);
    expect(result[2]).toBeCloseTo(100, 4);
  });
});
