import { normalizeName, findKnownAliases, matchTargetByName, mergeTargets } from "../targetMatcher";
import type { Target } from "../../fits/types";

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

describe("normalizeName", () => {
  it("trims whitespace", () => {
    expect(normalizeName("  M31  ")).toBe("M 31");
  });

  it("normalizes M prefix with number", () => {
    expect(normalizeName("m31")).toBe("M 31");
    expect(normalizeName("M31")).toBe("M 31");
    expect(normalizeName("M 31")).toBe("M 31");
  });

  it("normalizes NGC prefix", () => {
    expect(normalizeName("ngc7000")).toBe("NGC 7000");
    expect(normalizeName("NGC 7000")).toBe("NGC 7000");
  });

  it("normalizes IC prefix", () => {
    expect(normalizeName("ic1396")).toBe("IC 1396");
  });

  it("collapses multiple spaces", () => {
    expect(normalizeName("Orion   Nebula")).toBe("Orion Nebula");
  });
});

describe("findKnownAliases", () => {
  it("finds aliases via common name (exact match)", () => {
    const aliases = findKnownAliases("Andromeda Galaxy");
    expect(aliases).toContain("M31");
    expect(aliases).toContain("NGC 224");
    expect(aliases).not.toContain("Andromeda Galaxy");
  });

  it("finds aliases via common name for Orion", () => {
    const aliases = findKnownAliases("Orion Nebula");
    expect(aliases).toContain("M42");
  });

  it("returns empty for unknown objects", () => {
    expect(findKnownAliases("Unknown Object")).toEqual([]);
  });

  it("is case-insensitive for common names", () => {
    const aliases = findKnownAliases("orion nebula");
    expect(aliases.length).toBeGreaterThan(0);
  });

  it("finds aliases for NGC entries", () => {
    const aliases = findKnownAliases("NGC 7000");
    expect(aliases).toContain("North America Nebula");
  });
});

describe("matchTargetByName", () => {
  const targets: Target[] = [
    createMockTarget({
      id: "t1",
      name: "M31",
      aliases: ["Andromeda Galaxy"],
      type: "galaxy",
    }),
    createMockTarget({
      id: "t2",
      name: "M42",
      aliases: [],
      type: "nebula",
      status: "acquiring",
    }),
  ];

  it("matches by direct name", () => {
    expect(matchTargetByName("M31", targets)?.id).toBe("t1");
  });

  it("matches by alias", () => {
    expect(matchTargetByName("Andromeda Galaxy", targets)?.id).toBe("t1");
  });

  it("matches by known alias not stored on target", () => {
    expect(matchTargetByName("NGC 224", targets)?.id).toBe("t1");
  });

  it("matches case-insensitively", () => {
    expect(matchTargetByName("m31", targets)?.id).toBe("t1");
  });

  it("returns null for unmatched name", () => {
    expect(matchTargetByName("NGC 7000", targets)).toBeNull();
  });
});

describe("mergeTargets", () => {
  it("merges source into dest", () => {
    const dest = createMockTarget({
      id: "t1",
      name: "M31",
      aliases: ["NGC 224"],
      type: "galaxy",
      imageIds: ["f1", "f2"],
      status: "acquiring",
      plannedFilters: ["L"],
      plannedExposure: { L: 3600 },
      createdAt: 100,
      updatedAt: 200,
    });
    const source = createMockTarget({
      id: "t2",
      name: "Andromeda Galaxy",
      aliases: ["Andromeda"],
      type: "galaxy",
      imageIds: ["f3", "f1"],
      status: "planned",
      plannedFilters: ["R", "L"],
      plannedExposure: { R: 1800, L: 1800 },
      createdAt: 150,
      updatedAt: 250,
    });

    const merged = mergeTargets(dest, source);

    expect(merged.id).toBe("t1");
    expect(merged.name).toBe("M31");
    expect(merged.aliases).toContain("NGC 224");
    expect(merged.aliases).toContain("Andromeda Galaxy");
    expect(merged.aliases).toContain("Andromeda");
    expect(merged.aliases).not.toContain("M31");
  });

  it("deduplicates imageIds", () => {
    const dest = createMockTarget({
      id: "t1",
      name: "A",
      imageIds: ["f1", "f2"],
    });
    const source = createMockTarget({
      id: "t2",
      name: "B",
      imageIds: ["f2", "f3"],
    });

    const merged = mergeTargets(dest, source);
    expect(merged.imageIds).toEqual(["f1", "f2", "f3"]);
  });

  it("takes max exposure per filter", () => {
    const dest = createMockTarget({
      id: "t1",
      name: "A",
      plannedFilters: ["L"],
      plannedExposure: { L: 3600 },
    });
    const source = createMockTarget({
      id: "t2",
      name: "B",
      plannedFilters: ["L", "R"],
      plannedExposure: { L: 1800, R: 1200 },
    });

    const merged = mergeTargets(dest, source);
    expect(merged.plannedExposure.L).toBe(3600);
    expect(merged.plannedExposure.R).toBe(1200);
  });

  it("updates the updatedAt timestamp", () => {
    const before = Date.now();
    const dest = createMockTarget({
      id: "t1",
      name: "A",
      createdAt: 0,
      updatedAt: 0,
    });
    const source = createMockTarget({ id: "t2", name: "B" });

    const merged = mergeTargets(dest, source);
    expect(merged.updatedAt).toBeGreaterThanOrEqual(before);
  });
});
