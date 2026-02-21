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

    it("has general interaction defaults enabled", () => {
      const s = useSettingsStore.getState();
      expect(s.hapticsEnabled).toBe(true);
      expect(s.confirmDestructiveActions).toBe(true);
      expect(s.autoCheckUpdates).toBe(true);
      expect(s.logMinLevel).toBe(__DEV__ ? "debug" : "info");
      expect(s.logMaxEntries).toBe(2000);
      expect(s.logConsoleOutput).toBe(__DEV__);
      expect(s.logPersistEnabled).toBe(true);
    });

    it("has stacking detection defaults", () => {
      const s = useSettingsStore.getState();
      expect(s.stackingDetectionProfile).toBe("balanced");
      expect(s.stackingDetectSigmaThreshold).toBe(5);
      expect(s.stackingDetectMaxStars).toBe(220);
      expect(s.stackingDetectSigmaClipIters).toBe(2);
      expect(s.stackingDetectApplyMatchedFilter).toBe(true);
      expect(s.stackingDetectConnectivity).toBe(8);
      expect(s.stackingDetectMinFwhm).toBe(0.6);
      expect(s.stackingDetectMinSharpness).toBe(0.25);
      expect(s.stackingDetectMaxSharpness).toBe(18);
      expect(s.stackingDetectPeakMax).toBe(0);
      expect(s.stackingDetectSnrMin).toBe(2);
      expect(s.stackingUseAnnotatedForAlignment).toBe(true);
      expect(s.stackingDeblendNLevels).toBe(16);
      expect(s.stackingAlignmentInlierThreshold).toBe(3);
    });

    it("has frame classification defaults", () => {
      const s = useSettingsStore.getState();
      expect(s.frameClassificationConfig.frameTypes.some((item) => item.key === "darkflat")).toBe(
        true,
      );
      expect(s.reportFrameTypes).toEqual(["light"]);
    });

    it("has processing profile defaults", () => {
      const s = useSettingsStore.getState();
      expect(s.imageProcessingProfile).toBe("standard");
      expect(s.viewerApplyEditorRecipe).toBe(true);
    });

    it("has file list grid column default", () => {
      const s = useSettingsStore.getState();
      expect(s.fileListGridColumns).toBe(3);
    });

    it("has target interaction defaults", () => {
      const s = useSettingsStore.getState();
      expect(s.targetActionControlMode).toBe("icon");
      expect(s.targetActionSizePreset).toBe("standard");
      expect(s.targetActionAutoScaleFromFont).toBe(true);
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

  describe("general interaction settings", () => {
    it("updates hapticsEnabled", () => {
      useSettingsStore.getState().setHapticsEnabled(false);
      expect(useSettingsStore.getState().hapticsEnabled).toBe(false);
    });

    it("updates confirmDestructiveActions", () => {
      useSettingsStore.getState().setConfirmDestructiveActions(false);
      expect(useSettingsStore.getState().confirmDestructiveActions).toBe(false);
    });

    it("updates autoCheckUpdates", () => {
      useSettingsStore.getState().setAutoCheckUpdates(false);
      expect(useSettingsStore.getState().autoCheckUpdates).toBe(false);
    });

    it("updates log settings", () => {
      const store = useSettingsStore.getState();
      store.setLogMinLevel("warn");
      store.setLogMaxEntries(5000);
      store.setLogConsoleOutput(false);
      store.setLogPersistEnabled(false);

      const s = useSettingsStore.getState();
      expect(s.logMinLevel).toBe("warn");
      expect(s.logMaxEntries).toBe(5000);
      expect(s.logConsoleOutput).toBe(false);
      expect(s.logPersistEnabled).toBe(false);
    });
  });

  describe("processing profile settings", () => {
    it("updates imageProcessingProfile", () => {
      const store = useSettingsStore.getState();
      store.setImageProcessingProfile("legacy");
      expect(useSettingsStore.getState().imageProcessingProfile).toBe("legacy");
      store.setImageProcessingProfile("standard");
      expect(useSettingsStore.getState().imageProcessingProfile).toBe("standard");
    });

    it("updates viewerApplyEditorRecipe", () => {
      const store = useSettingsStore.getState();
      store.setViewerApplyEditorRecipe(false);
      expect(useSettingsStore.getState().viewerApplyEditorRecipe).toBe(false);
      store.setViewerApplyEditorRecipe(true);
      expect(useSettingsStore.getState().viewerApplyEditorRecipe).toBe(true);
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

    it("setCustomThemeToken supports background/surface overrides", () => {
      const store = useSettingsStore.getState();
      store.setCustomThemeToken("background", "#0F172A", "light");
      store.setCustomThemeToken("surface", "#1E293B", "light");

      const s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("custom");
      expect(s.customThemeColors.light.background).toBe("#0F172A");
      expect(s.customThemeColors.light.surface).toBe("#1E293B");
      expect(s.customThemeColors.dark.background).toBe("#0F172A");
      expect(s.customThemeColors.dark.surface).toBe("#1E293B");
    });

    it("setCustomThemeToken allows clearing optional background token", () => {
      const store = useSettingsStore.getState();
      store.setCustomThemeToken("background", "#0F172A", "light");
      store.setCustomThemeToken("background", "", "light");

      const s = useSettingsStore.getState();
      expect(s.customThemeColors.light.background).toBe("");
      expect(s.customThemeColors.dark.background).toBe("");
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

    it("setCustomThemeLinked false allows dark-only base token override", () => {
      useSettingsStore.getState().setCustomThemeLinked(false);
      useSettingsStore.getState().setCustomThemeToken("surface", "#223344", "dark");
      const s = useSettingsStore.getState();
      expect(s.customThemeColors.linked).toBe(false);
      expect(s.customThemeColors.dark.surface).toBe("#223344");
      expect(s.customThemeColors.light.surface).toBe("");
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

    it("partialize includes interaction settings", () => {
      const partialize = useSettingsStore.persist.getOptions().partialize;
      expect(partialize).toBeDefined();
      const partial = partialize?.(useSettingsStore.getState()) as {
        hapticsEnabled?: boolean;
        confirmDestructiveActions?: boolean;
        autoCheckUpdates?: boolean;
        logMinLevel?: string;
        logMaxEntries?: number;
        logConsoleOutput?: boolean;
        logPersistEnabled?: boolean;
        targetActionControlMode?: string;
        targetActionSizePreset?: string;
        targetActionAutoScaleFromFont?: boolean;
      };
      expect(partial?.hapticsEnabled).toBe(useSettingsStore.getState().hapticsEnabled);
      expect(partial?.confirmDestructiveActions).toBe(
        useSettingsStore.getState().confirmDestructiveActions,
      );
      expect(partial?.autoCheckUpdates).toBe(useSettingsStore.getState().autoCheckUpdates);
      expect(partial?.logMinLevel).toBe(useSettingsStore.getState().logMinLevel);
      expect(partial?.logMaxEntries).toBe(useSettingsStore.getState().logMaxEntries);
      expect(partial?.logConsoleOutput).toBe(useSettingsStore.getState().logConsoleOutput);
      expect(partial?.logPersistEnabled).toBe(useSettingsStore.getState().logPersistEnabled);
      expect(partial?.targetActionControlMode).toBe(
        useSettingsStore.getState().targetActionControlMode,
      );
      expect(partial?.targetActionSizePreset).toBe(
        useSettingsStore.getState().targetActionSizePreset,
      );
      expect(partial?.targetActionAutoScaleFromFont).toBe(
        useSettingsStore.getState().targetActionAutoScaleFromFont,
      );
    });

    it("partialize includes stacking advanced settings", () => {
      const partialize = useSettingsStore.persist.getOptions().partialize;
      const partial = partialize?.(useSettingsStore.getState()) as {
        stackingDetectionProfile?: string;
        stackingDetectSigmaThreshold?: number;
        stackingDetectMaxStars?: number;
        stackingDetectSigmaClipIters?: number;
        stackingDetectApplyMatchedFilter?: boolean;
        stackingDetectConnectivity?: number;
        stackingDetectMinFwhm?: number;
        stackingDetectMinSharpness?: number;
        stackingDetectMaxSharpness?: number;
        stackingDetectPeakMax?: number;
        stackingDetectSnrMin?: number;
        stackingUseAnnotatedForAlignment?: boolean;
        stackingDeblendNLevels?: number;
        stackingAlignmentInlierThreshold?: number;
      };
      expect(partial.stackingDetectionProfile).toBe("balanced");
      expect(partial.stackingDetectSigmaThreshold).toBe(5);
      expect(partial.stackingDetectMaxStars).toBe(220);
      expect(partial.stackingDetectSigmaClipIters).toBe(2);
      expect(partial.stackingDetectApplyMatchedFilter).toBe(true);
      expect(partial.stackingDetectConnectivity).toBe(8);
      expect(partial.stackingDetectMinFwhm).toBe(0.6);
      expect(partial.stackingDetectMinSharpness).toBe(0.25);
      expect(partial.stackingDetectMaxSharpness).toBe(18);
      expect(partial.stackingDetectPeakMax).toBe(0);
      expect(partial.stackingDetectSnrMin).toBe(2);
      expect(partial.stackingUseAnnotatedForAlignment).toBe(true);
      expect(partial.stackingDeblendNLevels).toBe(16);
      expect(partial.stackingAlignmentInlierThreshold).toBe(3);
    });

    it("applySettingsPatch sanitizes out-of-range values", () => {
      useSettingsStore.getState().applySettingsPatch({
        thumbnailQuality: 1000,
        thumbnailSize: 10,
        fileListGridColumns: 9,
        canvasMinScale: 8,
        canvasMaxScale: 2,
        canvasDoubleTapScale: 50,
        canvasPinchSensitivity: 9,
        canvasPinchOverzoomFactor: 0,
        canvasPanRubberBandFactor: -1,
        canvasWheelZoomSensitivity: 1,
        defaultBlackPoint: 0.95,
        defaultWhitePoint: 0.5,
      });

      const s = useSettingsStore.getState();
      expect(s.thumbnailQuality).toBe(100);
      expect(s.thumbnailSize).toBe(64);
      expect(s.fileListGridColumns).toBe(3);
      expect(s.canvasMaxScale).toBeGreaterThanOrEqual(s.canvasMinScale);
      expect(s.canvasDoubleTapScale).toBeLessThanOrEqual(s.canvasMaxScale);
      expect(s.canvasPinchSensitivity).toBe(1.8);
      expect(s.canvasPinchOverzoomFactor).toBe(1);
      expect(s.canvasPanRubberBandFactor).toBe(0);
      expect(s.canvasWheelZoomSensitivity).toBe(0.004);
      expect(s.defaultWhitePoint).toBeGreaterThan(s.defaultBlackPoint);
    });

    it("applySettingsPatch sanitizes stacking detection numeric range and area consistency", () => {
      useSettingsStore.getState().applySettingsPatch({
        stackingDetectSigmaThreshold: 200,
        stackingDetectMaxStars: 99999,
        stackingDetectMinArea: 500,
        stackingDetectMaxArea: 40,
        stackingDetectSigmaClipIters: 99,
        stackingDetectConnectivity: 99,
        stackingDetectMinFwhm: -5,
        stackingDeblendNLevels: 0,
        stackingDeblendMinContrast: -1,
        stackingFilterFwhm: 99,
        stackingDetectMinSharpness: -1,
        stackingDetectMaxSharpness: -1,
        stackingDetectPeakMax: -1,
        stackingDetectSnrMin: -1,
        stackingMaxEllipticity: 5,
        stackingRansacMaxIterations: 2,
        stackingAlignmentInlierThreshold: 99,
      });

      const s = useSettingsStore.getState();
      expect(s.stackingDetectSigmaThreshold).toBe(20);
      expect(s.stackingDetectMaxStars).toBe(2000);
      expect(s.stackingDetectMinArea).toBeLessThanOrEqual(s.stackingDetectMaxArea);
      expect(s.stackingDetectSigmaClipIters).toBe(10);
      expect(s.stackingDetectConnectivity).toBe(8);
      expect(s.stackingDetectMinFwhm).toBe(0.1);
      expect(s.stackingDeblendNLevels).toBe(1);
      expect(s.stackingDeblendMinContrast).toBe(0);
      expect(s.stackingFilterFwhm).toBe(15);
      expect(s.stackingDetectMinSharpness).toBe(0);
      expect(s.stackingDetectMaxSharpness).toBeGreaterThanOrEqual(s.stackingDetectMinSharpness);
      expect(s.stackingDetectPeakMax).toBe(0);
      expect(s.stackingDetectSnrMin).toBe(0);
      expect(s.stackingMaxEllipticity).toBe(1);
      expect(s.stackingRansacMaxIterations).toBe(10);
      expect(s.stackingAlignmentInlierThreshold).toBe(20);
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

    it("applySettingsPatch drops invalid boolean payloads", () => {
      useSettingsStore.getState().applySettingsPatch({
        hapticsEnabled: "yes",
        confirmDestructiveActions: 1,
        autoCheckUpdates: "no",
        logConsoleOutput: "false",
        logPersistEnabled: 0,
      } as unknown as Record<string, unknown>);

      const s = useSettingsStore.getState();
      expect(s.hapticsEnabled).toBe(true);
      expect(s.confirmDestructiveActions).toBe(true);
      expect(s.autoCheckUpdates).toBe(true);
      expect(s.logConsoleOutput).toBe(true);
      expect(s.logPersistEnabled).toBe(true);
    });

    it("applySettingsPatch sanitizes target interaction fields", () => {
      useSettingsStore.getState().applySettingsPatch({
        targetActionControlMode: "checkbox",
        targetActionSizePreset: "accessible",
        targetActionAutoScaleFromFont: false,
      });

      let s = useSettingsStore.getState();
      expect(s.targetActionControlMode).toBe("checkbox");
      expect(s.targetActionSizePreset).toBe("accessible");
      expect(s.targetActionAutoScaleFromFont).toBe(false);

      useSettingsStore.getState().applySettingsPatch({
        targetActionControlMode: "invalid",
        targetActionSizePreset: "bad",
        targetActionAutoScaleFromFont: "yes",
      } as unknown as Record<string, unknown>);

      s = useSettingsStore.getState();
      expect(s.targetActionControlMode).toBe("checkbox");
      expect(s.targetActionSizePreset).toBe("accessible");
      expect(s.targetActionAutoScaleFromFont).toBe(false);
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

    it("persist merge backfills new custom base tokens for legacy payloads", () => {
      const merge = useSettingsStore.persist.getOptions().merge;
      const current = useSettingsStore.getState();
      const merged = merge?.(
        {
          customThemeColors: {
            linked: false,
            light: {
              accent: "#112233",
              success: "#22C55E",
              warning: "#F59E0B",
              danger: "#EF4444",
            },
            dark: {
              accent: "#445566",
              success: "#22C55E",
              warning: "#F59E0B",
              danger: "#EF4444",
            },
          },
        },
        current,
      ) as typeof current;

      expect(merged.customThemeColors.light.background).toBe("");
      expect(merged.customThemeColors.light.surface).toBe("");
      expect(merged.customThemeColors.dark.background).toBe("");
      expect(merged.customThemeColors.dark.surface).toBe("");
    });

    it("sanitizes frame classification config and report scope", () => {
      useSettingsStore.getState().applySettingsPatch({
        frameClassificationConfig: {
          frameTypes: [{ key: "focus", label: "Focus" }],
          rules: [
            {
              id: "rule-1",
              enabled: true,
              priority: 10,
              target: "filename",
              matchType: "contains",
              pattern: "focus",
              frameType: "focus",
            },
            {
              id: "invalid-rule",
              enabled: true,
              priority: 10,
              target: "filename",
              matchType: "contains",
              pattern: "x",
              frameType: "missing",
            },
          ],
        },
        reportFrameTypes: ["focus", "missing"],
      } as unknown as Record<string, unknown>);

      const s = useSettingsStore.getState();
      expect(s.frameClassificationConfig.frameTypes.some((item) => item.key === "darkflat")).toBe(
        true,
      );
      expect(s.frameClassificationConfig.frameTypes.some((item) => item.key === "focus")).toBe(
        true,
      );
      expect(s.frameClassificationConfig.rules).toHaveLength(1);
      expect(s.reportFrameTypes).toEqual(["focus"]);
    });
  });

  describe("runtime sync", () => {
    it("updates uniwind variables when style changes", () => {
      useSettingsStore.getState().setAccentColor("cyan");
      expect(Uniwind.updateCSSVariables).toHaveBeenCalled();
      expect(Uniwind.setTheme).toHaveBeenCalled();
    });
  });

  describe("additional action coverage", () => {
    it("covers remaining direct setters", () => {
      const store = useSettingsStore.getState();
      store.setDefaultStretch("linear");
      store.setDefaultColormap("heat");
      store.setDefaultGridColumns(4);
      store.setDefaultExportFormat("jpeg");
      store.setAutoGroupByObject(false);
      store.setAutoDetectDuplicates(false);
      store.setAutoTagLocation(true);
      store.setLogMinLevel("warn");
      store.setLogConsoleOutput(false);
      store.setLogPersistEnabled(false);
      store.setSessionGapMinutes(90);
      store.setCalendarSyncEnabled(true);
      store.setDefaultReminderMinutes(10);
      store.setFontFamily("space-grotesk");
      store.setMonoFontFamily("jetbrains-mono");
      store.setDefaultShowGrid(true);
      store.setDefaultShowCrosshair(true);
      store.setDefaultShowPixelInfo(false);
      store.setDefaultShowMinimap(true);
      store.setDefaultHistogramMode("log");
      store.setDefaultGallerySortBy("name");
      store.setDefaultGallerySortOrder("asc");
      store.setDefaultStackMethod("median");
      store.setDefaultAlignmentMode("full");
      store.setDefaultEnableQuality(true);
      store.setStackingDetectApplyMatchedFilter(false);
      store.setStackingDetectConnectivity(4);
      store.setStackingUseAnnotatedForAlignment(false);
      store.setUseHighQualityPreview(false);
      store.setGridColor("#abcdef");
      store.setCrosshairColor("#fedcba");
      store.setThumbnailShowFilename(false);
      store.setThumbnailShowObject(true);
      store.setThumbnailShowFilter(false);
      store.setThumbnailShowExposure(true);
      store.setFileListStyle("compact");
      store.setFileListGridColumns(4);
      store.setDefaultConverterFormat("tiff");
      store.setBatchNamingRule("sequence");
      store.setTimelineGrouping("week");
      store.setSessionShowExposureCount(false);
      store.setSessionShowTotalExposure(false);
      store.setSessionShowFilters(false);
      store.setTargetSortBy("frames");
      store.setTargetSortOrder("desc");
      store.setTargetActionControlMode("checkbox");
      store.setTargetActionSizePreset("accessible");
      store.setTargetActionAutoScaleFromFont(false);
      store.setDefaultComposePreset("sho");
      store.setFrameClassificationConfig({
        frameTypes: [
          { key: "light", label: "Light", builtin: true },
          { key: "dark", label: "Dark", builtin: true },
          { key: "flat", label: "Flat", builtin: true },
          { key: "bias", label: "Bias", builtin: true },
          { key: "darkflat", label: "Dark Flat", builtin: true },
          { key: "unknown", label: "Unknown", builtin: true },
          { key: "focus", label: "Focus", builtin: false },
        ],
        rules: [],
      });
      store.setReportFrameTypes(["light", "focus"]);

      const s = useSettingsStore.getState();
      expect(s.defaultStretch).toBe("linear");
      expect(s.defaultColormap).toBe("heat");
      expect(s.defaultGridColumns).toBe(4);
      expect(s.defaultExportFormat).toBe("jpeg");
      expect(s.autoGroupByObject).toBe(false);
      expect(s.autoDetectDuplicates).toBe(false);
      expect(s.autoTagLocation).toBe(true);
      expect(s.logMinLevel).toBe("warn");
      expect(s.logConsoleOutput).toBe(false);
      expect(s.logPersistEnabled).toBe(false);
      expect(s.sessionGapMinutes).toBe(90);
      expect(s.calendarSyncEnabled).toBe(true);
      expect(s.defaultReminderMinutes).toBe(10);
      expect(s.fontFamily).toBe("space-grotesk");
      expect(s.monoFontFamily).toBe("jetbrains-mono");
      expect(s.defaultShowGrid).toBe(true);
      expect(s.defaultShowCrosshair).toBe(true);
      expect(s.defaultShowPixelInfo).toBe(false);
      expect(s.defaultShowMinimap).toBe(true);
      expect(s.defaultHistogramMode).toBe("log");
      expect(s.defaultGallerySortBy).toBe("name");
      expect(s.defaultGallerySortOrder).toBe("asc");
      expect(s.defaultStackMethod).toBe("median");
      expect(s.defaultAlignmentMode).toBe("full");
      expect(s.defaultEnableQuality).toBe(true);
      expect(s.stackingDetectApplyMatchedFilter).toBe(false);
      expect(s.stackingDetectConnectivity).toBe(4);
      expect(s.stackingUseAnnotatedForAlignment).toBe(false);
      expect(s.useHighQualityPreview).toBe(false);
      expect(s.gridColor).toBe("#abcdef");
      expect(s.crosshairColor).toBe("#fedcba");
      expect(s.thumbnailShowFilename).toBe(false);
      expect(s.thumbnailShowObject).toBe(true);
      expect(s.thumbnailShowFilter).toBe(false);
      expect(s.thumbnailShowExposure).toBe(true);
      expect(s.fileListStyle).toBe("compact");
      expect(s.fileListGridColumns).toBe(4);
      expect(s.defaultConverterFormat).toBe("tiff");
      expect(s.batchNamingRule).toBe("sequence");
      expect(s.timelineGrouping).toBe("week");
      expect(s.sessionShowExposureCount).toBe(false);
      expect(s.sessionShowTotalExposure).toBe(false);
      expect(s.sessionShowFilters).toBe(false);
      expect(s.targetSortBy).toBe("frames");
      expect(s.targetSortOrder).toBe("desc");
      expect(s.targetActionControlMode).toBe("checkbox");
      expect(s.targetActionSizePreset).toBe("accessible");
      expect(s.targetActionAutoScaleFromFont).toBe(false);
      expect(s.defaultComposePreset).toBe("sho");
      expect(s.frameClassificationConfig.frameTypes.some((item) => item.key === "focus")).toBe(
        true,
      );
      expect(s.reportFrameTypes).toEqual(["light", "focus"]);
    });

    it("covers remaining patch-backed numeric setters", () => {
      const store = useSettingsStore.getState();
      store.setThumbnailQuality(91);
      store.setLogMaxEntries(3333);
      store.setThumbnailSize(320);
      store.setDefaultBlackPoint(0.2);
      store.setDefaultWhitePoint(0.8);
      store.setDefaultGamma(1.3);
      store.setHistogramHeight(160);
      store.setPixelInfoDecimalPlaces(4);
      store.setDefaultSigmaValue(3.2);
      store.setImageProcessingDebounce(240);
      store.setGridOpacity(0.4);
      store.setCrosshairOpacity(0.6);
      store.setCanvasMinScale(0.8);
      store.setCanvasMaxScale(12);
      store.setCanvasDoubleTapScale(4);
      store.setCanvasPinchSensitivity(1.45);
      store.setCanvasPinchOverzoomFactor(1.35);
      store.setCanvasPanRubberBandFactor(0.7);
      store.setCanvasWheelZoomSensitivity(0.0024);
      store.setStackingDetectSigmaClipIters(3);
      store.setStackingDetectMinFwhm(0.9);
      store.setStackingDetectMaxSharpness(9.8);
      store.setStackingDetectMinSharpness(0.4);
      store.setStackingDetectPeakMax(4321);
      store.setStackingDetectSnrMin(2.7);
      store.setDefaultConverterQuality(88);
      store.setDefaultBlurSigma(2.4);
      store.setDefaultSharpenAmount(2.2);
      store.setDefaultDenoiseRadius(3);
      store.setEditorMaxUndo(25);
      store.setComposeRedWeight(1.7);
      store.setComposeGreenWeight(1.1);
      store.setComposeBlueWeight(0.9);

      const s = useSettingsStore.getState();
      expect(s.thumbnailQuality).toBe(91);
      expect(s.logMaxEntries).toBe(3333);
      expect(s.thumbnailSize).toBe(320);
      expect(s.defaultBlackPoint).toBe(0.2);
      expect(s.defaultWhitePoint).toBe(0.8);
      expect(s.defaultGamma).toBe(1.3);
      expect(s.histogramHeight).toBe(160);
      expect(s.pixelInfoDecimalPlaces).toBe(4);
      expect(s.defaultSigmaValue).toBe(3.2);
      expect(s.imageProcessingDebounce).toBe(240);
      expect(s.gridOpacity).toBe(0.4);
      expect(s.crosshairOpacity).toBe(0.6);
      expect(s.canvasMinScale).toBe(0.8);
      expect(s.canvasMaxScale).toBe(12);
      expect(s.canvasDoubleTapScale).toBe(4);
      expect(s.canvasPinchSensitivity).toBe(1.45);
      expect(s.canvasPinchOverzoomFactor).toBe(1.35);
      expect(s.canvasPanRubberBandFactor).toBe(0.7);
      expect(s.canvasWheelZoomSensitivity).toBe(0.0024);
      expect(s.stackingDetectSigmaClipIters).toBe(3);
      expect(s.stackingDetectMinFwhm).toBe(0.9);
      expect(s.stackingDetectMinSharpness).toBe(0.4);
      expect(s.stackingDetectMaxSharpness).toBe(9.8);
      expect(s.stackingDetectPeakMax).toBe(4321);
      expect(s.stackingDetectSnrMin).toBe(2.7);
      expect(s.defaultConverterQuality).toBe(88);
      expect(s.defaultBlurSigma).toBe(2.4);
      expect(s.defaultSharpenAmount).toBe(2.2);
      expect(s.defaultDenoiseRadius).toBe(3);
      expect(s.editorMaxUndo).toBe(25);
      expect(s.composeRedWeight).toBe(1.7);
      expect(s.composeGreenWeight).toBe(1.1);
      expect(s.composeBlueWeight).toBe(0.9);
    });

    it("resets frame classification defaults", () => {
      const store = useSettingsStore.getState();
      store.setFrameClassificationConfig({
        frameTypes: [
          { key: "light", label: "Light", builtin: true },
          { key: "dark", label: "Dark", builtin: true },
          { key: "flat", label: "Flat", builtin: true },
          { key: "bias", label: "Bias", builtin: true },
          { key: "darkflat", label: "Dark Flat", builtin: true },
          { key: "unknown", label: "Unknown", builtin: true },
          { key: "focus", label: "Focus", builtin: false },
        ],
        rules: [],
      });
      store.setReportFrameTypes(["focus"]);
      store.resetFrameClassificationConfig();

      const s = useSettingsStore.getState();
      expect(s.frameClassificationConfig.frameTypes.some((item) => item.key === "focus")).toBe(
        false,
      );
      expect(s.reportFrameTypes).toEqual(["light"]);
    });

    it("normalizes legacy targetSortBy value in applySettingsPatch", () => {
      useSettingsStore.getState().applySettingsPatch({
        targetSortBy: "priority",
      } as unknown as Record<string, unknown>);
      expect(useSettingsStore.getState().targetSortBy).toBe("favorite");
    });

    it("enforces theme mode exclusivity in applySettingsPatch", () => {
      const store = useSettingsStore.getState();
      store.applySettingsPatch({
        themeColorMode: "accent",
        accentColor: null,
      });
      let s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("accent");
      expect(s.accentColor).toBe("blue");
      expect(s.activePreset).toBe("default");

      store.applySettingsPatch({
        themeColorMode: "preset",
        activePreset: "ocean",
        accentColor: "cyan",
      });
      s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("preset");
      expect(s.activePreset).toBe("ocean");
      expect(s.accentColor).toBeNull();

      store.applySettingsPatch({
        themeColorMode: "custom",
        customThemeColors: {
          linked: false,
          light: {
            accent: "#112233",
            success: "#22C55E",
            warning: "#F59E0B",
            danger: "#EF4444",
          },
          dark: {
            accent: "#445566",
            success: "#22C55E",
            warning: "#F59E0B",
            danger: "#EF4444",
          },
        },
      });
      s = useSettingsStore.getState();
      expect(s.themeColorMode).toBe("custom");
      expect(s.customThemeColors.light.accent).toBe("#112233");
      expect(s.customThemeColors.dark.accent).toBe("#445566");
    });

    it("includes video defaults and supports video setters", () => {
      const store = useSettingsStore.getState();
      expect(store.videoAutoplay).toBe(false);
      expect(store.videoLoopByDefault).toBe(false);
      expect(store.videoMutedByDefault).toBe(false);
      expect(store.videoThumbnailTimeMs).toBe(1000);
      expect(store.videoProcessingConcurrency).toBe(2);
      expect(store.defaultVideoProfile).toBe("compatibility");
      expect(store.defaultVideoTargetPreset).toBe("1080p");

      store.setVideoAutoplay(true);
      store.setVideoLoopByDefault(true);
      store.setVideoMutedByDefault(true);
      store.setVideoThumbnailTimeMs(2500);
      store.setVideoProcessingConcurrency(4);
      store.setDefaultVideoProfile("balanced");
      store.setDefaultVideoTargetPreset("720p");
      store.setVideoCoreEnabled(false);
      store.setVideoProcessingEnabled(false);

      const s = useSettingsStore.getState();
      expect(s.videoAutoplay).toBe(true);
      expect(s.videoLoopByDefault).toBe(true);
      expect(s.videoMutedByDefault).toBe(true);
      expect(s.videoThumbnailTimeMs).toBe(2500);
      expect(s.videoProcessingConcurrency).toBe(4);
      expect(s.defaultVideoProfile).toBe("balanced");
      expect(s.defaultVideoTargetPreset).toBe("720p");
      expect(s.videoCoreEnabled).toBe(false);
      expect(s.videoProcessingEnabled).toBe(false);
    });

    it("sanitizes video numeric patch values and persists video fields", () => {
      useSettingsStore.getState().applySettingsPatch({
        videoThumbnailTimeMs: -99,
        videoProcessingConcurrency: 99,
      });

      const s = useSettingsStore.getState();
      expect(s.videoThumbnailTimeMs).toBe(0);
      expect(s.videoProcessingConcurrency).toBe(6);

      const partialize = useSettingsStore.persist.getOptions().partialize;
      const partial = partialize?.(s) as {
        videoAutoplay?: boolean;
        videoLoopByDefault?: boolean;
        videoMutedByDefault?: boolean;
        videoThumbnailTimeMs?: number;
        videoProcessingConcurrency?: number;
        defaultVideoProfile?: string;
        defaultVideoTargetPreset?: string;
        videoCoreEnabled?: boolean;
        videoProcessingEnabled?: boolean;
      };

      expect(partial.videoThumbnailTimeMs).toBe(0);
      expect(partial.videoProcessingConcurrency).toBe(6);
      expect(partial.defaultVideoProfile).toBe(s.defaultVideoProfile);
      expect(partial.defaultVideoTargetPreset).toBe(s.defaultVideoTargetPreset);
      expect(partial.videoCoreEnabled).toBe(s.videoCoreEnabled);
      expect(partial.videoProcessingEnabled).toBe(s.videoProcessingEnabled);
    });

    it("onRehydrateStorage syncs runtime theme from hydrated state", () => {
      const onRehydrate = useSettingsStore.persist.getOptions().onRehydrateStorage;
      const callback = onRehydrate?.(useSettingsStore.getState());
      callback?.({
        ...useSettingsStore.getState(),
        theme: "light",
      });
      expect(Uniwind.setTheme).toHaveBeenCalledWith("light");
      expect(Uniwind.updateCSSVariables).toHaveBeenCalled();
    });

    it("applySettingsPatch sanitizes invalid imageProcessingProfile enum", () => {
      useSettingsStore.getState().applySettingsPatch({
        imageProcessingProfile: "invalid" as unknown as "standard",
      });
      expect(useSettingsStore.getState().imageProcessingProfile).toBe("standard");
    });
  });
});
