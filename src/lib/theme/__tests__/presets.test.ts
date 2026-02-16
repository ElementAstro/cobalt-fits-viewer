import { Uniwind } from "uniwind";
import {
  BASE_THEME_VARIABLES,
  DEFAULT_CUSTOM_THEME_COLORS,
  applyAccentColor,
  applyStylePreset,
  applyThemeVariables,
  buildCustomThemeVariables,
  getThemeVariables,
  isHexColor,
  normalizeHexColor,
} from "../presets";

jest.mock("uniwind", () => ({
  Uniwind: {
    updateCSSVariables: jest.fn(),
  },
}));

describe("theme presets", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes and validates hex colors", () => {
    expect(normalizeHexColor("  #4f6bed ")).toBe("#4F6BED");
    expect(normalizeHexColor("#ABCDEF")).toBe("#ABCDEF");
    expect(normalizeHexColor("#123")).toBeNull();
    expect(isHexColor("#A1B2C3")).toBe(true);
    expect(isHexColor("red")).toBe(false);
  });

  it("builds custom variables with linked dark mode", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: true,
      light: {
        accent: "#111111",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      dark: {
        accent: "#FFFFFF",
        success: "#FFFFFF",
        warning: "#FFFFFF",
        danger: "#FFFFFF",
      },
    };

    const variables = buildCustomThemeVariables(custom);
    expect(variables.light["--accent"]).toBe("#111111");
    expect(variables.dark["--accent"]).toBe("#111111");
    expect(variables.light["--accent-foreground"]).toBe("#FFFFFF");
  });

  it("returns baseline + preset variables", () => {
    const variables = getThemeVariables("preset", null, "ocean", DEFAULT_CUSTOM_THEME_COLORS);
    expect(variables.light["--warning"]).toBe(BASE_THEME_VARIABLES.light["--warning"]);
    expect(variables.light["--accent"]).not.toBe(BASE_THEME_VARIABLES.light["--accent"]);
    expect(variables.dark["--success"]).not.toBe(BASE_THEME_VARIABLES.dark["--success"]);
  });

  it("returns baseline + accent override", () => {
    const variables = getThemeVariables("accent", "red", "default", DEFAULT_CUSTOM_THEME_COLORS);
    expect(variables.light["--accent"]).toBeDefined();
    expect(variables.dark["--accent"]).toBeDefined();
    expect(variables.light["--warning"]).toBe(BASE_THEME_VARIABLES.light["--warning"]);
  });

  it("applies variables to uniwind light/dark modes", () => {
    applyThemeVariables({
      light: { "--accent": "#123456" },
      dark: { "--accent": "#654321" },
    });
    expect(Uniwind.updateCSSVariables).toHaveBeenCalledTimes(2);
    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith("light", { "--accent": "#123456" });
    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith("dark", { "--accent": "#654321" });
  });

  it("legacy wrappers still update variables", () => {
    applyAccentColor("blue");
    applyStylePreset("forest");
    expect(Uniwind.updateCSSVariables).toHaveBeenCalled();
  });
});
