/**
 * Unit tests for useSettingsStore — orientationLock and related settings
 */

import { useSettingsStore } from "../useSettingsStore";

// Mock theme/style utilities
jest.mock("uniwind", () => ({
  Uniwind: { setTheme: jest.fn() },
}));
jest.mock("../../lib/theme/presets", () => ({
  applyAccentColor: jest.fn(),
  applyStylePreset: jest.fn(),
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
});
