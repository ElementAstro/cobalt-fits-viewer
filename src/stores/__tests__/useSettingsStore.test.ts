/**
 * Unit tests for useSettingsStore — orientationLock and related settings
 */

import { useSettingsStore } from "../useSettingsStore";
import { Uniwind } from "uniwind";
import { DEFAULT_CUSTOM_THEME_COLORS } from "../../lib/theme/presets";

// Mock theme/style utilities
jest.mock("uniwind", () => ({
  Uniwind: { setTheme: jest.fn(), updateCSSVariables: jest.fn() },
}));
jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

describe("useSettingsStore — orientationLock", () => {
  beforeEach(() => {
    useSettingsStore.getState().resetToDefaults();
    jest.clearAllMocks();
  });

  // ===== Default value =====

  describe("default state", () => {
    it("has orientationLock = 'default'", () => {
      expect(useSettingsStore.getState().orientationLock).toBe("default");
    });
  });

  // ===== Setter =====

  describe("setOrientationLock", () => {
    it("sets to portrait", () => {
      useSettingsStore.getState().setOrientationLock("portrait");
      expect(useSettingsStore.getState().orientationLock).toBe("portrait");
    });

    it("sets to landscape", () => {
      useSettingsStore.getState().setOrientationLock("landscape");
      expect(useSettingsStore.getState().orientationLock).toBe("landscape");
    });

    it("sets back to default", () => {
      useSettingsStore.getState().setOrientationLock("landscape");
      useSettingsStore.getState().setOrientationLock("default");
      expect(useSettingsStore.getState().orientationLock).toBe("default");
    });

    it("does not affect other settings", () => {
      const prevTheme = useSettingsStore.getState().theme;
      const prevLanguage = useSettingsStore.getState().language;
      useSettingsStore.getState().setOrientationLock("landscape");
      expect(useSettingsStore.getState().theme).toBe(prevTheme);
      expect(useSettingsStore.getState().language).toBe(prevLanguage);
    });
  });

  // ===== Reset =====

  describe("resetToDefaults", () => {
    it("resets orientationLock to default", () => {
      useSettingsStore.getState().setOrientationLock("portrait");
      expect(useSettingsStore.getState().orientationLock).toBe("portrait");

      useSettingsStore.getState().resetToDefaults();
      expect(useSettingsStore.getState().orientationLock).toBe("default");
    });

    it("resets map settings to defaults", () => {
      useSettingsStore.getState().setMapPreset("dark");
      useSettingsStore.getState().setMapShowOverlays(true);
      useSettingsStore.getState().resetToDefaults();
      expect(useSettingsStore.getState().mapPreset).toBe("standard");
      expect(useSettingsStore.getState().mapShowOverlays).toBe(false);
    });
  });

  // ===== Other settings not affected =====

  describe("independence from other settings", () => {
    it("changing theme does not affect orientationLock", () => {
      useSettingsStore.getState().setOrientationLock("landscape");
      useSettingsStore.getState().setTheme("light");
      expect(useSettingsStore.getState().orientationLock).toBe("landscape");
    });

    it("changing language does not affect orientationLock", () => {
      useSettingsStore.getState().setOrientationLock("portrait");
      useSettingsStore.getState().setLanguage("en");
      expect(useSettingsStore.getState().orientationLock).toBe("portrait");
    });
  });

  describe("theme customization", () => {
    it("setAccentColor switches to accent mode and clears preset", () => {
      useSettingsStore.getState().setActivePreset("ocean");
      useSettingsStore.getState().setAccentColor("red");

      const s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("accent");
      expect(s.accentColor).toBe("red");
      expect(s.activePreset).toBe("default");
    });

    it("setActivePreset switches to preset mode and clears accent", () => {
      useSettingsStore.getState().setAccentColor("green");
      useSettingsStore.getState().setActivePreset("forest");

      const s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("preset");
      expect(s.accentColor).toBeNull();
      expect(s.activePreset).toBe("forest");
    });

    it("setThemeColorMode accent auto-fills accent color", () => {
      useSettingsStore.getState().resetStyle();
      useSettingsStore.getState().setThemeColorMode("accent");
      const s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("accent");
      expect(s.accentColor).toBe("blue");
    });

    it("setCustomThemeToken writes valid hex and switches to custom mode", () => {
      useSettingsStore.getState().setCustomThemeToken("warning", "#AA5500", "light");

      const s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("custom");
      expect(s.customThemeColors.light.warning).toBe("#AA5500");
      expect(s.customThemeColors.dark.warning).toBe("#AA5500");
    });

    it("setCustomThemeToken ignores invalid hex", () => {
      const before = useSettingsStore.getState().customThemeColors.light.danger;
      useSettingsStore.getState().setCustomThemeToken("danger", "red", "light");
      expect(useSettingsStore.getState().customThemeColors.light.danger).toBe(before);
    });

    it("setCustomThemeLinked false allows dark-only override", () => {
      useSettingsStore.getState().setCustomThemeLinked(false);
      useSettingsStore.getState().setCustomThemeToken("accent", "#123456", "dark");
      const s = useSettingsStore.getState();
      expect(s.customThemeColors.linked).toBe(false);
      expect(s.customThemeColors.dark.accent).toBe("#123456");
      expect(s.customThemeColors.light.accent).not.toBe("#123456");
    });

    it("resetStyle restores style fields without changing app theme mode", () => {
      useSettingsStore.getState().setTheme("light");
      useSettingsStore.getState().setCustomThemeToken("accent", "#101010", "light");
      useSettingsStore.getState().setThemeColorMode("custom");
      useSettingsStore.getState().resetStyle();

      const s = useSettingsStore.getState();
      expect(s.theme).toBe("light");
      expect(s.themeColorMode).toBe("preset");
      expect(s.accentColor).toBeNull();
      expect(s.activePreset).toBe("default");
      expect(s.customThemeColors).toEqual(DEFAULT_CUSTOM_THEME_COLORS);
    });
  });

  describe("persistence and sanitization", () => {
    it("partialize includes orientationLock", () => {
      const partialize = useSettingsStore.persist.getOptions().partialize;
      expect(partialize).toBeDefined();
      const partial = partialize?.(useSettingsStore.getState()) as { orientationLock?: string };
      expect(partial?.orientationLock).toBe(useSettingsStore.getState().orientationLock);
    });

    it("applySettingsPatch sanitizes out-of-range values", () => {
      useSettingsStore.getState().applySettingsPatch({
        thumbnailQuality: 1000,
        thumbnailSize: 10,
        canvasMinScale: 8,
        canvasMaxScale: 2,
        canvasDoubleTapScale: 50,
        defaultBlackPoint: 0.95,
        defaultWhitePoint: 0.5,
      });

      const s = useSettingsStore.getState();
      expect(s.thumbnailQuality).toBe(100);
      expect(s.thumbnailSize).toBe(64);
      expect(s.canvasMaxScale).toBeGreaterThanOrEqual(s.canvasMinScale);
      expect(s.canvasDoubleTapScale).toBeLessThanOrEqual(s.canvasMaxScale);
      expect(s.defaultWhitePoint).toBeGreaterThan(s.defaultBlackPoint);
    });

    it("applySettingsPatch accepts numeric-string payloads", () => {
      useSettingsStore.getState().applySettingsPatch({
        thumbnailQuality: "95" as unknown as number,
        defaultReminderMinutes: "60" as unknown as number,
      });

      const s = useSettingsStore.getState();
      expect(s.thumbnailQuality).toBe(95);
      expect(s.defaultReminderMinutes).toBe(60);
    });

    it("applySettingsPatch ignores unknown keys", () => {
      useSettingsStore.getState().applySettingsPatch({
        unknownSetting: "bad",
      } as unknown as Record<string, unknown>);

      expect(
        (useSettingsStore.getState() as unknown as { unknownSetting?: string }).unknownSetting,
      ).toBe(undefined);
    });

    it("applySettingsPatch keeps black/white points valid for one-sided updates", () => {
      useSettingsStore.getState().applySettingsPatch({
        defaultWhitePoint: 0.4,
      });
      useSettingsStore.getState().applySettingsPatch({
        defaultBlackPoint: 0.6,
      });

      let s = useSettingsStore.getState();
      expect(s.defaultWhitePoint).toBeGreaterThan(s.defaultBlackPoint);
      expect(s.defaultWhitePoint).toBeCloseTo(0.61, 6);

      useSettingsStore.getState().applySettingsPatch({
        defaultBlackPoint: 0.8,
        defaultWhitePoint: 1,
      });
      useSettingsStore.getState().applySettingsPatch({
        defaultWhitePoint: 0.5,
      });

      s = useSettingsStore.getState();
      expect(s.defaultWhitePoint).toBeGreaterThan(s.defaultBlackPoint);
      expect(s.defaultBlackPoint).toBeCloseTo(0.49, 6);
    });

    it("applySettingsPatch keeps canvas scales valid for one-sided updates", () => {
      useSettingsStore.getState().applySettingsPatch({
        canvasMinScale: 4,
        canvasMaxScale: 6,
      });

      useSettingsStore.getState().applySettingsPatch({
        canvasMaxScale: 2,
      });

      let s = useSettingsStore.getState();
      expect(s.canvasMinScale).toBe(2);
      expect(s.canvasMaxScale).toBe(2);

      useSettingsStore.getState().applySettingsPatch({
        canvasMaxScale: 5,
      });
      useSettingsStore.getState().applySettingsPatch({
        canvasMinScale: 8,
      });

      s = useSettingsStore.getState();
      expect(s.canvasMinScale).toBe(8);
      expect(s.canvasMaxScale).toBe(8);
    });

    it("persist merge also drops unknown keys", () => {
      const merge = useSettingsStore.persist.getOptions().merge;
      const current = useSettingsStore.getState();
      const merged = merge?.(
        {
          thumbnailQuality: 150,
          unknownSetting: true,
        },
        current,
      ) as typeof current;

      expect(merged.thumbnailQuality).toBe(100);
      expect((merged as unknown as { unknownSetting?: boolean }).unknownSetting).toBeUndefined();
    });

    it("applySettingsPatch drops invalid theme customization values", () => {
      useSettingsStore.getState().applySettingsPatch({
        themeColorMode: "invalid",
        accentColor: "bad",
        activePreset: "unknown",
        customThemeColors: {
          linked: true,
          light: { accent: "red", success: "#22C55E", warning: "#F59E0B", danger: "#EF4444" },
          dark: { accent: "#123456", success: "#22C55E", warning: "#F59E0B", danger: "#EF4444" },
        },
      } as unknown as Record<string, unknown>);

      const s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("preset");
      expect(s.accentColor).toBeNull();
      expect(s.activePreset).toBe("default");
      expect(s.customThemeColors.light.accent).toBe(DEFAULT_CUSTOM_THEME_COLORS.light.accent);
    });

    it("persist merge infers accent mode for legacy payloads", () => {
      const merge = useSettingsStore.persist.getOptions().merge;
      const current = useSettingsStore.getState();
      const merged = merge?.(
        {
          accentColor: "purple",
          activePreset: "default",
        },
        current,
      ) as typeof current;

      expect(merged.themeColorMode).toBe("accent");
      expect(merged.accentColor).toBe("purple");
    });
  });

  describe("runtime sync", () => {
    it("updates uniwind variables when style changes", () => {
      useSettingsStore.getState().setAccentColor("cyan");
      expect(Uniwind.updateCSSVariables).toHaveBeenCalled();
      expect(Uniwind.setTheme).toHaveBeenCalled();
    });
  });
});
