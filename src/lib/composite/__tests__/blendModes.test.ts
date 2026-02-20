import { blendRgb, compositeLayer } from "../blendModes";

describe("composite blendModes", () => {
  it("supports multiply and screen", () => {
    const multiply = blendRgb([0.5, 0.5, 0.5], [0.2, 0.4, 0.8], "multiply");
    expect(multiply[0]).toBeCloseTo(0.1, 4);
    expect(multiply[1]).toBeCloseTo(0.2, 4);
    expect(multiply[2]).toBeCloseTo(0.4, 4);

    const screen = blendRgb([0.5, 0.5, 0.5], [0.2, 0.4, 0.8], "screen");
    expect(screen[0]).toBeCloseTo(0.6, 4);
    expect(screen[1]).toBeCloseTo(0.7, 4);
    expect(screen[2]).toBeCloseTo(0.9, 4);
  });

  it("supports non-separable color mode", () => {
    const color = blendRgb([0.2, 0.4, 0.6], [0.8, 0.1, 0.1], "color");
    expect(color[0]).toBeGreaterThanOrEqual(0);
    expect(color[1]).toBeGreaterThanOrEqual(0);
    expect(color[2]).toBeGreaterThanOrEqual(0);
    expect(color[0]).toBeLessThanOrEqual(1);
    expect(color[1]).toBeLessThanOrEqual(1);
    expect(color[2]).toBeLessThanOrEqual(1);
  });

  it("applies opacity during compositing", () => {
    const composed = compositeLayer([0, 0, 0], [1, 1, 1], "normal", 0.25);
    expect(composed[0]).toBeCloseTo(0.25, 4);
    expect(composed[1]).toBeCloseTo(0.25, 4);
    expect(composed[2]).toBeCloseTo(0.25, 4);
  });
});
