import { GOOGLE_DARK_ASTRONOMY_STYLE, MAP_PRESETS, MAP_PRESET_ORDER } from "../styles";

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
});
