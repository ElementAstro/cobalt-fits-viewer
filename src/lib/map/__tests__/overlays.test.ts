import type { FitsMetadata } from "../../fits/types";
import type { MapClusterNode } from "../types";

function makeFile(id: string, importDate: number, dateObs?: string): FitsMetadata {
  return {
    id,
    filename: `${id}.fits`,
    filepath: `file:///tmp/${id}.fits`,
    fileSize: 1024,
    importDate,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    dateObs,
    location: { latitude: 0, longitude: 0 },
  };
}

function makeCluster(id: string, longitude: number, files: FitsMetadata[]): MapClusterNode {
  return {
    id,
    label: id,
    isCluster: files.length > 1,
    count: files.length,
    location: {
      latitude: 0,
      longitude,
    },
    files,
  };
}

function loadOverlaysForPlatform(os: "ios" | "android") {
  jest.resetModules();
  jest.doMock("react-native", () => ({
    Platform: { OS: os },
  }));
  return require("../overlays") as typeof import("../overlays");
}

describe("buildClusterPolylines", () => {
  it("returns empty array when cluster count is less than 2", () => {
    const { buildClusterPolylines } = loadOverlaysForPlatform("android");
    const clusters = [makeCluster("only", 120, [makeFile("f1", 1000)])];
    expect(buildClusterPolylines(clusters)).toEqual([]);
  });

  it("uses Apple-specific contourStyle on iOS", () => {
    const { buildClusterPolylines } = loadOverlaysForPlatform("ios");
    const clusters = [
      makeCluster("a", 100, [makeFile("f1", 1000)]),
      makeCluster("b", 110, [makeFile("f2", 2000)]),
    ];
    const lines = buildClusterPolylines(clusters);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveProperty("contourStyle", "GEODESIC");
    expect(lines[0]).not.toHaveProperty("geodesic");
  });

  it("uses Google-specific geodesic on Android", () => {
    const { buildClusterPolylines } = loadOverlaysForPlatform("android");
    const clusters = [
      makeCluster("a", 100, [makeFile("f1", 1000)]),
      makeCluster("b", 110, [makeFile("f2", 2000)]),
    ];
    const lines = buildClusterPolylines(clusters);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toHaveProperty("geodesic", true);
    expect(lines[0]).not.toHaveProperty("contourStyle");
  });

  it("falls back to importDate when dateObs is invalid", () => {
    const { buildClusterPolylines } = loadOverlaysForPlatform("android");
    const clusters = [
      makeCluster("early", 10, [makeFile("f1", 5000, "1970-01-01T00:00:01.000Z")]),
      makeCluster("invalid", 20, [makeFile("f2", 2000, "invalid-date")]),
      makeCluster("late", 30, [makeFile("f3", 1000, "1970-01-01T00:00:03.000Z")]),
    ];
    const lines = buildClusterPolylines(clusters);
    const longitudes = lines[0].coordinates.map((c) => c.longitude);

    expect(longitudes).toEqual([10, 20, 30]);
  });
});

describe("buildSegmentDistances", () => {
  it("returns empty array when cluster count is less than 2", () => {
    const { buildSegmentDistances } = loadOverlaysForPlatform("android");
    const clusters = [makeCluster("only", 120, [makeFile("f1", 1000)])];
    expect(buildSegmentDistances(clusters)).toEqual([]);
  });

  it("computes midpoints and distance labels for adjacent clusters", () => {
    const { buildSegmentDistances } = loadOverlaysForPlatform("android");
    const clusters = [
      {
        ...makeCluster("a", 0, [makeFile("f1", 1000)]),
        location: { latitude: 0, longitude: 0 },
      },
      {
        ...makeCluster("b", 1, [makeFile("f2", 2000)]),
        location: { latitude: 0, longitude: 1 },
      },
    ];
    const segments = buildSegmentDistances(clusters);

    expect(segments).toHaveLength(1);
    expect(segments[0].midpoint.latitude).toBeCloseTo(0, 4);
    expect(segments[0].midpoint.longitude).toBeCloseTo(0.5, 4);
    expect(segments[0].distanceKm).toBeGreaterThan(100);
    expect(segments[0].label).toMatch(/km$/);
  });

  it("formats short distances in meters", () => {
    const { buildSegmentDistances } = loadOverlaysForPlatform("android");
    const clusters = [
      {
        ...makeCluster("a", 0, [makeFile("f1", 1000)]),
        location: { latitude: 0, longitude: 0 },
      },
      {
        ...makeCluster("b", 0.001, [makeFile("f2", 2000)]),
        location: { latitude: 0, longitude: 0.001 },
      },
    ];
    const segments = buildSegmentDistances(clusters);

    expect(segments).toHaveLength(1);
    expect(segments[0].distanceKm).toBeLessThan(1);
    expect(segments[0].label).toMatch(/m$/);
  });
});

describe("buildClusterCircles", () => {
  it("applies radius rule: 1 file=5km, +2km each additional file, max 50km", () => {
    const { buildClusterCircles } = loadOverlaysForPlatform("android");
    const clusters = [
      makeCluster("c1", 100, [makeFile("a", 1)]),
      makeCluster("c2", 110, [makeFile("a", 1), makeFile("b", 2), makeFile("c", 3)]),
      makeCluster(
        "c3",
        120,
        Array.from({ length: 30 }, (_, i) => makeFile(`f${i}`, i + 1)),
      ),
    ];
    const circles = buildClusterCircles(clusters);

    expect(circles[0].radius).toBe(5000);
    expect(circles[1].radius).toBe(9000);
    expect(circles[2].radius).toBe(50000);
  });
});
