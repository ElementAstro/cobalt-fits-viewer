import {
  clampScale,
  clampTranslation,
  clampImagePoint,
  computeIncrementalPinchTranslation,
  computeOneToOneScale,
  computeTranslateBounds,
  computeFitGeometry,
  imageToScreenPoint,
  remapPointBetweenSpaces,
  remapRegionBetweenSpaces,
  screenToImagePoint,
  screenToSourcePixel,
  zoomAroundCenter,
  zoomAroundPoint,
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

  it("keeps focal point stable when zooming around a point", () => {
    const next = zoomAroundPoint(120, 80, 1.5, 2.4, -30, 14);
    const localBeforeX = (120 - -30) / 1.5;
    const localBeforeY = (80 - 14) / 1.5;
    const localAfterX = (120 - next.x) / 2.4;
    const localAfterY = (80 - next.y) / 2.4;
    expect(localAfterX).toBeCloseTo(localBeforeX, 6);
    expect(localAfterY).toBeCloseTo(localBeforeY, 6);
  });

  it("applies incremental pinch translation with focal movement", () => {
    const next = computeIncrementalPinchTranslation(140, 110, 132, 102, 1.2, 1.6, -20, 30);
    const expectedFromZoomOnly = zoomAroundPoint(140, 110, 1.2, 1.6, -20, 30);
    expect(next.x).toBeCloseTo(expectedFromZoomOnly.x + 8, 6);
    expect(next.y).toBeCloseTo(expectedFromZoomOnly.y + 8, 6);
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

  it("returns non-finite fitScale for zero-size image", () => {
    const fit = computeFitGeometry(0, 0, 500, 500);
    expect(Number.isFinite(fit.fitScale)).toBe(false);
  });

  it("returns zero fitScale for zero-size canvas", () => {
    const fit = computeFitGeometry(100, 100, 0, 0);
    expect(fit.fitScale).toBe(0);
  });

  it("guards against currentScale=0 in zoomAroundPoint", () => {
    const next = zoomAroundPoint(100, 100, 0, 2, 0, 0);
    expect(Number.isFinite(next.x)).toBe(true);
    expect(Number.isFinite(next.y)).toBe(true);
  });

  it("clamps translation when scale < 1 (image smaller than canvas)", () => {
    const clamped = clampTranslation(100, 100, 0.5, 100, 100, 200, 200);
    expect(clamped.x).toBe(0);
    expect(clamped.y).toBe(0);
  });

  it("zooms around canvas center with zoomAroundCenter", () => {
    const result = zoomAroundCenter(1, 2, 0, 0, 800, 600);
    expect(result.x).toBeCloseTo(-400, 6);
    expect(result.y).toBeCloseTo(-300, 6);
  });

  it("converts screen tap to source pixel via screenToSourcePixel", () => {
    const transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      canvasWidth: 200,
      canvasHeight: 100,
    };
    const pixel = screenToSourcePixel(40, 20, transform, 100, 50, 1000, 500);
    expect(pixel).not.toBeNull();
    expect(pixel!.x).toBe(205);
    expect(pixel!.y).toBe(105);
  });

  it("returns null from screenToSourcePixel for out-of-bounds tap", () => {
    const transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      canvasWidth: 200,
      canvasHeight: 100,
    };
    expect(screenToSourcePixel(-10, -10, transform, 100, 50, 100, 50)).toBeNull();
  });

  it("returns null from screenToSourcePixel when fitScale is zero", () => {
    const transform = { scale: 1, translateX: 0, translateY: 0, canvasWidth: 0, canvasHeight: 0 };
    expect(screenToSourcePixel(50, 50, transform, 100, 100, 100, 100)).toBeNull();
  });

  it("zoomAroundCenter preserves viewport center stability", () => {
    const tx = -60;
    const ty = 30;
    const cw = 800;
    const ch = 600;
    const centerX = cw / 2;
    const centerY = ch / 2;

    const localBeforeX = (centerX - tx) / 2;
    const localBeforeY = (centerY - ty) / 2;

    const result = zoomAroundCenter(2, 4, tx, ty, cw, ch);

    const localAfterX = (centerX - result.x) / 4;
    const localAfterY = (centerY - result.y) / 4;

    expect(localAfterX).toBeCloseTo(localBeforeX, 6);
    expect(localAfterY).toBeCloseTo(localBeforeY, 6);
  });

  it("screenToSourcePixel identity remap when source == image dimensions", () => {
    const transform = {
      scale: 1,
      translateX: 0,
      translateY: 0,
      canvasWidth: 200,
      canvasHeight: 100,
    };
    const pixel = screenToSourcePixel(40, 20, transform, 100, 50, 100, 50);
    expect(pixel).not.toBeNull();
    expect(pixel!.x).toBe(20);
    expect(pixel!.y).toBe(10);
  });

  it("screenToSourcePixel works with non-unit scale and translate", () => {
    const transform = {
      scale: 2,
      translateX: -50,
      translateY: -25,
      canvasWidth: 400,
      canvasHeight: 200,
    };
    const pixel = screenToSourcePixel(150, 75, transform, 200, 100, 200, 100);
    expect(pixel).not.toBeNull();
    expect(pixel!.x).toBeGreaterThanOrEqual(0);
    expect(pixel!.x).toBeLessThan(200);
    expect(pixel!.y).toBeGreaterThanOrEqual(0);
    expect(pixel!.y).toBeLessThan(100);
  });

  it("zoomAroundCenter with zoom out returns translate closer to zero", () => {
    const result = zoomAroundCenter(3, 1, -800, -600, 800, 600);
    expect(Math.abs(result.x)).toBeLessThan(800);
    expect(Math.abs(result.y)).toBeLessThan(600);
  });
});
