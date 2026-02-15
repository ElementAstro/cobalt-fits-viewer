/**
 * 设置状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { Uniwind } from "uniwind";
import { zustandMMKVStorage } from "../lib/storage";
import type { StretchType, ColormapType, ExportFormat } from "../lib/fits/types";
import {
  applyAccentColor,
  applyStylePreset,
  type AccentColorKey,
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

  // 自定义风格
  accentColor: AccentColorKey | null;
  activePreset: StylePresetKey;

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
  targetSortBy: "name" | "date" | "priority";
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
  setAccentColor: (color: AccentColorKey | null) => void;
  setActivePreset: (preset: StylePresetKey) => void;
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
  setTargetSortBy: (v: "name" | "date" | "priority") => void;
  setTargetSortOrder: (v: "asc" | "desc") => void;
  setDefaultComposePreset: (v: "rgb" | "sho" | "hoo" | "lrgb" | "custom") => void;
  setComposeRedWeight: (v: number) => void;
  setComposeGreenWeight: (v: number) => void;
  setComposeBlueWeight: (v: number) => void;
  resetToDefaults: () => void;
}

/**
 * 同步主题与自定义风格到 Uniwind 运行时
 */
function syncThemeToRuntime(
  theme: "light" | "dark" | "system",
  accentColor: AccentColorKey | null,
  activePreset: StylePresetKey,
) {
  Uniwind.setTheme(theme);

  // 先应用预设，再覆盖强调色（强调色优先级更高）
  if (activePreset !== "default") {
    applyStylePreset(activePreset);
  }
  if (accentColor) {
    applyAccentColor(accentColor);
  }
}

export const useSettingsStore = create<SettingsStoreState>()(
  persist(
    (set, get) => ({
      defaultStretch: "asinh",
      defaultColormap: "grayscale",
      defaultGridColumns: 3,
      thumbnailQuality: 80,
      thumbnailSize: 256,
      defaultExportFormat: "png",
      autoGroupByObject: true,
      autoDetectDuplicates: true,
      autoTagLocation: false,
      mapPreset: "standard" as const,
      mapShowOverlays: false,
      sessionGapMinutes: 120,
      calendarSyncEnabled: false,
      defaultReminderMinutes: 30,
      language: "zh",
      theme: "dark",
      orientationLock: "default" as const,
      accentColor: null,
      activePreset: "default" as StylePresetKey,
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

      fileListStyle: "grid" as const,

      defaultConverterFormat: "png" as const,
      defaultConverterQuality: 90,
      batchNamingRule: "original" as const,

      defaultBlurSigma: 2.0,
      defaultSharpenAmount: 1.5,
      defaultDenoiseRadius: 1,
      editorMaxUndo: 10,

      timelineGrouping: "day" as const,

      sessionShowExposureCount: true,
      sessionShowTotalExposure: true,
      sessionShowFilters: true,

      targetSortBy: "name" as const,
      targetSortOrder: "asc" as const,

      defaultComposePreset: "rgb" as const,
      composeRedWeight: 1.0,
      composeGreenWeight: 1.0,
      composeBlueWeight: 1.0,

      imageProcessingDebounce: 150,
      useHighQualityPreview: true,

      setDefaultStretch: (stretch) => set({ defaultStretch: stretch }),
      setDefaultColormap: (colormap) => set({ defaultColormap: colormap }),
      setDefaultGridColumns: (cols) => set({ defaultGridColumns: cols }),
      setThumbnailQuality: (quality) => set({ thumbnailQuality: quality }),
      setThumbnailSize: (size) => set({ thumbnailSize: size }),
      setDefaultExportFormat: (format) => set({ defaultExportFormat: format }),
      setAutoGroupByObject: (value) => set({ autoGroupByObject: value }),
      setAutoDetectDuplicates: (value) => set({ autoDetectDuplicates: value }),
      setAutoTagLocation: (value) => set({ autoTagLocation: value }),
      setMapPreset: (preset) => set({ mapPreset: preset }),
      setMapShowOverlays: (value) => set({ mapShowOverlays: value }),
      setSessionGapMinutes: (minutes) => set({ sessionGapMinutes: minutes }),
      setCalendarSyncEnabled: (value) => set({ calendarSyncEnabled: value }),
      setDefaultReminderMinutes: (minutes) => set({ defaultReminderMinutes: minutes }),
      setLanguage: (lang) => set({ language: lang }),
      setOrientationLock: (lock) => set({ orientationLock: lock }),

      setTheme: (theme) => {
        const { accentColor, activePreset } = get();
        syncThemeToRuntime(theme, accentColor, activePreset);
        set({ theme });
      },

      setAccentColor: (color) => {
        const { theme } = get();
        set({ accentColor: color, activePreset: "default" });
        syncThemeToRuntime(theme, color, "default");
      },

      setActivePreset: (preset) => {
        const { theme } = get();
        set({ activePreset: preset, accentColor: null });
        syncThemeToRuntime(theme, null, preset);
      },

      setFontFamily: (font) => set({ fontFamily: font }),
      setMonoFontFamily: (font) => set({ monoFontFamily: font }),

      setDefaultShowGrid: (value) => set({ defaultShowGrid: value }),
      setDefaultShowCrosshair: (value) => set({ defaultShowCrosshair: value }),
      setDefaultShowPixelInfo: (value) => set({ defaultShowPixelInfo: value }),
      setDefaultShowMinimap: (value) => set({ defaultShowMinimap: value }),
      setDefaultBlackPoint: (value) => set({ defaultBlackPoint: value }),
      setDefaultWhitePoint: (value) => set({ defaultWhitePoint: value }),
      setDefaultGamma: (value) => set({ defaultGamma: value }),
      setDefaultHistogramMode: (mode) => set({ defaultHistogramMode: mode }),
      setHistogramHeight: (height) => set({ histogramHeight: height }),
      setPixelInfoDecimalPlaces: (places) => set({ pixelInfoDecimalPlaces: places }),
      setDefaultGallerySortBy: (sort) => set({ defaultGallerySortBy: sort }),
      setDefaultGallerySortOrder: (order) => set({ defaultGallerySortOrder: order }),
      setDefaultStackMethod: (method) => set({ defaultStackMethod: method }),
      setDefaultSigmaValue: (value) => set({ defaultSigmaValue: value }),
      setDefaultAlignmentMode: (mode) => set({ defaultAlignmentMode: mode }),
      setDefaultEnableQuality: (value) => set({ defaultEnableQuality: value }),
      setImageProcessingDebounce: (ms) => set({ imageProcessingDebounce: ms }),
      setUseHighQualityPreview: (value) => set({ useHighQualityPreview: value }),
      setGridColor: (color) => set({ gridColor: color }),
      setGridOpacity: (opacity) => set({ gridOpacity: opacity }),
      setCrosshairColor: (color) => set({ crosshairColor: color }),
      setCrosshairOpacity: (opacity) => set({ crosshairOpacity: opacity }),
      setCanvasMinScale: (scale) => set({ canvasMinScale: scale }),
      setCanvasMaxScale: (scale) => set({ canvasMaxScale: scale }),
      setCanvasDoubleTapScale: (scale) => set({ canvasDoubleTapScale: scale }),
      setThumbnailShowFilename: (v) => set({ thumbnailShowFilename: v }),
      setThumbnailShowObject: (v) => set({ thumbnailShowObject: v }),
      setThumbnailShowFilter: (v) => set({ thumbnailShowFilter: v }),
      setThumbnailShowExposure: (v) => set({ thumbnailShowExposure: v }),
      setFileListStyle: (style) => set({ fileListStyle: style }),
      setDefaultConverterFormat: (fmt) => set({ defaultConverterFormat: fmt }),
      setDefaultConverterQuality: (q) => set({ defaultConverterQuality: q }),
      setBatchNamingRule: (rule) => set({ batchNamingRule: rule }),
      setDefaultBlurSigma: (v) => set({ defaultBlurSigma: v }),
      setDefaultSharpenAmount: (v) => set({ defaultSharpenAmount: v }),
      setDefaultDenoiseRadius: (v) => set({ defaultDenoiseRadius: v }),
      setEditorMaxUndo: (v) => set({ editorMaxUndo: v }),
      setTimelineGrouping: (v) => set({ timelineGrouping: v }),
      setSessionShowExposureCount: (v) => set({ sessionShowExposureCount: v }),
      setSessionShowTotalExposure: (v) => set({ sessionShowTotalExposure: v }),
      setSessionShowFilters: (v) => set({ sessionShowFilters: v }),
      setTargetSortBy: (v) => set({ targetSortBy: v }),
      setTargetSortOrder: (v) => set({ targetSortOrder: v }),
      setDefaultComposePreset: (v) => set({ defaultComposePreset: v }),
      setComposeRedWeight: (v) => set({ composeRedWeight: v }),
      setComposeGreenWeight: (v) => set({ composeGreenWeight: v }),
      setComposeBlueWeight: (v) => set({ composeBlueWeight: v }),

      resetToDefaults: () => {
        set({
          defaultStretch: "asinh",
          defaultColormap: "grayscale",
          defaultGridColumns: 3,
          thumbnailQuality: 80,
          thumbnailSize: 256,
          defaultExportFormat: "png",
          autoGroupByObject: true,
          autoDetectDuplicates: true,
          autoTagLocation: false,
          sessionGapMinutes: 120,
          calendarSyncEnabled: false,
          defaultReminderMinutes: 30,
          language: "zh",
          theme: "dark",
          orientationLock: "default" as const,
          accentColor: null,
          activePreset: "default" as StylePresetKey,
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
          fileListStyle: "grid" as const,
          defaultConverterFormat: "png" as const,
          defaultConverterQuality: 90,
          batchNamingRule: "original" as const,
          defaultBlurSigma: 2.0,
          defaultSharpenAmount: 1.5,
          defaultDenoiseRadius: 1,
          editorMaxUndo: 10,
          timelineGrouping: "day" as const,
          sessionShowExposureCount: true,
          sessionShowTotalExposure: true,
          sessionShowFilters: true,
          targetSortBy: "name" as const,
          targetSortOrder: "asc" as const,
          defaultComposePreset: "rgb" as const,
          composeRedWeight: 1.0,
          composeGreenWeight: 1.0,
          composeBlueWeight: 1.0,
          imageProcessingDebounce: 150,
          useHighQualityPreview: true,
        });
        syncThemeToRuntime("dark", null, "default");
      },
    }),
    {
      name: "settings-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        defaultStretch: state.defaultStretch,
        defaultColormap: state.defaultColormap,
        defaultGridColumns: state.defaultGridColumns,
        thumbnailQuality: state.thumbnailQuality,
        thumbnailSize: state.thumbnailSize,
        defaultExportFormat: state.defaultExportFormat,
        autoGroupByObject: state.autoGroupByObject,
        autoDetectDuplicates: state.autoDetectDuplicates,
        autoTagLocation: state.autoTagLocation,
        mapPreset: state.mapPreset,
        mapShowOverlays: state.mapShowOverlays,
        sessionGapMinutes: state.sessionGapMinutes,
        calendarSyncEnabled: state.calendarSyncEnabled,
        defaultReminderMinutes: state.defaultReminderMinutes,
        language: state.language,
        theme: state.theme,
        accentColor: state.accentColor,
        activePreset: state.activePreset,
        fontFamily: state.fontFamily,
        monoFontFamily: state.monoFontFamily,
        defaultShowGrid: state.defaultShowGrid,
        defaultShowCrosshair: state.defaultShowCrosshair,
        defaultShowPixelInfo: state.defaultShowPixelInfo,
        defaultShowMinimap: state.defaultShowMinimap,
        defaultBlackPoint: state.defaultBlackPoint,
        defaultWhitePoint: state.defaultWhitePoint,
        defaultGamma: state.defaultGamma,
        defaultHistogramMode: state.defaultHistogramMode,
        histogramHeight: state.histogramHeight,
        pixelInfoDecimalPlaces: state.pixelInfoDecimalPlaces,
        defaultGallerySortBy: state.defaultGallerySortBy,
        defaultGallerySortOrder: state.defaultGallerySortOrder,
        defaultStackMethod: state.defaultStackMethod,
        defaultSigmaValue: state.defaultSigmaValue,
        defaultAlignmentMode: state.defaultAlignmentMode,
        defaultEnableQuality: state.defaultEnableQuality,
        gridColor: state.gridColor,
        gridOpacity: state.gridOpacity,
        crosshairColor: state.crosshairColor,
        crosshairOpacity: state.crosshairOpacity,
        canvasMinScale: state.canvasMinScale,
        canvasMaxScale: state.canvasMaxScale,
        canvasDoubleTapScale: state.canvasDoubleTapScale,
        thumbnailShowFilename: state.thumbnailShowFilename,
        thumbnailShowObject: state.thumbnailShowObject,
        thumbnailShowFilter: state.thumbnailShowFilter,
        thumbnailShowExposure: state.thumbnailShowExposure,
        fileListStyle: state.fileListStyle,
        defaultConverterFormat: state.defaultConverterFormat,
        defaultConverterQuality: state.defaultConverterQuality,
        batchNamingRule: state.batchNamingRule,
        defaultBlurSigma: state.defaultBlurSigma,
        defaultSharpenAmount: state.defaultSharpenAmount,
        defaultDenoiseRadius: state.defaultDenoiseRadius,
        editorMaxUndo: state.editorMaxUndo,
        timelineGrouping: state.timelineGrouping,
        sessionShowExposureCount: state.sessionShowExposureCount,
        sessionShowTotalExposure: state.sessionShowTotalExposure,
        sessionShowFilters: state.sessionShowFilters,
        targetSortBy: state.targetSortBy,
        targetSortOrder: state.targetSortOrder,
        defaultComposePreset: state.defaultComposePreset,
        composeRedWeight: state.composeRedWeight,
        composeGreenWeight: state.composeGreenWeight,
        composeBlueWeight: state.composeBlueWeight,
        imageProcessingDebounce: state.imageProcessingDebounce,
        useHighQualityPreview: state.useHighQualityPreview,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          syncThemeToRuntime(state.theme, state.accentColor, state.activePreset);
        }
      },
    },
  ),
);
