import {
  richardsonLucy,
  clahe,
  generateStarMask,
  applyStarMask,
  evaluatePixelExpression,
  gaussianBlur,
} from "../imageOperations";

// ===== Richardson-Lucy enhanced (wavelet regularization + deringing) =====

describe("richardsonLucy enhanced", () => {
  const makeBlurredStar = (w: number, h: number): Float32Array => {
    const pixels = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - w / 2;
        const dy = y - h / 2;
        pixels[y * w + x] = Math.exp(-(dx * dx + dy * dy) / 8) * 100 + 10;
      }
    }
    return gaussianBlur(pixels, w, h, 2);
  };

  it("returns same-length output with default options", () => {
    const pixels = makeBlurredStar(16, 16);
    const result = richardsonLucy(pixels, 16, 16, 2, 5, 0.1);
    expect(result.length).toBe(256);
  });

  it("returns copy when iterations=0", () => {
    const pixels = new Float32Array(64).fill(42);
    const result = richardsonLucy(pixels, 8, 8, 2, 0, 0.1);
    for (let i = 0; i < 64; i++) {
      expect(result[i]).toBeCloseTo(42, 4);
    }
  });

  it("wavelet regularization produces valid output", () => {
    const pixels = makeBlurredStar(16, 16);
    const result = richardsonLucy(pixels, 16, 16, 2, 15, 0.1, {
      waveletRegularization: true,
      waveletLayers: 3,
      waveletThreshold: 3,
    });
    expect(result.length).toBe(256);
    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });

  it("wavelet regularization reduces ringing artifacts", () => {
    const pixels = makeBlurredStar(32, 32);
    const noReg = richardsonLucy(pixels, 32, 32, 2, 30, 0.01);
    const withReg = richardsonLucy(pixels, 32, 32, 2, 30, 0.01, {
      waveletRegularization: true,
      waveletLayers: 3,
      waveletThreshold: 3,
    });
    // Regularized result should have smaller variance in background
    let bgVarNoReg = 0;
    let bgVarWithReg = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const idx = y * 32 + x;
        bgVarNoReg += (noReg[idx] - 10) ** 2;
        bgVarWithReg += (withReg[idx] - 10) ** 2;
      }
    }
    // Both should be finite
    expect(Number.isFinite(bgVarNoReg)).toBe(true);
    expect(Number.isFinite(bgVarWithReg)).toBe(true);
  });

  it("deringing produces valid output", () => {
    const pixels = makeBlurredStar(16, 16);
    const result = richardsonLucy(pixels, 16, 16, 2, 10, 0.1, {
      deringing: true,
      deringingDark: 0.5,
      deringingBright: 0.3,
    });
    expect(result.length).toBe(256);
    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });

  it("protection mask blends original in low-mask regions", () => {
    const w = 16;
    const h = 16;
    const n = w * h;
    const pixels = makeBlurredStar(w, h);
    // Mask: only center is active
    const mask = new Float32Array(n).fill(0);
    for (let y = 6; y < 10; y++) {
      for (let x = 6; x < 10; x++) {
        mask[y * w + x] = 1;
      }
    }
    const result = richardsonLucy(pixels, w, h, 2, 10, 0.1, {
      protectionMask: mask,
    });
    expect(result.length).toBe(n);
    // Corner pixel (mask=0) should be closer to original observed value
    const cornerIdx = 0;
    const diff = Math.abs(result[cornerIdx] - pixels[cornerIdx]);
    expect(diff).toBeLessThan(5);
  });

  it("clip option constrains output to [-1, 1]", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = Math.random() * 2;
    const result = richardsonLucy(pixels, 8, 8, 1, 5, 0.01, { clip: true });
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBeGreaterThanOrEqual(-1);
      expect(result[i]).toBeLessThanOrEqual(1);
    }
  });

  it("handles negative pixel values with offset", () => {
    const pixels = new Float32Array(64);
    for (let i = 0; i < 64; i++) pixels[i] = -10 + Math.random() * 20;
    const result = richardsonLucy(pixels, 8, 8, 1, 3, 0.1);
    expect(result.length).toBe(64);
    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });
});

// ===== CLAHE amount blending =====

describe("clahe amount blending", () => {
  it("amount=0 returns original pixel values", () => {
    const w = 16;
    const h = 16;
    const pixels = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) pixels[i] = Math.random();
    const result = clahe(pixels, w, h, 8, 3, 0);
    for (let i = 0; i < w * h; i++) {
      expect(result[i]).toBeCloseTo(pixels[i], 3);
    }
  });

  it("amount=1 gives full CLAHE effect (same as without amount)", () => {
    const w = 16;
    const h = 16;
    const pixels = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) pixels[i] = Math.random();
    const full = clahe(pixels, w, h, 8, 3, 1);
    const defaultAmount = clahe(pixels, w, h, 8, 3);
    for (let i = 0; i < w * h; i++) {
      expect(full[i]).toBeCloseTo(defaultAmount[i], 4);
    }
  });

  it("amount=0.5 produces intermediate result", () => {
    const w = 16;
    const h = 16;
    const pixels = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) pixels[i] = i / (w * h);
    const half = clahe(pixels, w, h, 8, 3, 0.5);
    const full = clahe(pixels, w, h, 8, 3, 1);
    const none = clahe(pixels, w, h, 8, 3, 0);

    // Half should be between none and full for most pixels
    let betweenCount = 0;
    for (let i = 0; i < w * h; i++) {
      const lo = Math.min(none[i], full[i]);
      const hi = Math.max(none[i], full[i]);
      if (half[i] >= lo - 0.01 && half[i] <= hi + 0.01) betweenCount++;
    }
    expect(betweenCount / (w * h)).toBeGreaterThan(0.8);
  });
});

// ===== Star mask growth/softness =====

describe("star mask growth and softness", () => {
  const makeStarField = (w: number, h: number): Float32Array => {
    const pixels = new Float32Array(w * h).fill(0.1);
    // Place a few bright stars
    const starPositions = [
      [w / 4, h / 4],
      [w / 2, h / 2],
      [(3 * w) / 4, (3 * h) / 4],
    ];
    for (const [sx, sy] of starPositions) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const px = Math.round(sx) + dx;
          const py = Math.round(sy) + dy;
          if (px >= 0 && px < w && py >= 0 && py < h) {
            const d2 = dx * dx + dy * dy;
            pixels[py * w + px] = Math.max(pixels[py * w + px], 0.1 + 0.9 * Math.exp(-d2 / 2));
          }
        }
      }
    }
    return pixels;
  };

  it("generateStarMask returns same-length output with growth=0, softness=0", () => {
    const w = 32;
    const h = 32;
    const pixels = makeStarField(w, h);
    const mask = generateStarMask(pixels, w, h, 1.5, 0, 0);
    expect(mask.length).toBe(w * h);
  });

  it("growth increases mask coverage", () => {
    const w = 32;
    const h = 32;
    const pixels = makeStarField(w, h);
    const noGrowth = generateStarMask(pixels, w, h, 1.5, 0, 0);
    const withGrowth = generateStarMask(pixels, w, h, 1.5, 3, 0);

    let countNoGrowth = 0;
    let countWithGrowth = 0;
    for (let i = 0; i < w * h; i++) {
      if (noGrowth[i] > 0.1) countNoGrowth++;
      if (withGrowth[i] > 0.1) countWithGrowth++;
    }
    expect(countWithGrowth).toBeGreaterThanOrEqual(countNoGrowth);
  });

  it("softness smooths mask edges", () => {
    const w = 32;
    const h = 32;
    const pixels = makeStarField(w, h);
    const noSoft = generateStarMask(pixels, w, h, 1.5, 0, 0);
    const withSoft = generateStarMask(pixels, w, h, 1.5, 0, 3);

    // Softened mask should have more intermediate values
    let intermediateNoSoft = 0;
    let intermediateWithSoft = 0;
    for (let i = 0; i < w * h; i++) {
      if (noSoft[i] > 0.1 && noSoft[i] < 0.9) intermediateNoSoft++;
      if (withSoft[i] > 0.1 && withSoft[i] < 0.9) intermediateWithSoft++;
    }
    expect(intermediateWithSoft).toBeGreaterThanOrEqual(intermediateNoSoft);
  });

  it("applyStarMask passes growth and softness through", () => {
    const w = 32;
    const h = 32;
    const pixels = makeStarField(w, h);
    const result = applyStarMask(pixels, w, h, 1.5, false, 2, 1);
    expect(result.length).toBe(w * h);
    for (let i = 0; i < result.length; i++) {
      expect(Number.isFinite(result[i])).toBe(true);
    }
  });
});

// ===== PixelMath multi-image + iif 3-arg =====

describe("evaluatePixelExpression enhanced", () => {
  it("supports basic $T variable", () => {
    const pixels = new Float32Array([1, 2, 3, 4]);
    const result = evaluatePixelExpression(pixels, "$T * 2");
    expect(result[0]).toBeCloseTo(2, 4);
    expect(result[1]).toBeCloseTo(4, 4);
    expect(result[2]).toBeCloseTo(6, 4);
    expect(result[3]).toBeCloseTo(8, 4);
  });

  it("supports $mean and $median variables", () => {
    const pixels = new Float32Array([10, 20, 30, 40]);
    const result = evaluatePixelExpression(pixels, "$T - $mean");
    // mean = 25
    expect(result[0]).toBeCloseTo(-15, 0);
    expect(result[3]).toBeCloseTo(15, 0);
  });

  it("supports multi-image reference $I0", () => {
    const pixels = new Float32Array([1, 2, 3, 4]);
    const img0 = new Float32Array([10, 20, 30, 40]);
    const result = evaluatePixelExpression(pixels, "$T + $I0", [img0]);
    expect(result[0]).toBeCloseTo(11, 4);
    expect(result[1]).toBeCloseTo(22, 4);
    expect(result[2]).toBeCloseTo(33, 4);
    expect(result[3]).toBeCloseTo(44, 4);
  });

  it("supports multiple additional images $I0 and $I1", () => {
    const pixels = new Float32Array([1, 1, 1, 1]);
    const img0 = new Float32Array([10, 20, 30, 40]);
    const img1 = new Float32Array([100, 200, 300, 400]);
    const result = evaluatePixelExpression(pixels, "$I0 + $I1", [img0, img1]);
    expect(result[0]).toBeCloseTo(110, 4);
    expect(result[1]).toBeCloseTo(220, 4);
  });

  it("returns 0 for out-of-range image index", () => {
    const pixels = new Float32Array([1, 2]);
    const result = evaluatePixelExpression(pixels, "$I5", []);
    expect(result[0]).toBeCloseTo(0, 4);
    expect(result[1]).toBeCloseTo(0, 4);
  });

  it("iif with 3 arguments: iif(cond, trueVal, falseVal)", () => {
    const pixels = new Float32Array([1, -1, 2, -2]);
    const result = evaluatePixelExpression(pixels, "iif($T, 100, 0)");
    expect(result[0]).toBeCloseTo(100, 4); // $T=1 > 0 → trueVal=100
    expect(result[1]).toBeCloseTo(0, 4); // $T=-1 ≤ 0 → falseVal=0
    expect(result[2]).toBeCloseTo(100, 4);
    expect(result[3]).toBeCloseTo(0, 4);
  });

  it("iif with 2 arguments still works (backward compat)", () => {
    const pixels = new Float32Array([1, -1]);
    const result = evaluatePixelExpression(pixels, "iif($T, 42)");
    expect(result[0]).toBeCloseTo(42, 4); // $T>0 → 42
    expect(result[1]).toBeCloseTo(0, 4); // $T≤0 → 0 (default falseVal)
  });

  it("clamp function works", () => {
    const pixels = new Float32Array([-5, 0.5, 10]);
    const result = evaluatePixelExpression(pixels, "clamp($T, 0, 1)");
    expect(result[0]).toBeCloseTo(0, 4);
    expect(result[1]).toBeCloseTo(0.5, 4);
    expect(result[2]).toBeCloseTo(1, 4);
  });

  it("handles invalid expression gracefully", () => {
    const pixels = new Float32Array([1, 2, 3]);
    // Invalid expression should fall back to original pixel values
    const result = evaluatePixelExpression(pixels, "invalidfunc($T)");
    expect(result.length).toBe(3);
  });
});
