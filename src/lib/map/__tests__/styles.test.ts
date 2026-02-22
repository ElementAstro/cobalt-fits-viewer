import {
  GOOGLE_DARK_ASTRONOMY_STYLE,
  MAP_PRESETS,
  MAP_PRESET_ORDER,
  MARKER_COLORS,
  getMarkerColor,
} from "../styles";

describe("map styles", () => {
  it("MAP_PRESET_ORDER matches MAP_PRESETS keys", () => {
    const presetKeys = Object.keys(MAP_PRESETS).sort();
    const orderedKeys = [...MAP_PRESET_ORDER].sort();

    expect(orderedKeys).toEqual(presetKeys);
    for (const key of MAP_PRESET_ORDER) {
      expect(MAP_PRESETS).toHaveProperty(key);
    }
  });

  it("dark preset style JSON is valid and non-empty", () => {
    expect(MAP_PRESETS.dark.googleStyleJson).toBe(GOOGLE_DARK_ASTRONOMY_STYLE);

    const parsed = JSON.parse(MAP_PRESETS.dark.googleStyleJson ?? "[]");
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThan(0);
  });

  it("every preset has a valid webTileUrl and webTileAttribution", () => {
    for (const key of MAP_PRESET_ORDER) {
      const config = MAP_PRESETS[key];
      expect(config.webTileUrl).toMatch(/^https?:\/\//);
      expect(config.webTileAttribution.length).toBeGreaterThan(0);
    }
  });

  it("dark preset uses CartoDB dark tiles for web", () => {
    expect(MAP_PRESETS.dark.webTileUrl).toContain("cartocdn.com/dark_all");
  });

  it("satellite preset uses ESRI imagery tiles for web", () => {
    expect(MAP_PRESETS.satellite.webTileUrl).toContain("arcgisonline.com");
  });

  it("terrain3d preset uses OpenTopoMap tiles for web", () => {
    expect(MAP_PRESETS.terrain3d.webTileUrl).toContain("opentopomap.org");
  });
});

describe("getMarkerColor", () => {
  it("returns single color for non-cluster with count 1", () => {
    expect(getMarkerColor(1, false)).toBe(MARKER_COLORS.single);
  });

  it("returns clusterSmall for small clusters (count < 5)", () => {
    expect(getMarkerColor(3, true)).toBe(MARKER_COLORS.clusterSmall);
  });

  it("returns clusterMedium for medium clusters (5 <= count < 10)", () => {
    expect(getMarkerColor(5, false)).toBe(MARKER_COLORS.clusterMedium);
    expect(getMarkerColor(9, true)).toBe(MARKER_COLORS.clusterMedium);
  });

  it("returns clusterLarge for large clusters (count >= 10)", () => {
    expect(getMarkerColor(10, false)).toBe(MARKER_COLORS.clusterLarge);
    expect(getMarkerColor(100, true)).toBe(MARKER_COLORS.clusterLarge);
  });
});
