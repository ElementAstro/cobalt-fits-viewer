import { normalizeFrames } from "../normalization";

function makeFrame(base: number, count: number = 64): Float32Array {
  const arr = new Float32Array(count);
  for (let i = 0; i < count; i++) arr[i] = base + i * 2;
  return arr;
}

describe("normalization", () => {
  const ref = makeFrame(100);
  const darker = makeFrame(60);
  const brighter = makeFrame(140);

  describe("mode=none", () => {
    it("returns frames unchanged", () => {
      const { normalized, results } = normalizeFrames([ref, darker], 0, "none");
      expect(normalized[0]).toBe(ref);
      expect(normalized[1]).toBe(darker);
      expect(results[0].mode).toBe("none");
      expect(results[1].mode).toBe("none");
    });
  });

  describe("mode=additive", () => {
    it("shifts darker frame toward reference median", () => {
      const { normalized, results } = normalizeFrames([ref, darker], 0, "additive");
      expect(normalized[0]).toBe(ref);
      expect(results[0].offset).toBe(0);
      expect(results[1].offset).toBeGreaterThan(0);
      // After normalization, medians should be closer
      const refMedian = median(Array.from(ref));
      const normMedian = median(Array.from(normalized[1]));
      expect(Math.abs(normMedian - refMedian)).toBeLessThan(
        Math.abs(median(Array.from(darker)) - refMedian),
      );
    });

    it("reference frame is identity", () => {
      const { results } = normalizeFrames([ref, darker], 0, "additive");
      expect(results[0].scale).toBe(1);
      expect(results[0].offset).toBe(0);
    });
  });

  describe("mode=multiplicative", () => {
    it("scales darker frame toward reference brightness", () => {
      const { normalized, results } = normalizeFrames([ref, darker], 0, "multiplicative");
      expect(normalized[0]).toBe(ref);
      expect(results[1].scale).toBeGreaterThan(1);
      expect(results[1].offset).toBe(0);
    });

    it("reference frame is identity", () => {
      const { results } = normalizeFrames([ref, brighter], 0, "multiplicative");
      expect(results[0].scale).toBe(1);
    });
  });

  describe("mode=additive+multiplicative", () => {
    it("applies both scale and offset", () => {
      const { normalized, results } = normalizeFrames([ref, darker], 0, "additive+multiplicative");
      expect(normalized[0]).toBe(ref);
      expect(results[1].mode).toBe("additive+multiplicative");
      // At least one of scale/offset should be non-trivial
      expect(results[1].scale !== 1 || results[1].offset !== 0).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("returns empty for empty frames", () => {
      const { normalized } = normalizeFrames([], 0, "additive");
      expect(normalized).toEqual([]);
    });

    it("single frame returns unchanged", () => {
      const { normalized } = normalizeFrames([ref], 0, "additive");
      expect(normalized[0]).toBe(ref);
    });

    it("handles referenceIndex out of range", () => {
      const { normalized } = normalizeFrames([ref, darker], 99, "additive");
      // Should clamp to last frame as reference
      expect(normalized.length).toBe(2);
    });
  });
});

function median(values: number[]): number {
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}
