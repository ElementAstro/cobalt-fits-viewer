import { clampCropRegion, moveCropRegion, resizeCropRegion, type CropRegion } from "../cropMath";

function expectRegion(
  actual: CropRegion,
  expected: { x: number; y: number; w: number; h: number },
) {
  expect(actual).toEqual(expected);
}

describe("cropMath", () => {
  it("clampCropRegion constrains out-of-bounds region and enforces min size", () => {
    const next = clampCropRegion({ x: -10, y: -5, w: 300, h: 10 }, 100, 80, 20);
    expectRegion(next, { x: 0, y: 0, w: 100, h: 20 });
  });

  it("moveCropRegion keeps region inside bounds", () => {
    const next = moveCropRegion({ x: 30, y: 20, w: 40, h: 30 }, 100, -50, 100, 80, 20);
    expectRegion(next, { x: 60, y: 0, w: 40, h: 30 });
  });

  it("resizeCropRegion supports corner resize (nw)", () => {
    const next = resizeCropRegion({ x: 10, y: 10, w: 40, h: 30 }, "nw", 10, 5, 100, 80, 20);
    expectRegion(next, { x: 20, y: 15, w: 30, h: 25 });
  });

  it("resizeCropRegion enforces min size for edge resize", () => {
    const next = resizeCropRegion({ x: 10, y: 10, w: 20, h: 20 }, "w", 15, 0, 100, 80, 20);
    expectRegion(next, { x: 10, y: 10, w: 20, h: 20 });
  });

  it("resizeCropRegion clamps edge resize to image boundary", () => {
    const next = resizeCropRegion({ x: 70, y: 20, w: 20, h: 20 }, "e", 20, 0, 100, 80, 20);
    expectRegion(next, { x: 70, y: 20, w: 30, h: 20 });
  });

  it("resizeCropRegion clamps corner expansion at top-left boundary", () => {
    const next = resizeCropRegion({ x: 10, y: 10, w: 40, h: 30 }, "nw", -20, -20, 100, 80, 20);
    expectRegion(next, { x: 0, y: 0, w: 50, h: 40 });
  });

  it("resizeCropRegion clamps bottom edge to image boundary", () => {
    const next = resizeCropRegion({ x: 20, y: 60, w: 30, h: 15 }, "s", 0, 20, 100, 80, 20);
    expectRegion(next, { x: 20, y: 60, w: 30, h: 20 });
  });
});
