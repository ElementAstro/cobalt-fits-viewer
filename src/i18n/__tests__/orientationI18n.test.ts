/**
 * Unit tests for orientation-related i18n keys
 */

import { renderHook, act } from "@testing-library/react-native";
import { useI18n } from "../useI18n";

describe("orientation i18n keys", () => {
  afterEach(() => {
    const { result } = renderHook(() => useI18n());
    act(() => {
      result.current.setLocale("en");
    });
  });

  describe("English", () => {
    it("has settings.orientation key", () => {
      const { result } = renderHook(() => useI18n());
      expect(result.current.t("settings.orientation")).toBe("Screen Orientation");
    });

    it("has orientationDefault key", () => {
      const { result } = renderHook(() => useI18n());
      expect(result.current.t("settings.orientationDefault")).toBe("Auto");
    });

    it("has orientationPortrait key", () => {
      const { result } = renderHook(() => useI18n());
      expect(result.current.t("settings.orientationPortrait")).toBe("Portrait");
    });

    it("has orientationLandscape key", () => {
      const { result } = renderHook(() => useI18n());
      expect(result.current.t("settings.orientationLandscape")).toBe("Landscape");
    });
  });

  describe("Chinese", () => {
    it("has settings.orientation key", () => {
      const { result } = renderHook(() => useI18n());
      act(() => {
        result.current.setLocale("zh");
      });
      expect(result.current.t("settings.orientation")).toBe("屏幕方向");
    });

    it("has orientationDefault key", () => {
      const { result } = renderHook(() => useI18n());
      act(() => {
        result.current.setLocale("zh");
      });
      expect(result.current.t("settings.orientationDefault")).toBe("自动");
    });

    it("has orientationPortrait key", () => {
      const { result } = renderHook(() => useI18n());
      act(() => {
        result.current.setLocale("zh");
      });
      expect(result.current.t("settings.orientationPortrait")).toBe("竖屏");
    });

    it("has orientationLandscape key", () => {
      const { result } = renderHook(() => useI18n());
      act(() => {
        result.current.setLocale("zh");
      });
      expect(result.current.t("settings.orientationLandscape")).toBe("横屏");
    });
  });
});
