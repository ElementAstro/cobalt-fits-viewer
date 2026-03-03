/**
 * 自定义字体加载 Hook
 * 使用 expo-font 的 useFonts 异步加载所有自定义字体
 */

import { useFonts } from "expo-font";
import { FONT_LOAD_MAP } from "../lib/theme/fonts";

export function useFontLoader() {
  const [fontsLoaded, fontError] = useFonts(FONT_LOAD_MAP);

  return { fontsLoaded, fontError };
}
