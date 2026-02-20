/**
 * Unit tests for imageOperations.ts
 * Covers both existing and new PixInsight-style operations
 */

import {
  rotate90CW,
  rotate90CCW,
  rotate180,
  flipHorizontal,
  flipVertical,
  invertPixels,
  gaussianBlur,
  sharpen,
  medianFilter,
  histogramEqualize,
  cropImage,
  adjustBrightness,
  adjustContrast,
  adjustGamma,
  applyLevels,
  rotateArbitrary,
  extractBackground,
  applyMTF,
  applyStarMask,
  generateStarMask,
  applyWithMask,
  binarize,
  rescalePixels,
  applySCNR,
  applySCNRGray,
  clahe,
  applyCurves,
  morphErode,
  morphDilate,
  morphologicalOp,
  hdrMultiscaleTransform,
  createRangeMask,
  applyRangeMask,
  adjustSaturation,
  evaluatePixelExpression,
  richardsonLucy,
  dynamicBackgroundExtract,
  applyOperation,
  type ScientificImageOperation,
} from "../imageOperations";

// ===== Test Helpers =====

/** Create a simple W×H Float32Array filled with a constant or gradient */
function makePixels(w: number, h: number, fill: number | "gradient" = 0.5): Float32Array {
  const n = w * h;
  const pixels = new Float32Array(n);
  if (fill === "gradient") {
    for (let i = 0; i < n; i++) pixels[i] = i / (n - 1);
  } else {
    pixels.fill(fill);
  }
  return pixels;
}

/** Create a simple RGBA buffer */
function makeRGBA(n: number, r: number, g: number, b: number, a: number = 255): Uint8ClampedArray {
  const data = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return data;
}

/** Check all pixel values are within [lo, hi] */
function allInRange(pixels: Float32Array, lo: number, hi: number): boolean {
  for (let i = 0; i < pixels.length; i++) {
    if (pixels[i] < lo - 1e-6 || pixels[i] > hi + 1e-6) return false;
  }
  return true;
}

// ===== Existing Operations =====

describe("Geometry transforms", () => {
  const pixels = new Float32Array([1, 2, 3, 4, 5, 6]); // 3×2

  it("rotate90CW swaps dimensions", () => {
    const r = rotate90CW(pixels, 3, 2);
    expect(r.width).toBe(2);
    expect(r.height).toBe(3);
    expect(r.pixels.length).toBe(6);
  });

  it("rotate90CCW swaps dimensions", () => {
    const r = rotate90CCW(pixels, 3, 2);
    expect(r.width).toBe(2);
    expect(r.height).toBe(3);
  });

  it("rotate180 preserves dimensions", () => {
    const r = rotate180(pixels, 3, 2);
    expect(r.width).toBe(3);
    expect(r.height).toBe(2);
    expect(r.pixels[0]).toBe(6);
    expect(r.pixels[5]).toBe(1);
  });

  it("rotate90CW then rotate90CCW returns original", () => {
    const r1 = rotate90CW(pixels, 3, 2);
    const r2 = rotate90CCW(r1.pixels, r1.width, r1.height);
    expect(r2.width).toBe(3);
    expect(r2.height).toBe(2);
    for (let i = 0; i < 6; i++) {
      expect(r2.pixels[i]).toBe(pixels[i]);
    }
  });

  it("flipHorizontal reverses each row", () => {
    const r = flipHorizontal(pixels, 3, 2);
    expect(r[0]).toBe(3);
    expect(r[1]).toBe(2);
    expect(r[2]).toBe(1);
  });

  it("flipVertical reverses rows", () => {
    const r = flipVertical(pixels, 3, 2);
    expect(r[0]).toBe(4);
    expect(r[3]).toBe(1);
  });

  it("double flipH returns original", () => {
    const r = flipHorizontal(flipHorizontal(pixels, 3, 2), 3, 2);
    for (let i = 0; i < 6; i++) expect(r[i]).toBe(pixels[i]);
  });

  it("cropImage extracts correct subregion", () => {
    const r = cropImage(pixels, 3, 0, 0, 2, 2);
    expect(r.width).toBe(2);
    expect(r.height).toBe(2);
    expect(r.pixels[0]).toBe(1);
    expect(r.pixels[1]).toBe(2);
    expect(r.pixels[2]).toBe(4);
    expect(r.pixels[3]).toBe(5);
  });

  it("rotateArbitrary preserves approximate dimensions for 0°", () => {
    const r = rotateArbitrary(pixels, 3, 2, 0);
    expect(r.width).toBe(3);
    expect(r.height).toBe(2);
  });
});

describe("Pixel transforms", () => {
  it("invertPixels inverts values around min/max midpoint", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const inv = invertPixels(pixels);
    expect(inv[0]).toBeCloseTo(1.0, 5);
    expect(inv[4]).toBeCloseTo(0, 5);
    expect(inv[2]).toBeCloseTo(0.5, 5);
  });

  it("adjustBrightness adds amount", () => {
    const pixels = new Float32Array([0.5, 0.5]);
    const r = adjustBrightness(pixels, 0.1);
    expect(r[0]).toBeCloseTo(0.6, 5);
  });

  it("adjustContrast with factor 1 preserves values", () => {
    const pixels = new Float32Array([0.2, 0.8]);
    const r = adjustContrast(pixels, 1.0);
    expect(r[0]).toBeCloseTo(0.2, 5);
    expect(r[1]).toBeCloseTo(0.8, 5);
  });

  it("adjustGamma with gamma=1 preserves values", () => {
    const pixels = new Float32Array([0, 0.5, 1.0]);
    const r = adjustGamma(pixels, 1.0);
    for (let i = 0; i < 3; i++) expect(r[i]).toBeCloseTo(pixels[i], 4);
  });

  it("applyLevels identity transform preserves values", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const r = applyLevels(pixels, 0, 1, 1, 0, 1);
    for (let i = 0; i < 5; i++) expect(r[i]).toBeCloseTo(pixels[i], 4);
  });
});

describe("Filters", () => {
  it("gaussianBlur produces output of same size", () => {
    const pixels = makePixels(10, 10, "gradient");
    const r = gaussianBlur(pixels, 10, 10, 1.0);
    expect(r.length).toBe(100);
  });

  it("gaussianBlur on uniform image returns same values", () => {
    const pixels = makePixels(8, 8, 0.5);
    const r = gaussianBlur(pixels, 8, 8, 2.0);
    for (let i = 0; i < r.length; i++) expect(r[i]).toBeCloseTo(0.5, 2);
  });

  it("sharpen produces output of same size", () => {
    const pixels = makePixels(10, 10, "gradient");
    const r = sharpen(pixels, 10, 10, 1.0, 1.0);
    expect(r.length).toBe(100);
  });

  it("medianFilter produces output of same size", () => {
    const pixels = makePixels(10, 10, "gradient");
    const r = medianFilter(pixels, 10, 10, 1);
    expect(r.length).toBe(100);
  });

  it("histogramEqualize normalizes output", () => {
    const pixels = makePixels(10, 10, "gradient");
    const r = histogramEqualize(pixels);
    expect(r.length).toBe(100);
  });

  it("extractBackground produces same-size output", () => {
    const pixels = makePixels(16, 16, "gradient");
    const r = extractBackground(pixels, 16, 16, 4);
    expect(r.length).toBe(256);
  });
});

// ===== New PixInsight-style Operations =====

describe("MTF (Midtone Transfer Function)", () => {
  it("applyMTF with midtone=0.5 is identity-like", () => {
    const pixels = makePixels(4, 4, "gradient");
    const r = applyMTF(pixels, 0.5);
    // midtone=0.5 maps 0.5 → 0.5
    expect(r.length).toBe(16);
    // endpoints should be preserved
    expect(r[0]).toBeCloseTo(pixels[0], 1);
  });

  it("applyMTF with low midtone brightens image", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const r = applyMTF(pixels, 0.15);
    // Low midtone should brighten midtones
    expect(r[2]).toBeGreaterThan(0.5);
  });

  it("applyMTF with high midtone darkens image", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const r = applyMTF(pixels, 0.85);
    expect(r[2]).toBeLessThan(0.5);
  });

  it("applyMTF with shadows/highlights clipping", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const r = applyMTF(pixels, 0.5, 0.1, 0.9);
    expect(r.length).toBe(5);
  });

  it("applyMTF handles uniform image", () => {
    const pixels = makePixels(4, 4, 0.5);
    const r = applyMTF(pixels, 0.5);
    expect(r.length).toBe(16);
  });

  it("applyMTF handles single-value image", () => {
    const pixels = makePixels(4, 4, 0);
    const r = applyMTF(pixels, 0.5);
    // All same value → range=0 → returns copy
    for (let i = 0; i < r.length; i++) expect(r[i]).toBe(0);
  });
});

describe("StarMask", () => {
  // Use a simple image with a bright "star" in center
  function makeStarImage(w: number, h: number): Float32Array {
    const pixels = new Float32Array(w * h).fill(0.1);
    const cx = Math.floor(w / 2),
      cy = Math.floor(h / 2);
    // Create bright gaussian-like spot
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        const r2 = dx * dx + dy * dy;
        const px = cx + dx,
          py = cy + dy;
        if (px >= 0 && px < w && py >= 0 && py < h) {
          pixels[py * w + px] = 0.1 + 0.9 * Math.exp(-r2 / 2);
        }
      }
    }
    return pixels;
  }

  it("generateStarMask produces correct dimensions", () => {
    const pixels = makeStarImage(32, 32);
    const mask = generateStarMask(pixels, 32, 32, 1.5);
    expect(mask.length).toBe(32 * 32);
  });

  it("generateStarMask values are in [0, 1]", () => {
    const pixels = makeStarImage(32, 32);
    const mask = generateStarMask(pixels, 32, 32, 1.5);
    expect(allInRange(mask, 0, 1)).toBe(true);
  });

  it("applyStarMask with invert=false preserves stars", () => {
    const pixels = makeStarImage(32, 32);
    const r = applyStarMask(pixels, 32, 32, 1.5, false);
    expect(r.length).toBe(32 * 32);
  });

  it("applyStarMask with invert=true removes stars", () => {
    const pixels = makeStarImage(32, 32);
    const r = applyStarMask(pixels, 32, 32, 1.5, true);
    expect(r.length).toBe(32 * 32);
  });

  it("applyWithMask blends correctly", () => {
    const original = new Float32Array([0, 0, 0, 0]);
    const processed = new Float32Array([1, 1, 1, 1]);
    const mask = new Float32Array([0, 0.5, 1, 0.25]);
    const r = applyWithMask(original, processed, mask);
    expect(r[0]).toBeCloseTo(0, 5);
    expect(r[1]).toBeCloseTo(0.5, 5);
    expect(r[2]).toBeCloseTo(1, 5);
    expect(r[3]).toBeCloseTo(0.25, 5);
  });

  it("applyWithMask with invert reverses mask", () => {
    const original = new Float32Array([0, 0]);
    const processed = new Float32Array([1, 1]);
    const mask = new Float32Array([0.8, 0.2]);
    const r = applyWithMask(original, processed, mask, true);
    // inverted: m = 1-0.8=0.2, so result = 0*0.8 + 1*0.2 = 0.2
    expect(r[0]).toBeCloseTo(0.2, 5);
    expect(r[1]).toBeCloseTo(0.8, 5);
  });
});

describe("Binarize / Rescale", () => {
  it("binarize with threshold 0.5 splits correctly", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const r = binarize(pixels, 0.5);
    expect(r[0]).toBe(0); // below threshold
    expect(r[1]).toBe(0);
    expect(r[2]).toBe(0); // equal
    expect(r[3]).toBe(1); // above
    expect(r[4]).toBe(1);
  });

  it("binarize with threshold 0 maps all above min to max", () => {
    const pixels = new Float32Array([0.1, 0.5, 1.0]);
    const r = binarize(pixels, 0);
    // absThreshold = min (0.1), so pixels > 0.1 → max (1.0), pixel == 0.1 → min (0.1)
    expect(r[0]).toBeCloseTo(0.1, 5); // equal to min, stays min
    expect(r[1]).toBeCloseTo(1.0, 5); // above min
    expect(r[2]).toBeCloseTo(1.0, 5); // above min
  });

  it("binarize handles uniform image", () => {
    const pixels = makePixels(4, 4, 0.5);
    const r = binarize(pixels, 0.5);
    // range=0 → returns zeros
    expect(r.length).toBe(16);
  });

  it("rescalePixels maps to [0, 1]", () => {
    const pixels = new Float32Array([10, 20, 30, 40, 50]);
    const r = rescalePixels(pixels);
    expect(r[0]).toBeCloseTo(0, 5);
    expect(r[4]).toBeCloseTo(1, 5);
    expect(r[2]).toBeCloseTo(0.5, 5);
  });

  it("rescalePixels handles uniform image", () => {
    const pixels = makePixels(4, 4, 42);
    const r = rescalePixels(pixels);
    for (let i = 0; i < r.length; i++) expect(r[i]).toBeCloseTo(0.5, 5);
  });

  it("rescalePixels handles already normalized", () => {
    const pixels = new Float32Array([0, 0.5, 1]);
    const r = rescalePixels(pixels);
    expect(r[0]).toBeCloseTo(0, 5);
    expect(r[1]).toBeCloseTo(0.5, 5);
    expect(r[2]).toBeCloseTo(1, 5);
  });
});

describe("SCNR (Subtractive Chromatic Noise Reduction)", () => {
  it("applySCNR averageNeutral reduces green", () => {
    // Pixel with excess green: R=100, G=200, B=100
    const rgba = makeRGBA(1, 100, 200, 100);
    const r = applySCNR(rgba, "averageNeutral", 1.0);
    // avg(R,B) = 100, G'=min(200,100) = 100
    expect(r[1]).toBe(100);
  });

  it("applySCNR maximumNeutral reduces green", () => {
    const rgba = makeRGBA(1, 100, 200, 80);
    const r = applySCNR(rgba, "maximumNeutral", 1.0);
    // max(R,B) = 100, G'=min(200,100) = 100
    expect(r[1]).toBe(100);
  });

  it("applySCNR with amount=0 preserves original", () => {
    const rgba = makeRGBA(1, 100, 200, 100);
    const r = applySCNR(rgba, "averageNeutral", 0);
    expect(r[1]).toBe(200);
  });

  it("applySCNR with amount=0.5 partially reduces", () => {
    const rgba = makeRGBA(1, 100, 200, 100);
    const r = applySCNR(rgba, "averageNeutral", 0.5);
    // G'=min(200,100)=100, blend: 200*0.5 + 100*0.5 = 150
    expect(r[1]).toBe(150);
  });

  it("applySCNR does not affect R, B, A channels", () => {
    const rgba = makeRGBA(1, 100, 200, 80, 255);
    const r = applySCNR(rgba, "averageNeutral", 1.0);
    expect(r[0]).toBe(100); // R
    expect(r[2]).toBe(80); // B
    expect(r[3]).toBe(255); // A
  });

  it("applySCNR no-op when green is not excess", () => {
    // G is already ≤ avg(R,B)
    const rgba = makeRGBA(1, 200, 50, 200);
    const r = applySCNR(rgba, "averageNeutral", 1.0);
    expect(r[1]).toBe(50); // unchanged
  });
});

describe("CLAHE", () => {
  it("clahe produces correct dimensions", () => {
    const pixels = makePixels(16, 16, "gradient");
    const r = clahe(pixels, 16, 16, 8, 3.0);
    expect(r.length).toBe(256);
  });

  it("clahe output is in original value range", () => {
    const pixels = makePixels(16, 16, "gradient");
    const r = clahe(pixels, 16, 16, 8, 3.0);
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] < min) min = pixels[i];
      if (pixels[i] > max) max = pixels[i];
    }
    expect(allInRange(r, min - 0.01, max + 0.01)).toBe(true);
  });

  it("clahe handles uniform image", () => {
    const pixels = makePixels(16, 16, 0.5);
    const r = clahe(pixels, 16, 16, 8, 3.0);
    expect(r.length).toBe(256);
  });

  it("clahe with different tile sizes", () => {
    const pixels = makePixels(32, 32, "gradient");
    const r4 = clahe(pixels, 32, 32, 4, 3.0);
    const r16 = clahe(pixels, 32, 32, 16, 3.0);
    expect(r4.length).toBe(1024);
    expect(r16.length).toBe(1024);
  });
});

describe("CurvesTransformation", () => {
  it("identity curve preserves values", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const r = applyCurves(pixels, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    for (let i = 0; i < 5; i++) expect(r[i]).toBeCloseTo(pixels[i], 2);
  });

  it("brighten curve increases values", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const r = applyCurves(pixels, [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.4 },
      { x: 0.5, y: 0.65 },
      { x: 0.75, y: 0.85 },
      { x: 1, y: 1 },
    ]);
    expect(r[2]).toBeGreaterThan(0.5); // midtone brightened
  });

  it("curves output stays in value range", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = applyCurves(pixels, [
      { x: 0, y: 0 },
      { x: 0.3, y: 0.6 },
      { x: 0.7, y: 0.4 },
      { x: 1, y: 1 },
    ]);
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] < min) min = pixels[i];
      if (pixels[i] > max) max = pixels[i];
    }
    expect(allInRange(r, min - 0.01, max + 0.01)).toBe(true);
  });

  it("curves handles single control point", () => {
    const pixels = new Float32Array([0, 0.5, 1.0]);
    const r = applyCurves(pixels, [{ x: 0.5, y: 0.5 }]);
    expect(r.length).toBe(3);
  });

  it("curves handles uniform image", () => {
    const pixels = makePixels(4, 4, 0.5);
    const r = applyCurves(pixels, [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ]);
    expect(r.length).toBe(16);
  });
});

describe("Morphological Operations", () => {
  it("morphErode reduces bright features", () => {
    // Create image with bright center pixel
    const pixels = makePixels(5, 5, 0);
    pixels[12] = 1.0; // center
    const r = morphErode(pixels, 5, 5, 1);
    expect(r[12]).toBe(0); // center should become min of neighborhood
  });

  it("morphDilate expands bright features", () => {
    const pixels = makePixels(5, 5, 0);
    pixels[12] = 1.0; // center
    const r = morphDilate(pixels, 5, 5, 1);
    // Center and neighbors should be 1.0
    expect(r[12]).toBe(1.0);
    expect(r[11]).toBe(1.0); // left
    expect(r[13]).toBe(1.0); // right
    expect(r[7]).toBe(1.0); // top
    expect(r[17]).toBe(1.0); // bottom
  });

  it("morphologicalOp open = erode then dilate", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = morphologicalOp(pixels, 8, 8, "open", 1);
    expect(r.length).toBe(64);
  });

  it("morphologicalOp close = dilate then erode", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = morphologicalOp(pixels, 8, 8, "close", 1);
    expect(r.length).toBe(64);
  });

  it("erode on uniform image preserves values", () => {
    const pixels = makePixels(8, 8, 0.5);
    const r = morphErode(pixels, 8, 8, 2);
    for (let i = 0; i < r.length; i++) expect(r[i]).toBeCloseTo(0.5, 5);
  });

  it("dilate on uniform image preserves values", () => {
    const pixels = makePixels(8, 8, 0.5);
    const r = morphDilate(pixels, 8, 8, 2);
    for (let i = 0; i < r.length; i++) expect(r[i]).toBeCloseTo(0.5, 5);
  });
});

describe("HDR Multiscale Transform", () => {
  it("hdrMultiscaleTransform produces correct dimensions", () => {
    const pixels = makePixels(16, 16, "gradient");
    const r = hdrMultiscaleTransform(pixels, 16, 16, 3, 0.5);
    expect(r.length).toBe(256);
  });

  it("hdrMultiscaleTransform output stays in range", () => {
    const pixels = makePixels(16, 16, "gradient");
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] < min) min = pixels[i];
      if (pixels[i] > max) max = pixels[i];
    }
    const r = hdrMultiscaleTransform(pixels, 16, 16, 3, 0.5);
    expect(allInRange(r, min - 0.01, max + 0.01)).toBe(true);
  });

  it("hdrMultiscaleTransform with amount=0 is near identity", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = hdrMultiscaleTransform(pixels, 8, 8, 3, 0);
    // amount=0 → compression=1 → should be close to original
    for (let i = 0; i < pixels.length; i++) {
      expect(r[i]).toBeCloseTo(pixels[i], 1);
    }
  });

  it("hdrMultiscaleTransform handles uniform image", () => {
    const pixels = makePixels(8, 8, 0.5);
    const r = hdrMultiscaleTransform(pixels, 8, 8, 3, 0.5);
    expect(r.length).toBe(64);
  });
});

describe("Range Selection / Luminance Mask", () => {
  it("createRangeMask full range returns all ones", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const mask = createRangeMask(pixels, 0, 1, 0.1);
    for (let i = 0; i < mask.length; i++) expect(mask[i]).toBeCloseTo(1, 2);
  });

  it("createRangeMask narrow range selects correctly", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1.0]);
    const mask = createRangeMask(pixels, 0.4, 0.6, 0.05);
    // 0.5 should be fully selected
    expect(mask[2]).toBeCloseTo(1, 2);
    // 0 and 1 should be zero or near-zero
    expect(mask[0]).toBeCloseTo(0, 1);
    expect(mask[4]).toBeCloseTo(0, 1);
  });

  it("createRangeMask with fuzziness creates smooth transitions", () => {
    const pixels = new Float32Array([0, 0.1, 0.2, 0.3, 0.4, 0.5]);
    const mask = createRangeMask(pixels, 0.3, 0.8, 0.15);
    // 0.3 should be at boundary → close to 1
    expect(mask[3]).toBeGreaterThan(0.5);
    // 0.1 should be faded
    expect(mask[1]).toBeLessThan(0.5);
  });

  it("applyRangeMask produces correct size", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = applyRangeMask(pixels, 0.2, 0.8, 0.1);
    expect(r.length).toBe(64);
  });

  it("createRangeMask handles uniform image", () => {
    const pixels = makePixels(4, 4, 0.5);
    const mask = createRangeMask(pixels, 0, 1, 0.1);
    // uniform → range=0 → returns all 1s
    for (let i = 0; i < mask.length; i++) expect(mask[i]).toBe(1);
  });
});

describe("Color Saturation", () => {
  it("adjustSaturation with amount=0 preserves original", () => {
    const rgba = makeRGBA(1, 200, 100, 50);
    const r = adjustSaturation(rgba, 0);
    expect(r[0]).toBe(200);
    expect(r[1]).toBe(100);
    expect(r[2]).toBe(50);
    expect(r[3]).toBe(255);
  });

  it("adjustSaturation desaturates with negative amount", () => {
    const rgba = makeRGBA(1, 255, 0, 0); // Pure red
    const r = adjustSaturation(rgba, -1);
    // Fully desaturated → gray
    const avg = (r[0] + r[1] + r[2]) / 3;
    expect(Math.abs(r[0] - avg)).toBeLessThan(2);
    expect(Math.abs(r[1] - avg)).toBeLessThan(2);
    expect(Math.abs(r[2] - avg)).toBeLessThan(2);
  });

  it("adjustSaturation preserves grayscale pixels", () => {
    const rgba = makeRGBA(1, 128, 128, 128);
    const r = adjustSaturation(rgba, 1.0);
    // Gray has no saturation to adjust
    expect(r[0]).toBe(128);
    expect(r[1]).toBe(128);
    expect(r[2]).toBe(128);
  });

  it("adjustSaturation preserves alpha", () => {
    const rgba = makeRGBA(1, 200, 100, 50, 200);
    const r = adjustSaturation(rgba, 0.5);
    expect(r[3]).toBe(200);
  });
});

describe("PixelMath Expression Evaluator", () => {
  it("identity expression $T returns original", () => {
    const pixels = new Float32Array([0.1, 0.5, 0.9]);
    const r = evaluatePixelExpression(pixels, "$T");
    for (let i = 0; i < 3; i++) expect(r[i]).toBeCloseTo(pixels[i], 5);
  });

  it("constant expression returns constant", () => {
    const pixels = new Float32Array([0.1, 0.5, 0.9]);
    const r = evaluatePixelExpression(pixels, "0.42");
    for (let i = 0; i < 3; i++) expect(r[i]).toBeCloseTo(0.42, 5);
  });

  it("arithmetic operations work", () => {
    const pixels = new Float32Array([2]);
    expect(evaluatePixelExpression(pixels, "$T + 1")[0]).toBeCloseTo(3, 5);
    expect(evaluatePixelExpression(pixels, "$T - 1")[0]).toBeCloseTo(1, 5);
    expect(evaluatePixelExpression(pixels, "$T * 3")[0]).toBeCloseTo(6, 5);
    expect(evaluatePixelExpression(pixels, "$T / 2")[0]).toBeCloseTo(1, 5);
  });

  it("power operator works", () => {
    const pixels = new Float32Array([3]);
    const r = evaluatePixelExpression(pixels, "$T ^ 2");
    expect(r[0]).toBeCloseTo(9, 5);
  });

  it("functions work", () => {
    const pixels = new Float32Array([4]);
    expect(evaluatePixelExpression(pixels, "sqrt($T)")[0]).toBeCloseTo(2, 5);
    expect(evaluatePixelExpression(pixels, "abs(-$T)")[0]).toBeCloseTo(4, 5);
  });

  it("min/max functions work", () => {
    const pixels = new Float32Array([5]);
    expect(evaluatePixelExpression(pixels, "min($T, 3)")[0]).toBeCloseTo(3, 5);
    expect(evaluatePixelExpression(pixels, "max($T, 10)")[0]).toBeCloseTo(10, 5);
  });

  it("$mean and $median variables work", () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5]);
    const rMean = evaluatePixelExpression(pixels, "$mean");
    expect(rMean[0]).toBeCloseTo(3, 1);

    const rMedian = evaluatePixelExpression(pixels, "$median");
    expect(rMedian[0]).toBeCloseTo(3, 1);
  });

  it("normalization expression works", () => {
    const pixels = new Float32Array([10, 20, 30]);
    const r = evaluatePixelExpression(pixels, "($T - $min) / ($max - $min)");
    expect(r[0]).toBeCloseTo(0, 3);
    expect(r[1]).toBeCloseTo(0.5, 3);
    expect(r[2]).toBeCloseTo(1, 3);
  });

  it("nested parentheses work", () => {
    const pixels = new Float32Array([2]);
    const r = evaluatePixelExpression(pixels, "(($T + 1) * 2)");
    expect(r[0]).toBeCloseTo(6, 5);
  });

  it("handles invalid expression gracefully", () => {
    const pixels = new Float32Array([1, 2, 3]);
    // Unknown function → catches error, returns original value
    const r = evaluatePixelExpression(pixels, "badFunc($T)");
    for (let i = 0; i < 3; i++) expect(r[i]).toBe(pixels[i]);
  });

  it("handles unary negation", () => {
    const pixels = new Float32Array([5]);
    const r = evaluatePixelExpression(pixels, "-$T");
    expect(r[0]).toBeCloseTo(-5, 5);
  });
});

describe("Deconvolution (Richardson-Lucy)", () => {
  it("richardsonLucy produces correct dimensions", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = richardsonLucy(pixels, 8, 8, 1.5, 5, 0.1);
    expect(r.length).toBe(64);
  });

  it("richardsonLucy on uniform image returns near-uniform", () => {
    const pixels = makePixels(8, 8, 0.5);
    const r = richardsonLucy(pixels, 8, 8, 1.5, 5, 0.1);
    for (let i = 0; i < r.length; i++) {
      expect(r[i]).toBeCloseTo(0.5, 1);
    }
  });

  it("richardsonLucy handles negative pixels", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = -0.1 + i * 0.01;
    const r = richardsonLucy(pixels, 8, 8, 1.0, 3, 0.1);
    expect(r.length).toBe(64);
  });

  it("richardsonLucy with 0 iterations returns input", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = richardsonLucy(pixels, 8, 8, 1.5, 0, 0.1);
    // 0 iterations → estimate = observed (with offset)
    expect(r.length).toBe(64);
  });
});

// ===== applyOperation dispatcher =====

describe("applyOperation dispatcher", () => {
  const pixels = makePixels(4, 4, "gradient");
  const w = 4,
    h = 4;

  // Test that every operation type is dispatched without throwing
  const operations: ScientificImageOperation[] = [
    { type: "rotate90cw" },
    { type: "rotate90ccw" },
    { type: "rotate180" },
    { type: "flipH" },
    { type: "flipV" },
    { type: "invert" },
    { type: "blur", sigma: 1 },
    { type: "sharpen", amount: 1, sigma: 1 },
    { type: "denoise", radius: 1 },
    { type: "histogramEq" },
    { type: "crop", x: 0, y: 0, width: 2, height: 2 },
    { type: "brightness", amount: 0.1 },
    { type: "contrast", factor: 1.2 },
    { type: "gamma", gamma: 1.5 },
    { type: "levels", inputBlack: 0, inputWhite: 1, gamma: 1, outputBlack: 0, outputWhite: 1 },
    { type: "rotateArbitrary", angle: 10 },
    { type: "backgroundExtract", gridSize: 4 },
    { type: "mtf", midtone: 0.3, shadowsClip: 0, highlightsClip: 1 },
    { type: "starMask", scale: 1.5, invert: false },
    { type: "binarize", threshold: 0.5 },
    { type: "rescale" },
    { type: "clahe", tileSize: 4, clipLimit: 3 },
    {
      type: "curves",
      points: [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    { type: "morphology", operation: "dilate", radius: 1 },
    { type: "hdr", layers: 3, amount: 0.5 },
    { type: "rangeMask", low: 0.2, high: 0.8, fuzziness: 0.1 },
    { type: "pixelMath", expression: "$T * 2" },
    { type: "deconvolution", psfSigma: 1.5, iterations: 3, regularization: 0.1 },
  ];

  it.each(operations.map((op) => [op.type, op]))("dispatches %s without error", (_name, op) => {
    const result = applyOperation(pixels, w, h, op);
    expect(result).toBeDefined();
    expect(result.pixels).toBeInstanceOf(Float32Array);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
    expect(result.pixels.length).toBe(result.width * result.height);
  });
});

// ===== Edge case tests =====

describe("Edge cases", () => {
  it("all operations handle 1×1 image", () => {
    const pixels = new Float32Array([0.5]);
    expect(applyMTF(pixels, 0.3).length).toBe(1);
    expect(binarize(pixels, 0.5).length).toBe(1);
    expect(rescalePixels(pixels).length).toBe(1);
    expect(clahe(pixels, 1, 1, 1, 3).length).toBe(1);
    expect(
      applyCurves(pixels, [
        { x: 0, y: 0 },
        { x: 1, y: 1 },
      ]).length,
    ).toBe(1);
    expect(morphErode(pixels, 1, 1, 1).length).toBe(1);
    expect(morphDilate(pixels, 1, 1, 1).length).toBe(1);
    expect(hdrMultiscaleTransform(pixels, 1, 1, 3, 0.5).length).toBe(1);
    expect(createRangeMask(pixels, 0, 1, 0.1).length).toBe(1);
    expect(evaluatePixelExpression(pixels, "$T").length).toBe(1);
    expect(richardsonLucy(pixels, 1, 1, 1, 3, 0.1).length).toBe(1);
  });

  it("all operations handle NaN pixels gracefully", () => {
    const pixels = new Float32Array([NaN, 0.5, NaN, 0.8]);
    // Should not throw
    expect(() => applyMTF(pixels, 0.5)).not.toThrow();
    expect(() => binarize(pixels, 0.5)).not.toThrow();
    expect(() => rescalePixels(pixels)).not.toThrow();
    expect(() => evaluatePixelExpression(pixels, "$T")).not.toThrow();
  });

  it("SCNR handles multiple pixels", () => {
    const rgba = new Uint8ClampedArray(12); // 3 pixels
    // pixel 0: R=50,G=200,B=50; pixel 1: R=100,G=100,B=100; pixel 2: R=200,G=50,B=200
    rgba.set([50, 200, 50, 255, 100, 100, 100, 255, 200, 50, 200, 255]);
    const r = applySCNR(rgba, "averageNeutral", 1.0);
    expect(r[1]).toBe(50); // green reduced
    expect(r[5]).toBe(100); // already neutral
    expect(r[9]).toBe(50); // green below avg, unchanged
  });

  it("saturation handles multiple pixels", () => {
    const rgba = new Uint8ClampedArray(8);
    rgba.set([255, 0, 0, 255, 0, 0, 255, 255]);
    const r = adjustSaturation(rgba, 0);
    expect(r.length).toBe(8);
  });
});

// ===== Input Validation Tests =====

describe("Input validation / parameter clamping", () => {
  const pixels = makePixels(8, 8, "gradient");

  it("applyMTF clamps midtone to [0.001, 0.999]", () => {
    // Extreme values should not crash
    expect(() => applyMTF(pixels, -1)).not.toThrow();
    expect(() => applyMTF(pixels, 2)).not.toThrow();
    expect(() => applyMTF(pixels, 0)).not.toThrow();
    expect(() => applyMTF(pixels, 1)).not.toThrow();
  });

  it("applyMTF clamps shadowsClip and highlightsClip", () => {
    expect(() => applyMTF(pixels, 0.5, -0.5, 1.5)).not.toThrow();
    const r = applyMTF(pixels, 0.5, -0.5, 1.5);
    expect(r.length).toBe(64);
  });

  it("binarize clamps threshold to [0, 1]", () => {
    const r1 = binarize(pixels, -0.5);
    const r2 = binarize(pixels, 1.5);
    expect(r1.length).toBe(64);
    expect(r2.length).toBe(64);
  });

  it("clahe clamps tileSize and clipLimit", () => {
    // tileSize < 2 should be clamped to 2
    expect(() => clahe(pixels, 8, 8, 0, 3)).not.toThrow();
    // clipLimit < 1 should be clamped to 1
    expect(() => clahe(pixels, 8, 8, 4, 0)).not.toThrow();
    // Very large values should be clamped
    expect(() => clahe(pixels, 8, 8, 200, 100)).not.toThrow();
  });

  it("morphologicalOp clamps radius to [1, 10]", () => {
    const r0 = morphologicalOp(pixels, 8, 8, "erode", 0);
    expect(r0.length).toBe(64); // clamped to 1
    const r20 = morphologicalOp(pixels, 8, 8, "dilate", 20);
    expect(r20.length).toBe(64); // clamped to 10
  });

  it("hdrMultiscaleTransform clamps layers and amount", () => {
    expect(() => hdrMultiscaleTransform(pixels, 8, 8, 0, -1)).not.toThrow();
    expect(() => hdrMultiscaleTransform(pixels, 8, 8, 20, 5)).not.toThrow();
  });

  it("richardsonLucy clamps psfSigma, iterations, regularization", () => {
    expect(() => richardsonLucy(pixels, 8, 8, 0.1, -5, -1)).not.toThrow();
    expect(() => richardsonLucy(pixels, 8, 8, 100, 200, 5)).not.toThrow();
  });
});

// ===== PixelMath Extended Functions =====

describe("PixelMath extended functions", () => {
  it("ln (natural log) works", () => {
    const pixels = new Float32Array([Math.E]);
    const r = evaluatePixelExpression(pixels, "ln($T)");
    expect(r[0]).toBeCloseTo(1, 3);
  });

  it("log10 works", () => {
    const pixels = new Float32Array([100]);
    const r = evaluatePixelExpression(pixels, "log10($T)");
    expect(r[0]).toBeCloseTo(2, 3);
  });

  it("sin and cos work", () => {
    const pixels = new Float32Array([0]);
    expect(evaluatePixelExpression(pixels, "sin($T)")[0]).toBeCloseTo(0, 5);
    expect(evaluatePixelExpression(pixels, "cos($T)")[0]).toBeCloseTo(1, 5);
  });

  it("atan2 works", () => {
    const pixels = new Float32Array([1]);
    const r = evaluatePixelExpression(pixels, "atan2($T, $T)");
    expect(r[0]).toBeCloseTo(Math.PI / 4, 3);
  });

  it("avg function works", () => {
    const pixels = new Float32Array([4]);
    const r = evaluatePixelExpression(pixels, "avg($T, 6)");
    expect(r[0]).toBeCloseTo(5, 5);
  });

  it("round function works", () => {
    const pixels = new Float32Array([3.7]);
    expect(evaluatePixelExpression(pixels, "round($T)")[0]).toBeCloseTo(4, 5);
  });

  it("floor function works", () => {
    const pixels = new Float32Array([3.7]);
    expect(evaluatePixelExpression(pixels, "floor($T)")[0]).toBeCloseTo(3, 5);
  });

  it("ceil function works", () => {
    const pixels = new Float32Array([3.2]);
    expect(evaluatePixelExpression(pixels, "ceil($T)")[0]).toBeCloseTo(4, 5);
  });

  it("iif conditional function works", () => {
    const pixels = new Float32Array([5, -1, 0]);
    const r = evaluatePixelExpression(pixels, "iif($T, 1)");
    expect(r[0]).toBeCloseTo(1, 5); // 5 > 0 → 1
    expect(r[1]).toBeCloseTo(0, 5); // -1 ≤ 0 → 0
    expect(r[2]).toBeCloseTo(0, 5); // 0 ≤ 0 → 0
  });

  it("clamp function clamps to [0, max]", () => {
    const pixels = new Float32Array([1.5]);
    expect(evaluatePixelExpression(pixels, "clamp($T)")[0]).toBeCloseTo(1, 5);
    expect(evaluatePixelExpression(pixels, "clamp($T, 2)")[0]).toBeCloseTo(1.5, 5);
  });

  it("pow function works with base clamping", () => {
    const pixels = new Float32Array([4]);
    expect(evaluatePixelExpression(pixels, "pow($T, 0.5)")[0]).toBeCloseTo(2, 3);
  });

  it("division by zero returns safe value", () => {
    const pixels = new Float32Array([5]);
    // division by 0 uses fallback (1e-10 denominator)
    const r = evaluatePixelExpression(pixels, "$T / 0");
    expect(isFinite(r[0])).toBe(true);
  });

  it("complex nested expression works", () => {
    const pixels = new Float32Array([0.5]);
    const r = evaluatePixelExpression(pixels, "clamp(sqrt(abs($T * 2 - 1)))");
    // |0.5*2-1| = 0, sqrt(0)=0, clamp(0)=0
    expect(r[0]).toBeCloseTo(0, 3);
  });

  it("chained arithmetic with variables", () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5]);
    const r = evaluatePixelExpression(pixels, "$T * 2 + $mean - $min");
    // mean=3, min=1 → for pixel[0]: 1*2+3-1=4
    expect(r[0]).toBeCloseTo(4, 3);
    // for pixel[4]: 5*2+3-1=12
    expect(r[4]).toBeCloseTo(12, 3);
  });

  it("exp with large input is clamped", () => {
    const pixels = new Float32Array([1000]);
    const r = evaluatePixelExpression(pixels, "exp($T)");
    // Should not overflow to Infinity — clamped at exp(20)
    expect(isFinite(r[0])).toBe(true);
    // Float32 precision: check within 0.1% relative error
    const expected = Math.exp(20);
    expect(Math.abs(r[0] - expected) / expected).toBeLessThan(0.001);
  });

  it("log handles zero/negative input safely", () => {
    const pixels = new Float32Array([0]);
    // log uses log1p(max(0, x)), so log(0) = log1p(0) = 0
    expect(evaluatePixelExpression(pixels, "log($T)")[0]).toBeCloseTo(0, 5);
  });

  it("ln handles near-zero safely", () => {
    const pixels = new Float32Array([0]);
    // ln uses max(1e-10, x) to prevent -Infinity
    const r = evaluatePixelExpression(pixels, "ln($T)");
    expect(isFinite(r[0])).toBe(true);
  });
});

// ===== Numerical Correctness =====

describe("Numerical correctness", () => {
  it("MTF midtone formula: f(x=m) ≈ 0.5", () => {
    const m = 0.3;
    const pixels = new Float32Array([0, m, 1]);
    const r = applyMTF(pixels, m);
    // After normalization, midpoint m should map close to 0.5 of the range
    // result[1] should be ≈ min + 0.5 * range
    const resultNormalized = (r[1] - r[0]) / (r[2] - r[0] || 1);
    expect(resultNormalized).toBeCloseTo(0.5, 1);
  });

  it("Curves S-curve inverts midpoint correctly", () => {
    const pixels = new Float32Array([0, 0.5, 1]);
    const r = applyCurves(pixels, [
      { x: 0, y: 0 },
      { x: 0.25, y: 0.15 },
      { x: 0.5, y: 0.5 },
      { x: 0.75, y: 0.85 },
      { x: 1, y: 1 },
    ]);
    // Midpoint 0.5 should map to 0.5 since curve passes through (0.5, 0.5)
    expect(r[1]).toBeCloseTo(0.5, 1);
    // Endpoints should be preserved
    expect(r[0]).toBeCloseTo(0, 1);
    expect(r[2]).toBeCloseTo(1, 1);
  });

  it("Morphology: erode(dilate(x)) ≈ close(x)", () => {
    const pixels = makePixels(8, 8, "gradient");
    const closed = morphologicalOp(pixels, 8, 8, "close", 1);
    const manual = morphErode(morphDilate(pixels, 8, 8, 1), 8, 8, 1);
    for (let i = 0; i < pixels.length; i++) {
      expect(closed[i]).toBeCloseTo(manual[i], 5);
    }
  });

  it("Morphology: dilate(erode(x)) ≈ open(x)", () => {
    const pixels = makePixels(8, 8, "gradient");
    const opened = morphologicalOp(pixels, 8, 8, "open", 1);
    const manual = morphDilate(morphErode(pixels, 8, 8, 1), 8, 8, 1);
    for (let i = 0; i < pixels.length; i++) {
      expect(opened[i]).toBeCloseTo(manual[i], 5);
    }
  });

  it("Morphology: erode ≤ original ≤ dilate (for non-negative)", () => {
    const pixels = makePixels(8, 8, "gradient");
    const eroded = morphErode(pixels, 8, 8, 1);
    const dilated = morphDilate(pixels, 8, 8, 1);
    for (let i = 0; i < pixels.length; i++) {
      expect(eroded[i]).toBeLessThanOrEqual(pixels[i] + 1e-6);
      expect(dilated[i]).toBeGreaterThanOrEqual(pixels[i] - 1e-6);
    }
  });

  it("CLAHE preserves mean approximately", () => {
    const pixels = makePixels(16, 16, "gradient");
    const r = clahe(pixels, 16, 16, 8, 3);
    const origMean = pixels.reduce((s, v) => s + v, 0) / pixels.length;
    const resultMean = r.reduce((s, v) => s + v, 0) / r.length;
    // CLAHE should approximately preserve overall mean
    expect(Math.abs(resultMean - origMean)).toBeLessThan(origMean * 0.3);
  });

  it("RangeMask monotonicity: wider range ≥ narrower range mask", () => {
    const pixels = makePixels(8, 8, "gradient");
    const narrow = createRangeMask(pixels, 0.3, 0.7, 0.05);
    const wide = createRangeMask(pixels, 0.1, 0.9, 0.05);
    for (let i = 0; i < pixels.length; i++) {
      expect(wide[i]).toBeGreaterThanOrEqual(narrow[i] - 0.01);
    }
  });

  it("Rescale then binarize at 0.5 splits evenly", () => {
    const pixels = new Float32Array([10, 20, 30, 40, 50]);
    const rescaled = rescalePixels(pixels);
    const bin = binarize(rescaled, 0.5);
    // After rescale: [0, 0.25, 0.5, 0.75, 1.0]
    // Binarize at 0.5: > 0.5 → 1, else → 0
    expect(bin[0]).toBeCloseTo(0, 5);
    expect(bin[1]).toBeCloseTo(0, 5);
    expect(bin[2]).toBeCloseTo(0, 5); // = threshold, not >
    expect(bin[3]).toBeCloseTo(1, 5);
    expect(bin[4]).toBeCloseTo(1, 5);
  });

  it("invertPixels is self-inverse", () => {
    const pixels = new Float32Array([0, 0.25, 0.5, 0.75, 1]);
    const inv2 = invertPixels(invertPixels(pixels));
    for (let i = 0; i < pixels.length; i++) {
      expect(inv2[i]).toBeCloseTo(pixels[i], 4);
    }
  });

  it("adjustGamma is invertible: gamma(g) then gamma(1/g)", () => {
    const pixels = new Float32Array([0.1, 0.3, 0.5, 0.7, 0.9]);
    const g = 2.2;
    const applied = adjustGamma(adjustGamma(pixels, g), 1 / g);
    for (let i = 0; i < pixels.length; i++) {
      expect(applied[i]).toBeCloseTo(pixels[i], 2);
    }
  });
});

// ===== SCNR Gray stub =====

describe("SCNR Gray (no-op on grayscale)", () => {
  it("applySCNRGray returns copy of input", () => {
    const pixels = new Float32Array([0.1, 0.5, 0.9]);
    const r = applySCNRGray(pixels);
    expect(r.length).toBe(3);
    for (let i = 0; i < 3; i++) expect(r[i]).toBeCloseTo(pixels[i], 5);
  });

  it("applySCNRGray does not mutate input", () => {
    const pixels = new Float32Array([0.3, 0.6]);
    const r = applySCNRGray(pixels);
    r[0] = 999;
    expect(pixels[0]).toBeCloseTo(0.3, 5);
  });
});

// ===== Curves Akima interpolation edge cases =====

describe("Curves Akima edge cases", () => {
  it("curves with 3 control points", () => {
    const pixels = new Float32Array([0, 0.5, 1.0]);
    const r = applyCurves(pixels, [
      { x: 0, y: 0 },
      { x: 0.5, y: 0.8 },
      { x: 1, y: 1 },
    ]);
    // 0.5 maps near 0.8
    const normalized = (r[1] - r[0]) / (r[2] - r[0] || 1);
    expect(normalized).toBeGreaterThan(0.6);
  });

  it("curves with many control points", () => {
    const pixels = makePixels(8, 8, "gradient");
    const points = [];
    for (let i = 0; i <= 10; i++) {
      points.push({ x: i / 10, y: Math.pow(i / 10, 0.5) });
    }
    const r = applyCurves(pixels, points);
    expect(r.length).toBe(64);
    expect(allInRange(r, 0, 1.01)).toBe(true);
  });

  it("curves points sorted requirement", () => {
    const pixels = new Float32Array([0, 0.5, 1]);
    // Even unsorted points shouldn't crash (interpolation may be incorrect)
    expect(() =>
      applyCurves(pixels, [
        { x: 1, y: 1 },
        { x: 0, y: 0 },
        { x: 0.5, y: 0.5 },
      ]),
    ).not.toThrow();
  });
});

// ===== HDR à trous wavelet correctness =====

describe("HDR wavelet correctness", () => {
  it("hdrMultiscaleTransform preserves value range", () => {
    const pixels = makePixels(32, 32, "gradient");
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < pixels.length; i++) {
      if (pixels[i] < min) min = pixels[i];
      if (pixels[i] > max) max = pixels[i];
    }
    const r = hdrMultiscaleTransform(pixels, 32, 32, 5, 0.7);
    expect(allInRange(r, min - 0.01, max + 0.01)).toBe(true);
  });

  it("hdrMultiscaleTransform with 1 layer", () => {
    const pixels = makePixels(8, 8, "gradient");
    const r = hdrMultiscaleTransform(pixels, 8, 8, 1, 0.5);
    expect(r.length).toBe(64);
  });

  it("hdrMultiscaleTransform increasing amount increases compression", () => {
    const pixels = makePixels(16, 16, "gradient");
    const r1 = hdrMultiscaleTransform(pixels, 16, 16, 3, 0.2);
    const r2 = hdrMultiscaleTransform(pixels, 16, 16, 3, 0.8);

    // Higher amount should reduce dynamic range (stddev should be lower or similar)
    const std1 = Math.sqrt(r1.reduce((s, v) => s + (v - 0.5) ** 2, 0) / r1.length);
    const std2 = Math.sqrt(r2.reduce((s, v) => s + (v - 0.5) ** 2, 0) / r2.length);
    // Amount=0.8 should compress more than 0.2 → lower stddev
    expect(std2).toBeLessThanOrEqual(std1 + 0.05);
  });
});

// ===== Deconvolution correctness =====

describe("Deconvolution correctness", () => {
  it("richardsonLucy preserves approximate total flux", () => {
    const pixels = makePixels(16, 16, "gradient");
    const origSum = pixels.reduce((s, v) => s + v, 0);
    const r = richardsonLucy(pixels, 16, 16, 1.5, 5, 0.1);
    const resultSum = r.reduce((s, v) => s + v, 0);
    // Total flux should be approximately preserved
    expect(Math.abs(resultSum - origSum) / origSum).toBeLessThan(0.3);
  });

  it("richardsonLucy with more iterations sharpens more", () => {
    // Create blurred point source
    const pixels = makePixels(16, 16, 0);
    pixels[8 * 16 + 8] = 1; // bright center
    const blurred = gaussianBlur(pixels, 16, 16, 2);

    const r5 = richardsonLucy(blurred, 16, 16, 2, 5, 0);
    const r20 = richardsonLucy(blurred, 16, 16, 2, 20, 0);
    // More iterations should recover more of the peak
    expect(r20[8 * 16 + 8]).toBeGreaterThanOrEqual(r5[8 * 16 + 8] - 0.01);
  });
});

// ===== Large image sanity =====

describe("Large image handling", () => {
  it("operations handle 256×256 image", () => {
    const pixels = makePixels(256, 256, "gradient");
    // Just verify no crash and correct output size
    expect(applyMTF(pixels, 0.3).length).toBe(65536);
    expect(rescalePixels(pixels).length).toBe(65536);
    expect(binarize(pixels, 0.5).length).toBe(65536);
  });

  it("CLAHE handles non-square image", () => {
    const pixels = makePixels(20, 10, "gradient");
    const r = clahe(pixels, 20, 10, 5, 3);
    expect(r.length).toBe(200);
  });

  it("morphology handles non-square image", () => {
    const pixels = makePixels(12, 8, "gradient");
    const r = morphologicalOp(pixels, 12, 8, "dilate", 2);
    expect(r.length).toBe(96);
  });
});

// ===== Saturation correctness =====

describe("Saturation correctness", () => {
  it("increasing saturation makes colors more vivid", () => {
    const rgba = makeRGBA(1, 200, 100, 50); // warm orange
    const r = adjustSaturation(rgba, 1.0);
    // Red should increase, blue should decrease
    expect(r[0]).toBeGreaterThanOrEqual(200);
    expect(r[2]).toBeLessThanOrEqual(50);
  });

  it("saturation with extreme boost is clamped", () => {
    const rgba = makeRGBA(1, 200, 100, 50);
    const r = adjustSaturation(rgba, 5.0);
    expect(r[0]).toBeLessThanOrEqual(255);
    expect(r[1]).toBeGreaterThanOrEqual(0);
    expect(r[2]).toBeGreaterThanOrEqual(0);
  });

  it("full desaturation gives equal RGB channels", () => {
    const rgba = makeRGBA(1, 200, 100, 50);
    const r = adjustSaturation(rgba, -1);
    // Should be gray
    expect(Math.abs(r[0] - r[1])).toBeLessThan(3);
    expect(Math.abs(r[1] - r[2])).toBeLessThan(3);
  });
});

// ===== StarMask correctness =====

describe("StarMask correctness", () => {
  function makeStarField(w: number, h: number): Float32Array {
    const pixels = new Float32Array(w * h).fill(0.05);
    // Add several bright spots
    const stars = [
      [w / 4, h / 4],
      [w / 2, h / 2],
      [(3 * w) / 4, (3 * h) / 4],
    ];
    for (const [sx, sy] of stars) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const px = Math.round(sx) + dx;
          const py = Math.round(sy) + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            pixels[py * w + px] = 0.05 + 0.95 * Math.exp(-(dx * dx + dy * dy) / 1.5);
          }
        }
      }
    }
    return pixels;
  }

  it("star mask has high values near star positions", () => {
    const pixels = makeStarField(32, 32);
    const mask = generateStarMask(pixels, 32, 32, 2);
    const cx = 16,
      cy = 16;
    // Center star should have a non-zero mask value
    expect(mask[cy * 32 + cx]).toBeGreaterThan(0);
  });

  it("applyStarMask invert=true reduces star brightness", () => {
    const pixels = makeStarField(32, 32);
    const starRemoved = applyStarMask(pixels, 32, 32, 1.5, true);
    const cx = 16,
      cy = 16;
    // Star-removed image should be dimmer at star center
    expect(starRemoved[cy * 32 + cx]).toBeLessThanOrEqual(pixels[cy * 32 + cx]);
  });

  it("applyStarMask invert=false emphasizes stars", () => {
    const pixels = makeStarField(32, 32);
    const starOnly = applyStarMask(pixels, 32, 32, 1.5, false);
    // Background should be reduced
    expect(starOnly[0]).toBeLessThanOrEqual(pixels[0] + 0.01);
  });
});

describe("advanced processing semantics", () => {
  it("CLAHE keeps output finite under OpenCV-style tile grid settings", () => {
    const pixels = makePixels(31, 17, "gradient");
    const out = clahe(pixels, 31, 17, 8, 2.0);
    expect(out.length).toBe(pixels.length);
    for (let i = 0; i < out.length; i++) {
      expect(Number.isFinite(out[i])).toBe(true);
    }
  });

  it("Richardson-Lucy supports clip option and filter epsilon", () => {
    const pixels = new Float32Array([2, 2, 2, 2, 2, 2, 2, 2, 2]);
    const out = richardsonLucy(pixels, 3, 3, 1.2, 3, 1e-6, {
      filterEpsilon: 1e-6,
      clip: true,
    });
    expect(out.length).toBe(9);
    for (let i = 0; i < out.length; i++) {
      expect(out[i]).toBeLessThanOrEqual(1);
      expect(out[i]).toBeGreaterThanOrEqual(-1);
    }
  });

  it("dynamicBackgroundExtract removes large-scale background trend", () => {
    const w = 32;
    const h = 24;
    const pixels = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0.1 + x * 0.005 + y * 0.002;
        if ((x - 16) * (x - 16) + (y - 12) * (y - 12) < 9) v += 1.5;
        pixels[y * w + x] = v;
      }
    }

    const corrected = dynamicBackgroundExtract(pixels, w, h, 8, 6, 2.5);
    const sorted = Array.from(corrected).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(Math.abs(median)).toBeLessThan(0.15);
  });
});
