/**
 * 字体预设定义
 * 集中管理自定义字体的名称、标签和 fontFamily 映射
 */

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from "@expo-google-fonts/space-grotesk";
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
} from "@expo-google-fonts/jetbrains-mono";
import type { FontSource } from "expo-font";

// ─── 字体族类型 ─────────────────────────────────────────────

export type FontFamilyKey = "system" | "inter" | "space-grotesk";
export type MonoFontKey = "system-mono" | "jetbrains-mono";

// ─── 字体族预设 ─────────────────────────────────────────────

export interface FontPreset {
  label: { en: string; zh: string };
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
}

export const FONT_FAMILY_PRESETS: Record<FontFamilyKey, FontPreset> = {
  system: {
    label: { en: "System Default", zh: "系统默认" },
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System",
  },
  inter: {
    label: { en: "Inter", zh: "Inter" },
    regular: "Inter_400Regular",
    medium: "Inter_500Medium",
    semibold: "Inter_600SemiBold",
    bold: "Inter_700Bold",
  },
  "space-grotesk": {
    label: { en: "Space Grotesk", zh: "Space Grotesk" },
    regular: "SpaceGrotesk_400Regular",
    medium: "SpaceGrotesk_500Medium",
    semibold: "SpaceGrotesk_600SemiBold",
    bold: "SpaceGrotesk_700Bold",
  },
};

export interface MonoFontPreset {
  label: { en: string; zh: string };
  regular: string;
  medium: string;
  semibold: string;
  bold: string;
}

export const MONO_FONT_PRESETS: Record<MonoFontKey, MonoFontPreset> = {
  "system-mono": {
    label: { en: "System Mono", zh: "系统等宽" },
    regular: "System",
    medium: "System",
    semibold: "System",
    bold: "System",
  },
  "jetbrains-mono": {
    label: { en: "JetBrains Mono", zh: "JetBrains Mono" },
    regular: "JetBrainsMono_400Regular",
    medium: "JetBrainsMono_500Medium",
    semibold: "JetBrainsMono_600SemiBold",
    bold: "JetBrainsMono_700Bold",
  },
};

export const FONT_FAMILY_KEYS = Object.keys(FONT_FAMILY_PRESETS) as FontFamilyKey[];
export const MONO_FONT_KEYS = Object.keys(MONO_FONT_PRESETS) as MonoFontKey[];

// ─── useFonts 加载映射 ──────────────────────────────────────

export const FONT_LOAD_MAP: Record<string, FontSource> = {
  // Inter
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  // Space Grotesk
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  // JetBrains Mono
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
  JetBrainsMono_700Bold,
};
