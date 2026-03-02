import {
  isFiniteNum,
  clampFinite,
  medianOfSorted,
  robustMedian,
  robustMedianFloat32,
  robustPercentile,
  percentileByRatio,
  robustMAD,
  robustSigmaClippedStats,
  robustSn,
  robustBiweightMidvariance,
} from "../robustStats";

describe("robustStats", () => {
  describe("isFiniteNum", () => {
    it("returns true for finite numbers", () => {
      expect(isFiniteNum(0)).toBe(true);
      expect(isFiniteNum(-1.5)).toBe(true);
      expect(isFiniteNum(1e10)).toBe(true);
    });

    it("returns false for non-finite values", () => {
      expect(isFiniteNum(NaN)).toBe(false);
      expect(isFiniteNum(Infinity)).toBe(false);
      expect(isFiniteNum(-Infinity)).toBe(false);
    });
  });

  describe("clampFinite", () => {
    it("returns value when finite", () => {
      expect(clampFinite(3.14, 0)).toBe(3.14);
    });

    it("returns fallback when not finite", () => {
      expect(clampFinite(NaN, 1)).toBe(1);
      expect(clampFinite(Infinity, 2)).toBe(2);
    });
  });

  describe("medianOfSorted", () => {
    it("returns 0 for empty array", () => {
      expect(medianOfSorted([])).toBe(0);
    });

    it("returns middle element (floor index)", () => {
      expect(medianOfSorted([1, 2, 3])).toBe(2);
      expect(medianOfSorted([1, 2, 3, 4])).toBe(3);
    });
  });

  describe("robustMedian", () => {
    it("returns 0 for empty array", () => {
      expect(robustMedian([])).toBe(0);
    });

    it("returns median with interpolation for even arrays", () => {
      expect(robustMedian([4, 1, 3, 2])).toBe(2.5);
    });

    it("returns middle value for odd arrays", () => {
      expect(robustMedian([5, 1, 3])).toBe(3);
    });
  });

  describe("robustMedianFloat32", () => {
    it("returns 0 for empty array", () => {
      expect(robustMedianFloat32(new Float32Array(0))).toBe(0);
    });

    it("skips NaN values", () => {
      const arr = new Float32Array([1, NaN, 3, NaN, 5]);
      const med = robustMedianFloat32(arr);
      expect(med).toBe(3);
    });

    it("works with sampling", () => {
      const arr = new Float32Array(100);
      for (let i = 0; i < 100; i++) arr[i] = i;
      const med = robustMedianFloat32(arr, 50);
      expect(med).toBeGreaterThan(30);
      expect(med).toBeLessThan(70);
    });
  });

  describe("robustPercentile", () => {
    it("returns 0 for empty array", () => {
      expect(robustPercentile([], 50)).toBe(0);
    });

    it("returns single value for single-element array", () => {
      expect(robustPercentile([42], 50)).toBe(42);
    });

    it("returns correct percentiles with interpolation", () => {
      const sorted = [10, 20, 30, 40, 50];
      expect(robustPercentile(sorted, 0)).toBe(10);
      expect(robustPercentile(sorted, 100)).toBe(50);
      expect(robustPercentile(sorted, 50)).toBe(30);
      expect(robustPercentile(sorted, 25)).toBe(20);
    });
  });

  describe("percentileByRatio", () => {
    it("returns 0 for empty array", () => {
      expect(percentileByRatio([], 0.5)).toBe(0);
    });

    it("returns value at floor index for given ratio", () => {
      const sorted = [10, 20, 30, 40, 50];
      expect(percentileByRatio(sorted, 0)).toBe(10);
      expect(percentileByRatio(sorted, 1)).toBe(50);
      expect(percentileByRatio(sorted, 0.5)).toBe(30);
    });
  });

  describe("robustMAD", () => {
    it("returns zeros for empty array", () => {
      const result = robustMAD(new Float32Array(0));
      expect(result.median).toBe(0);
      expect(result.mad).toBe(0);
      expect(result.sigma).toBe(0);
    });

    it("computes MAD and sigma for simple data", () => {
      const arr = new Float32Array([1, 2, 3, 4, 5]);
      const result = robustMAD(arr);
      expect(result.median).toBe(3);
      expect(result.mad).toBe(1);
      expect(result.sigma).toBeGreaterThan(1.4);
      expect(result.sigma).toBeLessThan(1.5);
    });

    it("handles NaN values", () => {
      const arr = new Float32Array([1, NaN, 3, NaN, 5]);
      const result = robustMAD(arr);
      expect(result.median).toBe(3);
    });
  });

  describe("robustSigmaClippedStats", () => {
    it("returns zeros for empty array", () => {
      const result = robustSigmaClippedStats([], 2);
      expect(result.median).toBe(0);
      expect(result.sigma).toBe(0);
    });

    it("returns stats for normal data", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = robustSigmaClippedStats(values, 2);
      expect(result.median).toBeGreaterThan(0);
      expect(result.sigma).toBeGreaterThan(0);
    });

    it("clips outliers", () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
      const withClip = robustSigmaClippedStats(values, 3);
      const withoutClip = robustSigmaClippedStats(values, 0);
      // Sigma should be smaller after clipping the outlier
      expect(withClip.sigma).toBeLessThanOrEqual(withoutClip.sigma);
    });
  });

  describe("robustSn", () => {
    it("returns 0 for arrays with < 2 elements", () => {
      expect(robustSn(new Float32Array(0))).toBe(0);
      expect(robustSn(new Float32Array([1]))).toBe(0);
    });

    it("returns positive value for varied data", () => {
      const arr = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const sn = robustSn(arr);
      expect(sn).toBeGreaterThan(0);
    });
  });

  describe("robustBiweightMidvariance", () => {
    it("returns 0 for empty array", () => {
      expect(robustBiweightMidvariance(new Float32Array(0))).toBe(0);
    });

    it("returns 0 for constant data", () => {
      expect(robustBiweightMidvariance(new Float32Array([5, 5, 5, 5]))).toBe(0);
    });

    it("returns positive value for varied data", () => {
      const arr = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      expect(robustBiweightMidvariance(arr)).toBeGreaterThan(0);
    });
  });
});
