import type { Target } from "../../fits/types";
import {
  detectDuplicates,
  findDuplicatesOf,
  selectPrimaryDuplicateTarget,
  sortDuplicateTargetsByMergePriority,
  suggestMergeStrategy,
} from "../duplicateDetector";

const DEFAULT_TIMESTAMP = 1_700_000_000_000;

const makeTarget = (overrides: Partial<Target> = {}): Target => {
  return {
    id: "t1",
    name: "M42",
    aliases: [],
    type: "nebula",
    tags: [],
    isFavorite: false,
    isPinned: false,
    imageIds: [],
    status: "planned",
    plannedFilters: [],
    plannedExposure: {},
    imageRatings: {},
    changeLog: [],
    createdAt: DEFAULT_TIMESTAMP,
    updatedAt: DEFAULT_TIMESTAMP,
    ...overrides,
  };
};

describe("target duplicateDetector", () => {
  it("detects duplicate groups by normalized name, alias, and coordinates", () => {
    const targets = [
      makeTarget({ id: "a", name: "M42" }),
      makeTarget({ id: "b", name: "m 42" }),
      makeTarget({ id: "c", name: "Orion", aliases: ["M42"] }),
      makeTarget({ id: "d", name: "Other", ra: 10, dec: 20 }),
      makeTarget({ id: "e", name: "Other2", ra: 10.1, dec: 20.1 }),
    ];

    const result = detectDuplicates(targets);
    expect(result.groups.length).toBeGreaterThanOrEqual(2);
    expect(result.totalDuplicates).toBeGreaterThan(0);
    expect(result.potentialSavings).toBe(result.totalDuplicates);
    expect(result.groups.some((g) => g.matchReason === "name")).toBe(true);
    expect(result.groups.some((g) => g.matchReason === "coordinates")).toBe(true);
  });

  it("finds duplicates of a target by name, alias, and coordinates", () => {
    const targets = [
      makeTarget({ id: "t1", name: "M31", aliases: ["Andromeda"], ra: 10, dec: 20 }),
      makeTarget({ id: "t2", name: "m 31", aliases: [], ra: 50, dec: 10 }),
      makeTarget({ id: "t3", name: "Andromeda Galaxy", aliases: ["Andromeda"], ra: 120, dec: 0 }),
      makeTarget({ id: "t4", name: "Close Coord", aliases: [], ra: 10.2, dec: 20.1 }),
      makeTarget({ id: "t5", name: "Different", aliases: [], ra: 200, dec: 20 }),
    ];

    const duplicates = findDuplicatesOf(targets, "t1").map((t) => t.id);
    expect(duplicates).toEqual(expect.arrayContaining(["t2", "t3", "t4"]));
    expect(duplicates).not.toContain("t5");
  });

  it("returns empty list when target does not exist", () => {
    const targets = [makeTarget({ id: "a" })];
    expect(findDuplicatesOf(targets, "missing")).toEqual([]);
  });

  it("suggests merge strategy from duplicate group", () => {
    const group = {
      id: "g1",
      matchReason: "alias" as const,
      confidence: "high" as const,
      targets: [
        makeTarget({
          id: "a",
          name: "M42",
          aliases: ["Orion"],
          tags: ["nebula"],
          imageIds: ["i1", "i2"],
          notes: "note-a",
          category: "Winter",
          ra: 10,
          dec: 20,
        }),
        makeTarget({
          id: "b",
          name: "Orion Nebula",
          aliases: ["M42", "NGC 1976"],
          tags: ["favorite"],
          imageIds: ["i2", "i3"],
          notes: "note-b",
        }),
      ],
    };

    const strategy = suggestMergeStrategy(group);
    expect(strategy).not.toBeNull();
    expect(strategy!.primaryTarget.id).toBe("a");
    expect(strategy!.mergeData.aliases).toEqual(expect.arrayContaining(["Orion", "NGC 1976"]));
    expect(strategy!.mergeData.tags).toEqual(expect.arrayContaining(["nebula", "favorite"]));
    expect(strategy!.mergeData.imageIds).toEqual(expect.arrayContaining(["i1", "i2", "i3"]));
    expect(strategy!.mergeData.notes).toContain("note-a");
    expect(strategy!.mergeData.notes).toContain("note-b");
  });

  it("returns null merge strategy when group has less than two targets", () => {
    const group = {
      id: "g",
      matchReason: "name" as const,
      confidence: "high" as const,
      targets: [makeTarget({ id: "single" })],
    };
    expect(suggestMergeStrategy(group)).toBeNull();
  });

  it("selects primary target deterministically using tie-break rules", () => {
    const targets = [
      makeTarget({
        id: "c",
        imageIds: ["i1", "i2"],
        updatedAt: 100,
        createdAt: 50,
      }),
      makeTarget({
        id: "a",
        imageIds: ["i1", "i2"],
        updatedAt: 100,
        createdAt: 50,
      }),
      makeTarget({
        id: "b",
        imageIds: ["i1", "i2", "i3"],
        updatedAt: 10,
        createdAt: 10,
      }),
    ];

    const sorted = sortDuplicateTargetsByMergePriority(targets);
    expect(sorted.map((target) => target.id)).toEqual(["b", "a", "c"]);
    expect(selectPrimaryDuplicateTarget(targets)?.id).toBe("b");
  });

  it("prefers recently updated target when frame counts tie", () => {
    const targets = [
      makeTarget({ id: "older", imageIds: ["i1"], updatedAt: 10, createdAt: 100 }),
      makeTarget({ id: "newer", imageIds: ["i1"], updatedAt: 20, createdAt: 50 }),
    ];
    expect(selectPrimaryDuplicateTarget(targets)?.id).toBe("newer");
  });
});
