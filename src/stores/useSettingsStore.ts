/**
 * 设置状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Uniwind } from "uniwind";
import { zustandMMKVStorage } from "../lib/storage";
import type { StretchType, ColormapType, ExportFormat } from "../lib/fits/types";
import {
  ACCENT_PRESETS,
  DEFAULT_CUSTOM_THEME_COLORS,
  STYLE_PRESETS,
  THEME_COLOR_MODES,
  applyThemeVariables,
  getThemeVariables,
  normalizeHexColor,
  type AccentColorKey,
  type ThemeColorMode,
  type ThemeCustomColors,
  type ThemeEditableToken,
  type StylePresetKey,
} from "../lib/theme/presets";
import type { FontFamilyKey, MonoFontKey } from "../lib/theme/fonts";

interface SettingsStoreState {
  // 查看器默认设置
  defaultStretch: StretchType;
  defaultColormap: ColormapType;

  // 相册设置
  defaultGridColumns: 2 | 3 | 4;
  thumbnailQuality: number;
  thumbnailSize: number;

  // 导出/转换默认
  defaultExportFormat: ExportFormat;

  // 目标管理
  autoGroupByObject: boolean;

  // 重复检测
  autoDetectDuplicates: boolean;

  // 位置设置
  autoTagLocation: boolean;

  // 地图设置
  mapPreset: "standard" | "dark" | "satellite" | "terrain3d";
  mapShowOverlays: boolean; // polylines + circles

  // 会话管理
  sessionGapMinutes: number; // 自动分割会话的时间间隔(分钟)

  // 日历同步
  calendarSyncEnabled: boolean;
  defaultReminderMinutes: number; // 0 = 不提醒

  // 显示设置
  language: "en" | "zh";
  theme: "light" | "dark" | "system";

  // 屏幕方向
  orientationLock: "default" | "portrait" | "landscape";

  // 通用交互设置
  hapticsEnabled: boolean;
  confirmDestructiveActions: boolean;
  autoCheckUpdates: boolean;

  // 自定义风格
  themeColorMode: ThemeColorMode;
  accentColor: AccentColorKey | null;
  activePreset: StylePresetKey;
  customThemeColors: ThemeCustomColors;

  // 字体设置
  fontFamily: FontFamilyKey;
  monoFontFamily: MonoFontKey;

  // 查看器叠加层默认状态
  defaultShowGrid: boolean;
  defaultShowCrosshair: boolean;
  defaultShowPixelInfo: boolean;
  defaultShowMinimap: boolean;

  // 查看器默认显示参数
  defaultBlackPoint: number;
  defaultWhitePoint: number;
  defaultGamma: number;

  // 直方图配置
  defaultHistogramMode: "linear" | "log" | "cdf";
  histogramHeight: number;

  // 像素信息显示配置
  pixelInfoDecimalPlaces: number;

  // 图库默认排序
  defaultGallerySortBy: "name" | "date" | "size" | "object" | "filter";
  defaultGallerySortOrder: "asc" | "desc";

  // 堆叠默认参数
  defaultStackMethod: "average" | "median" | "sigma" | "min" | "max" | "winsorized" | "weighted";
  defaultSigmaValue: number;
  defaultAlignmentMode: "none" | "translation" | "full";
  defaultEnableQuality: boolean;

  // 网格/十字线样式
  gridColor: string;
  gridOpacity: number;
  crosshairColor: string;
  crosshairOpacity: number;

  // 画布缩放限制
  canvasMinScale: number;
  canvasMaxScale: number;
  canvasDoubleTapScale: number;

  // 缩略图叠加信息
  thumbnailShowFilename: boolean;
  thumbnailShowObject: boolean;
  thumbnailShowFilter: boolean;
  thumbnailShowExposure: boolean;

  // 文件列表显示风格
  fileListStyle: "grid" | "list" | "compact";

  // 转换器默认设置
  defaultConverterFormat: "png" | "jpeg" | "tiff" | "webp";
  defaultConverterQuality: number;
  batchNamingRule: "original" | "prefix" | "suffix" | "sequence";

  // 编辑器默认参数
  defaultBlurSigma: number;
  defaultSharpenAmount: number;
  defaultDenoiseRadius: number;
  editorMaxUndo: number;

  // 时间线分组
  timelineGrouping: "day" | "week" | "month";

  // 会话显示字段
  sessionShowExposureCount: boolean;
  sessionShowTotalExposure: boolean;
  sessionShowFilters: boolean;

  // 目标排序
  targetSortBy: "name" | "date" | "frames" | "exposure" | "favorite";
  targetSortOrder: "asc" | "desc";

  // 合成默认设置
  defaultComposePreset: "rgb" | "sho" | "hoo" | "lrgb" | "custom";
  composeRedWeight: number;
  composeGreenWeight: number;
  composeBlueWeight: number;

  // 性能配置
  imageProcessingDebounce: number;
  useHighQualityPreview: boolean;

  // Actions
  setDefaultStretch: (stretch: StretchType) => void;
  setDefaultColormap: (colormap: ColormapType) => void;
  setDefaultGridColumns: (cols: 2 | 3 | 4) => void;
  setThumbnailQuality: (quality: number) => void;
  setThumbnailSize: (size: number) => void;
  setDefaultExportFormat: (format: ExportFormat) => void;
  setAutoGroupByObject: (value: boolean) => void;
  setAutoDetectDuplicates: (value: boolean) => void;
  setAutoTagLocation: (value: boolean) => void;
  setMapPreset: (preset: "standard" | "dark" | "satellite" | "terrain3d") => void;
  setMapShowOverlays: (value: boolean) => void;
  setSessionGapMinutes: (minutes: number) => void;
  setCalendarSyncEnabled: (value: boolean) => void;
  setDefaultReminderMinutes: (minutes: number) => void;
  setLanguage: (lang: "en" | "zh") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setOrientationLock: (lock: "default" | "portrait" | "landscape") => void;
  setHapticsEnabled: (value: boolean) => void;
  setConfirmDestructiveActions: (value: boolean) => void;
  setAutoCheckUpdates: (value: boolean) => void;
  setThemeColorMode: (mode: ThemeColorMode) => void;
  setAccentColor: (color: AccentColorKey | null) => void;
  setActivePreset: (preset: StylePresetKey) => void;
  setCustomThemeLinked: (linked: boolean) => void;
  setCustomThemeToken: (token: ThemeEditableToken, value: string, mode?: "light" | "dark") => void;
  resetStyle: () => void;
  setFontFamily: (font: FontFamilyKey) => void;
  setMonoFontFamily: (font: MonoFontKey) => void;

  setDefaultShowGrid: (value: boolean) => void;
  setDefaultShowCrosshair: (value: boolean) => void;
  setDefaultShowPixelInfo: (value: boolean) => void;
  setDefaultShowMinimap: (value: boolean) => void;
  setDefaultBlackPoint: (value: number) => void;
  setDefaultWhitePoint: (value: number) => void;
  setDefaultGamma: (value: number) => void;
  setDefaultHistogramMode: (mode: "linear" | "log" | "cdf") => void;
  setHistogramHeight: (height: number) => void;
  setPixelInfoDecimalPlaces: (places: number) => void;
  setDefaultGallerySortBy: (sort: "name" | "date" | "size" | "object" | "filter") => void;
  setDefaultGallerySortOrder: (order: "asc" | "desc") => void;
  setDefaultStackMethod: (
    method: "average" | "median" | "sigma" | "min" | "max" | "winsorized" | "weighted",
  ) => void;
  setDefaultSigmaValue: (value: number) => void;
  setDefaultAlignmentMode: (mode: "none" | "translation" | "full") => void;
  setDefaultEnableQuality: (value: boolean) => void;
  setImageProcessingDebounce: (ms: number) => void;
  setUseHighQualityPreview: (value: boolean) => void;
  setGridColor: (color: string) => void;
  setGridOpacity: (opacity: number) => void;
  setCrosshairColor: (color: string) => void;
  setCrosshairOpacity: (opacity: number) => void;
  setCanvasMinScale: (scale: number) => void;
  setCanvasMaxScale: (scale: number) => void;
  setCanvasDoubleTapScale: (scale: number) => void;
  setThumbnailShowFilename: (v: boolean) => void;
  setThumbnailShowObject: (v: boolean) => void;
  setThumbnailShowFilter: (v: boolean) => void;
  setThumbnailShowExposure: (v: boolean) => void;
  setFileListStyle: (style: "grid" | "list" | "compact") => void;
  setDefaultConverterFormat: (fmt: "png" | "jpeg" | "tiff" | "webp") => void;
  setDefaultConverterQuality: (q: number) => void;
  setBatchNamingRule: (rule: "original" | "prefix" | "suffix" | "sequence") => void;
  setDefaultBlurSigma: (v: number) => void;
  setDefaultSharpenAmount: (v: number) => void;
  setDefaultDenoiseRadius: (v: number) => void;
  setEditorMaxUndo: (v: number) => void;
  setTimelineGrouping: (v: "day" | "week" | "month") => void;
  setSessionShowExposureCount: (v: boolean) => void;
  setSessionShowTotalExposure: (v: boolean) => void;
  setSessionShowFilters: (v: boolean) => void;
  setTargetSortBy: (v: "name" | "date" | "frames" | "exposure" | "favorite") => void;
  setTargetSortOrder: (v: "asc" | "desc") => void;
  setDefaultComposePreset: (v: "rgb" | "sho" | "hoo" | "lrgb" | "custom") => void;
  setComposeRedWeight: (v: number) => void;
  setComposeGreenWeight: (v: number) => void;
  setComposeBlueWeight: (v: number) => void;
  applySettingsPatch: (patch: Record<string, unknown>) => void;
  resetToDefaults: () => void;
}

/**
 * 同步主题与自定义风格到 Uniwind 运行时
 */
function syncThemeToRuntime(
  theme: "light" | "dark" | "system",
  themeColorMode: ThemeColorMode,
  accentColor: AccentColorKey | null,
  activePreset: StylePresetKey,
  customThemeColors: ThemeCustomColors,
) {
  Uniwind.setTheme(theme);
  const variables = getThemeVariables(themeColorMode, accentColor, activePreset, customThemeColors);
  applyThemeVariables(variables);
}

function cloneCustomThemeColors(colors: ThemeCustomColors): ThemeCustomColors {
  return {
    linked: colors.linked,
    light: { ...colors.light },
    dark: { ...colors.dark },
  };
}

type SettingsActionKeys = {
  [K in keyof SettingsStoreState]: SettingsStoreState[K] extends (...args: never[]) => unknown
    ? K
    : never;
}[keyof SettingsStoreState];

type SettingsDataState = Omit<SettingsStoreState, SettingsActionKeys>;

const DEFAULT_SETTINGS: SettingsDataState = {
  defaultStretch: "asinh",
  defaultColormap: "grayscale",
  defaultGridColumns: 3,
  thumbnailQuality: 80,
  thumbnailSize: 256,
  defaultExportFormat: "png",
  autoGroupByObject: true,
  autoDetectDuplicates: true,
  autoTagLocation: false,
  mapPreset: "standard",
  mapShowOverlays: false,
  sessionGapMinutes: 120,
  calendarSyncEnabled: false,
  defaultReminderMinutes: 30,
  language: "zh",
  theme: "dark",
  orientationLock: "default",
  hapticsEnabled: true,
  confirmDestructiveActions: true,
  autoCheckUpdates: true,
  themeColorMode: "preset",
  accentColor: null,
  activePreset: "default",
  customThemeColors: cloneCustomThemeColors(DEFAULT_CUSTOM_THEME_COLORS),
  fontFamily: "system",
  monoFontFamily: "system-mono",
  defaultShowGrid: false,
  defaultShowCrosshair: false,
  defaultShowPixelInfo: true,
  defaultShowMinimap: false,
  defaultBlackPoint: 0,
  defaultWhitePoint: 1,
  defaultGamma: 1,
  defaultHistogramMode: "linear",
  histogramHeight: 100,
  pixelInfoDecimalPlaces: 1,
  defaultGallerySortBy: "date",
  defaultGallerySortOrder: "desc",
  defaultStackMethod: "average",
  defaultSigmaValue: 2.5,
  defaultAlignmentMode: "none",
  defaultEnableQuality: false,
  gridColor: "#64c8ff",
  gridOpacity: 0.3,
  crosshairColor: "#ff5050",
  crosshairOpacity: 0.7,
  canvasMinScale: 0.5,
  canvasMaxScale: 10,
  canvasDoubleTapScale: 3,
  thumbnailShowFilename: true,
  thumbnailShowObject: false,
  thumbnailShowFilter: true,
  thumbnailShowExposure: false,
  fileListStyle: "grid",
  defaultConverterFormat: "png",
  defaultConverterQuality: 90,
  batchNamingRule: "original",
  defaultBlurSigma: 2.0,
  defaultSharpenAmount: 1.5,
  defaultDenoiseRadius: 1,
  editorMaxUndo: 10,
  timelineGrouping: "day",
  sessionShowExposureCount: true,
  sessionShowTotalExposure: true,
  sessionShowFilters: true,
  targetSortBy: "name",
  targetSortOrder: "asc",
  defaultComposePreset: "rgb",
  composeRedWeight: 1.0,
  composeGreenWeight: 1.0,
  composeBlueWeight: 1.0,
  imageProcessingDebounce: 150,
  useHighQualityPreview: true,
};

const SETTINGS_DATA_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsDataState>;

function pickSettingsData(
  state: Pick<SettingsStoreState, keyof SettingsDataState>,
): SettingsDataState {
  return SETTINGS_DATA_KEYS.reduce((acc, key) => {
    (acc as Record<string, unknown>)[key] = state[key];
    return acc;
  }, {} as SettingsDataState);
}

function toFiniteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeCustomThemeColors(
  value: unknown,
  fallback: ThemeCustomColors,
): ThemeCustomColors | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const linked = typeof raw.linked === "boolean" ? raw.linked : fallback.linked;
  const next: ThemeCustomColors = cloneCustomThemeColors(fallback);
  next.linked = linked;

  for (const mode of ["light", "dark"] as const) {
    const modeRaw = raw[mode];
    if (!modeRaw || typeof modeRaw !== "object") continue;
    const tokenMap = modeRaw as Record<string, unknown>;
    for (const token of Object.keys(next[mode]) as Array<keyof ThemeCustomColors["light"]>) {
      const normalized = normalizeHexColor(tokenMap[token]);
      if (normalized) {
        next[mode][token] = normalized;
      }
    }
  }

  if (next.linked) {
    next.dark = { ...next.light };
  }

  return next;
}

function inferThemeColorMode(
  accentColor: AccentColorKey | null,
  activePreset: StylePresetKey,
  fallback: ThemeColorMode = "preset",
): ThemeColorMode {
  if (accentColor) return "accent";
  if (activePreset !== "default") return "preset";
  return fallback;
}

function sanitizeSettingsPatch(
  patch: Record<string, unknown>,
  current: SettingsDataState,
): Partial<SettingsDataState> {
  const sanitized: Partial<SettingsDataState> = {};

  for (const key of SETTINGS_DATA_KEYS) {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      (sanitized as Record<string, unknown>)[key] = patch[key];
    }
  }

  const numericRules: Array<{
    key: keyof SettingsDataState;
    min: number;
    max: number;
    integer?: boolean;
  }> = [
    { key: "thumbnailQuality", min: 10, max: 100, integer: true },
    { key: "thumbnailSize", min: 64, max: 2048, integer: true },
    { key: "sessionGapMinutes", min: 15, max: 1440, integer: true },
    { key: "defaultReminderMinutes", min: 0, max: 1440, integer: true },
    { key: "defaultBlackPoint", min: 0, max: 1 },
    { key: "defaultWhitePoint", min: 0, max: 1 },
    { key: "defaultGamma", min: 0.1, max: 5 },
    { key: "histogramHeight", min: 60, max: 300, integer: true },
    { key: "pixelInfoDecimalPlaces", min: 0, max: 8, integer: true },
    { key: "defaultSigmaValue", min: 0.1, max: 10 },
    { key: "gridOpacity", min: 0, max: 1 },
    { key: "crosshairOpacity", min: 0, max: 1 },
    { key: "canvasMinScale", min: 0.1, max: 10 },
    { key: "canvasMaxScale", min: 1, max: 30 },
    { key: "canvasDoubleTapScale", min: 1, max: 30 },
    { key: "defaultConverterQuality", min: 1, max: 100, integer: true },
    { key: "defaultBlurSigma", min: 0.1, max: 20 },
    { key: "defaultSharpenAmount", min: 0, max: 10 },
    { key: "defaultDenoiseRadius", min: 0, max: 20, integer: true },
    { key: "editorMaxUndo", min: 1, max: 200, integer: true },
    { key: "composeRedWeight", min: 0, max: 4 },
    { key: "composeGreenWeight", min: 0, max: 4 },
    { key: "composeBlueWeight", min: 0, max: 4 },
    { key: "imageProcessingDebounce", min: 0, max: 2000, integer: true },
  ];

  const numericRuleKeys = new Set(numericRules.map((rule) => rule.key));

  for (const rule of numericRules) {
    const raw = sanitized[rule.key];
    if (raw === undefined) continue;
    const parsed = toFiniteNumber(raw);
    const fallback = current[rule.key];
    const fallbackNumber = typeof fallback === "number" ? fallback : rule.min;
    const safe = parsed === undefined ? fallbackNumber : clamp(parsed, rule.min, rule.max);
    (sanitized as Record<string, unknown>)[rule.key] = rule.integer ? Math.round(safe) : safe;
  }

  const enumRules: Partial<Record<keyof SettingsDataState, readonly (string | number)[]>> = {
    defaultGridColumns: [2, 3, 4],
    mapPreset: ["standard", "dark", "satellite", "terrain3d"],
    language: ["en", "zh"],
    theme: ["light", "dark", "system"],
    orientationLock: ["default", "portrait", "landscape"],
    themeColorMode: THEME_COLOR_MODES,
    defaultHistogramMode: ["linear", "log", "cdf"],
    defaultGallerySortBy: ["name", "date", "size", "object", "filter"],
    defaultGallerySortOrder: ["asc", "desc"],
    defaultStackMethod: ["average", "median", "sigma", "min", "max", "winsorized", "weighted"],
    defaultAlignmentMode: ["none", "translation", "full"],
    fileListStyle: ["grid", "list", "compact"],
    defaultConverterFormat: ["png", "jpeg", "tiff", "webp"],
    batchNamingRule: ["original", "prefix", "suffix", "sequence"],
    timelineGrouping: ["day", "week", "month"],
    targetSortBy: ["name", "date", "frames", "exposure", "favorite"],
    targetSortOrder: ["asc", "desc"],
    defaultComposePreset: ["rgb", "sho", "hoo", "lrgb", "custom"],
  };

  const rawTargetSortBy = (sanitized as Record<string, unknown>).targetSortBy;
  if (rawTargetSortBy === "priority") {
    (sanitized as Record<string, unknown>).targetSortBy = "favorite";
  }

  for (const [key, allowedValues] of Object.entries(enumRules) as Array<
    [keyof SettingsDataState, readonly (string | number)[]]
  >) {
    if (sanitized[key] === undefined) continue;
    if (!allowedValues.includes(sanitized[key] as string | number)) {
      delete sanitized[key];
    }
  }

  if (sanitized.accentColor !== undefined) {
    const nextAccent = sanitized.accentColor;
    if (
      nextAccent !== null &&
      !Object.prototype.hasOwnProperty.call(ACCENT_PRESETS, String(nextAccent))
    ) {
      delete sanitized.accentColor;
    }
  }

  if (
    sanitized.activePreset !== undefined &&
    !Object.prototype.hasOwnProperty.call(STYLE_PRESETS, String(sanitized.activePreset))
  ) {
    delete sanitized.activePreset;
  }

  if (sanitized.customThemeColors !== undefined) {
    const nextCustomTheme = sanitizeCustomThemeColors(
      sanitized.customThemeColors,
      current.customThemeColors,
    );
    if (nextCustomTheme) {
      sanitized.customThemeColors = nextCustomTheme;
    } else {
      delete sanitized.customThemeColors;
    }
  }

  for (const key of SETTINGS_DATA_KEYS) {
    if (sanitized[key] === undefined) continue;
    if (numericRuleKeys.has(key) || enumRules[key]) continue;

    const currentValue = current[key];
    const nextValue = sanitized[key];

    if (currentValue === null) {
      if (nextValue !== null && typeof nextValue !== "string") {
        delete sanitized[key];
      }
      continue;
    }

    if (typeof nextValue !== typeof currentValue) {
      delete sanitized[key];
    }
  }

  const hasBlack = typeof sanitized.defaultBlackPoint === "number";
  const hasWhite = typeof sanitized.defaultWhitePoint === "number";
  if (hasBlack || hasWhite) {
    const black = hasBlack ? sanitized.defaultBlackPoint : current.defaultBlackPoint;
    const white = hasWhite ? sanitized.defaultWhitePoint : current.defaultWhitePoint;
    if (typeof black === "number" && typeof white === "number" && black >= white) {
      if (hasBlack && !hasWhite) {
        sanitized.defaultWhitePoint = clamp(black + 0.01, 0.01, 1);
      } else if (!hasBlack && hasWhite) {
        sanitized.defaultBlackPoint = clamp(white - 0.01, 0, 0.99);
      } else {
        sanitized.defaultWhitePoint = clamp(black + 0.01, 0.01, 1);
      }
    }
  }

  const hasMinScale = typeof sanitized.canvasMinScale === "number";
  const hasMaxScale = typeof sanitized.canvasMaxScale === "number";
  if (hasMinScale || hasMaxScale) {
    const minScale = hasMinScale ? sanitized.canvasMinScale : current.canvasMinScale;
    const maxScale = hasMaxScale ? sanitized.canvasMaxScale : current.canvasMaxScale;
    if (typeof minScale === "number" && typeof maxScale === "number" && minScale > maxScale) {
      if (hasMinScale && !hasMaxScale) {
        sanitized.canvasMaxScale = minScale;
      } else if (!hasMinScale && hasMaxScale) {
        sanitized.canvasMinScale = maxScale;
      } else {
        sanitized.canvasMaxScale = minScale;
      }
    }
  }

  if (sanitized.canvasDoubleTapScale !== undefined) {
    const minScale =
      typeof sanitized.canvasMinScale === "number"
        ? sanitized.canvasMinScale
        : current.canvasMinScale;
    const maxScale =
      typeof sanitized.canvasMaxScale === "number"
        ? sanitized.canvasMaxScale
        : current.canvasMaxScale;
    if (typeof sanitized.canvasDoubleTapScale === "number") {
      sanitized.canvasDoubleTapScale = clamp(sanitized.canvasDoubleTapScale, minScale, maxScale);
    }
  }

  const effectiveAccent = (sanitized.accentColor ?? current.accentColor) as AccentColorKey | null;
  const effectivePreset = (sanitized.activePreset ?? current.activePreset) as StylePresetKey;

  if (
    sanitized.themeColorMode === undefined &&
    (sanitized.accentColor !== undefined || sanitized.activePreset !== undefined)
  ) {
    sanitized.themeColorMode = inferThemeColorMode(
      effectiveAccent,
      effectivePreset,
      current.themeColorMode,
    );
  }

  if (sanitized.themeColorMode === "accent") {
    const accent = sanitized.accentColor ?? current.accentColor;
    sanitized.accentColor = accent ?? "blue";
    sanitized.activePreset = "default";
  } else if (sanitized.themeColorMode === "preset") {
    const preset = sanitized.activePreset ?? current.activePreset;
    sanitized.activePreset =
      preset && Object.prototype.hasOwnProperty.call(STYLE_PRESETS, preset) ? preset : "default";
    sanitized.accentColor = null;
  } else if (sanitized.themeColorMode === "custom") {
    const customTheme =
      (sanitized.customThemeColors as ThemeCustomColors | undefined) ?? current.customThemeColors;
    sanitized.customThemeColors = cloneCustomThemeColors(customTheme);
  }

  return sanitized;
}

const THEME_SYNC_KEYS: Array<keyof SettingsDataState> = [
  "theme",
  "themeColorMode",
  "accentColor",
  "activePreset",
  "customThemeColors",
];

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,

      setDefaultStretch: (stretch) => set({ defaultStretch: stretch }),
      setDefaultColormap: (colormap) => set({ defaultColormap: colormap }),
      setDefaultGridColumns: (cols) => set({ defaultGridColumns: cols }),
      setThumbnailQuality: (quality) => get().applySettingsPatch({ thumbnailQuality: quality }),
      setThumbnailSize: (size) => get().applySettingsPatch({ thumbnailSize: size }),
      setDefaultExportFormat: (format) => set({ defaultExportFormat: format }),
      setAutoGroupByObject: (value) => set({ autoGroupByObject: value }),
      setAutoDetectDuplicates: (value) => set({ autoDetectDuplicates: value }),
      setAutoTagLocation: (value) => set({ autoTagLocation: value }),
      setMapPreset: (preset) => set({ mapPreset: preset }),
      setMapShowOverlays: (value) => set({ mapShowOverlays: value }),
      setSessionGapMinutes: (minutes) => get().applySettingsPatch({ sessionGapMinutes: minutes }),
      setCalendarSyncEnabled: (value) => set({ calendarSyncEnabled: value }),
      setDefaultReminderMinutes: (minutes) =>
        get().applySettingsPatch({ defaultReminderMinutes: minutes }),
      setLanguage: (lang) => set({ language: lang }),
      setOrientationLock: (lock) => set({ orientationLock: lock }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setConfirmDestructiveActions: (value) => set({ confirmDestructiveActions: value }),
      setAutoCheckUpdates: (value) => set({ autoCheckUpdates: value }),

      setTheme: (theme) => {
        const { themeColorMode, accentColor, activePreset, customThemeColors } = get();
        syncThemeToRuntime(theme, themeColorMode, accentColor, activePreset, customThemeColors);
        set({ theme });
      },

      setThemeColorMode: (mode) => {
        const current = get();
        const nextPatch: Partial<SettingsDataState> = { themeColorMode: mode };
        if (mode === "accent") {
          nextPatch.accentColor = current.accentColor ?? "blue";
          nextPatch.activePreset = "default";
        } else if (mode === "preset") {
          nextPatch.accentColor = null;
        }
        set(nextPatch);
        const next = get();
        syncThemeToRuntime(
          next.theme,
          next.themeColorMode,
          next.accentColor,
          next.activePreset,
          next.customThemeColors,
        );
      },

      setAccentColor: (color) => {
        const { theme, customThemeColors } = get();
        const mode: ThemeColorMode = color ? "accent" : "preset";
        set({ accentColor: color, activePreset: "default", themeColorMode: mode });
        syncThemeToRuntime(theme, mode, color, "default", customThemeColors);
      },

      setActivePreset: (preset) => {
        const { theme, customThemeColors } = get();
        set({ activePreset: preset, accentColor: null, themeColorMode: "preset" });
        syncThemeToRuntime(theme, "preset", null, preset, customThemeColors);
      },

      setCustomThemeLinked: (linked) => {
        const current = get();
        const nextCustomTheme = cloneCustomThemeColors(current.customThemeColors);
        nextCustomTheme.linked = linked;
        if (linked) {
          nextCustomTheme.dark = { ...nextCustomTheme.light };
        }
        set({ customThemeColors: nextCustomTheme, themeColorMode: "custom" });
        syncThemeToRuntime(
          current.theme,
          "custom",
          current.accentColor,
          current.activePreset,
          nextCustomTheme,
        );
      },

      setCustomThemeToken: (token, value, mode = "light") => {
        const normalized = normalizeHexColor(value);
        if (!normalized) return;

        const current = get();
        const nextCustomTheme = cloneCustomThemeColors(current.customThemeColors);
        if (nextCustomTheme.linked || mode === "light") {
          nextCustomTheme.light[token] = normalized;
          if (nextCustomTheme.linked) {
            nextCustomTheme.dark[token] = normalized;
          }
        }
        if (!nextCustomTheme.linked && mode === "dark") {
          nextCustomTheme.dark[token] = normalized;
        }

        set({ customThemeColors: nextCustomTheme, themeColorMode: "custom" });
        syncThemeToRuntime(
          current.theme,
          "custom",
          current.accentColor,
          current.activePreset,
          nextCustomTheme,
        );
      },

      resetStyle: () => {
        const current = get();
        const nextCustomTheme = cloneCustomThemeColors(DEFAULT_CUSTOM_THEME_COLORS);
        set({
          themeColorMode: DEFAULT_SETTINGS.themeColorMode,
          accentColor: DEFAULT_SETTINGS.accentColor,
          activePreset: DEFAULT_SETTINGS.activePreset,
          customThemeColors: nextCustomTheme,
        });
        syncThemeToRuntime(
          current.theme,
          DEFAULT_SETTINGS.themeColorMode,
          DEFAULT_SETTINGS.accentColor,
          DEFAULT_SETTINGS.activePreset,
          nextCustomTheme,
        );
      },

      setFontFamily: (font) => set({ fontFamily: font }),
      setMonoFontFamily: (font) => set({ monoFontFamily: font }),

      setDefaultShowGrid: (value) => set({ defaultShowGrid: value }),
      setDefaultShowCrosshair: (value) => set({ defaultShowCrosshair: value }),
      setDefaultShowPixelInfo: (value) => set({ defaultShowPixelInfo: value }),
      setDefaultShowMinimap: (value) => set({ defaultShowMinimap: value }),
      setDefaultBlackPoint: (value) => get().applySettingsPatch({ defaultBlackPoint: value }),
      setDefaultWhitePoint: (value) => get().applySettingsPatch({ defaultWhitePoint: value }),
      setDefaultGamma: (value) => get().applySettingsPatch({ defaultGamma: value }),
      setDefaultHistogramMode: (mode) => set({ defaultHistogramMode: mode }),
      setHistogramHeight: (height) => get().applySettingsPatch({ histogramHeight: height }),
      setPixelInfoDecimalPlaces: (places) =>
        get().applySettingsPatch({ pixelInfoDecimalPlaces: places }),
      setDefaultGallerySortBy: (sort) => set({ defaultGallerySortBy: sort }),
      setDefaultGallerySortOrder: (order) => set({ defaultGallerySortOrder: order }),
      setDefaultStackMethod: (method) => set({ defaultStackMethod: method }),
      setDefaultSigmaValue: (value) => get().applySettingsPatch({ defaultSigmaValue: value }),
      setDefaultAlignmentMode: (mode) => set({ defaultAlignmentMode: mode }),
      setDefaultEnableQuality: (value) => set({ defaultEnableQuality: value }),
      setImageProcessingDebounce: (ms) => get().applySettingsPatch({ imageProcessingDebounce: ms }),
      setUseHighQualityPreview: (value) => set({ useHighQualityPreview: value }),
      setGridColor: (color) => set({ gridColor: color }),
      setGridOpacity: (opacity) => get().applySettingsPatch({ gridOpacity: opacity }),
      setCrosshairColor: (color) => set({ crosshairColor: color }),
      setCrosshairOpacity: (opacity) => get().applySettingsPatch({ crosshairOpacity: opacity }),
      setCanvasMinScale: (scale) => get().applySettingsPatch({ canvasMinScale: scale }),
      setCanvasMaxScale: (scale) => get().applySettingsPatch({ canvasMaxScale: scale }),
      setCanvasDoubleTapScale: (scale) => get().applySettingsPatch({ canvasDoubleTapScale: scale }),
      setThumbnailShowFilename: (v) => set({ thumbnailShowFilename: v }),
      setThumbnailShowObject: (v) => set({ thumbnailShowObject: v }),
      setThumbnailShowFilter: (v) => set({ thumbnailShowFilter: v }),
      setThumbnailShowExposure: (v) => set({ thumbnailShowExposure: v }),
      setFileListStyle: (style) => set({ fileListStyle: style }),
      setDefaultConverterFormat: (fmt) => set({ defaultConverterFormat: fmt }),
      setDefaultConverterQuality: (q) => get().applySettingsPatch({ defaultConverterQuality: q }),
      setBatchNamingRule: (rule) => set({ batchNamingRule: rule }),
      setDefaultBlurSigma: (v) => get().applySettingsPatch({ defaultBlurSigma: v }),
      setDefaultSharpenAmount: (v) => get().applySettingsPatch({ defaultSharpenAmount: v }),
      setDefaultDenoiseRadius: (v) => get().applySettingsPatch({ defaultDenoiseRadius: v }),
      setEditorMaxUndo: (v) => get().applySettingsPatch({ editorMaxUndo: v }),
      setTimelineGrouping: (v) => set({ timelineGrouping: v }),
      setSessionShowExposureCount: (v) => set({ sessionShowExposureCount: v }),
      setSessionShowTotalExposure: (v) => set({ sessionShowTotalExposure: v }),
      setSessionShowFilters: (v) => set({ sessionShowFilters: v }),
      setTargetSortBy: (v) => set({ targetSortBy: v }),
      setTargetSortOrder: (v) => set({ targetSortOrder: v }),
      setDefaultComposePreset: (v) => set({ defaultComposePreset: v }),
      setComposeRedWeight: (v) => get().applySettingsPatch({ composeRedWeight: v }),
      setComposeGreenWeight: (v) => get().applySettingsPatch({ composeGreenWeight: v }),
      setComposeBlueWeight: (v) => get().applySettingsPatch({ composeBlueWeight: v }),

      applySettingsPatch: (patch) => {
        const current = get() as SettingsDataState;
        const sanitized = sanitizeSettingsPatch(patch, current);
        set(sanitized);
        if (THEME_SYNC_KEYS.some((key) => sanitized[key] !== undefined)) {
          const { theme, themeColorMode, accentColor, activePreset, customThemeColors } = get();
          syncThemeToRuntime(theme, themeColorMode, accentColor, activePreset, customThemeColors);
        }
      },

      resetToDefaults: () => {
        const nextDefaults: SettingsDataState = {
          ...DEFAULT_SETTINGS,
          customThemeColors: cloneCustomThemeColors(DEFAULT_SETTINGS.customThemeColors),
        };
        set(nextDefaults);
        syncThemeToRuntime(
          nextDefaults.theme,
          nextDefaults.themeColorMode,
          nextDefaults.accentColor,
          nextDefaults.activePreset,
          nextDefaults.customThemeColors,
        );
      },
    }),
    {
      name: "settings-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      merge: (persistedState, currentState) => {
        const persistedPatch = sanitizeSettingsPatch(
          (persistedState as Record<string, unknown>) ?? {},
          currentState as SettingsDataState,
        );
        const merged = {
          ...currentState,
          ...persistedPatch,
        };
        if (persistedPatch.themeColorMode === undefined) {
          merged.themeColorMode = inferThemeColorMode(
            merged.accentColor,
            merged.activePreset,
            merged.themeColorMode,
          );
        }
        merged.customThemeColors = cloneCustomThemeColors(
          merged.customThemeColors ?? DEFAULT_CUSTOM_THEME_COLORS,
        );
        return merged;
      },
      partialize: (state) => pickSettingsData(state),
      onRehydrateStorage: () => (state) => {
        if (state) {
          syncThemeToRuntime(
            state.theme,
            state.themeColorMode,
            state.accentColor,
            state.activePreset,
            state.customThemeColors,
          );
        }
      },
    },
  ),
);
