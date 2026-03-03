import {
  integrateFrames,
  averageStrategy,
  medianStrategy,
  sigmaClipStrategy,
  winsorizedSigmaClipStrategy,
  minStrategy,
  maxStrategy,
  weightedAverageStrategy,
  percentileClipStrategy,
  linearFitClipStrategy,
  esdStrategy,
  averagedSigmaClipStrategy,
} from "../integration";

function makeFrames(...rows: number[][]): Float32Array[] {
  return rows.map((r) => new Float32Array(r));
}

describe("integrateFrames", () => {
  describe("empty input", () => {
    it("returns empty for no frames", () => {
      const result = integrateFrames([], { strategy: averageStrategy() });
      expect(result.pixels.length).toBe(0);
      expect(result.stats.pixelCount).toBe(0);
    });
  });

  describe("averageStrategy", () => {
    it("computes per-pixel mean", () => {
      const frames = makeFrames([2, 4], [4, 6], [6, 8]);
      const { pixels } = integrateFrames(frames, { strategy: averageStrategy() });
      expect(pixels[0]).toBeCloseTo(4, 5);
      expect(pixels[1]).toBeCloseTo(6, 5);
    });

    it("skips NaN values", () => {
      const frames = makeFrames([2, NaN], [4, 6]);
      const { pixels } = integrateFrames(frames, { strategy: averageStrategy() });
      expect(pixels[0]).toBeCloseTo(3, 5);
      expect(pixels[1]).toBeCloseTo(6, 5);
    });

    it("returns NaN when all values are NaN", () => {
      const frames = makeFrames([NaN], [NaN]);
      const { pixels } = integrateFrames(frames, { strategy: averageStrategy() });
      expect(Number.isNaN(pixels[0])).toBe(true);
    });
  });

  describe("medianStrategy", () => {
    it("computes per-pixel median", () => {
      const frames = makeFrames([1, 10], [5, 20], [9, 30]);
      const { pixels } = integrateFrames(frames, { strategy: medianStrategy() });
      expect(pixels[0]).toBeCloseTo(5, 5);
      expect(pixels[1]).toBeCloseTo(20, 5);
    });
  });

  describe("sigmaClipStrategy", () => {
    it("rejects outliers", () => {
      const frames = makeFrames([10], [10], [10], [10], [10], [10], [10], [10], [10], [100]);
      const { pixels, stats } = integrateFrames(frames, {
        strategy: sigmaClipStrategy(2, 2),
        context: { sigmaLow: 2, sigmaHigh: 2, iterations: 3, params: {} },
      });
      expect(pixels[0]).toBeCloseTo(10, 0);
      expect(stats.totalRejectedHigh).toBeGreaterThan(0);
    });

    it("supports asymmetric sigma", () => {
      const frames = makeFrames([10], [10], [10], [1], [100]);
      const { stats: sym } = integrateFrames(frames, {
        strategy: sigmaClipStrategy(2, 2),
        context: { sigmaLow: 2, sigmaHigh: 2, iterations: 3, params: {} },
      });
      const { stats: asym } = integrateFrames(frames, {
        strategy: sigmaClipStrategy(10, 2),
        context: { sigmaLow: 10, sigmaHigh: 2, iterations: 3, params: {} },
      });
      // With high sigmaLow, fewer low-end rejections
      expect(asym.totalRejectedLow).toBeLessThanOrEqual(sym.totalRejectedLow);
    });
  });

  describe("winsorizedSigmaClipStrategy", () => {
    it("clamps rather than rejects", () => {
      const frames = makeFrames([10], [10], [10], [10], [100]);
      const { pixels } = integrateFrames(frames, {
        strategy: winsorizedSigmaClipStrategy(2, 2),
        context: { sigmaLow: 2, sigmaHigh: 2, iterations: 3, params: {} },
      });
      expect(pixels[0]).toBeLessThan(30);
    });
  });

  describe("minStrategy", () => {
    it("returns minimum", () => {
      const frames = makeFrames([5, 1], [3, 9]);
      const { pixels } = integrateFrames(frames, { strategy: minStrategy() });
      expect(pixels[0]).toBe(3);
      expect(pixels[1]).toBe(1);
    });
  });

  describe("maxStrategy", () => {
    it("returns maximum", () => {
      const frames = makeFrames([5, 1], [3, 9]);
      const { pixels } = integrateFrames(frames, { strategy: maxStrategy() });
      expect(pixels[0]).toBe(5);
      expect(pixels[1]).toBe(9);
    });
  });

  describe("weightedAverageStrategy", () => {
    it("applies weights correctly", () => {
      const frames = makeFrames([10], [20]);
      const { pixels } = integrateFrames(frames, {
        strategy: weightedAverageStrategy([1, 3]),
      });
      // (10*1 + 20*3) / (1+3) = 70/4 = 17.5
      expect(pixels[0]).toBeCloseTo(17.5, 5);
    });

    it("handles NaN with correct weight mapping", () => {
      const frames = makeFrames([NaN, 10], [20, NaN], [30, 30]);
      const { pixels } = integrateFrames(frames, {
        strategy: weightedAverageStrategy([1, 2, 3]),
      });
      // pixel[0]: frame1=NaN, frame2=20 (w=2), frame3=30 (w=3) => (20*2+30*3)/(2+3) = 130/5 = 26
      expect(pixels[0]).toBeCloseTo(26, 5);
      // pixel[1]: frame1=10 (w=1), frame2=NaN, frame3=30 (w=3) => (10*1+30*3)/(1+3) = 100/4 = 25
      expect(pixels[1]).toBeCloseTo(25, 5);
    });
  });

  describe("range rejection", () => {
    it("excludes values outside range", () => {
      const frames = makeFrames([0.5, 0.01], [0.5, 0.99]);
      const { pixels } = integrateFrames(frames, {
        strategy: averageStrategy(),
        rangeLow: 0.1,
        rangeHigh: 0.9,
      });
      expect(pixels[0]).toBeCloseTo(0.5, 5);
      // pixel[1]: 0.01 excluded (< 0.1), 0.99 excluded (> 0.9) => NaN
      expect(Number.isNaN(pixels[1])).toBe(true);
    });
  });

  describe("rejection map", () => {
    it("generates low/high rejection counts", () => {
      const frames = makeFrames([10], [10], [10], [10], [10], [10], [10], [10], [10], [100]);
      const result = integrateFrames(frames, {
        strategy: sigmaClipStrategy(2, 2),
        context: { sigmaLow: 2, sigmaHigh: 2, iterations: 3, params: {} },
        generateRejectionMap: true,
      });
      expect(result.rejectionMap).toBeDefined();
      expect(result.rejectionMap!.high[0]).toBeGreaterThan(0);
    });

    it("does not generate map when not requested", () => {
      const frames = makeFrames([10], [20]);
      const result = integrateFrames(frames, {
        strategy: averageStrategy(),
        generateRejectionMap: false,
      });
      expect(result.rejectionMap).toBeUndefined();
    });
  });

  describe("percentileClipStrategy", () => {
    it("clips extreme values", () => {
      const frames = makeFrames([1], [5], [5], [5], [100]);
      const { pixels } = integrateFrames(frames, {
        strategy: percentileClipStrategy(20, 80),
      });
      // Should exclude the 1 and 100 and average the middle
      expect(pixels[0]).toBeCloseTo(5, 0);
    });
  });

  describe("linearFitClipStrategy", () => {
    it("returns reasonable result for uniform data", () => {
      const frames = makeFrames([10], [10], [10], [10], [10]);
      const { pixels } = integrateFrames(frames, {
        strategy: linearFitClipStrategy(),
        context: { sigmaLow: 2.5, sigmaHigh: 2.5, iterations: 3, params: {} },
      });
      expect(pixels[0]).toBeCloseTo(10, 1);
    });
  });

  describe("esdStrategy", () => {
    it("handles small data gracefully", () => {
      const frames = makeFrames([10], [20]);
      const { pixels } = integrateFrames(frames, {
        strategy: esdStrategy(),
        context: {
          sigmaLow: 2.5,
          sigmaHigh: 2.5,
          iterations: 3,
          params: { significance: 0.05, maxOutliers: 0.3, relaxation: 1.5 },
        },
      });
      expect(Number.isFinite(pixels[0])).toBe(true);
    });

    it("detects outlier in larger dataset", () => {
      const frames = makeFrames([10], [10], [10], [10], [10], [10], [10], [10], [10], [100]);
      const { pixels, stats } = integrateFrames(frames, {
        strategy: esdStrategy(),
        context: {
          sigmaLow: 2.5,
          sigmaHigh: 2.5,
          iterations: 3,
          params: { significance: 0.05, maxOutliers: 0.3, relaxation: 1.5 },
        },
      });
      // Should reject the 100 outlier
      expect(pixels[0]).toBeLessThan(20);
      expect(stats.totalRejectedHigh).toBeGreaterThan(0);
    });
  });

  describe("averagedSigmaClipStrategy", () => {
    it("uses Poisson noise model", () => {
      const frames = makeFrames([100], [100], [100], [100], [200]);
      const { pixels } = integrateFrames(frames, {
        strategy: averagedSigmaClipStrategy(2, 2),
        context: { sigmaLow: 2, sigmaHigh: 2, iterations: 3, params: {} },
      });
      expect(pixels[0]).toBeCloseTo(100, 0);
    });
  });
});
