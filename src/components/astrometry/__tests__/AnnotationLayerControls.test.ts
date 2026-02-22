import { createDefaultLayerVisibility, getVisibleTypes } from "../AnnotationLayerControls";

describe("createDefaultLayerVisibility", () => {
  it("returns all types visible by default", () => {
    const v = createDefaultLayerVisibility();
    expect(v.messier).toBe(true);
    expect(v.ngc).toBe(true);
    expect(v.ic).toBe(true);
    expect(v.hd).toBe(true);
    expect(v.bright_star).toBe(true);
    expect(v.star).toBe(true);
    expect(v.other).toBe(true);
  });

  it("returns a new object each time", () => {
    const a = createDefaultLayerVisibility();
    const b = createDefaultLayerVisibility();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe("getVisibleTypes", () => {
  it("returns all types when all visible", () => {
    const v = createDefaultLayerVisibility();
    const types = getVisibleTypes(v);
    expect(types).toContain("messier");
    expect(types).toContain("ngc");
    expect(types).toContain("star");
    expect(types.length).toBe(7);
  });

  it("excludes toggled-off types", () => {
    const v = { ...createDefaultLayerVisibility(), hd: false, star: false };
    const types = getVisibleTypes(v);
    expect(types).not.toContain("hd");
    expect(types).not.toContain("star");
    expect(types.length).toBe(5);
  });

  it("returns empty when all hidden", () => {
    const v = createDefaultLayerVisibility();
    for (const key of Object.keys(v)) {
      (v as Record<string, boolean>)[key] = false;
    }
    const types = getVisibleTypes(v);
    expect(types).toEqual([]);
  });
});
