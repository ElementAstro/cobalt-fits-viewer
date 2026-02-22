import {
  ANNOTATION_TYPE_COLORS,
  ANNOTATION_TYPE_LABELS,
  ANNOTATION_TYPES_ORDERED,
  OVERLAY_COLORS,
} from "../annotationConstants";
import type { AstrometryAnnotationType } from "../types";

const ALL_TYPES: AstrometryAnnotationType[] = [
  "messier",
  "ngc",
  "ic",
  "hd",
  "bright_star",
  "star",
  "other",
];

describe("ANNOTATION_TYPE_COLORS", () => {
  it("defines a color for every annotation type", () => {
    for (const type of ALL_TYPES) {
      expect(ANNOTATION_TYPE_COLORS[type]).toBeDefined();
      expect(ANNOTATION_TYPE_COLORS[type]).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe("ANNOTATION_TYPE_LABELS", () => {
  it("defines a non-empty label for every annotation type", () => {
    for (const type of ALL_TYPES) {
      expect(ANNOTATION_TYPE_LABELS[type]).toBeDefined();
      expect(ANNOTATION_TYPE_LABELS[type].length).toBeGreaterThan(0);
    }
  });
});

describe("ANNOTATION_TYPES_ORDERED", () => {
  it("contains all annotation types exactly once", () => {
    expect([...ANNOTATION_TYPES_ORDERED].sort()).toEqual([...ALL_TYPES].sort());
    expect(new Set(ANNOTATION_TYPES_ORDERED).size).toBe(ANNOTATION_TYPES_ORDERED.length);
  });
});

describe("OVERLAY_COLORS", () => {
  it("defines coordinateGrid color as valid hex", () => {
    expect(OVERLAY_COLORS.coordinateGrid).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it("defines constellationLines color as valid hex", () => {
    expect(OVERLAY_COLORS.constellationLines).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
