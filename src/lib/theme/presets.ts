/**
 * 主题预设与强调色定义
 *
 * 使用 Uniwind.updateCSSVariables() 在运行时覆盖 HeroUI Native 的 CSS 变量
 */

import { Uniwind } from "uniwind";

type ThemeVariableMap = Record<string, string>;

export const THEME_COLOR_MODES = ["preset", "accent", "custom"] as const;
export type ThemeColorMode = (typeof THEME_COLOR_MODES)[number];

const THEME_BASE_TOKENS = ["background", "surface"] as const;
const THEME_SEMANTIC_TOKENS = ["accent", "success", "warning", "danger"] as const;
export const THEME_EDITABLE_TOKENS = [...THEME_BASE_TOKENS, ...THEME_SEMANTIC_TOKENS] as const;
export type ThemeEditableToken = (typeof THEME_EDITABLE_TOKENS)[number];

export interface ThemeCustomTokenSet {
  background: string;
  surface: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
}

export interface ThemeCustomColors {
  linked: boolean;
  light: ThemeCustomTokenSet;
  dark: ThemeCustomTokenSet;
}

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{6})$/;

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

// ─── 基线变量 ───────────────────────────────────────────────

export const BASE_THEME_VARIABLES: { light: ThemeVariableMap; dark: ThemeVariableMap } = {
  light: {
    "--accent": "hsl(253.83, 100%, 62.04%)",
    "--accent-foreground": "hsl(0, 0%, 100%)",
    "--success": "hsl(150.81, 100%, 73.29%)",
    "--success-foreground": "hsl(285.89, 5.9%, 21.03%)",
    "--warning": "hsl(72.33, 100%, 78.19%)",
    "--warning-foreground": "hsl(285.89, 5.9%, 21.03%)",
    "--danger": "hsl(25.74, 100%, 65.32%)",
    "--danger-foreground": "hsl(285.89, 5.9%, 21.03%)",
  },
  dark: {
    "--accent": "hsl(264.1, 100%, 55.1%)",
    "--accent-foreground": "hsl(0, 0%, 100%)",
    "--success": "hsl(163.2, 100%, 76.5%)",
    "--success-foreground": "hsl(285.89, 5.9%, 21.03%)",
    "--warning": "hsl(86, 100%, 79.5%)",
    "--warning-foreground": "hsl(285.89, 5.9%, 21.03%)",
    "--danger": "hsl(25.3, 100%, 63.7%)",
    "--danger-foreground": "hsl(285.89, 5.9%, 21.03%)",
  },
};

export const DEFAULT_CUSTOM_THEME_COLORS: ThemeCustomColors = {
  linked: true,
  light: {
    background: "",
    surface: "",
    accent: "#4F6BED",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  dark: {
    background: "",
    surface: "",
    accent: "#4F6BED",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
};

// ─── 运行时应用函数 ─────────────────────────────────────────

function mergeThemeVariables(...maps: ThemeVariableMap[]) {
  return maps.reduce<ThemeVariableMap>((acc, map) => ({ ...acc, ...map }), {});
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;
  const raw = normalized.slice(1);
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  return { r, g, b };
}

function getReadableForeground(hex: string) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "#FFFFFF";

  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  return luminance > 0.52 ? "#111827" : "#FFFFFF";
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_REGEX.test(value.trim());
}

export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return HEX_COLOR_REGEX.test(normalized) ? normalized : null;
}

function buildBaseThemeVariables(tokens: ThemeCustomTokenSet) {
  const variables: ThemeVariableMap = {};
  const background = normalizeHexColor(tokens.background);
  const surface = normalizeHexColor(tokens.surface) ?? background;

  if (background) {
    variables["--background"] = background;
    variables["--foreground"] = getReadableForeground(background);
  }

  if (surface) {
    const surfaceForeground = getReadableForeground(surface);
    variables["--surface"] = surface;
    variables["--surface-foreground"] = surfaceForeground;
    variables["--surface-secondary"] = surface;
    variables["--surface-secondary-foreground"] = surfaceForeground;
    variables["--surface-tertiary"] = surface;
    variables["--surface-tertiary-foreground"] = surfaceForeground;
    variables["--field-background"] = surface;
    variables["--field-foreground"] = surfaceForeground;
  }

  return variables;
}

export function buildCustomThemeVariables(custom: ThemeCustomColors) {
  const darkTokens = custom.linked ? custom.light : custom.dark;
  const light: ThemeVariableMap = buildBaseThemeVariables(custom.light);
  const dark: ThemeVariableMap = buildBaseThemeVariables(darkTokens);

  for (const token of THEME_SEMANTIC_TOKENS) {
    const lightColor = normalizeHexColor(custom.light[token]);
    const darkColor = normalizeHexColor(darkTokens[token]);
    if (!lightColor || !darkColor) continue;

    light[`--${token}`] = lightColor;
    light[`--${token}-foreground`] = getReadableForeground(lightColor);
    dark[`--${token}`] = darkColor;
    dark[`--${token}-foreground`] = getReadableForeground(darkColor);
  }

  return { light, dark };
}

export function getThemeVariables(
  mode: ThemeColorMode,
  accentColor: AccentColorKey | null,
  preset: StylePresetKey,
  custom: ThemeCustomColors,
) {
  let light = { ...BASE_THEME_VARIABLES.light };
  let dark = { ...BASE_THEME_VARIABLES.dark };

  if (mode === "preset") {
    const stylePreset = STYLE_PRESETS[preset];
    if (stylePreset) {
      light = mergeThemeVariables(light, stylePreset.light);
      dark = mergeThemeVariables(dark, stylePreset.dark);
    }
  } else if (mode === "accent" && accentColor) {
    const accentPreset = ACCENT_PRESETS[accentColor];
    if (accentPreset) {
      light = mergeThemeVariables(light, accentPreset.light as ThemeVariableMap);
      dark = mergeThemeVariables(dark, accentPreset.dark as ThemeVariableMap);
    }
  } else if (mode === "custom") {
    const customVars = buildCustomThemeVariables(custom);
    light = mergeThemeVariables(light, customVars.light);
    dark = mergeThemeVariables(dark, customVars.dark);
  }

  return { light, dark };
}

export function applyThemeVariables(variables: {
  light: ThemeVariableMap;
  dark: ThemeVariableMap;
}) {
  Uniwind.updateCSSVariables("light", variables.light);
  Uniwind.updateCSSVariables("dark", variables.dark);
}

/**
 * 将强调色 CSS 变量应用到 Uniwind 运行时
 */
export function applyAccentColor(key: AccentColorKey) {
  applyThemeVariables(getThemeVariables("accent", key, "default", DEFAULT_CUSTOM_THEME_COLORS));
}

/**
 * 将风格预设 CSS 变量应用到 Uniwind 运行时
 */
export function applyStylePreset(key: StylePresetKey) {
  applyThemeVariables(getThemeVariables("preset", null, key, DEFAULT_CUSTOM_THEME_COLORS));
}
