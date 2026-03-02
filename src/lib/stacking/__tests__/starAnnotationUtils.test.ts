import {
  STAR_ANNOTATION_EPS,
  isFinitePoint,
  distance2,
  findNearestIndex,
  ensureUniqueAnchors,
  clampToImage,
  createPointId,
} from "../starAnnotationUtils";
import type { StarAnnotationPoint } from "../../fits/types";

function point(id: string, x: number, y: number, anchor?: 1 | 2 | 3): StarAnnotationPoint {
  return { id, x, y, enabled: true, source: "manual", anchorIndex: anchor };
}

describe("starAnnotationUtils", () => {
  it("exports a positive epsilon constant", () => {
    expect(STAR_ANNOTATION_EPS).toBeGreaterThan(0);
    expect(STAR_ANNOTATION_EPS).toBeLessThan(1e-6);
  });

  describe("isFinitePoint", () => {
    it("returns true for finite coordinates", () => {
      expect(isFinitePoint({ x: 0, y: 0 })).toBe(true);
      expect(isFinitePoint({ x: 10.5, y: -3.2 })).toBe(true);
    });

    it("returns false for non-finite coordinates", () => {
      expect(isFinitePoint({ x: NaN, y: 0 })).toBe(false);
      expect(isFinitePoint({ x: 0, y: Infinity })).toBe(false);
      expect(isFinitePoint({ x: -Infinity, y: 5 })).toBe(false);
    });
  });

  describe("distance2", () => {
    it("returns squared distance between two points", () => {
      expect(distance2({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
      expect(distance2({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
    });
  });

  describe("findNearestIndex", () => {
    it("finds nearest candidate within radius", () => {
      const candidates = [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
        { x: 15, y: 15 },
      ];
      const idx = findNearestIndex({ x: 14, y: 14 }, candidates, new Set(), 5);
      expect(idx).toBe(2);
    });

    it("returns -1 when no candidate in radius", () => {
      const candidates = [{ x: 100, y: 100 }];
      const idx = findNearestIndex({ x: 0, y: 0 }, candidates, new Set(), 5);
      expect(idx).toBe(-1);
    });

    it("skips used indices", () => {
      const candidates = [
        { x: 1, y: 1 },
        { x: 2, y: 2 },
      ];
      const idx = findNearestIndex({ x: 1, y: 1 }, candidates, new Set([0]), 5);
      expect(idx).toBe(1);
    });
  });

  describe("ensureUniqueAnchors", () => {
    it("keeps first point with each anchor index", () => {
      const pts = [point("a", 0, 0, 1), point("b", 5, 5, 1), point("c", 10, 10, 2)];
      const result = ensureUniqueAnchors(pts);
      expect(result[0].anchorIndex).toBe(1);
      expect(result[1].anchorIndex).toBeUndefined();
      expect(result[2].anchorIndex).toBe(2);
    });

    it("preserves points without anchors", () => {
      const pts = [point("a", 0, 0), point("b", 5, 5)];
      const result = ensureUniqueAnchors(pts);
      expect(result).toHaveLength(2);
      expect(result[0].anchorIndex).toBeUndefined();
    });
  });

  describe("clampToImage", () => {
    it("keeps points inside bounds", () => {
      const pts = [point("a", 5, 5), point("b", 50, 50)];
      const result = clampToImage(pts, 100, 100);
      expect(result).toHaveLength(2);
    });

    it("removes points outside bounds", () => {
      const pts = [point("a", -1, 5), point("b", 5, 100), point("c", 100, 5)];
      const result = clampToImage(pts, 100, 100);
      expect(result).toHaveLength(0);
    });

    it("removes points with non-finite coords", () => {
      const pts = [{ ...point("a", NaN, 5) }];
      const result = clampToImage(pts, 100, 100);
      expect(result).toHaveLength(0);
    });
  });

  describe("createPointId", () => {
    it("creates unique IDs with correct prefix", () => {
      const id1 = createPointId("d", 10.5, 20.3);
      const id2 = createPointId("m", 10.5, 20.3);
      expect(id1).toMatch(/^d_/);
      expect(id2).toMatch(/^m_/);
      expect(id1).not.toBe(id2);
    });

    it("encodes coordinates in the ID", () => {
      const id = createPointId("d", 12.345, 67.891);
      expect(id).toContain("1235");
      expect(id).toContain("6789");
    });
  });
});
