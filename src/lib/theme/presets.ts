/**
 * 主题预设与强调色定义
 *
 * 使用 Uniwind.updateCSSVariables() 在运行时覆盖 HeroUI Native 的 CSS 变量
 */

import { Uniwind } from "uniwind";

// ─── 强调色预设 ─────────────────────────────────────────────

export const ACCENT_PRESETS = {
  blue: {
    label: { en: "Blue", zh: "蓝色" },
    light: { "--accent": "oklch(0.6204 0.195 253.83)", "--accent-foreground": "oklch(0.9911 0 0)" },
    dark: { "--accent": "oklch(0.6204 0.195 253.83)", "--accent-foreground": "oklch(0.9911 0 0)" },
    swatch: "#4F6BED",
  },
  purple: {
    label: { en: "Purple", zh: "紫色" },
    light: { "--accent": "oklch(0.5469 0.218 292.72)", "--accent-foreground": "oklch(0.9911 0 0)" },
    dark: { "--accent": "oklch(0.5938 0.218 292.72)", "--accent-foreground": "oklch(0.9911 0 0)" },
    swatch: "#8B5CF6",
  },
  green: {
    label: { en: "Green", zh: "绿色" },
    light: { "--accent": "oklch(0.6503 0.178 155.83)", "--accent-foreground": "oklch(0.9911 0 0)" },
    dark: { "--accent": "oklch(0.6903 0.178 155.83)", "--accent-foreground": "oklch(0.9911 0 0)" },
    swatch: "#22C55E",
  },
  orange: {
    label: { en: "Orange", zh: "橙色" },
    light: {
      "--accent": "oklch(0.7050 0.191 50.14)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
    },
    dark: {
      "--accent": "oklch(0.7450 0.171 55.14)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
    },
    swatch: "#F97316",
  },
  red: {
    label: { en: "Red", zh: "红色" },
    light: { "--accent": "oklch(0.6232 0.248 21.74)", "--accent-foreground": "oklch(0.9911 0 0)" },
    dark: { "--accent": "oklch(0.5940 0.220 24.63)", "--accent-foreground": "oklch(0.9911 0 0)" },
    swatch: "#EF4444",
  },
  cyan: {
    label: { en: "Cyan", zh: "青色" },
    light: {
      "--accent": "oklch(0.6811 0.141 207.93)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
    },
    dark: {
      "--accent": "oklch(0.7211 0.141 207.93)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
    },
    swatch: "#06B6D4",
  },
  pink: {
    label: { en: "Pink", zh: "粉色" },
    light: { "--accent": "oklch(0.6295 0.225 349.53)", "--accent-foreground": "oklch(0.9911 0 0)" },
    dark: { "--accent": "oklch(0.6695 0.205 349.53)", "--accent-foreground": "oklch(0.9911 0 0)" },
    swatch: "#EC4899",
  },
  amber: {
    label: { en: "Amber", zh: "琥珀" },
    light: {
      "--accent": "oklch(0.7910 0.167 75.93)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
    },
    dark: {
      "--accent": "oklch(0.8210 0.147 75.93)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
    },
    swatch: "#F59E0B",
  },
} as const;

export type AccentColorKey = keyof typeof ACCENT_PRESETS;
export const ACCENT_COLOR_KEYS = Object.keys(ACCENT_PRESETS) as AccentColorKey[];

// ─── 风格预设 ─────────────────────────────────────────────

export interface StylePresetDef {
  label: { en: string; zh: string };
  swatch: string;
  light: Record<string, string>;
  dark: Record<string, string>;
}

export const STYLE_PRESETS: Record<string, StylePresetDef> = {
  default: {
    label: { en: "Default", zh: "默认" },
    swatch: "#4F6BED",
    light: {},
    dark: {},
  },
  ocean: {
    label: { en: "Ocean", zh: "海洋" },
    swatch: "#0EA5E9",
    light: {
      "--accent": "oklch(0.6515 0.178 231.83)",
      "--accent-foreground": "oklch(0.9911 0 0)",
      "--success": "oklch(0.6911 0.141 207.93)",
      "--success-foreground": "oklch(0.2103 0.006 285.89)",
    },
    dark: {
      "--accent": "oklch(0.6915 0.158 231.83)",
      "--accent-foreground": "oklch(0.9911 0 0)",
      "--success": "oklch(0.7211 0.141 207.93)",
      "--success-foreground": "oklch(0.2103 0.006 285.89)",
    },
  },
  forest: {
    label: { en: "Forest", zh: "森林" },
    swatch: "#16A34A",
    light: {
      "--accent": "oklch(0.6503 0.178 155.83)",
      "--accent-foreground": "oklch(0.9911 0 0)",
      "--success": "oklch(0.7329 0.1935 150.81)",
      "--success-foreground": "oklch(0.2103 0.006 285.89)",
    },
    dark: {
      "--accent": "oklch(0.6903 0.158 155.83)",
      "--accent-foreground": "oklch(0.9911 0 0)",
      "--success": "oklch(0.7329 0.1935 150.81)",
      "--success-foreground": "oklch(0.2103 0.006 285.89)",
    },
  },
  sunset: {
    label: { en: "Sunset", zh: "日落" },
    swatch: "#F97316",
    light: {
      "--accent": "oklch(0.7050 0.191 50.14)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
      "--success": "oklch(0.7819 0.1585 72.33)",
      "--success-foreground": "oklch(0.2103 0.006 285.89)",
    },
    dark: {
      "--accent": "oklch(0.7450 0.171 55.14)",
      "--accent-foreground": "oklch(0.2103 0.006 285.89)",
      "--success": "oklch(0.8203 0.1388 76.34)",
      "--success-foreground": "oklch(0.2103 0.006 285.89)",
    },
  },
};

export type StylePresetKey = keyof typeof STYLE_PRESETS;
export const STYLE_PRESET_KEYS = Object.keys(STYLE_PRESETS) as StylePresetKey[];

// ─── 运行时应用函数 ─────────────────────────────────────────

/**
 * 将强调色 CSS 变量应用到 Uniwind 运行时
 */
export function applyAccentColor(key: AccentColorKey) {
  const preset = ACCENT_PRESETS[key];
  if (!preset) return;
  Uniwind.updateCSSVariables("light", preset.light as Record<string, string>);
  Uniwind.updateCSSVariables("dark", preset.dark as Record<string, string>);
}

/**
 * 将风格预设 CSS 变量应用到 Uniwind 运行时
 */
export function applyStylePreset(key: StylePresetKey) {
  const preset = STYLE_PRESETS[key];
  if (!preset) return;
  if (Object.keys(preset.light).length > 0) {
    Uniwind.updateCSSVariables("light", preset.light);
  }
  if (Object.keys(preset.dark).length > 0) {
    Uniwind.updateCSSVariables("dark", preset.dark);
  }
}
