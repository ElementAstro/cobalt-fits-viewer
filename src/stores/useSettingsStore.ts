/**
 * 设置状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Uniwind } from "uniwind";
import { zustandMMKVStorage } from "../lib/storage";
import { setI18nLocale } from "../i18n";
import type {
  StretchType,
  ColormapType,
  ExportFormat,
  FrameClassificationConfig,
  ProcessingAlgorithmProfile,
} from "../lib/fits/types";
import type { LogLevel } from "../lib/logger";
import {
  DEFAULT_FRAME_CLASSIFICATION_CONFIG,
  getFrameTypeDefinitions,
  sanitizeFrameClassificationConfig,
} from "../lib/gallery/frameClassifier";
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

export interface SettingsStoreState {
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
  logMinLevel: LogLevel;
  logMaxEntries: number;
  logConsoleOutput: boolean;
  logPersistEnabled: boolean;

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
  stackingDetectionProfile: "fast" | "balanced" | "accurate";
  stackingDetectSigmaThreshold: number;
  stackingDetectMaxStars: number;
  stackingDetectMinArea: number;
  stackingDetectMaxArea: number;
  stackingDetectBorderMargin: number;
  stackingDetectSigmaClipIters: number;
  stackingDetectApplyMatchedFilter: boolean;
  stackingDetectConnectivity: 4 | 8;
  stackingBackgroundMeshSize: number;
  stackingDeblendNLevels: number;
  stackingDeblendMinContrast: number;
  stackingFilterFwhm: number;
  stackingDetectMinFwhm: number;
  stackingMaxFwhm: number;
  stackingMaxEllipticity: number;
  stackingDetectMinSharpness: number;
  stackingDetectMaxSharpness: number;
  stackingDetectPeakMax: number;
  stackingDetectSnrMin: number;
  stackingUseAnnotatedForAlignment: boolean;
  stackingRansacMaxIterations: number;
  stackingAlignmentInlierThreshold: number;

  // 网格/十字线样式
  gridColor: string;
  gridOpacity: number;
  crosshairColor: string;
  crosshairOpacity: number;

  // 画布缩放限制
  canvasMinScale: number;
  canvasMaxScale: number;
  canvasDoubleTapScale: number;
  canvasPinchSensitivity: number;
  canvasPinchOverzoomFactor: number;
  canvasPanRubberBandFactor: number;
  canvasWheelZoomSensitivity: number;

  // 缩略图叠加信息
  thumbnailShowFilename: boolean;
  thumbnailShowObject: boolean;
  thumbnailShowFilter: boolean;
  thumbnailShowExposure: boolean;

  // 文件列表显示风格
  fileListStyle: "grid" | "list" | "compact";

  // 转换器默认设置
  defaultConverterFormat: ExportFormat;
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
  advancedComposeRegistrationMode: "none" | "translation" | "full";
  advancedComposeFramingMode: "first" | "min" | "cog";
  advancedComposeAutoLinearMatch: boolean;
  advancedComposeAutoBrightnessBalance: boolean;
  advancedComposePreviewScale: number;
  advancedComposePixelMathR: string;
  advancedComposePixelMathG: string;
  advancedComposePixelMathB: string;

  // 性能配置
  imageProcessingProfile: ProcessingAlgorithmProfile;
  viewerApplyEditorRecipe: boolean;
  imageProcessingDebounce: number;
  useHighQualityPreview: boolean;
  videoAutoplay: boolean;
  videoLoopByDefault: boolean;
  videoMutedByDefault: boolean;
  videoThumbnailTimeMs: number;
  videoProcessingConcurrency: number;
  defaultVideoProfile: "compatibility" | "balanced" | "quality";
  defaultVideoTargetPreset: "1080p" | "720p" | "custom";
  videoCoreEnabled: boolean;
  videoProcessingEnabled: boolean;

  // 帧分类规则
  frameClassificationConfig: FrameClassificationConfig;
  reportFrameTypes: string[];

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
  setLogMinLevel: (level: LogLevel) => void;
  setLogMaxEntries: (value: number) => void;
  setLogConsoleOutput: (value: boolean) => void;
  setLogPersistEnabled: (value: boolean) => void;
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
  setStackingDetectionProfile: (value: "fast" | "balanced" | "accurate") => void;
  setStackingDetectSigmaThreshold: (value: number) => void;
  setStackingDetectMaxStars: (value: number) => void;
  setStackingDetectMinArea: (value: number) => void;
  setStackingDetectMaxArea: (value: number) => void;
  setStackingDetectBorderMargin: (value: number) => void;
  setStackingDetectSigmaClipIters: (value: number) => void;
  setStackingDetectApplyMatchedFilter: (value: boolean) => void;
  setStackingDetectConnectivity: (value: 4 | 8) => void;
  setStackingBackgroundMeshSize: (value: number) => void;
  setStackingDeblendNLevels: (value: number) => void;
  setStackingDeblendMinContrast: (value: number) => void;
  setStackingFilterFwhm: (value: number) => void;
  setStackingDetectMinFwhm: (value: number) => void;
  setStackingMaxFwhm: (value: number) => void;
  setStackingMaxEllipticity: (value: number) => void;
  setStackingDetectMinSharpness: (value: number) => void;
  setStackingDetectMaxSharpness: (value: number) => void;
  setStackingDetectPeakMax: (value: number) => void;
  setStackingDetectSnrMin: (value: number) => void;
  setStackingUseAnnotatedForAlignment: (value: boolean) => void;
  setStackingRansacMaxIterations: (value: number) => void;
  setStackingAlignmentInlierThreshold: (value: number) => void;
  setImageProcessingProfile: (profile: ProcessingAlgorithmProfile) => void;
  setViewerApplyEditorRecipe: (value: boolean) => void;
  setImageProcessingDebounce: (ms: number) => void;
  setUseHighQualityPreview: (value: boolean) => void;
  setVideoAutoplay: (value: boolean) => void;
  setVideoLoopByDefault: (value: boolean) => void;
  setVideoMutedByDefault: (value: boolean) => void;
  setVideoThumbnailTimeMs: (value: number) => void;
  setVideoProcessingConcurrency: (value: number) => void;
  setDefaultVideoProfile: (value: "compatibility" | "balanced" | "quality") => void;
  setDefaultVideoTargetPreset: (value: "1080p" | "720p" | "custom") => void;
  setVideoCoreEnabled: (value: boolean) => void;
  setVideoProcessingEnabled: (value: boolean) => void;
  setFrameClassificationConfig: (config: FrameClassificationConfig) => void;
  setReportFrameTypes: (values: string[]) => void;
  resetFrameClassificationConfig: () => void;
  setGridColor: (color: string) => void;
  setGridOpacity: (opacity: number) => void;
  setCrosshairColor: (color: string) => void;
  setCrosshairOpacity: (opacity: number) => void;
  setCanvasMinScale: (scale: number) => void;
  setCanvasMaxScale: (scale: number) => void;
  setCanvasDoubleTapScale: (scale: number) => void;
  setCanvasPinchSensitivity: (value: number) => void;
  setCanvasPinchOverzoomFactor: (value: number) => void;
  setCanvasPanRubberBandFactor: (value: number) => void;
  setCanvasWheelZoomSensitivity: (value: number) => void;
  setThumbnailShowFilename: (v: boolean) => void;
  setThumbnailShowObject: (v: boolean) => void;
  setThumbnailShowFilter: (v: boolean) => void;
  setThumbnailShowExposure: (v: boolean) => void;
  setFileListStyle: (style: "grid" | "list" | "compact") => void;
  setDefaultConverterFormat: (fmt: ExportFormat) => void;
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
  setAdvancedComposeRegistrationMode: (v: "none" | "translation" | "full") => void;
  setAdvancedComposeFramingMode: (v: "first" | "min" | "cog") => void;
  setAdvancedComposeAutoLinearMatch: (v: boolean) => void;
  setAdvancedComposeAutoBrightnessBalance: (v: boolean) => void;
  setAdvancedComposePreviewScale: (v: number) => void;
  setAdvancedComposePixelMathR: (v: string) => void;
  setAdvancedComposePixelMathG: (v: string) => void;
  setAdvancedComposePixelMathB: (v: string) => void;
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

export type SettingsDataState = Omit<SettingsStoreState, SettingsActionKeys>;

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
  logMinLevel: __DEV__ ? "debug" : "info",
  logMaxEntries: 2000,
  logConsoleOutput: __DEV__,
  logPersistEnabled: true,
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
  stackingDetectionProfile: "balanced",
  stackingDetectSigmaThreshold: 5,
  stackingDetectMaxStars: 220,
  stackingDetectMinArea: 3,
  stackingDetectMaxArea: 600,
  stackingDetectBorderMargin: 10,
  stackingDetectSigmaClipIters: 2,
  stackingDetectApplyMatchedFilter: true,
  stackingDetectConnectivity: 8,
  stackingBackgroundMeshSize: 64,
  stackingDeblendNLevels: 16,
  stackingDeblendMinContrast: 0.08,
  stackingFilterFwhm: 2.2,
  stackingDetectMinFwhm: 0.6,
  stackingMaxFwhm: 11,
  stackingMaxEllipticity: 0.65,
  stackingDetectMinSharpness: 0.25,
  stackingDetectMaxSharpness: 18,
  stackingDetectPeakMax: 0,
  stackingDetectSnrMin: 2,
  stackingUseAnnotatedForAlignment: true,
  stackingRansacMaxIterations: 100,
  stackingAlignmentInlierThreshold: 3,
  gridColor: "#64c8ff",
  gridOpacity: 0.3,
  crosshairColor: "#ff5050",
  crosshairOpacity: 0.7,
  canvasMinScale: 0.5,
  canvasMaxScale: 10,
  canvasDoubleTapScale: 3,
  canvasPinchSensitivity: 1.0,
  canvasPinchOverzoomFactor: 1.25,
  canvasPanRubberBandFactor: 0.55,
  canvasWheelZoomSensitivity: 0.0015,
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
  advancedComposeRegistrationMode: "full",
  advancedComposeFramingMode: "cog",
  advancedComposeAutoLinearMatch: true,
  advancedComposeAutoBrightnessBalance: true,
  advancedComposePreviewScale: 0.35,
  advancedComposePixelMathR: "R",
  advancedComposePixelMathG: "G",
  advancedComposePixelMathB: "B",
  imageProcessingProfile: "standard",
  viewerApplyEditorRecipe: true,
  imageProcessingDebounce: 150,
  useHighQualityPreview: true,
  videoAutoplay: false,
  videoLoopByDefault: false,
  videoMutedByDefault: false,
  videoThumbnailTimeMs: 1000,
  videoProcessingConcurrency: 2,
  defaultVideoProfile: "compatibility",
  defaultVideoTargetPreset: "1080p",
  videoCoreEnabled: true,
  videoProcessingEnabled: true,
  frameClassificationConfig: sanitizeFrameClassificationConfig(
    DEFAULT_FRAME_CLASSIFICATION_CONFIG,
    DEFAULT_FRAME_CLASSIFICATION_CONFIG,
  ),
  reportFrameTypes: ["light"],
};

export const SETTINGS_DATA_KEYS = Object.keys(DEFAULT_SETTINGS) as Array<keyof SettingsDataState>;

export function pickSettingsData(
  state: Pick<SettingsStoreState, keyof SettingsDataState>,
): SettingsDataState {
  return SETTINGS_DATA_KEYS.reduce((acc, key) => {
    (acc as Record<string, unknown>)[key] = state[key];
    return acc;
  }, {} as SettingsDataState);
}

export function getSettingsBackupData(
  state: Pick<SettingsStoreState, keyof SettingsDataState>,
): Record<string, unknown> {
  return pickSettingsData(state);
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

const OPTIONAL_CUSTOM_THEME_TOKENS = new Set<ThemeEditableToken>(["background", "surface"]);

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
      if (
        OPTIONAL_CUSTOM_THEME_TOKENS.has(token) &&
        typeof tokenMap[token] === "string" &&
        tokenMap[token].trim().length === 0
      ) {
        next[mode][token] = "";
        continue;
      }
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

function sanitizeReportFrameTypes(values: unknown, config: FrameClassificationConfig): string[] {
  if (!Array.isArray(values)) return ["light"];
  const allowed = new Set(getFrameTypeDefinitions(config).map((item) => item.key));
  const next: string[] = [];
  for (const item of values) {
    const key = String(item ?? "")
      .trim()
      .toLowerCase();
    if (!key || !allowed.has(key) || next.includes(key)) continue;
    next.push(key);
  }
  return next.length > 0 ? next : ["light"];
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
    { key: "stackingDetectSigmaThreshold", min: 1, max: 20 },
    { key: "stackingDetectMaxStars", min: 10, max: 2000, integer: true },
    { key: "stackingDetectMinArea", min: 1, max: 100, integer: true },
    { key: "stackingDetectMaxArea", min: 10, max: 10000, integer: true },
    { key: "stackingDetectBorderMargin", min: 0, max: 200, integer: true },
    { key: "stackingDetectSigmaClipIters", min: 0, max: 10, integer: true },
    { key: "stackingBackgroundMeshSize", min: 8, max: 512, integer: true },
    { key: "stackingDeblendNLevels", min: 1, max: 64, integer: true },
    { key: "stackingDeblendMinContrast", min: 0, max: 1 },
    { key: "stackingFilterFwhm", min: 0.3, max: 15 },
    { key: "stackingDetectMinFwhm", min: 0.1, max: 15 },
    { key: "stackingMaxFwhm", min: 0.5, max: 30 },
    { key: "stackingMaxEllipticity", min: 0, max: 1 },
    { key: "stackingDetectMinSharpness", min: 0, max: 100 },
    { key: "stackingDetectMaxSharpness", min: 0, max: 100 },
    { key: "stackingDetectPeakMax", min: 0, max: 1000000000 },
    { key: "stackingDetectSnrMin", min: 0, max: 100 },
    { key: "stackingRansacMaxIterations", min: 10, max: 1000, integer: true },
    { key: "stackingAlignmentInlierThreshold", min: 0.5, max: 20 },
    { key: "gridOpacity", min: 0, max: 1 },
    { key: "crosshairOpacity", min: 0, max: 1 },
    { key: "canvasMinScale", min: 0.1, max: 10 },
    { key: "canvasMaxScale", min: 1, max: 30 },
    { key: "canvasDoubleTapScale", min: 1, max: 30 },
    { key: "canvasPinchSensitivity", min: 0.6, max: 1.8 },
    { key: "canvasPinchOverzoomFactor", min: 1, max: 1.6 },
    { key: "canvasPanRubberBandFactor", min: 0, max: 0.9 },
    { key: "canvasWheelZoomSensitivity", min: 0.0005, max: 0.004 },
    { key: "defaultConverterQuality", min: 1, max: 100, integer: true },
    { key: "defaultBlurSigma", min: 0.1, max: 20 },
    { key: "defaultSharpenAmount", min: 0, max: 10 },
    { key: "defaultDenoiseRadius", min: 0, max: 20, integer: true },
    { key: "editorMaxUndo", min: 1, max: 200, integer: true },
    { key: "composeRedWeight", min: 0, max: 4 },
    { key: "composeGreenWeight", min: 0, max: 4 },
    { key: "composeBlueWeight", min: 0, max: 4 },
    { key: "advancedComposePreviewScale", min: 0.1, max: 1 },
    { key: "imageProcessingDebounce", min: 0, max: 2000, integer: true },
    { key: "videoThumbnailTimeMs", min: 0, max: 300000, integer: true },
    { key: "videoProcessingConcurrency", min: 1, max: 6, integer: true },
    { key: "logMaxEntries", min: 100, max: 10000, integer: true },
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
    stackingDetectionProfile: ["fast", "balanced", "accurate"],
    stackingDetectConnectivity: [4, 8],
    fileListStyle: ["grid", "list", "compact"],
    defaultExportFormat: ["png", "jpeg", "webp", "tiff", "bmp", "fits"],
    defaultConverterFormat: ["png", "jpeg", "tiff", "webp", "bmp", "fits"],
    batchNamingRule: ["original", "prefix", "suffix", "sequence"],
    timelineGrouping: ["day", "week", "month"],
    targetSortBy: ["name", "date", "frames", "exposure", "favorite"],
    targetSortOrder: ["asc", "desc"],
    defaultComposePreset: ["rgb", "sho", "hoo", "lrgb", "custom"],
    advancedComposeRegistrationMode: ["none", "translation", "full"],
    advancedComposeFramingMode: ["first", "min", "cog"],
    imageProcessingProfile: ["standard", "legacy"],
    defaultVideoProfile: ["compatibility", "balanced", "quality"],
    defaultVideoTargetPreset: ["1080p", "720p", "custom"],
    logMinLevel: ["debug", "info", "warn", "error"],
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

  if (sanitized.frameClassificationConfig !== undefined) {
    sanitized.frameClassificationConfig = sanitizeFrameClassificationConfig(
      sanitized.frameClassificationConfig,
      current.frameClassificationConfig,
    );
  }

  if (sanitized.reportFrameTypes !== undefined) {
    const nextConfig = (sanitized.frameClassificationConfig ??
      current.frameClassificationConfig) as FrameClassificationConfig;
    sanitized.reportFrameTypes = sanitizeReportFrameTypes(sanitized.reportFrameTypes, nextConfig);
  } else if (sanitized.frameClassificationConfig !== undefined) {
    sanitized.reportFrameTypes = sanitizeReportFrameTypes(
      current.reportFrameTypes,
      sanitized.frameClassificationConfig as FrameClassificationConfig,
    );
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

  const hasDetectMinArea = typeof sanitized.stackingDetectMinArea === "number";
  const hasDetectMaxArea = typeof sanitized.stackingDetectMaxArea === "number";
  if (hasDetectMinArea || hasDetectMaxArea) {
    const minArea = hasDetectMinArea
      ? sanitized.stackingDetectMinArea
      : current.stackingDetectMinArea;
    const maxArea = hasDetectMaxArea
      ? sanitized.stackingDetectMaxArea
      : current.stackingDetectMaxArea;
    if (typeof minArea === "number" && typeof maxArea === "number" && minArea > maxArea) {
      if (hasDetectMinArea && !hasDetectMaxArea) {
        sanitized.stackingDetectMaxArea = minArea;
      } else if (!hasDetectMinArea && hasDetectMaxArea) {
        sanitized.stackingDetectMinArea = maxArea;
      } else {
        sanitized.stackingDetectMaxArea = minArea;
      }
    }
  }

  const hasDetectMinFwhm = typeof sanitized.stackingDetectMinFwhm === "number";
  const hasDetectMaxFwhm = typeof sanitized.stackingMaxFwhm === "number";
  if (hasDetectMinFwhm || hasDetectMaxFwhm) {
    const minFwhm = hasDetectMinFwhm
      ? sanitized.stackingDetectMinFwhm
      : current.stackingDetectMinFwhm;
    const maxFwhm = hasDetectMaxFwhm ? sanitized.stackingMaxFwhm : current.stackingMaxFwhm;
    if (typeof minFwhm === "number" && typeof maxFwhm === "number" && minFwhm > maxFwhm) {
      if (hasDetectMinFwhm && !hasDetectMaxFwhm) {
        sanitized.stackingMaxFwhm = minFwhm;
      } else if (!hasDetectMinFwhm && hasDetectMaxFwhm) {
        sanitized.stackingDetectMinFwhm = maxFwhm;
      } else {
        sanitized.stackingMaxFwhm = minFwhm;
      }
    }
  }

  const hasDetectMinSharpness = typeof sanitized.stackingDetectMinSharpness === "number";
  const hasDetectMaxSharpness = typeof sanitized.stackingDetectMaxSharpness === "number";
  if (hasDetectMinSharpness || hasDetectMaxSharpness) {
    const minSharpness = hasDetectMinSharpness
      ? sanitized.stackingDetectMinSharpness
      : current.stackingDetectMinSharpness;
    const maxSharpness = hasDetectMaxSharpness
      ? sanitized.stackingDetectMaxSharpness
      : current.stackingDetectMaxSharpness;
    if (
      typeof minSharpness === "number" &&
      typeof maxSharpness === "number" &&
      minSharpness > maxSharpness
    ) {
      if (hasDetectMinSharpness && !hasDetectMaxSharpness) {
        sanitized.stackingDetectMaxSharpness = minSharpness;
      } else if (!hasDetectMinSharpness && hasDetectMaxSharpness) {
        sanitized.stackingDetectMinSharpness = maxSharpness;
      } else {
        sanitized.stackingDetectMaxSharpness = minSharpness;
      }
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

export function normalizeSettingsBackupPatch(
  patch: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeSettingsPatch(patch, DEFAULT_SETTINGS);
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
      setLanguage: (lang) => {
        const normalized = setI18nLocale(lang);
        set({ language: normalized });
      },
      setOrientationLock: (lock) => set({ orientationLock: lock }),
      setHapticsEnabled: (value) => set({ hapticsEnabled: value }),
      setConfirmDestructiveActions: (value) => set({ confirmDestructiveActions: value }),
      setAutoCheckUpdates: (value) => set({ autoCheckUpdates: value }),
      setLogMinLevel: (level) => set({ logMinLevel: level }),
      setLogMaxEntries: (value) => get().applySettingsPatch({ logMaxEntries: value }),
      setLogConsoleOutput: (value) => set({ logConsoleOutput: value }),
      setLogPersistEnabled: (value) => set({ logPersistEnabled: value }),

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
        const trimmed = value.trim();
        const isOptionalToken = OPTIONAL_CUSTOM_THEME_TOKENS.has(token);
        const normalized = isOptionalToken && trimmed.length === 0 ? "" : normalizeHexColor(value);
        if (normalized === null) return;

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
      setStackingDetectionProfile: (value) => set({ stackingDetectionProfile: value }),
      setStackingDetectSigmaThreshold: (value) =>
        get().applySettingsPatch({ stackingDetectSigmaThreshold: value }),
      setStackingDetectMaxStars: (value) =>
        get().applySettingsPatch({ stackingDetectMaxStars: value }),
      setStackingDetectMinArea: (value) =>
        get().applySettingsPatch({ stackingDetectMinArea: value }),
      setStackingDetectMaxArea: (value) =>
        get().applySettingsPatch({ stackingDetectMaxArea: value }),
      setStackingDetectBorderMargin: (value) =>
        get().applySettingsPatch({ stackingDetectBorderMargin: value }),
      setStackingDetectSigmaClipIters: (value) =>
        get().applySettingsPatch({ stackingDetectSigmaClipIters: value }),
      setStackingDetectApplyMatchedFilter: (value) =>
        set({ stackingDetectApplyMatchedFilter: value }),
      setStackingDetectConnectivity: (value) => set({ stackingDetectConnectivity: value }),
      setStackingBackgroundMeshSize: (value) =>
        get().applySettingsPatch({ stackingBackgroundMeshSize: value }),
      setStackingDeblendNLevels: (value) =>
        get().applySettingsPatch({ stackingDeblendNLevels: value }),
      setStackingDeblendMinContrast: (value) =>
        get().applySettingsPatch({ stackingDeblendMinContrast: value }),
      setStackingFilterFwhm: (value) => get().applySettingsPatch({ stackingFilterFwhm: value }),
      setStackingDetectMinFwhm: (value) =>
        get().applySettingsPatch({ stackingDetectMinFwhm: value }),
      setStackingMaxFwhm: (value) => get().applySettingsPatch({ stackingMaxFwhm: value }),
      setStackingMaxEllipticity: (value) =>
        get().applySettingsPatch({ stackingMaxEllipticity: value }),
      setStackingDetectMinSharpness: (value) =>
        get().applySettingsPatch({ stackingDetectMinSharpness: value }),
      setStackingDetectMaxSharpness: (value) =>
        get().applySettingsPatch({ stackingDetectMaxSharpness: value }),
      setStackingDetectPeakMax: (value) =>
        get().applySettingsPatch({ stackingDetectPeakMax: value }),
      setStackingDetectSnrMin: (value) => get().applySettingsPatch({ stackingDetectSnrMin: value }),
      setStackingUseAnnotatedForAlignment: (value) =>
        set({ stackingUseAnnotatedForAlignment: value }),
      setStackingRansacMaxIterations: (value) =>
        get().applySettingsPatch({ stackingRansacMaxIterations: value }),
      setStackingAlignmentInlierThreshold: (value) =>
        get().applySettingsPatch({ stackingAlignmentInlierThreshold: value }),
      setImageProcessingProfile: (profile) => set({ imageProcessingProfile: profile }),
      setViewerApplyEditorRecipe: (value) => set({ viewerApplyEditorRecipe: value }),
      setImageProcessingDebounce: (ms) => get().applySettingsPatch({ imageProcessingDebounce: ms }),
      setUseHighQualityPreview: (value) => set({ useHighQualityPreview: value }),
      setVideoAutoplay: (value) => set({ videoAutoplay: value }),
      setVideoLoopByDefault: (value) => set({ videoLoopByDefault: value }),
      setVideoMutedByDefault: (value) => set({ videoMutedByDefault: value }),
      setVideoThumbnailTimeMs: (value) => get().applySettingsPatch({ videoThumbnailTimeMs: value }),
      setVideoProcessingConcurrency: (value) =>
        get().applySettingsPatch({ videoProcessingConcurrency: value }),
      setDefaultVideoProfile: (value) => set({ defaultVideoProfile: value }),
      setDefaultVideoTargetPreset: (value) => set({ defaultVideoTargetPreset: value }),
      setVideoCoreEnabled: (value) => set({ videoCoreEnabled: value }),
      setVideoProcessingEnabled: (value) => set({ videoProcessingEnabled: value }),
      setFrameClassificationConfig: (config) =>
        get().applySettingsPatch({ frameClassificationConfig: config }),
      setReportFrameTypes: (values) => get().applySettingsPatch({ reportFrameTypes: values }),
      resetFrameClassificationConfig: () =>
        get().applySettingsPatch({
          frameClassificationConfig: DEFAULT_FRAME_CLASSIFICATION_CONFIG,
          reportFrameTypes: ["light"],
        }),
      setGridColor: (color) => set({ gridColor: color }),
      setGridOpacity: (opacity) => get().applySettingsPatch({ gridOpacity: opacity }),
      setCrosshairColor: (color) => set({ crosshairColor: color }),
      setCrosshairOpacity: (opacity) => get().applySettingsPatch({ crosshairOpacity: opacity }),
      setCanvasMinScale: (scale) => get().applySettingsPatch({ canvasMinScale: scale }),
      setCanvasMaxScale: (scale) => get().applySettingsPatch({ canvasMaxScale: scale }),
      setCanvasDoubleTapScale: (scale) => get().applySettingsPatch({ canvasDoubleTapScale: scale }),
      setCanvasPinchSensitivity: (value) =>
        get().applySettingsPatch({ canvasPinchSensitivity: value }),
      setCanvasPinchOverzoomFactor: (value) =>
        get().applySettingsPatch({ canvasPinchOverzoomFactor: value }),
      setCanvasPanRubberBandFactor: (value) =>
        get().applySettingsPatch({ canvasPanRubberBandFactor: value }),
      setCanvasWheelZoomSensitivity: (value) =>
        get().applySettingsPatch({ canvasWheelZoomSensitivity: value }),
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
      setAdvancedComposeRegistrationMode: (v) => set({ advancedComposeRegistrationMode: v }),
      setAdvancedComposeFramingMode: (v) => set({ advancedComposeFramingMode: v }),
      setAdvancedComposeAutoLinearMatch: (v) => set({ advancedComposeAutoLinearMatch: v }),
      setAdvancedComposeAutoBrightnessBalance: (v) =>
        set({ advancedComposeAutoBrightnessBalance: v }),
      setAdvancedComposePreviewScale: (v) =>
        get().applySettingsPatch({ advancedComposePreviewScale: v }),
      setAdvancedComposePixelMathR: (v) => set({ advancedComposePixelMathR: v }),
      setAdvancedComposePixelMathG: (v) => set({ advancedComposePixelMathG: v }),
      setAdvancedComposePixelMathB: (v) => set({ advancedComposePixelMathB: v }),

      applySettingsPatch: (patch) => {
        const current = get() as SettingsDataState;
        const sanitized = sanitizeSettingsPatch(patch, current);
        if (sanitized.language !== undefined) {
          sanitized.language = setI18nLocale(sanitized.language);
        }
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
          frameClassificationConfig: sanitizeFrameClassificationConfig(
            DEFAULT_SETTINGS.frameClassificationConfig,
            DEFAULT_SETTINGS.frameClassificationConfig,
          ),
          reportFrameTypes: [...DEFAULT_SETTINGS.reportFrameTypes],
        };
        set(nextDefaults);
        setI18nLocale(nextDefaults.language);
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
        merged.frameClassificationConfig = sanitizeFrameClassificationConfig(
          merged.frameClassificationConfig,
          DEFAULT_SETTINGS.frameClassificationConfig,
        );
        merged.reportFrameTypes = sanitizeReportFrameTypes(
          merged.reportFrameTypes,
          merged.frameClassificationConfig,
        );
        return merged;
      },
      partialize: (state) => pickSettingsData(state),
      onRehydrateStorage: () => (state) => {
        if (state) {
          setI18nLocale(state.language);
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
