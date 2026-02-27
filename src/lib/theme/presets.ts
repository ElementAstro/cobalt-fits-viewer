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
const THEME_ADVANCED_TOKENS = [
  "secondary",
  "info",
  "foreground",
  "card",
  "border",
  "focus",
  "muted",
] as const;
export const THEME_EDITABLE_TOKENS = [...THEME_BASE_TOKENS, ...THEME_SEMANTIC_TOKENS] as const;
export const THEME_ADVANCED_EDITABLE_TOKENS = THEME_ADVANCED_TOKENS;
export type ThemeEditableToken = (typeof THEME_EDITABLE_TOKENS)[number];
export type ThemeAdvancedToken = (typeof THEME_ADVANCED_TOKENS)[number];

export interface ThemeCustomTokenSet {
  background: string;
  surface: string;
  accent: string;
  success: string;
  warning: string;
  danger: string;
  secondary?: string;
  info?: string;
  foreground?: string;
  card?: string;
  border?: string;
  focus?: string;
  muted?: string;
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
    light: { "--accent": "#0485F7", "--accent-foreground": "#FCFCFC" },
    dark: { "--accent": "#0485F7", "--accent-foreground": "#FCFCFC" },
    swatch: "#4F6BED",
  },
  purple: {
    label: { en: "Purple", zh: "紫色" },
    light: { "--accent": "#7A49E1", "--accent-foreground": "#FCFCFC" },
    dark: { "--accent": "#8858F1", "--accent-foreground": "#FCFCFC" },
    swatch: "#8B5CF6",
  },
  green: {
    label: { en: "Green", zh: "绿色" },
    light: { "--accent": "#00AD5E", "--accent-foreground": "#FCFCFC" },
    dark: { "--accent": "#00BA6A", "--accent-foreground": "#FCFCFC" },
    swatch: "#22C55E",
  },
  orange: {
    label: { en: "Orange", zh: "橙色" },
    light: {
      "--accent": "#F97300",
      "--accent-foreground": "#18181B",
    },
    dark: {
      "--accent": "#FC8A28",
      "--accent-foreground": "#18181B",
    },
    swatch: "#F97316",
  },
  red: {
    label: { en: "Red", zh: "红色" },
    light: { "--accent": "#F90B3C", "--accent-foreground": "#FCFCFC" },
    dark: { "--accent": "#E42834", "--accent-foreground": "#FCFCFC" },
    swatch: "#EF4444",
  },
  cyan: {
    label: { en: "Cyan", zh: "青色" },
    light: {
      "--accent": "#00AFC6",
      "--accent-foreground": "#18181B",
    },
    dark: {
      "--accent": "#00BCD3",
      "--accent-foreground": "#18181B",
    },
    swatch: "#06B6D4",
  },
  pink: {
    label: { en: "Pink", zh: "粉色" },
    light: { "--accent": "#E3379D", "--accent-foreground": "#FCFCFC" },
    dark: { "--accent": "#EB52A8", "--accent-foreground": "#FCFCFC" },
    swatch: "#EC4899",
  },
  amber: {
    label: { en: "Amber", zh: "琥珀" },
    light: {
      "--accent": "#F7A900",
      "--accent-foreground": "#18181B",
    },
    dark: {
      "--accent": "#FAB646",
      "--accent-foreground": "#18181B",
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
      "--accent": "#009EE8",
      "--accent-foreground": "#FCFCFC",
      "--success": "#00B2C9",
      "--success-foreground": "#18181B",
    },
    dark: {
      "--accent": "#00AAEC",
      "--accent-foreground": "#FCFCFC",
      "--success": "#00BCD3",
      "--success-foreground": "#18181B",
    },
  },
  forest: {
    label: { en: "Forest", zh: "森林" },
    swatch: "#16A34A",
    light: {
      "--accent": "#00AD5E",
      "--accent-foreground": "#FCFCFC",
      "--success": "#17C964",
      "--success-foreground": "#18181B",
    },
    dark: {
      "--accent": "#25B770",
      "--accent-foreground": "#FCFCFC",
      "--success": "#17C964",
      "--success-foreground": "#18181B",
    },
  },
  sunset: {
    label: { en: "Sunset", zh: "日落" },
    swatch: "#F97316",
    light: {
      "--accent": "#F97300",
      "--accent-foreground": "#18181B",
      "--success": "#F5A524",
      "--success-foreground": "#18181B",
    },
    dark: {
      "--accent": "#FC8A28",
      "--accent-foreground": "#18181B",
      "--success": "#F7B750",
      "--success-foreground": "#18181B",
    },
  },
};

export type StylePresetKey = keyof typeof STYLE_PRESETS;
export const STYLE_PRESET_KEYS = Object.keys(STYLE_PRESETS) as StylePresetKey[];

// ─── 圆角预设 ─────────────────────────────────────────────

export const RADIUS_PRESETS = {
  none: { label: { en: "Square", zh: "直角" }, value: "0rem" },
  small: { label: { en: "Small", zh: "小圆角" }, value: "0.25rem" },
  default: { label: { en: "Default", zh: "默认" }, value: "0.5rem" },
  large: { label: { en: "Rounded", zh: "大圆角" }, value: "0.75rem" },
  pill: { label: { en: "Pill", zh: "药丸" }, value: "1rem" },
} as const;

export type RadiusPresetKey = keyof typeof RADIUS_PRESETS;
export const RADIUS_PRESET_KEYS = Object.keys(RADIUS_PRESETS) as RadiusPresetKey[];

// ─── 边框宽度预设 ───────────────────────────────────────────

export const BORDER_WIDTH_PRESETS = {
  none: { label: { en: "None", zh: "无" }, value: "0px" },
  thin: { label: { en: "Thin", zh: "细" }, value: "1px" },
  medium: { label: { en: "Medium", zh: "中" }, value: "2px" },
} as const;

export type BorderWidthPresetKey = keyof typeof BORDER_WIDTH_PRESETS;
export const BORDER_WIDTH_PRESET_KEYS = Object.keys(BORDER_WIDTH_PRESETS) as BorderWidthPresetKey[];

// ─── 禁用透明度预设 ─────────────────────────────────────────

export const DISABLED_OPACITY_PRESETS = {
  subtle: { label: { en: "Subtle", zh: "轻微" }, value: "0.3" },
  default: { label: { en: "Default", zh: "默认" }, value: "0.5" },
  visible: { label: { en: "Visible", zh: "明显" }, value: "0.7" },
} as const;

export type DisabledOpacityPresetKey = keyof typeof DISABLED_OPACITY_PRESETS;
export const DISABLED_OPACITY_PRESET_KEYS = Object.keys(
  DISABLED_OPACITY_PRESETS,
) as DisabledOpacityPresetKey[];

// ─── 自定义主题模板 ─────────────────────────────────────────

export const CUSTOM_THEME_TEMPLATES: Record<
  string,
  { label: { en: string; zh: string }; swatch: string; colors: ThemeCustomColors }
> = {
  "astro-red": {
    label: { en: "Astro Red", zh: "天文暗红" },
    swatch: "#8B0000",
    colors: {
      linked: false,
      light: {
        background: "#FFF5F5",
        surface: "#FFFFFF",
        accent: "#DC2626",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#B91C1C",
      },
      dark: {
        background: "#0A0000",
        surface: "#1A0A0A",
        accent: "#8B0000",
        success: "#166534",
        warning: "#92400E",
        danger: "#7F1D1D",
      },
    },
  },
  "aurora-green": {
    label: { en: "Aurora Green", zh: "极光绿" },
    swatch: "#06B6D4",
    colors: {
      linked: false,
      light: {
        background: "#F0FDFA",
        surface: "#FFFFFF",
        accent: "#0D9488",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      dark: {
        background: "#0D1B2A",
        surface: "#112240",
        accent: "#06B6D4",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
    },
  },
  moonlight: {
    label: { en: "Moonlight", zh: "月光银" },
    swatch: "#94A3B8",
    colors: {
      linked: false,
      light: {
        background: "#F8FAFC",
        surface: "#FFFFFF",
        accent: "#64748B",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      dark: {
        background: "#0F172A",
        surface: "#1E293B",
        accent: "#94A3B8",
        success: "#22C55E",
        warning: "#F59E0B",
        danger: "#EF4444",
      },
    },
  },
  nord: {
    label: { en: "Nord", zh: "北极" },
    swatch: "#5E81AC",
    colors: {
      linked: false,
      light: {
        background: "#ECEFF4",
        surface: "#E5E9F0",
        accent: "#5E81AC",
        success: "#A3BE8C",
        warning: "#EBCB8B",
        danger: "#BF616A",
      },
      dark: {
        background: "#2E3440",
        surface: "#3B4252",
        accent: "#88C0D0",
        success: "#A3BE8C",
        warning: "#EBCB8B",
        danger: "#BF616A",
      },
    },
  },
  dracula: {
    label: { en: "Dracula", zh: "暗夜" },
    swatch: "#BD93F9",
    colors: {
      linked: false,
      light: {
        background: "#F8F8F2",
        surface: "#FFFFFF",
        accent: "#BD93F9",
        success: "#50FA7B",
        warning: "#F1FA8C",
        danger: "#FF5555",
      },
      dark: {
        background: "#282A36",
        surface: "#44475A",
        accent: "#BD93F9",
        success: "#50FA7B",
        warning: "#F1FA8C",
        danger: "#FF5555",
      },
    },
  },
  "rose-pine": {
    label: { en: "Rosé Pine", zh: "玫瑰松" },
    swatch: "#C4A7E7",
    colors: {
      linked: false,
      light: {
        background: "#FAF4ED",
        surface: "#FFFAF3",
        accent: "#907AA9",
        success: "#56949F",
        warning: "#EA9D34",
        danger: "#B4637A",
      },
      dark: {
        background: "#191724",
        surface: "#1F1D2E",
        accent: "#C4A7E7",
        success: "#9CCFD8",
        warning: "#F6C177",
        danger: "#EB6F92",
      },
    },
  },
};

export const CUSTOM_THEME_TEMPLATE_KEYS = Object.keys(CUSTOM_THEME_TEMPLATES);

// ─── 基线变量 ───────────────────────────────────────────────

export const BASE_THEME_VARIABLES: { light: ThemeVariableMap; dark: ThemeVariableMap } = {
  light: {
    "--accent": "#6A3DFF",
    "--accent-foreground": "#FFFFFF",
    "--success": "#77FFBD",
    "--success-foreground": "#373239",
    "--warning": "#E8FF90",
    "--warning-foreground": "#373239",
    "--danger": "#FF9A4E",
    "--danger-foreground": "#373239",
  },
  dark: {
    "--accent": "#761AFF",
    "--accent-foreground": "#FFFFFF",
    "--success": "#87FFDD",
    "--success-foreground": "#373239",
    "--warning": "#D2FF96",
    "--warning-foreground": "#373239",
    "--danger": "#FF9446",
    "--danger-foreground": "#373239",
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
    secondary: "",
    info: "",
    foreground: "",
    card: "",
    border: "",
    focus: "",
    muted: "",
  },
  dark: {
    background: "",
    surface: "",
    accent: "#4F6BED",
    success: "#22C55E",
    warning: "#F59E0B",
    danger: "#EF4444",
    secondary: "",
    info: "",
    foreground: "",
    card: "",
    border: "",
    focus: "",
    muted: "",
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

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    "#" +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase()
  );
}

/** Shift perceived lightness of a hex color by delta (-1 to +1) */
function adjustLightness(hex: string, delta: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  // Scale each channel proportionally toward white (+) or black (-)
  if (delta > 0) {
    return rgbToHex(
      rgb.r + (255 - rgb.r) * delta,
      rgb.g + (255 - rgb.g) * delta,
      rgb.b + (255 - rgb.b) * delta,
    );
  }
  const factor = 1 + delta; // delta is negative
  return rgbToHex(rgb.r * factor, rgb.g * factor, rgb.b * factor);
}

/** Mix two hex colors by ratio (0 = first, 1 = second) */
function mixHex(hex1: string, hex2: string, ratio: number): string {
  const r1 = hexToRgb(hex1);
  const r2 = hexToRgb(hex2);
  if (!r1 || !r2) return hex1;
  const mix = (a: number, b: number) => a + (b - a) * ratio;
  return rgbToHex(mix(r1.r, r2.r), mix(r1.g, r2.g), mix(r1.b, r2.b));
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

// ─── Shadow 常量 ─────────────────────────────────────────────

const LIGHT_SURFACE_SHADOW =
  "0 2px 4px 0 rgba(0,0,0,0.04), 0 1px 2px 0 rgba(0,0,0,0.06), 0 0 1px 0 rgba(0,0,0,0.06)";
const LIGHT_OVERLAY_SHADOW =
  "0 2px 8px 0 rgba(0,0,0,0.02), 0 -6px 12px 0 rgba(0,0,0,0.01), 0 14px 28px 0 rgba(0,0,0,0.03)";
const DARK_SURFACE_SHADOW = "0 0 0 0 transparent inset";
const DARK_OVERLAY_SHADOW = "0 0 1px 0 rgba(255,255,255,0.2) inset";
const DARK_FIELD_SHADOW = "0 0 0 0 transparent inset";

function buildBaseThemeVariables(
  tokens: ThemeCustomTokenSet,
  mode: "light" | "dark",
): ThemeVariableMap {
  const variables: ThemeVariableMap = {};
  const background = normalizeHexColor(tokens.background);
  const surface = normalizeHexColor(tokens.surface) ?? background;
  const foreground = background ? getReadableForeground(background) : null;

  if (background && foreground) {
    variables["--background"] = background;
    variables["--foreground"] = foreground;

    // overlay: use surface if available, otherwise background
    const overlayColor = surface ?? background;
    variables["--overlay"] = overlayColor;
    variables["--overlay-foreground"] = getReadableForeground(overlayColor);

    // muted: midpoint between background and foreground
    variables["--muted"] = mixHex(background, foreground, 0.45);

    // default: slightly offset from background
    const defaultColor =
      mode === "light" ? adjustLightness(background, -0.06) : adjustLightness(background, 0.12);
    variables["--default"] = defaultColor;
    variables["--default-foreground"] = getReadableForeground(defaultColor);

    // border & separator: low/medium contrast
    variables["--border"] = mixHex(background, foreground, mode === "light" ? 0.1 : 0.12);
    variables["--separator"] = mixHex(background, foreground, mode === "light" ? 0.26 : 0.22);

    // link follows foreground
    variables["--link"] = foreground;
  }

  if (surface) {
    const surfaceFg = getReadableForeground(surface);
    variables["--surface"] = surface;
    variables["--surface-foreground"] = surfaceFg;

    // Three-level surface contrast progression
    const delta2 = mode === "light" ? -0.04 : 0.07;
    const delta3 = mode === "light" ? -0.07 : 0.12;
    variables["--surface-secondary"] = adjustLightness(surface, delta2);
    variables["--surface-secondary-foreground"] = surfaceFg;
    variables["--surface-tertiary"] = adjustLightness(surface, delta3);
    variables["--surface-tertiary-foreground"] = surfaceFg;

    // segment follows surface
    variables["--segment"] = surface;
    variables["--segment-foreground"] = surfaceFg;

    // field tokens
    variables["--field-background"] = surface;
    variables["--field-foreground"] = surfaceFg;
    variables["--field-placeholder"] = variables["--muted"] ?? surfaceFg;
    variables["--field-border"] = "transparent";

    // shadows
    if (mode === "light") {
      variables["--surface-shadow"] = LIGHT_SURFACE_SHADOW;
      variables["--overlay-shadow"] = LIGHT_OVERLAY_SHADOW;
      variables["--field-shadow"] = LIGHT_SURFACE_SHADOW;
    } else {
      variables["--surface-shadow"] = DARK_SURFACE_SHADOW;
      variables["--overlay-shadow"] = DARK_OVERLAY_SHADOW;
      variables["--field-shadow"] = DARK_FIELD_SHADOW;
    }
  }

  return variables;
}

export function buildCustomThemeVariables(custom: ThemeCustomColors) {
  const darkTokens = custom.linked ? custom.light : custom.dark;
  const light: ThemeVariableMap = buildBaseThemeVariables(custom.light, "light");
  const dark: ThemeVariableMap = buildBaseThemeVariables(darkTokens, "dark");

  for (const token of THEME_SEMANTIC_TOKENS) {
    const lightColor = normalizeHexColor(custom.light[token]);
    const darkColor = normalizeHexColor(darkTokens[token]);
    if (!lightColor || !darkColor) continue;

    light[`--${token}`] = lightColor;
    light[`--${token}-foreground`] = getReadableForeground(lightColor);
    dark[`--${token}`] = darkColor;
    dark[`--${token}-foreground`] = getReadableForeground(darkColor);
  }

  // Advanced tokens: secondary, info
  for (const token of ["secondary", "info"] as const) {
    const lc = normalizeHexColor(custom.light[token]);
    const dc = normalizeHexColor(darkTokens[token]);
    if (lc) {
      light[`--${token}`] = lc;
      light[`--${token}-foreground`] = getReadableForeground(lc);
    }
    if (dc) {
      dark[`--${token}`] = dc;
      dark[`--${token}-foreground`] = getReadableForeground(dc);
    }
  }

  // Advanced overrides: foreground, card, border, muted, focus
  const advOverrides: Array<{ token: keyof ThemeCustomTokenSet; cssVar: string }> = [
    { token: "foreground", cssVar: "--foreground" },
    { token: "card", cssVar: "--surface" },
    { token: "border", cssVar: "--border" },
    { token: "muted", cssVar: "--muted" },
    { token: "focus", cssVar: "--focus" },
  ];
  for (const { token, cssVar } of advOverrides) {
    const lc = normalizeHexColor(custom.light[token]);
    const dc = normalizeHexColor(darkTokens[token]);
    if (lc) light[cssVar] = lc;
    if (dc) dark[cssVar] = dc;
  }

  // --focus fallback: tracks accent if not explicitly set
  if (!light["--focus"]) {
    const lightAccent = normalizeHexColor(custom.light.accent);
    if (lightAccent) light["--focus"] = lightAccent;
  }
  if (!dark["--focus"]) {
    const darkAccent = normalizeHexColor(darkTokens.accent);
    if (darkAccent) dark["--focus"] = darkAccent;
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

/**
 * HeroUI Native 的 @theme inline static 在构建时将 var(--accent) 等引用
 * 编译为静态值，运行时仅更新 --accent 不会传播到 --color-accent。
 * 此函数将原始 CSS 变量扩展为 Tailwind --color-* 主题变量，
 * 确保 className（如 bg-accent）能够读取到运行时覆盖值。
 */
function expandToTailwindColorVars(vars: ThemeVariableMap): ThemeVariableMap {
  const expanded: ThemeVariableMap = { ...vars };

  // Direct mappings: --X → --color-X
  const DIRECT_COLOR_MAPPINGS: Array<[string, string]> = [
    ["--background", "--color-background"],
    ["--foreground", "--color-foreground"],
    ["--surface", "--color-surface"],
    ["--surface-foreground", "--color-surface-foreground"],
    ["--surface-secondary", "--color-surface-secondary"],
    ["--surface-secondary-foreground", "--color-surface-secondary-foreground"],
    ["--surface-tertiary", "--color-surface-tertiary"],
    ["--surface-tertiary-foreground", "--color-surface-tertiary-foreground"],
    ["--overlay", "--color-overlay"],
    ["--overlay-foreground", "--color-overlay-foreground"],
    ["--muted", "--color-muted"],
    ["--accent", "--color-accent"],
    ["--accent-foreground", "--color-accent-foreground"],
    ["--default", "--color-default"],
    ["--default-foreground", "--color-default-foreground"],
    ["--success", "--color-success"],
    ["--success-foreground", "--color-success-foreground"],
    ["--warning", "--color-warning"],
    ["--warning-foreground", "--color-warning-foreground"],
    ["--danger", "--color-danger"],
    ["--danger-foreground", "--color-danger-foreground"],
    ["--border", "--color-border"],
    ["--separator", "--color-separator"],
    ["--focus", "--color-focus"],
    ["--link", "--color-link"],
    ["--segment", "--color-segment"],
    ["--segment-foreground", "--color-segment-foreground"],
  ];

  for (const [src, dest] of DIRECT_COLOR_MAPPINGS) {
    if (vars[src] !== undefined) {
      expanded[dest] = vars[src];
    }
  }

  // Field mappings: --field-X → --color-field(-X)
  if (vars["--field-background"] !== undefined) {
    expanded["--color-field"] = vars["--field-background"];
  }
  if (vars["--field-foreground"] !== undefined) {
    expanded["--color-field-foreground"] = vars["--field-foreground"];
  }
  if (vars["--field-placeholder"] !== undefined) {
    expanded["--color-field-placeholder"] = vars["--field-placeholder"];
  }
  if (vars["--field-border"] !== undefined) {
    expanded["--color-field-border"] = vars["--field-border"];
  }

  // Shadow mappings
  if (vars["--surface-shadow"] !== undefined) {
    expanded["--shadow-surface"] = vars["--surface-shadow"];
  }
  if (vars["--overlay-shadow"] !== undefined) {
    expanded["--shadow-overlay"] = vars["--overlay-shadow"];
  }
  if (vars["--field-shadow"] !== undefined) {
    expanded["--shadow-field"] = vars["--field-shadow"];
  }

  // Hover variants via simple color mixing (10% foreground blend)
  const HOVER_PAIRS: Array<{ base: string; fg: string; out: string; ratio: number }> = [
    { base: "--accent", fg: "--accent-foreground", out: "--color-accent-hover", ratio: 0.1 },
    { base: "--success", fg: "--success-foreground", out: "--color-success-hover", ratio: 0.1 },
    { base: "--warning", fg: "--warning-foreground", out: "--color-warning-hover", ratio: 0.1 },
    { base: "--danger", fg: "--danger-foreground", out: "--color-danger-hover", ratio: 0.1 },
    { base: "--default", fg: "--default-foreground", out: "--color-default-hover", ratio: 0.04 },
    { base: "--surface", fg: "--surface-foreground", out: "--color-surface-hover", ratio: 0.08 },
  ];

  for (const { base, fg, out, ratio } of HOVER_PAIRS) {
    const baseColor = hexToRgb(vars[base]);
    const fgColor = hexToRgb(vars[fg]);
    if (baseColor && fgColor) {
      expanded[out] = rgbToHex(
        baseColor.r + (fgColor.r - baseColor.r) * ratio,
        baseColor.g + (fgColor.g - baseColor.g) * ratio,
        baseColor.b + (fgColor.b - baseColor.b) * ratio,
      );
    }
  }

  // Soft variants (15% of color, 85% transparent → approximated as alpha blend)
  const SOFT_COLORS = ["accent", "danger", "warning", "success"] as const;
  for (const name of SOFT_COLORS) {
    const colorHex = vars[`--${name}`];
    const rgb = hexToRgb(colorHex);
    if (rgb) {
      // Approximate soft as the color itself at reduced opacity is not possible
      // via hex, so lighten toward white for light themes / darken for dark themes.
      // The exact color-mix(in oklab, X 15%, transparent) is hard to replicate;
      // we just pass the base color and let HeroUI's compiled getter handle it
      // if it can, otherwise the direct --color-X-soft will take effect.
      expanded[`--color-${name}-soft-foreground`] = colorHex;
    }
  }

  return expanded;
}

export function applyThemeVariables(variables: {
  light: ThemeVariableMap;
  dark: ThemeVariableMap;
}) {
  Uniwind.updateCSSVariables("light", expandToTailwindColorVars(variables.light));
  Uniwind.updateCSSVariables("dark", expandToTailwindColorVars(variables.dark));
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
