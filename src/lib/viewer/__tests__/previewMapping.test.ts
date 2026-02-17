import { remapPointBetweenSpaces, remapRegionBetweenSpaces } from "../transform";

describe("preview/source mapping helpers", () => {
  it("maps preview point to source and back stably", () => {
    const preview = { w: 512, h: 341 };
    const source = { w: 6048, h: 4024 };
    const previewPoint = { x: 173.25, y: 140.5 };

    const sourcePoint = remapPointBetweenSpaces(
      previewPoint,
      preview.w,
      preview.h,
      source.w,
      source.h,
    );
    const restored = remapPointBetweenSpaces(sourcePoint, source.w, source.h, preview.w, preview.h);

    expect(restored.x).toBeCloseTo(previewPoint.x, 5);
    expect(restored.y).toBeCloseTo(previewPoint.y, 5);
  });

  it("maps preview region to source region proportionally", () => {
    const previewRegion = { x: 32, y: 24, w: 96, h: 80 };
    const sourceRegion = remapRegionBetweenSpaces(previewRegion, 512, 341, 6048, 4024);

    expect(sourceRegion.x).toBeCloseTo((32 / 512) * 6048, 5);
    expect(sourceRegion.y).toBeCloseTo((24 / 341) * 4024, 5);
    expect(sourceRegion.w).toBeCloseTo((96 / 512) * 6048, 5);
    expect(sourceRegion.h).toBeCloseTo((80 / 341) * 4024, 5);
  });
});
