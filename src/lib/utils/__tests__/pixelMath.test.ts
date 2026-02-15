/**
 * Unit tests for pixelMath.ts — calculateRegionHistogram and related functions
 */

import {
  calculateHistogram,
  calculateRegionHistogram,
  calculateStats,
  computeAutoStretch,
} from "../pixelMath";

// ===== Helpers =====

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

// ===== calculateHistogram =====

describe("calculateHistogram", () => {
  it("returns correct number of bins and edges", () => {
    const pixels = makePixels(10, 10, "gradient");
    const { counts, edges } = calculateHistogram(pixels, 64);
    expect(counts.length).toBe(64);
    expect(edges.length).toBe(65);
  });

  it("sum of counts equals pixel count for small images", () => {
    const pixels = makePixels(8, 8, "gradient");
    const { counts } = calculateHistogram(pixels, 16);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(64);
  });

  it("handles uniform image (all same value)", () => {
    const pixels = makePixels(4, 4, 0.5);
    const { counts, edges } = calculateHistogram(pixels, 8);
    expect(counts.length).toBe(8);
    expect(edges.length).toBe(9);
    // All pixels should be in the first bin
    expect(counts[0]).toBe(16);
  });

  it("edges span min to max", () => {
    const pixels = new Float32Array([10, 20, 30, 40, 50]);
    const { edges } = calculateHistogram(pixels, 4);
    expect(edges[0]).toBeCloseTo(10, 5);
    expect(edges[edges.length - 1]).toBeCloseTo(50, 5);
  });

  it("uses precomputedRange when provided", () => {
    const pixels = new Float32Array([0.2, 0.4, 0.6, 0.8]);
    const { edges } = calculateHistogram(pixels, 4, { min: 0, max: 1 });
    expect(edges[0]).toBeCloseTo(0, 5);
    expect(edges[edges.length - 1]).toBeCloseTo(1, 5);
  });

  it("handles single pixel", () => {
    const pixels = new Float32Array([42]);
    const { counts } = calculateHistogram(pixels, 8);
    expect(counts.length).toBe(8);
    expect(counts[0]).toBe(1);
  });

  it("handles NaN pixels gracefully", () => {
    const pixels = new Float32Array([NaN, 0.5, NaN, 1.0]);
    expect(() => calculateHistogram(pixels, 8)).not.toThrow();
  });
});

// ===== calculateRegionHistogram =====

describe("calculateRegionHistogram", () => {
  it("computes histogram for a subregion", () => {
    // 4×4 gradient image
    const pixels = makePixels(4, 4, "gradient");
    const { counts, edges } = calculateRegionHistogram(pixels, 4, 0, 0, 2, 2, 8);
    expect(counts.length).toBe(8);
    expect(edges.length).toBe(9);
    // 2×2 region = 4 pixels
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });

  it("full region equals full histogram", () => {
    const pixels = makePixels(4, 4, "gradient");
    const full = calculateHistogram(pixels, 16);
    const region = calculateRegionHistogram(pixels, 4, 0, 0, 4, 4, 16);
    expect(region.counts).toEqual(full.counts);
    expect(region.edges).toEqual(full.edges);
  });

  it("uses globalRange for consistent edges", () => {
    const pixels = makePixels(8, 8, "gradient");
    const globalRange = { min: 0, max: 1 };
    const { edges } = calculateRegionHistogram(pixels, 8, 2, 2, 3, 3, 16, globalRange);
    expect(edges[0]).toBeCloseTo(0, 5);
    expect(edges[edges.length - 1]).toBeCloseTo(1, 5);
  });

  it("handles 1×1 region", () => {
    const pixels = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const { counts } = calculateRegionHistogram(pixels, 2, 1, 0, 1, 1, 8);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(1);
  });

  it("handles uniform region", () => {
    const pixels = makePixels(4, 4, 0.5);
    const { counts } = calculateRegionHistogram(pixels, 4, 1, 1, 2, 2, 8);
    expect(counts.length).toBe(8);
    // All 4 pixels in same bin
    expect(counts[0]).toBe(4);
  });

  it("region at bottom-right corner", () => {
    const pixels = makePixels(8, 8, "gradient");
    const { counts } = calculateRegionHistogram(pixels, 8, 6, 6, 2, 2, 8);
    const total = counts.reduce((a, b) => a + b, 0);
    expect(total).toBe(4);
  });
});

// ===== calculateStats =====

describe("calculateStats", () => {
  it("computes correct min, max, mean for simple array", () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5]);
    const stats = calculateStats(pixels);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
    expect(stats.mean).toBeCloseTo(3, 5);
  });

  it("computes stdDev correctly", () => {
    const pixels = new Float32Array([2, 4, 4, 4, 5, 5, 7, 9]);
    const stats = calculateStats(pixels);
    // mean = 5, variance = 4, stdDev = 2
    expect(stats.mean).toBeCloseTo(5, 5);
    expect(stats.stddev).toBeCloseTo(2, 1);
  });

  it("handles single pixel", () => {
    const pixels = new Float32Array([42]);
    const stats = calculateStats(pixels);
    expect(stats.min).toBe(42);
    expect(stats.max).toBe(42);
    expect(stats.mean).toBeCloseTo(42, 5);
  });

  it("handles uniform image", () => {
    const pixels = makePixels(4, 4, 0.5);
    const stats = calculateStats(pixels);
    expect(stats.min).toBeCloseTo(0.5, 5);
    expect(stats.max).toBeCloseTo(0.5, 5);
    expect(stats.stddev).toBeCloseTo(0, 5);
  });
});

// ===== computeAutoStretch =====

describe("computeAutoStretch", () => {
  it("returns blackPoint < whitePoint", () => {
    const pixels = makePixels(16, 16, "gradient");
    const { blackPoint, whitePoint } = computeAutoStretch(pixels);
    expect(blackPoint).toBeLessThan(whitePoint);
  });

  it("returns values in [0, 1]", () => {
    const pixels = makePixels(16, 16, "gradient");
    const { blackPoint, whitePoint, midtone } = computeAutoStretch(pixels);
    expect(blackPoint).toBeGreaterThanOrEqual(0);
    expect(blackPoint).toBeLessThanOrEqual(1);
    expect(whitePoint).toBeGreaterThanOrEqual(0);
    expect(whitePoint).toBeLessThanOrEqual(1);
    expect(midtone).toBeGreaterThan(0);
    expect(midtone).toBeLessThan(1);
  });

  it("handles uniform image", () => {
    const pixels = makePixels(8, 8, 0.5);
    const result = computeAutoStretch(pixels);
    expect(result.blackPoint).toBeDefined();
    expect(result.whitePoint).toBeDefined();
    expect(result.midtone).toBeDefined();
  });

  it("handles empty array", () => {
    const pixels = new Float32Array(0);
    const result = computeAutoStretch(pixels);
    expect(result.blackPoint).toBe(0);
    expect(result.whitePoint).toBe(1);
    expect(result.midtone).toBe(0.5);
  });
});
