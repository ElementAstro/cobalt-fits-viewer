import { normalizeNarrowband } from "../narrowbandNormalization";

describe("normalizeNarrowband", () => {
  it("reference channel has factor=1", () => {
    const ha = new Float32Array([100, 200, 300, 400]);
    const oiii = new Float32Array([50, 100, 150, 200]);
    const result = normalizeNarrowband([ha, oiii], 0, "median");
    expect(result.factors[0]).toBe(1);
    expect(result.factors[1]).toBeCloseTo(2, 0);
  });

  it("linearMatch method uses linear fit", () => {
    const ha = new Float32Array([100, 200, 300, 400]);
    const oiii = new Float32Array([50, 100, 150, 200]);
    const result = normalizeNarrowband([ha, oiii], 0, "linearMatch");
    expect(result.factors[0]).toBe(1);
    expect(result.normalized.length).toBe(2);
    expect(result.normalized[0].length).toBe(4);
  });

  it("manual factors override auto calculation", () => {
    const ha = new Float32Array([100, 200, 300]);
    const oiii = new Float32Array([50, 100, 150]);
    const result = normalizeNarrowband([ha, oiii], 0, "median", [
      undefined as unknown as number,
      3,
    ]);
    expect(result.factors[1]).toBe(3);
    expect(result.normalized[1][0]).toBeCloseTo(150, 0);
  });

  it("empty channels returns empty", () => {
    const result = normalizeNarrowband([], 0, "median");
    expect(result.normalized.length).toBe(0);
    expect(result.factors.length).toBe(0);
  });

  it("mean method uses mean for normalization", () => {
    const ch1 = new Float32Array([10, 20, 30]);
    const ch2 = new Float32Array([5, 10, 15]);
    const result = normalizeNarrowband([ch1, ch2], 0, "mean");
    expect(result.factors[1]).toBeCloseTo(2, 0);
  });
});
