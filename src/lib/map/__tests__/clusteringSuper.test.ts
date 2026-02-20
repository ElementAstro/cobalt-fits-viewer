import { buildSuperclusterIndex } from "../clusteringSuper";
import type { FitsMetadata } from "../../fits/types";

function makeFile(
  id: string,
  latitude: number,
  longitude: number,
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
    location: { latitude, longitude },
    ...overrides,
  };
}

const WORLD = { west: -180, south: -85, east: 180, north: 85 };

describe("buildSuperclusterIndex", () => {
  it("changes clustering shape as zoom increases", () => {
    const files = [
      makeFile("a", 0, 0),
      makeFile("b", 0.001, 0.001),
      makeFile("c", 0.002, 0.002),
      makeFile("d", 10, 10),
    ];
    const index = buildSuperclusterIndex(files);

    const lowZoom = index.getClustersByViewport({ ...WORLD, zoom: 2 });
    const highZoom = index.getClustersByViewport({ ...WORLD, zoom: 16 });

    const lowClusterCount = lowZoom.filter((node) => node.isCluster).length;
    const highClusterCount = highZoom.filter((node) => node.isCluster).length;

    expect(lowClusterCount).toBeGreaterThanOrEqual(highClusterCount);
    expect(highZoom.length).toBeGreaterThanOrEqual(lowZoom.length);
  });

  it("resolves expansion zoom and leaves for a cluster", () => {
    const files = [
      makeFile("a", 1, 1),
      makeFile("b", 1.0002, 1.0002),
      makeFile("c", 1.0004, 1.0004),
    ];
    const index = buildSuperclusterIndex(files);
    const nodes = index.getClustersByViewport({ ...WORLD, zoom: 2 });
    const cluster = nodes.find((node) => node.isCluster && node.clusterId !== undefined);

    expect(cluster).toBeDefined();
    const expansionZoom = index.getExpansionZoom(cluster!.clusterId!);
    const leaves = index.getLeaves(cluster!.clusterId!);
    const leafIds = new Set(leaves.map((file) => file.id));

    expect(expansionZoom).toBeGreaterThan(2);
    expect(leaves).toHaveLength(3);
    expect(leafIds).toEqual(new Set(["a", "b", "c"]));
  });

  it("handles 5k points within a reasonable time envelope", () => {
    const files = Array.from({ length: 5000 }, (_, i) => {
      const row = Math.floor(i / 100);
      const col = i % 100;
      return makeFile(`f-${i}`, -20 + row * 0.02, 110 + col * 0.02);
    });

    const started = Date.now();
    const index = buildSuperclusterIndex(files);
    const midZoom = index.getClustersByViewport({ ...WORLD, zoom: 8 });
    const elapsedMs = Date.now() - started;

    expect(midZoom.length).toBeGreaterThan(0);
    expect(elapsedMs).toBeLessThan(3000);
  });
});
