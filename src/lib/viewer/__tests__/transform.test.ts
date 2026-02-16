import {
  clampImagePoint,
  computeFitGeometry,
  imageToScreenPoint,
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
});
