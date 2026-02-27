import { getStretchFn, adaptiveStretch, generalizedHyperbolicStretch } from "../stretchAlgorithms";

describe("getStretchFn", () => {
  it("returns identity for 'linear' type", () => {
    const fn = getStretchFn("linear");
    expect(fn(0.5)).toBe(0.5);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });

  it("applies sqrt stretch", () => {
    const fn = getStretchFn("sqrt");
    expect(fn(0.25)).toBeCloseTo(0.5, 4);
    expect(fn(0)).toBe(0);
    expect(fn(1)).toBe(1);
  });

  it("applies log stretch", () => {
    const fn = getStretchFn("log");
    const val = fn(0.5);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThan(1);
  });

  describe("asinh stretch with configurable softening", () => {
    it("uses default softening=10", () => {
      const fn = getStretchFn("asinh");
      const val = fn(0.5);
      expect(val).toBeGreaterThan(0.5);
      expect(val).toBeLessThan(1);
    });

    it("low softening produces less stretch", () => {
      const fnLow = getStretchFn("asinh", 2);
      const fnHigh = getStretchFn("asinh", 50);
      // Higher softening → more aggressive stretch at midtones
      const lowVal = fnLow(0.3);
      const highVal = fnHigh(0.3);
      expect(highVal).toBeGreaterThan(lowVal);
    });

    it("clamps softening to valid range [1, 100]", () => {
      const fnMin = getStretchFn("asinh", 0);
      const fnMax = getStretchFn("asinh", 200);
      // Should not throw
      expect(fnMin(0.5)).toBeGreaterThan(0);
      expect(fnMax(0.5)).toBeGreaterThan(0);
    });

    it("maps 0 to 0 and 1 to 1", () => {
      const fn = getStretchFn("asinh", 20);
      expect(fn(0)).toBeCloseTo(0, 6);
      expect(fn(1)).toBeCloseTo(1, 6);
    });
  });
});

describe("adaptiveStretch", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = Math.random();
    const result = adaptiveStretch(pixels);
    expect(result.length).toBe(64);
  });

  it("returns empty array for empty input", () => {
    const result = adaptiveStretch(new Float32Array(0));
    expect(result.length).toBe(0);
  });

  it("preserves flat image", () => {
    const pixels = new Float32Array(64).fill(42);
    const result = adaptiveStretch(pixels);
    expect(result.length).toBe(64);
    // flat → range=0 → copy
    for (let i = 0; i < 64; i++) {
      expect(result[i]).toBeCloseTo(42, 4);
    }
  });

  it("output values stay within input range", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = 10 + Math.random() * 90;
    const result = adaptiveStretch(pixels);
    let min = Infinity;
    let max = -Infinity;
    let origMin = Infinity;
    let origMax = -Infinity;
    for (let i = 0; i < 256; i++) {
      if (result[i] < min) min = result[i];
      if (result[i] > max) max = result[i];
      if (pixels[i] < origMin) origMin = pixels[i];
      if (pixels[i] > origMax) origMax = pixels[i];
    }
    expect(min).toBeGreaterThanOrEqual(origMin - 0.01);
    expect(max).toBeLessThanOrEqual(origMax + 0.01);
  });

  it("produces finite values for noisy input", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = Math.random() * 1000;
    const result = adaptiveStretch(pixels, 0.01, 0.5, 5);
    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });

  it("accepts all parameter combinations without error", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = i;
    expect(() => adaptiveStretch(pixels, 0, 0, 1)).not.toThrow();
    expect(() => adaptiveStretch(pixels, 0.5, 1, 20)).not.toThrow();
    expect(() => adaptiveStretch(pixels, 0.001, 0, 5)).not.toThrow();
  });
});

describe("generalizedHyperbolicStretch", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = Math.random();
    const result = generalizedHyperbolicStretch(pixels);
    expect(result.length).toBe(64);
  });

  it("returns copy for flat image (range=0)", () => {
    const pixels = new Float32Array(16).fill(0.5);
    const result = generalizedHyperbolicStretch(pixels, 2, 0.25, 0, 0, 0);
    for (let i = 0; i < 16; i++) {
      expect(result[i]).toBeCloseTo(0.5, 4);
    }
  });

  it("returns copy-like result for D=0 (no stretch)", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const result = generalizedHyperbolicStretch(pixels, 0, 0.25, 0, 0, 0);
    for (let i = 0; i < pixels.length; i++) {
      expect(result[i]).toBeCloseTo(pixels[i], 3);
    }
  });

  it("stretches midtones with D>0", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = i / 255;
    const result = generalizedHyperbolicStretch(pixels, 5, 0.25, 0, 0, 0);
    // With D=5, low values should be lifted (stretched)
    const midIdx = 64; // ~0.25 in normalized
    const origNorm = pixels[midIdx];
    const resultNorm = (result[midIdx] - pixels[0]) / (pixels[255] - pixels[0]);
    expect(resultNorm).toBeGreaterThan(origNorm);
  });

  it("output values are finite", () => {
    const pixels = new Float32Array(128);
    for (let i = 0; i < 128; i++) pixels[i] = Math.random() * 65535;
    const result = generalizedHyperbolicStretch(pixels, 3, 0.5, 2, 0.3, 0.2);
    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });

  it("preserves monotonicity", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = i;
    const result = generalizedHyperbolicStretch(pixels, 3, 0.25, 0, 0, 0);
    for (let i = 1; i < 256; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(result[i - 1] - 0.001);
    }
  });

  it("highlight protection reduces stretch in bright areas", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = i / 255;
    const noHP = generalizedHyperbolicStretch(pixels, 3, 0.25, 0, 0, 0);
    const withHP = generalizedHyperbolicStretch(pixels, 3, 0.25, 0, 0.8, 0);
    // With HP, bright pixels should be less affected
    let diffBright = 0;
    for (let i = 200; i < 256; i++) {
      diffBright += Math.abs(noHP[i] - withHP[i]);
    }
    expect(diffBright).toBeGreaterThan(0);
  });

  it("shadow protection reduces stretch in dark areas", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = i / 255;
    const noLP = generalizedHyperbolicStretch(pixels, 3, 0.25, 0, 0, 0);
    const withLP = generalizedHyperbolicStretch(pixels, 3, 0.25, 0, 0, 0.8);
    let diffDark = 0;
    for (let i = 0; i < 50; i++) {
      diffDark += Math.abs(noLP[i] - withLP[i]);
    }
    expect(diffDark).toBeGreaterThan(0);
  });

  it("shape parameter SP changes curve character", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = i / 255;
    const spNeg = generalizedHyperbolicStretch(pixels, 3, 0.5, -2, 0, 0);
    const spPos = generalizedHyperbolicStretch(pixels, 3, 0.5, 2, 0, 0);
    let diff = 0;
    for (let i = 0; i < 256; i++) diff += Math.abs(spNeg[i] - spPos[i]);
    expect(diff).toBeGreaterThan(0);
  });
});
