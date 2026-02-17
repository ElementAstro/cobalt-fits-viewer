import { VIEWER_CURVE_PRESETS } from "../presets";

describe("viewer presets", () => {
  it("defines all supported curve presets in stable order", () => {
    expect(VIEWER_CURVE_PRESETS.map((p) => p.key)).toEqual([
      "linear",
      "sCurve",
      "brighten",
      "darken",
      "highContrast",
    ]);
  });

  it("maps each preset to i18n label key", () => {
    for (const preset of VIEWER_CURVE_PRESETS) {
      expect(preset.labelKey).toMatch(/^viewer\.curve/);
    }
  });

  it("does not contain duplicate preset keys", () => {
    const keys = VIEWER_CURVE_PRESETS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
