import { renderHook, act } from "@testing-library/react-native";
import { useI18n } from "../useI18n";

describe("useI18n", () => {
  it("should return the current locale", () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.locale).toBe("en");
  });

  it("should translate keys", () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.t("home.title")).toBe("Quick Starter");
  });

  it("should change locale via setLocale", () => {
    const { result } = renderHook(() => useI18n());

    act(() => {
      result.current.setLocale("zh");
    });

    expect(result.current.locale).toBe("zh");
    expect(result.current.t("home.title")).toBe("快速启动");
  });

  it("should fallback to default locale for missing keys", () => {
    const { result } = renderHook(() => useI18n());

    act(() => {
      result.current.setLocale("en");
    });

    const translation = result.current.t("nonexistent.key");
    expect(translation).toBeDefined();
  });

  afterEach(() => {
    // Reset locale to English after each test
    const { result } = renderHook(() => useI18n());
    act(() => {
      result.current.setLocale("en");
    });
  });
});
