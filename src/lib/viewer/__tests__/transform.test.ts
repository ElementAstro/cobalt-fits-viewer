import {
  clampScale,
  clampTranslation,
  clampImagePoint,
  computeOneToOneScale,
  computeTranslateBounds,
  computeFitGeometry,
  imageToScreenPoint,
  remapPointBetweenSpaces,
  remapRegionBetweenSpaces,
  screenToImagePoint,
} from "../transform";

describe("viewer transform helpers", () => {
  it("computes fit geometry", () => {
    const fit = computeFitGeometry(1000, 500, 500, 500);
    expect(fit.fitScale).toBeCloseTo(0.5, 5);
    expect(fit.offsetX).toBeCloseTo(0, 5);
    expect(fit.offsetY).toBeGreaterThan(0);
  });

  it("screen<->image round trip remains stable", () => {
    const transform = {
      scale: 1.6,
      translateX: 40,
      translateY: -20,
      canvasWidth: 800,
      canvasHeight: 600,
    };
    const imagePoint = { x: 220, y: 140 };
    const screen = imageToScreenPoint(imagePoint, transform, 1000, 700);
    const restored = screenToImagePoint(screen, transform, 1000, 700);
    expect(restored.x).toBeCloseTo(imagePoint.x, 4);
    expect(restored.y).toBeCloseTo(imagePoint.y, 4);
  });

  it("clamps image point to bounds", () => {
    const p = clampImagePoint({ x: -10, y: 999 }, 300, 200);
    expect(p.x).toBe(0);
    expect(p.y).toBe(200);
  });

  it("computes one-to-one scale for width-limited and height-limited fits", () => {
    expect(computeOneToOneScale(4000, 1000, 1000, 1000)).toBeCloseTo(4, 6);
    expect(computeOneToOneScale(1000, 4000, 1000, 1000)).toBeCloseTo(4, 6);
  });

  it("clamps scale into min/max range", () => {
    expect(clampScale(8, 1, 6)).toBe(6);
    expect(clampScale(0.4, 1, 6)).toBe(1);
    expect(clampScale(3, 1, 6)).toBe(3);
  });

  it("computes translate bounds and clamps translation", () => {
    const bounds = computeTranslateBounds(2, 1000, 500, 500, 500);
    expect(bounds.maxX).toBeGreaterThan(0);
    expect(bounds.maxY).toBeGreaterThanOrEqual(0);

    const clamped = clampTranslation(9999, -9999, 2, 1000, 500, 500, 500);
    expect(clamped.x).toBeLessThanOrEqual(bounds.maxX);
    expect(clamped.x).toBeGreaterThanOrEqual(-bounds.maxX);
    expect(clamped.y).toBeLessThanOrEqual(bounds.maxY);
    expect(clamped.y).toBeGreaterThanOrEqual(-bounds.maxY);
  });

  it("remaps points and regions between source and preview spaces", () => {
    const p = remapPointBetweenSpaces({ x: 256, y: 128 }, 512, 256, 6000, 3000);
    expect(p.x).toBeCloseTo(3000, 6);
    expect(p.y).toBeCloseTo(1500, 6);

    const region = remapRegionBetweenSpaces(
      { x: 128, y: 64, w: 256, h: 128 },
      512,
      256,
      6000,
      3000,
    );
    expect(region.x).toBeCloseTo(1500, 6);
    expect(region.y).toBeCloseTo(750, 6);
    expect(region.w).toBeCloseTo(3000, 6);
    expect(region.h).toBeCloseTo(1500, 6);
  });
});
