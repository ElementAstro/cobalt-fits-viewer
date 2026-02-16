import {
  extractTargetName,
  createTarget,
  autoDetectTarget,
  findTargetByNameOrAlias,
  guessTargetType,
  calculateTargetExposure,
} from "../targetManager";
import type { Target, FitsMetadata } from "../../fits/types";

// Helper to create mock targets with all required fields
function createMockTarget(overrides: Partial<Target> = {}): Target {
  const now = Date.now();
  return {
    id: "t1",
    name: "Test",
    aliases: [],
    type: "other",
    tags: [],
    isFavorite: false,
    isPinned: false,
    imageIds: [],
    status: "planned",
    plannedFilters: [],
    plannedExposure: {},
    imageRatings: {},
    changeLog: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("extractTargetName", () => {
  it("extracts object name from metadata", () => {
    expect(extractTargetName({ object: "M31" } as FitsMetadata)).toBe("M31");
  });

  it("trims whitespace", () => {
    expect(extractTargetName({ object: "  M42  " } as FitsMetadata)).toBe("M42");
  });

  it("returns null when object is missing", () => {
    expect(extractTargetName({} as FitsMetadata)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(extractTargetName({ object: "  " } as FitsMetadata)).toBeNull();
  });
});

describe("createTarget", () => {
  it("creates a target with default values", () => {
    const target = createTarget("M31");
    expect(target.name).toBe("M31");
    expect(target.type).toBe("other");
    expect(target.status).toBe("planned");
    expect(target.aliases).toEqual([]);
    expect(target.imageIds).toEqual([]);
    expect(target.id).toMatch(/^target_/);
  });

  it("creates a target with specified type", () => {
    const target = createTarget("M31", "galaxy");
    expect(target.type).toBe("galaxy");
  });

  it("sets timestamps", () => {
    const before = Date.now();
    const target = createTarget("Test");
    expect(target.createdAt).toBeGreaterThanOrEqual(before);
    expect(target.updatedAt).toBeGreaterThanOrEqual(before);
  });
});

describe("guessTargetType", () => {
  it("identifies Messier galaxies", () => {
    expect(guessTargetType("M31")).toBe("galaxy");
    expect(guessTargetType("M51")).toBe("galaxy");
    expect(guessTargetType("M101")).toBe("galaxy");
  });

  it("identifies Messier nebulae", () => {
    expect(guessTargetType("M42")).toBe("nebula");
    expect(guessTargetType("M1")).toBe("nebula");
    expect(guessTargetType("M57")).toBe("nebula");
  });

  it("identifies Messier clusters", () => {
    expect(guessTargetType("M13")).toBe("cluster");
    expect(guessTargetType("M45")).toBe("cluster");
  });

  it("handles Messier with space", () => {
    expect(guessTargetType("M 31")).toBe("galaxy");
  });

  it("identifies known NGC nebulae", () => {
    expect(guessTargetType("NGC7000")).toBe("nebula");
    expect(guessTargetType("NGC 7000")).toBe("nebula");
  });

  it("identifies known NGC galaxies", () => {
    expect(guessTargetType("NGC891")).toBe("galaxy");
  });

  it("identifies known IC objects", () => {
    expect(guessTargetType("IC1396")).toBe("nebula");
  });

  it("identifies Sharpless objects as nebulae", () => {
    expect(guessTargetType("SH2-129")).toBe("nebula");
  });

  it("identifies planets", () => {
    expect(guessTargetType("Mars")).toBe("planet");
    expect(guessTargetType("JUPITER")).toBe("planet");
  });

  it("identifies Moon", () => {
    expect(guessTargetType("Moon")).toBe("moon");
    expect(guessTargetType("Luna")).toBe("moon");
  });

  it("identifies Sun", () => {
    expect(guessTargetType("Sun")).toBe("sun");
    expect(guessTargetType("SOL")).toBe("sun");
  });

  it("identifies keyword-based types", () => {
    expect(guessTargetType("Orion Nebula")).toBe("nebula");
    expect(guessTargetType("Andromeda Galaxy")).toBe("galaxy");
    expect(guessTargetType("C/2023 A3")).toBe("comet");
  });

  it("returns other for unknown objects", () => {
    expect(guessTargetType("Unknown Target")).toBe("other");
  });
});

describe("findTargetByNameOrAlias", () => {
  const targets: Target[] = [
    createMockTarget({
      id: "t1",
      name: "M31",
      aliases: ["Andromeda Galaxy", "NGC 224"],
      type: "galaxy",
    }),
  ];

  it("finds by exact name (case-insensitive)", () => {
    expect(findTargetByNameOrAlias("m31", targets)?.id).toBe("t1");
    expect(findTargetByNameOrAlias("M31", targets)?.id).toBe("t1");
  });

  it("finds by alias", () => {
    expect(findTargetByNameOrAlias("Andromeda Galaxy", targets)?.id).toBe("t1");
    expect(findTargetByNameOrAlias("ngc 224", targets)?.id).toBe("t1");
  });

  it("returns undefined when not found", () => {
    expect(findTargetByNameOrAlias("M42", targets)).toBeUndefined();
  });
});

describe("autoDetectTarget", () => {
  const existing: Target[] = [
    createMockTarget({
      id: "t1",
      name: "M31",
      type: "galaxy",
    }),
  ];

  it("returns null when metadata has no object", () => {
    expect(autoDetectTarget({} as FitsMetadata, existing)).toBeNull();
  });

  it("matches existing target without mutation", () => {
    const result = autoDetectTarget(
      { object: "M31", ra: 10.68, dec: 41.27 } as FitsMetadata,
      existing,
    );
    expect(result?.isNew).toBe(false);
    expect(result?.target.id).toBe("t1");
    // Should not mutate existing target
    expect(existing[0].ra).toBeUndefined();
    // Should return coordinate updates separately
    expect(result?.coordinateUpdates?.ra).toBe(10.68);
    expect(result?.coordinateUpdates?.dec).toBe(41.27);
  });

  it("creates new target for unknown object", () => {
    const result = autoDetectTarget(
      { object: "NGC 7000", ra: 314.75, dec: 44.37 } as FitsMetadata,
      existing,
    );
    expect(result?.isNew).toBe(true);
    expect(result?.target.name).toBe("NGC 7000");
    expect(result?.target.ra).toBe(314.75);
  });
});

describe("calculateTargetExposure", () => {
  it("calculates exposure by filter", () => {
    const target = createMockTarget({
      id: "t1",
      name: "M31",
      type: "galaxy",
      imageIds: ["f1", "f2", "f3"],
      status: "acquiring",
    });
    const files: FitsMetadata[] = [
      { id: "f1", filter: "L", exptime: 300 } as FitsMetadata,
      { id: "f2", filter: "L", exptime: 300 } as FitsMetadata,
      { id: "f3", filter: "R", exptime: 120 } as FitsMetadata,
    ];
    const result = calculateTargetExposure(target, files);
    expect(result.L.count).toBe(2);
    expect(result.L.totalSeconds).toBe(600);
    expect(result.R.count).toBe(1);
    expect(result.R.totalSeconds).toBe(120);
  });

  it("handles files not belonging to target", () => {
    const target = createMockTarget({
      id: "t1",
      name: "M31",
      type: "galaxy",
      imageIds: ["f1"],
      status: "planned",
    });
    const files: FitsMetadata[] = [
      { id: "f1", filter: "L", exptime: 300 } as FitsMetadata,
      { id: "f2", filter: "R", exptime: 120 } as FitsMetadata,
    ];
    const result = calculateTargetExposure(target, files);
    expect(result.L.count).toBe(1);
    expect(result.R).toBeUndefined();
  });

  it("returns empty for target with no images", () => {
    const target = createMockTarget({
      id: "t1",
      name: "M31",
      type: "galaxy",
      imageIds: [],
      status: "planned",
    });
    const result = calculateTargetExposure(target, []);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
