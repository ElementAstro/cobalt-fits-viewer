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

  // 位置设置
  autoTagLocation: boolean;

  // 会话管理
  sessionGapMinutes: number; // 自动分割会话的时间间隔(分钟)

  // 日历同步
  calendarSyncEnabled: boolean;
  defaultReminderMinutes: number; // 0 = 不提醒

  // 显示设置
  language: "en" | "zh";
  theme: "light" | "dark" | "system";

  // 自定义风格
  accentColor: AccentColorKey | null;
  activePreset: StylePresetKey;

  // 字体设置
  fontFamily: FontFamilyKey;
  monoFontFamily: MonoFontKey;

  // Actions
  setDefaultStretch: (stretch: StretchType) => void;
  setDefaultColormap: (colormap: ColormapType) => void;
  setDefaultGridColumns: (cols: 2 | 3 | 4) => void;
  setThumbnailQuality: (quality: number) => void;
  setThumbnailSize: (size: number) => void;
  setDefaultExportFormat: (format: ExportFormat) => void;
  setAutoGroupByObject: (value: boolean) => void;
  setAutoTagLocation: (value: boolean) => void;
  setSessionGapMinutes: (minutes: number) => void;
  setCalendarSyncEnabled: (value: boolean) => void;
  setDefaultReminderMinutes: (minutes: number) => void;
  setLanguage: (lang: "en" | "zh") => void;
  setTheme: (theme: "light" | "dark" | "system") => void;
  setAccentColor: (color: AccentColorKey | null) => void;
  setActivePreset: (preset: StylePresetKey) => void;
  setFontFamily: (font: FontFamilyKey) => void;
  setMonoFontFamily: (font: MonoFontKey) => void;
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
      autoTagLocation: false,
      sessionGapMinutes: 120,
      calendarSyncEnabled: false,
      defaultReminderMinutes: 30,
      language: "zh",
      theme: "dark",
      accentColor: null,
      activePreset: "default" as StylePresetKey,
      fontFamily: "system",
      monoFontFamily: "system-mono",

      setDefaultStretch: (stretch) => set({ defaultStretch: stretch }),
      setDefaultColormap: (colormap) => set({ defaultColormap: colormap }),
      setDefaultGridColumns: (cols) => set({ defaultGridColumns: cols }),
      setThumbnailQuality: (quality) => set({ thumbnailQuality: quality }),
      setThumbnailSize: (size) => set({ thumbnailSize: size }),
      setDefaultExportFormat: (format) => set({ defaultExportFormat: format }),
      setAutoGroupByObject: (value) => set({ autoGroupByObject: value }),
      setAutoTagLocation: (value) => set({ autoTagLocation: value }),
      setSessionGapMinutes: (minutes) => set({ sessionGapMinutes: minutes }),
      setCalendarSyncEnabled: (value) => set({ calendarSyncEnabled: value }),
      setDefaultReminderMinutes: (minutes) => set({ defaultReminderMinutes: minutes }),
      setLanguage: (lang) => set({ language: lang }),

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

      resetToDefaults: () => {
        set({
          defaultStretch: "asinh",
          defaultColormap: "grayscale",
          defaultGridColumns: 3,
          thumbnailQuality: 80,
          thumbnailSize: 256,
          defaultExportFormat: "png",
          autoGroupByObject: true,
          autoTagLocation: false,
          sessionGapMinutes: 120,
          calendarSyncEnabled: false,
          defaultReminderMinutes: 30,
          language: "zh",
          theme: "dark",
          accentColor: null,
          activePreset: "default" as StylePresetKey,
          fontFamily: "system",
          monoFontFamily: "system-mono",
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
        autoTagLocation: state.autoTagLocation,
        sessionGapMinutes: state.sessionGapMinutes,
        calendarSyncEnabled: state.calendarSyncEnabled,
        defaultReminderMinutes: state.defaultReminderMinutes,
        language: state.language,
        theme: state.theme,
        accentColor: state.accentColor,
        activePreset: state.activePreset,
        fontFamily: state.fontFamily,
        monoFontFamily: state.monoFontFamily,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          syncThemeToRuntime(state.theme, state.accentColor, state.activePreset);
        }
      },
    },
  ),
);
