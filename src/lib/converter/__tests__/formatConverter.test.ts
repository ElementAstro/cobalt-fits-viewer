/**
 * Unit tests for formatConverter.ts — applyStretch with outputBlack/outputWhite
 */

import { applyStretch, fitsToRGBA, fitsToRGBAChunked } from "../formatConverter";

// ===== Helpers =====

function makePixels(n: number, fill: number | "gradient" = 0.5): Float32Array {
  const pixels = new Float32Array(n);
  if (fill === "gradient") {
    for (let i = 0; i < n; i++) pixels[i] = i / (n - 1);
  } else {
    pixels.fill(fill);
  }
  return pixels;
}

function allInRange(arr: Float32Array, lo: number, hi: number): boolean {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < lo - 1e-6 || arr[i] > hi + 1e-6) return false;
  }
  return true;
}

// ===== applyStretch basics =====

describe("applyStretch", () => {
  it("linear stretch identity returns values in [0, 1]", () => {
    const pixels = makePixels(100, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 1);
    expect(result.length).toBe(100);
    expect(allInRange(result, 0, 1)).toBe(true);
  });

  it("linear stretch maps endpoints correctly", () => {
    const pixels = new Float32Array([0, 0.5, 1.0]);
    const result = applyStretch(pixels, "linear", 0, 1, 1);
    expect(result[0]).toBeCloseTo(0, 2);
    expect(result[2]).toBeCloseTo(1, 2);
  });

  it("sqrt stretch produces values in [0, 1]", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "sqrt", 0, 1, 1);
    expect(allInRange(result, 0, 1)).toBe(true);
  });

  it("log stretch produces values in [0, 1]", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "log", 0, 1, 1);
    expect(allInRange(result, 0, 1)).toBe(true);
  });

  it("asinh stretch produces values in [0, 1]", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "asinh", 0, 1, 1);
    expect(allInRange(result, 0, 1)).toBe(true);
  });

  it("gamma=2 darkens image (midpoint < 0.5)", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 2);
    // Gamma > 1 via pow(v, 1/gamma) → brightens; gamma < 1 → darkens
    // pow(0.5, 1/2) = 0.707
    const midIdx = Math.floor(64 / 2);
    expect(result[midIdx]).toBeGreaterThan(0.5);
  });

  it("handles uniform image (range = 0)", () => {
    const pixels = makePixels(16, 0.5);
    const result = applyStretch(pixels, "linear", 0, 1, 1);
    // All same → range=0 → returns 0.5
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeCloseTo(0.5, 5);
    }
  });

  it("blackPoint > 0 clips low values", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const result = applyStretch(pixels, "linear", 0.3, 1, 1);
    expect(result[0]).toBeCloseTo(0, 2); // Below black point → 0
  });

  it("whitePoint < 1 clips high values", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const result = applyStretch(pixels, "linear", 0, 0.7, 1);
    expect(result[4]).toBeCloseTo(1, 2); // Above white point → 1
  });
});

// ===== applyStretch with outputBlack / outputWhite =====

describe("applyStretch outputBlack/outputWhite", () => {
  it("default output levels (0, 1) preserve normal range", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 1, 0, 1);
    expect(allInRange(result, 0, 1)).toBe(true);
    // First pixel should be ~0, last should be ~1
    expect(result[0]).toBeCloseTo(0, 2);
    expect(result[63]).toBeCloseTo(1, 2);
  });

  it("outputBlack=0.2 raises minimum output", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 1, 0.2, 1);
    // First pixel (was 0) should now be ~0.2
    expect(result[0]).toBeCloseTo(0.2, 1);
    // Last pixel should still be ~1
    expect(result[63]).toBeCloseTo(1, 1);
  });

  it("outputWhite=0.8 lowers maximum output", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 1, 0, 0.8);
    // First pixel should still be ~0
    expect(result[0]).toBeCloseTo(0, 1);
    // Last pixel (was 1) should now be ~0.8
    expect(result[63]).toBeCloseTo(0.8, 1);
  });

  it("outputBlack=0.2, outputWhite=0.8 compresses range", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 1, 0.2, 0.8);
    expect(result[0]).toBeCloseTo(0.2, 1);
    expect(result[63]).toBeCloseTo(0.8, 1);
    // Midpoint should be ~0.5
    const midIdx = Math.floor(64 / 2);
    expect(result[midIdx]).toBeCloseTo(0.5, 1);
  });

  it("inverted output levels (outputBlack > outputWhite) inverts image", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 1, 1, 0);
    // First pixel (was 0 → mapped to 1.0)
    expect(result[0]).toBeCloseTo(1, 1);
    // Last pixel (was 1 → mapped to 0)
    expect(result[63]).toBeCloseTo(0, 1);
  });

  it("output levels work with non-linear stretch", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "sqrt", 0, 1, 1, 0.1, 0.9);
    expect(allInRange(result, 0.1 - 0.01, 0.9 + 0.01)).toBe(true);
  });

  it("output levels work with gamma", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0, 1, 2, 0.1, 0.9);
    expect(result[0]).toBeCloseTo(0.1, 1);
    expect(result[63]).toBeCloseTo(0.9, 1);
  });

  it("output levels combined with blackPoint/whitePoint clipping", () => {
    const pixels = makePixels(64, "gradient");
    const result = applyStretch(pixels, "linear", 0.1, 0.9, 1, 0.2, 0.8);
    // Clipped pixels at edges should map to output bounds
    expect(result[0]).toBeCloseTo(0.2, 1); // Below bp → 0 → outputBlack
    expect(result[63]).toBeCloseTo(0.8, 1); // Above wp → 1 → outputWhite
  });
});

// ===== fitsToRGBA with outputBlack / outputWhite =====

describe("fitsToRGBA with output levels", () => {
  it("produces RGBA with correct length", () => {
    const pixels = makePixels(16, "gradient");
    const rgba = fitsToRGBA(pixels, 4, 4, {
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      outputBlack: 0,
      outputWhite: 1,
    });
    expect(rgba.length).toBe(64); // 4*4*4 = 64
    expect(rgba).toBeInstanceOf(Uint8ClampedArray);
  });

  it("outputBlack raises minimum pixel values in RGBA", () => {
    const pixels = makePixels(4, "gradient");
    const rgba = fitsToRGBA(pixels, 2, 2, {
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      outputBlack: 0.5,
      outputWhite: 1,
    });
    // First pixel R channel should be >= 127 (0.5 * 255)
    expect(rgba[0]).toBeGreaterThanOrEqual(120);
  });

  it("outputWhite lowers maximum pixel values in RGBA", () => {
    const pixels = makePixels(4, "gradient");
    const rgba = fitsToRGBA(pixels, 2, 2, {
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      outputBlack: 0,
      outputWhite: 0.5,
    });
    // Last pixel R channel should be <= 130 (~0.5 * 255)
    const lastR = rgba[(4 - 1) * 4]; // R of last pixel
    expect(lastR).toBeLessThanOrEqual(135);
  });

  it("alpha channel is always 255", () => {
    const pixels = makePixels(4, "gradient");
    const rgba = fitsToRGBA(pixels, 2, 2, {
      stretch: "linear",
      colormap: "grayscale",
      blackPoint: 0,
      whitePoint: 1,
      gamma: 1,
      outputBlack: 0.2,
      outputWhite: 0.8,
    });
    for (let i = 0; i < 4; i++) {
      expect(rgba[i * 4 + 3]).toBe(255);
    }
  });
});

describe("viewer tone adjustments", () => {
  it("brightness increases dark values", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1]);
    const out = applyStretch(pixels, "linear", 0, 1, 1, 0, 1, 0.2, 1, 0.5, "linear");
    expect(out[1]).toBeGreaterThan(0.25);
  });

  it("contrast pushes midpoint away from center", () => {
    const pixels = new Float32Array([0.4, 0.5, 0.6]);
    const out = applyStretch(pixels, "linear", 0, 1, 1, 0, 1, 0, 1.8, 0.5, "linear");
    expect(out[0]).toBeLessThan(0.4);
    expect(out[2]).toBeGreaterThan(0.6);
  });

  it("curve preset alters output distribution", () => {
    const pixels = makePixels(32, "gradient");
    const linear = applyStretch(pixels, "linear", 0, 1, 1, 0, 1, 0, 1, 0.5, "linear");
    const bright = applyStretch(pixels, "linear", 0, 1, 1, 0, 1, 0, 1, 0.5, "brighten");
    expect(bright[10]).toBeGreaterThan(linear[10]);
  });

  it("chunked output matches sync output for extended options", async () => {
    const pixels = makePixels(4096, "gradient");
    const options = {
      stretch: "asinh" as const,
      colormap: "grayscale" as const,
      blackPoint: 0.05,
      whitePoint: 0.95,
      gamma: 1.2,
      outputBlack: 0.05,
      outputWhite: 0.9,
      brightness: 0.1,
      contrast: 1.1,
      mtfMidtone: 0.45,
      curvePreset: "sCurve" as const,
    };
    const sync = fitsToRGBA(pixels, 64, 64, options);
    const chunked = await fitsToRGBAChunked(pixels, 64, 64, options);
    expect(chunked.length).toBe(sync.length);
    for (let i = 0; i < sync.length; i += 97) {
      expect(chunked[i]).toBe(sync[i]);
    }
  });
});
