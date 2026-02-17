import { clusterByDistance, computeBounds } from "../clustering";
import type { FitsMetadata } from "../../fits/types";

function makeFile(
  id: string,
  location?: { latitude: number; longitude: number },
  overrides: Partial<FitsMetadata> = {},
): FitsMetadata {
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
    location,
    ...overrides,
  };
}

describe("clusterByDistance", () => {
  it("returns empty array when no files have location", () => {
    const files = [makeFile("a"), makeFile("b")];
    expect(clusterByDistance(files)).toEqual([]);
  });

  it("uses transitive clustering (A~B and B~C => A/B/C in same cluster)", () => {
    const files = [
      makeFile("a", { latitude: 0, longitude: 0 }),
      makeFile("b", { latitude: 0, longitude: 0.25 }),
      makeFile("c", { latitude: 0, longitude: 0.5 }),
      makeFile("d", { latitude: 5, longitude: 5 }),
    ];

    const clusters = clusterByDistance(files, 30);
    expect(clusters).toHaveLength(2);

    const sizes = clusters.map((c) => c.files.length).sort((a, b) => a - b);
    expect(sizes).toEqual([1, 3]);

    const chainedCluster = clusters.find((c) => c.files.length === 3);
    expect(chainedCluster).toBeDefined();
    const ids = chainedCluster!.files.map((f) => f.id).sort();
    expect(ids).toEqual(["a", "b", "c"]);
  });
});

describe("computeBounds", () => {
  it("returns zoom=12 and same center for a single cluster", () => {
    const clusters = clusterByDistance([makeFile("single", { latitude: 35.5, longitude: 120.25 })]);
    const bounds = computeBounds(clusters);

    expect(bounds).toEqual({
      center: { latitude: 35.5, longitude: 120.25 },
      zoom: 12,
    });
  });

  it("computes center and zoom from multiple clusters", () => {
    const clusters = clusterByDistance(
      [
        makeFile("north", { latitude: 10, longitude: 0 }),
        makeFile("south", { latitude: 0, longitude: 0 }),
      ],
      1,
    );
    const bounds = computeBounds(clusters);

    expect(bounds).not.toBeNull();
    expect(bounds!.center.latitude).toBe(5);
    expect(bounds!.center.longitude).toBe(0);
    expect(bounds!.zoom).toBe(5);
  });
});
