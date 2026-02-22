import type { FitsMetadata } from "../../fits/types";
import type { MapClusterNode } from "../types";
import {
  uniqueSorted,
  toTestIdValue,
  siteKey,
  resolveNodeForOpen,
  computeObservationSummary,
} from "../utils";

describe("uniqueSorted", () => {
  it("deduplicates, filters blanks, and sorts", () => {
    expect(uniqueSorted(["B", "A", undefined, "B", "", "  ", "C"])).toEqual(["A", "B", "C"]);
  });

  it("returns empty array for all-undefined input", () => {
    expect(uniqueSorted([undefined, undefined])).toEqual([]);
  });
});

describe("toTestIdValue", () => {
  it("lowercases and replaces non-alphanumeric chars", () => {
    expect(toTestIdValue("M31 (Andromeda)")).toBe("m31-andromeda-");
    expect(toTestIdValue("session-1")).toBe("session-1");
  });
});

describe("siteKey", () => {
  it("rounds to 3 decimal places", () => {
    expect(siteKey(31.12345, 121.98765)).toBe("31.123_121.988");
  });

  it("handles negative coordinates", () => {
    expect(siteKey(-33.8688, 151.2093)).toBe("-33.869_151.209");
  });
});

describe("resolveNodeForOpen", () => {
  function makeNode(overrides: Partial<MapClusterNode> = {}): MapClusterNode {
    return {
      id: "n1",
      label: "Node",
      isCluster: false,
      count: 1,
      location: { latitude: 0, longitude: 0 },
      files: [],
      ...overrides,
    };
  }

  it("returns the node as-is when not a cluster", () => {
    const node = makeNode();
    const result = resolveNodeForOpen(node, () => []);
    expect(result).toBe(node);
  });

  it("expands cluster files via getLeaves", () => {
    const leaf1 = { id: "f1" } as FitsMetadata;
    const leaf2 = { id: "f2" } as FitsMetadata;
    const node = makeNode({ isCluster: true, clusterId: 42, count: 2 });
    const result = resolveNodeForOpen(node, () => [leaf1, leaf2]);
    expect(result.files).toEqual([leaf1, leaf2]);
    expect(result.count).toBe(2);
  });
});

describe("computeObservationSummary", () => {
  function makeFile(id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata {
    return {
      id,
      filename: `${id}.fits`,
      filepath: `file:///tmp/${id}.fits`,
      fileSize: 1024,
      importDate: 1_700_000_000_000,
      frameType: "light",
      isFavorite: false,
      tags: [],
      albumIds: [],
      ...overrides,
    };
  }

  it("returns null for empty files", () => {
    expect(computeObservationSummary([])).toBeNull();
  });

  it("sums exposure and counts filters", () => {
    const files = [
      makeFile("f1", { exptime: 120, filter: "Ha" }),
      makeFile("f2", { exptime: 60, filter: "Ha" }),
      makeFile("f3", { exptime: 300, filter: "OIII" }),
    ];
    const result = computeObservationSummary(files)!;
    expect(result.totalExposure).toBe(480);
    expect(result.filterCounts).toEqual({ Ha: 2, OIII: 1 });
  });

  it("collects unique sorted objects", () => {
    const files = [
      makeFile("f1", { object: "M42" }),
      makeFile("f2", { object: "M31" }),
      makeFile("f3", { object: "M42" }),
    ];
    const result = computeObservationSummary(files)!;
    expect(result.objects).toEqual(["M31", "M42"]);
  });

  it("computes date range from dateObs", () => {
    const files = [
      makeFile("f1", { dateObs: "2024-01-15T20:00:00Z" }),
      makeFile("f2", { dateObs: "2024-03-10T22:00:00Z" }),
    ];
    const result = computeObservationSummary(files)!;
    expect(result.dateRange).not.toBeNull();
    expect(result.dateRange!.from).toBeTruthy();
    expect(result.dateRange!.to).toBeTruthy();
  });

  it("falls back to importDate when dateObs is missing", () => {
    const files = [makeFile("f1", { importDate: 1_700_000_000_000 })];
    const result = computeObservationSummary(files)!;
    expect(result.dateRange).not.toBeNull();
  });
});
