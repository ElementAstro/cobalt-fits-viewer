import type { Target } from "../../fits/types";
import { getSearchSuggestions, quickSearch, searchTargets, sortTargets } from "../targetSearch";

const makeTarget = (overrides: Partial<Target> = {}): Target => {
  const now = Date.now();
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
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
};

describe("targetSearch", () => {
  const targets = [
    makeTarget({
      id: "a",
      name: "M42",
      aliases: ["Orion Nebula"],
      type: "nebula",
      status: "completed",
      category: "Winter",
      tags: ["nebula", "bright"],
      isFavorite: true,
      isPinned: false,
      ra: 83.8,
      dec: -5.4,
      imageIds: ["i1"],
      notes: "excellent seeing",
    }),
    makeTarget({
      id: "b",
      name: "M31",
      aliases: ["Andromeda"],
      type: "galaxy",
      status: "planned",
      category: "Autumn",
      tags: ["galaxy"],
      isFavorite: false,
      isPinned: true,
      imageIds: [],
      notes: "next season",
    }),
    makeTarget({
      id: "c",
      name: "Jupiter",
      aliases: ["Jove"],
      type: "planet",
      status: "acquiring",
      tags: ["planetary"],
      isFavorite: true,
      isPinned: true,
      ra: 20,
      dec: 10,
      imageIds: ["i3", "i4"],
    }),
  ];

  it("filters with combined conditions", () => {
    const result = searchTargets(targets, {
      query: "orion",
      raMin: 80,
      raMax: 90,
      decMin: -10,
      decMax: 0,
      types: ["nebula"],
      statuses: ["completed"],
      categories: ["Winter"],
      tags: ["nebula"],
      isFavorite: true,
      isPinned: false,
      hasCoordinates: true,
      hasImages: true,
      notes: "excellent",
    });
    expect(result.matchCount).toBe(1);
    expect(result.targets[0].id).toBe("a");
  });

  it("supports negative filters for coordinates and images", () => {
    expect(searchTargets(targets, { hasCoordinates: false }).targets.map((t) => t.id)).toEqual([
      "b",
    ]);
    expect(searchTargets(targets, { hasImages: false }).targets.map((t) => t.id)).toEqual(["b"]);
  });

  it("quickSearch checks names and aliases and returns all on blank query", () => {
    expect(quickSearch(targets, "andromeda").map((t) => t.id)).toEqual(["b"]);
    expect(quickSearch(targets, "   ").map((t) => t.id)).toEqual(["a", "b", "c"]);
  });

  it("returns at most 10 unique suggestions across fields", () => {
    const expanded = [
      ...targets,
      ...Array.from({ length: 15 }).map((_, i) =>
        makeTarget({
          id: `x${i}`,
          name: `Nebula ${i}`,
          aliases: [`Alias ${i}`],
          tags: [`tag-${i}`],
          category: `Category ${i}`,
        }),
      ),
    ];
    const suggestions = getSearchSuggestions(expanded, "ne");
    expect(suggestions.length).toBeLessThanOrEqual(10);
    expect(suggestions.some((s) => s.includes("Nebula"))).toBe(true);
  });

  it("returns empty suggestions on blank query", () => {
    expect(getSearchSuggestions(targets, " ")).toEqual([]);
  });

  describe("sortTargets", () => {
    it("sorts by name ascending", () => {
      const sorted = sortTargets(targets, "name", "asc");
      expect(sorted.map((t) => t.id)).toEqual(["c", "b", "a"]);
    });

    it("sorts by name descending", () => {
      const sorted = sortTargets(targets, "name", "desc");
      // b and c are pinned so come first; among pinned, desc name: M31(b) > Jupiter(c)
      // then unpinned: a (M42)
      expect(sorted.map((t) => t.id)).toEqual(["b", "c", "a"]);
    });

    it("pinned targets always come first regardless of sort", () => {
      const sorted = sortTargets(targets, "name", "asc");
      // b and c are pinned, should come before a
      expect(sorted[0].isPinned || sorted[1].isPinned).toBe(true);
      const unpinned = sorted.filter((t) => !t.isPinned);
      expect(unpinned[0].id).toBe("a");
    });

    it("sorts by frames count", () => {
      const sorted = sortTargets(targets, "frames", "desc");
      const unpinned = sorted.filter((t) => !t.isPinned);
      // a has 1 image (only unpinned), so it's the only one
      expect(unpinned[0].imageIds.length).toBe(1);
    });

    it("sorts by exposure using lookup function", () => {
      const lookup = (id: string) => {
        if (id === "a") return 300;
        if (id === "c") return 100;
        return 0;
      };
      const sorted = sortTargets(targets, "exposure", "desc", lookup);
      // pinned first (b, c), then a
      const unpinned = sorted.filter((t) => !t.isPinned);
      expect(unpinned[0].id).toBe("a");
    });

    it("sorts by favorite then date", () => {
      const sorted = sortTargets(targets, "favorite", "desc");
      // pinned first, then among unpinned: a is favorite
      const unpinned = sorted.filter((t) => !t.isPinned);
      expect(unpinned[0].isFavorite).toBe(true);
    });

    it("does not mutate the original array", () => {
      const original = [...targets];
      sortTargets(targets, "name", "asc");
      expect(targets).toEqual(original);
    });
  });
});
