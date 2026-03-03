import {
  clampCropRegion,
  moveCropRegion,
  resizeCropRegion,
  getAspectRatioValue,
  applyAspectRatio,
  resizeCropRegionWithAspect,
  type CropRegion,
} from "../cropMath";

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

describe("getAspectRatioValue", () => {
  it("returns null for free preset", () => {
    expect(getAspectRatioValue("free", 100, 80)).toBeNull();
  });

  it("returns 1 for 1:1 preset", () => {
    expect(getAspectRatioValue("1:1", 100, 80)).toBe(1);
  });

  it("returns 4/3 for 4:3 preset", () => {
    expect(getAspectRatioValue("4:3", 100, 80)).toBeCloseTo(4 / 3);
  });

  it("returns 3/2 for 3:2 preset", () => {
    expect(getAspectRatioValue("3:2", 100, 80)).toBeCloseTo(1.5);
  });

  it("returns 16/9 for 16:9 preset", () => {
    expect(getAspectRatioValue("16:9", 100, 80)).toBeCloseTo(16 / 9);
  });

  it("returns image ratio for original preset", () => {
    expect(getAspectRatioValue("original", 200, 100)).toBe(2);
    expect(getAspectRatioValue("original", 100, 200)).toBe(0.5);
  });
});

describe("applyAspectRatio", () => {
  it("returns region unchanged when aspect is null", () => {
    const region = { x: 10, y: 10, w: 50, h: 30 };
    expectRegion(applyAspectRatio(region, null, 100, 80, 20), region);
  });

  it("enforces 1:1 aspect ratio centered on original region", () => {
    const result = applyAspectRatio({ x: 10, y: 10, w: 60, h: 40 }, 1, 100, 80, 20);
    expect(result.w).toBe(result.h);
  });

  it("enforces 4:3 aspect ratio and clamps to image bounds", () => {
    const result = applyAspectRatio({ x: 0, y: 0, w: 100, h: 80 }, 4 / 3, 100, 80, 20);
    expect(result.w).toBeGreaterThanOrEqual(20);
    expect(result.h).toBeGreaterThanOrEqual(20);
    expect(result.x + result.w).toBeLessThanOrEqual(100);
    expect(result.y + result.h).toBeLessThanOrEqual(80);
    expect(Math.abs(result.w / result.h - 4 / 3)).toBeLessThan(2);
  });
});

describe("resizeCropRegionWithAspect", () => {
  it("behaves like resizeCropRegion when aspect is null", () => {
    const a = resizeCropRegion({ x: 10, y: 10, w: 40, h: 30 }, "se", 10, 5, 100, 80, 20);
    const b = resizeCropRegionWithAspect(
      { x: 10, y: 10, w: 40, h: 30 },
      "se",
      10,
      5,
      null,
      100,
      80,
      20,
    );
    expectRegion(b, a);
  });

  it("enforces aspect ratio after resize", () => {
    const result = resizeCropRegionWithAspect(
      { x: 10, y: 10, w: 40, h: 40 },
      "e",
      20,
      0,
      1,
      100,
      80,
      20,
    );
    expect(result.w).toBe(result.h);
  });

  it("clamps to image bounds with aspect ratio", () => {
    const result = resizeCropRegionWithAspect(
      { x: 50, y: 50, w: 40, h: 30 },
      "se",
      100,
      100,
      16 / 9,
      100,
      80,
      20,
    );
    expect(result.x + result.w).toBeLessThanOrEqual(100);
    expect(result.y + result.h).toBeLessThanOrEqual(80);
  });
});
