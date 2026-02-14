/**
 * 字体上下文 Provider
 * 根据用户设置提供当前字体族名，供组件消费
 */

import { createContext, useContext, useMemo, type PropsWithChildren } from "react";
import { useSettingsStore } from "../../stores/useSettingsStore";
import {
  FONT_FAMILY_PRESETS,
  MONO_FONT_PRESETS,
  type FontFamilyKey,
  type MonoFontKey,
} from "../../lib/theme/fonts";

interface FontContextValue {
  /** 当前正文字体族 key */
  fontFamilyKey: FontFamilyKey;
  /** 当前等宽字体族 key */
  monoFontKey: MonoFontKey;
  /** 是否使用系统默认字体 */
  isSystemFont: boolean;
  /** 获取正文字体的 fontFamily 值（传入 fontWeight 风格） */
  getFontFamily: (weight?: "regular" | "medium" | "semibold" | "bold") => string | undefined;
  /** 获取等宽字体的 fontFamily 值 */
  getMonoFontFamily: (weight?: "regular" | "medium" | "semibold" | "bold") => string | undefined;
}

const FontContext = createContext<FontContextValue>({
  fontFamilyKey: "system",
  monoFontKey: "system-mono",
  isSystemFont: true,
  getFontFamily: () => undefined,
  getMonoFontFamily: () => undefined,
});

export function FontProvider({ children }: PropsWithChildren) {
  const fontFamilyKey = useSettingsStore((s) => s.fontFamily);
  const monoFontKey = useSettingsStore((s) => s.monoFontFamily);

  const value = useMemo<FontContextValue>(() => {
    const isSystemFont = fontFamilyKey === "system";
    const preset = FONT_FAMILY_PRESETS[fontFamilyKey];
    const monoPreset = MONO_FONT_PRESETS[monoFontKey];

    const getFontFamily = (weight: "regular" | "medium" | "semibold" | "bold" = "regular") => {
      if (isSystemFont) return undefined;
      return preset[weight];
    };

    const getMonoFontFamily = (weight: "regular" | "medium" | "semibold" | "bold" = "regular") => {
      if (monoFontKey === "system-mono") return undefined;
      return monoPreset[weight];
    };

    return {
      fontFamilyKey,
      monoFontKey,
      isSystemFont,
      getFontFamily,
      getMonoFontFamily,
    };
  }, [fontFamilyKey, monoFontKey]);

  return <FontContext.Provider value={value}>{children}</FontContext.Provider>;
}

/**
 * 获取当前字体上下文
 */
export function useFontFamily() {
  return useContext(FontContext);
}
