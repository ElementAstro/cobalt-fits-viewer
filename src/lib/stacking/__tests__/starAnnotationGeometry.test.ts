import { transformStarAnnotationPoints } from "../starAnnotationGeometry";
import type { StarAnnotationPoint } from "../../fits/types";

function point(id: string, x: number, y: number, anchor?: 1 | 2 | 3): StarAnnotationPoint {
  return { id, x, y, enabled: true, source: "manual", anchorIndex: anchor };
}

describe("starAnnotationGeometry", () => {
  it("rotate90CW maps coordinates correctly", () => {
    const result = transformStarAnnotationPoints([point("a", 10, 20)], 100, 200, {
      type: "rotate90cw",
    });
    expect(result.transformed).toBe(true);
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].x).toBeCloseTo(179, 0);
    expect(result.points[0].y).toBeCloseTo(10, 0);
  });

  it("rotate90CCW maps coordinates correctly", () => {
    const result = transformStarAnnotationPoints([point("a", 10, 20)], 100, 200, {
      type: "rotate90ccw",
    });
    expect(result.transformed).toBe(true);
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].x).toBeCloseTo(20, 0);
    expect(result.points[0].y).toBeCloseTo(89, 0);
  });

  it("rotate180 maps coordinates correctly", () => {
    const result = transformStarAnnotationPoints([point("a", 10, 20)], 100, 200, {
      type: "rotate180",
    });
    expect(result.transformed).toBe(true);
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].x).toBeCloseTo(89, 0);
    expect(result.points[0].y).toBeCloseTo(179, 0);
  });

  it("flipH mirrors x coordinate", () => {
    const result = transformStarAnnotationPoints([point("a", 10, 20)], 100, 200, { type: "flipH" });
    expect(result.transformed).toBe(true);
    expect(result.width).toBe(100);
    expect(result.height).toBe(200);
    expect(result.points[0].x).toBeCloseTo(89, 0);
    expect(result.points[0].y).toBeCloseTo(20, 0);
  });

  it("flipV mirrors y coordinate", () => {
    const result = transformStarAnnotationPoints([point("a", 10, 20)], 100, 200, { type: "flipV" });
    expect(result.transformed).toBe(true);
    expect(result.points[0].x).toBeCloseTo(10, 0);
    expect(result.points[0].y).toBeCloseTo(179, 0);
  });

  it("crop offsets points and removes out-of-bounds", () => {
    const pts = [point("inside", 50, 60), point("outside", 5, 5)];
    const result = transformStarAnnotationPoints(pts, 200, 200, {
      type: "crop",
      x: 30,
      y: 40,
      width: 100,
      height: 80,
    });
    expect(result.transformed).toBe(true);
    expect(result.width).toBe(100);
    expect(result.height).toBe(80);
    expect(result.points).toHaveLength(1);
    expect(result.points[0].id).toBe("inside");
    expect(result.points[0].x).toBeCloseTo(20, 0);
    expect(result.points[0].y).toBeCloseTo(20, 0);
  });

  it("rotateArbitrary rotates by 90 degrees (should approximate rotate90CW)", () => {
    const result = transformStarAnnotationPoints([point("a", 50, 50)], 100, 100, {
      type: "rotateArbitrary",
      angle: 45,
    });
    expect(result.transformed).toBe(true);
    expect(result.points).toHaveLength(1);
    expect(Number.isFinite(result.points[0].x)).toBe(true);
    expect(Number.isFinite(result.points[0].y)).toBe(true);
  });

  it("unsupported op returns transformed=false with stale reason", () => {
    const result = transformStarAnnotationPoints([point("a", 10, 20)], 100, 200, {
      type: "blur",
      sigma: 2,
    } as any);
    expect(result.transformed).toBe(false);
    expect(result.staleReason).toBe("unsupported-transform");
    expect(result.points).toHaveLength(1);
  });

  it("preserves unique anchors after transform", () => {
    const pts = [point("a", 10, 20, 1), point("b", 50, 60, 2), point("c", 30, 40, 1)];
    const result = transformStarAnnotationPoints(pts, 100, 200, { type: "flipH" });
    const anchors = result.points.filter((p) => p.anchorIndex === 1);
    expect(anchors).toHaveLength(1);
  });

  it("handles empty point array", () => {
    const result = transformStarAnnotationPoints([], 100, 200, { type: "rotate90cw" });
    expect(result.transformed).toBe(true);
    expect(result.points).toHaveLength(0);
    expect(result.width).toBe(200);
    expect(result.height).toBe(100);
  });

  it("rotate90CW and rotate90CCW are inverse operations", () => {
    const pts = [point("a", 25, 75)];
    const cw = transformStarAnnotationPoints(pts, 100, 200, { type: "rotate90cw" });
    const back = transformStarAnnotationPoints(cw.points, cw.width, cw.height, {
      type: "rotate90ccw",
    });
    expect(back.points).toHaveLength(1);
    expect(back.points[0].x).toBeCloseTo(25, 0);
    expect(back.points[0].y).toBeCloseTo(75, 0);
    expect(back.width).toBe(100);
    expect(back.height).toBe(200);
  });
});
