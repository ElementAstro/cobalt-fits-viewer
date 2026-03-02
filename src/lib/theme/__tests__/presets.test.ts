import { Uniwind } from "uniwind";
import {
  BASE_THEME_VARIABLES,
  DEFAULT_CUSTOM_THEME_COLORS,
  applyAccentColor,
  applyStylePreset,
  applyThemeVariables,
  buildCustomThemeVariables,
  expandLayoutVariables,
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
        ...DEFAULT_CUSTOM_THEME_COLORS.light,
        accent: "#111111",
      },
      dark: {
        ...DEFAULT_CUSTOM_THEME_COLORS.dark,
        accent: "#FFFFFF",
      },
    };

    const variables = buildCustomThemeVariables(custom);
    expect(variables.light["--accent"]).toBe("#111111");
    expect(variables.dark["--accent"]).toBe("#111111");
    expect(variables.light["--accent-foreground"]).toBe("#FFFFFF");
  });

  it("builds background and surface variables with readable foreground", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: false,
      light: {
        ...DEFAULT_CUSTOM_THEME_COLORS.light,
        background: "#FFFFFF",
        surface: "#111111",
      },
      dark: {
        ...DEFAULT_CUSTOM_THEME_COLORS.dark,
        background: "#000000",
        surface: "#E5E7EB",
      },
    };

    const variables = buildCustomThemeVariables(custom);
    expect(variables.light["--background"]).toBe("#FFFFFF");
    expect(variables.light["--foreground"]).toBe("#111827");
    expect(variables.light["--surface"]).toBe("#111111");
    expect(variables.light["--surface-foreground"]).toBe("#FFFFFF");
    expect(variables.light["--field-background"]).toBe("#111111");
    expect(variables.dark["--background"]).toBe("#000000");
    expect(variables.dark["--surface"]).toBe("#E5E7EB");
    expect(variables.dark["--surface-foreground"]).toBe("#111827");
  });

  it("generates overlay, muted, default, border, separator, link from background", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: false,
      light: {
        ...DEFAULT_CUSTOM_THEME_COLORS.light,
        background: "#F0F0F0",
        surface: "#FFFFFF",
      },
      dark: {
        ...DEFAULT_CUSTOM_THEME_COLORS.dark,
        background: "#111111",
        surface: "#222222",
      },
    };

    const variables = buildCustomThemeVariables(custom);

    // Light mode derived tokens
    expect(variables.light["--overlay"]).toBeDefined();
    expect(variables.light["--overlay-foreground"]).toBeDefined();
    expect(variables.light["--muted"]).toBeDefined();
    expect(variables.light["--default"]).toBeDefined();
    expect(variables.light["--default-foreground"]).toBeDefined();
    expect(variables.light["--border"]).toBeDefined();
    expect(variables.light["--separator"]).toBeDefined();
    expect(variables.light["--link"]).toBe(variables.light["--foreground"]);

    // Dark mode derived tokens
    expect(variables.dark["--overlay"]).toBeDefined();
    expect(variables.dark["--muted"]).toBeDefined();
    expect(variables.dark["--default"]).toBeDefined();
    expect(variables.dark["--border"]).toBeDefined();
    expect(variables.dark["--separator"]).toBeDefined();
    expect(variables.dark["--link"]).toBe(variables.dark["--foreground"]);
  });

  it("generates segment, field-placeholder, field-border, and shadow tokens", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: true,
      light: {
        ...DEFAULT_CUSTOM_THEME_COLORS.light,
        background: "#FAFAFA",
        surface: "#FFFFFF",
      },
      dark: { ...DEFAULT_CUSTOM_THEME_COLORS.dark },
    };

    const variables = buildCustomThemeVariables(custom);
    expect(variables.light["--segment"]).toBe("#FFFFFF");
    expect(variables.light["--segment-foreground"]).toBeDefined();
    expect(variables.light["--field-placeholder"]).toBeDefined();
    expect(variables.light["--field-border"]).toBe("transparent");
    expect(variables.light["--surface-shadow"]).toContain("rgba");
    expect(variables.light["--overlay-shadow"]).toContain("rgba");
    expect(variables.light["--field-shadow"]).toContain("rgba");
  });

  it("generates dark mode shadow tokens as transparent/inset", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: false,
      light: { ...DEFAULT_CUSTOM_THEME_COLORS.light },
      dark: {
        ...DEFAULT_CUSTOM_THEME_COLORS.dark,
        background: "#0A0A0A",
        surface: "#1A1A1A",
      },
    };

    const variables = buildCustomThemeVariables(custom);
    expect(variables.dark["--surface-shadow"]).toContain("transparent");
    expect(variables.dark["--overlay-shadow"]).toContain("inset");
    expect(variables.dark["--field-shadow"]).toContain("transparent");
  });

  it("generates surface-secondary and surface-tertiary with different lightness", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: false,
      light: {
        ...DEFAULT_CUSTOM_THEME_COLORS.light,
        background: "#F5F5F5",
        surface: "#FFFFFF",
      },
      dark: {
        ...DEFAULT_CUSTOM_THEME_COLORS.dark,
        background: "#111111",
        surface: "#1E1E1E",
      },
    };

    const variables = buildCustomThemeVariables(custom);

    // Light: secondary/tertiary should be darker than surface
    expect(variables.light["--surface-secondary"]).not.toBe("#FFFFFF");
    expect(variables.light["--surface-tertiary"]).not.toBe("#FFFFFF");
    expect(variables.light["--surface-tertiary"]).not.toBe(variables.light["--surface-secondary"]);

    // Dark: secondary/tertiary should be lighter than surface
    expect(variables.dark["--surface-secondary"]).not.toBe("#1E1E1E");
    expect(variables.dark["--surface-tertiary"]).not.toBe("#1E1E1E");
    expect(variables.dark["--surface-tertiary"]).not.toBe(variables.dark["--surface-secondary"]);
  });

  it("sets --focus to accent color", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: true,
      light: {
        ...DEFAULT_CUSTOM_THEME_COLORS.light,
        accent: "#FF0000",
      },
      dark: { ...DEFAULT_CUSTOM_THEME_COLORS.dark },
    };

    const variables = buildCustomThemeVariables(custom);
    expect(variables.light["--focus"]).toBe("#FF0000");
    expect(variables.dark["--focus"]).toBe("#FF0000");
  });

  it("falls back surface to background when surface override is empty", () => {
    const custom = {
      ...DEFAULT_CUSTOM_THEME_COLORS,
      linked: true,
      light: {
        ...DEFAULT_CUSTOM_THEME_COLORS.light,
        background: "#123456",
        surface: "",
      },
      dark: {
        ...DEFAULT_CUSTOM_THEME_COLORS.dark,
      },
    };

    const variables = buildCustomThemeVariables(custom);
    expect(variables.light["--background"]).toBe("#123456");
    expect(variables.light["--surface"]).toBe("#123456");
    expect(variables.dark["--surface"]).toBe("#123456");
  });

  it("does not override base tokens when background and surface are empty", () => {
    const variables = buildCustomThemeVariables(DEFAULT_CUSTOM_THEME_COLORS);
    expect(variables.light["--background"]).toBeUndefined();
    expect(variables.light["--surface"]).toBeUndefined();
    expect(variables.dark["--background"]).toBeUndefined();
    expect(variables.dark["--surface"]).toBeUndefined();
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
    // expandToTailwindColorVars adds --color-* duplicates for Tailwind theme resolution
    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith(
      "light",
      expect.objectContaining({
        "--accent": "#123456",
        "--color-accent": "#123456",
      }),
    );
    expect(Uniwind.updateCSSVariables).toHaveBeenCalledWith(
      "dark",
      expect.objectContaining({
        "--accent": "#654321",
        "--color-accent": "#654321",
      }),
    );
  });

  it("legacy wrappers still update variables", () => {
    applyAccentColor("blue");
    applyStylePreset("forest");
    expect(Uniwind.updateCSSVariables).toHaveBeenCalled();
  });

  describe("expandLayoutVariables", () => {
    it("converts rem to px numbers (1rem = 16px) for all derived radius variables", () => {
      const vars = expandLayoutVariables("0.5rem", "1px", "0px");
      // 0.5rem = 8px
      expect(vars["--radius"]).toBe(8);
      expect(vars["--radius-xs"]).toBe(2); // 8 * 0.25
      expect(vars["--radius-sm"]).toBe(4); // 8 * 0.5
      expect(vars["--radius-md"]).toBe(6); // 8 * 0.75
      expect(vars["--radius-lg"]).toBe(8); // 8 * 1
      expect(vars["--radius-xl"]).toBe(12); // 8 * 1.5
      expect(vars["--radius-2xl"]).toBe(16); // 8 * 2
      expect(vars["--radius-3xl"]).toBe(24); // 8 * 3
      expect(vars["--radius-4xl"]).toBe(32); // 8 * 4
    });

    it("handles none preset (0rem) correctly", () => {
      const vars = expandLayoutVariables("0rem", "1px", "0px");
      expect(vars["--radius"]).toBe(0);
      expect(vars["--radius-xs"]).toBe(0);
      expect(vars["--radius-lg"]).toBe(0);
      expect(vars["--radius-4xl"]).toBe(0);
    });

    it("handles pill preset (1rem = 16px) correctly", () => {
      const vars = expandLayoutVariables("1rem", "1px", "0px");
      expect(vars["--radius-lg"]).toBe(16); // 16 * 1
      expect(vars["--radius-3xl"]).toBe(48); // 16 * 3
      expect(vars["--radius-4xl"]).toBe(64); // 16 * 4
    });

    it("pre-computes field radius as radiusPx * 1.5", () => {
      const vars = expandLayoutVariables("0.75rem", "1px", "0px");
      // 0.75rem = 12px, field = 12 * 1.5 = 18
      expect(vars["--field-radius"]).toBe(18);
      expect(vars["--radius-field"]).toBe(18);
    });

    it("converts border-width px strings to numbers", () => {
      const vars = expandLayoutVariables("0.5rem", "2px", "1px");
      expect(vars["--border-width"]).toBe(2);
      expect(vars["--field-border-width"]).toBe(1);
      expect(vars["--border-width-field"]).toBe(1);
    });

    it("returns all values as numbers, not strings", () => {
      const vars = expandLayoutVariables("0.5rem", "1px", "0px");
      for (const [, value] of Object.entries(vars)) {
        expect(typeof value).toBe("number");
      }
    });
  });
});
