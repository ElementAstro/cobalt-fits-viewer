/**
 * 自定义主题保存/管理状态
 * 支持最多 10 个命名主题插槽
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { ThemeCustomColors } from "../lib/theme/presets";

export const MAX_SAVED_THEMES = 10;

export interface SavedTheme {
  name: string;
  colors: ThemeCustomColors;
  savedAt: number;
}

interface SavedThemesState {
  themes: SavedTheme[];
  saveTheme: (name: string, colors: ThemeCustomColors) => boolean;
  deleteTheme: (name: string) => void;
  renameTheme: (oldName: string, newName: string) => boolean;
}

export const useSavedThemesStore = create<SavedThemesState>()(
  persist(
    (set, get) => ({
      themes: [],

      saveTheme: (name, colors) => {
        const trimmed = name.trim();
        if (!trimmed) return false;
        const current = get().themes;
        const existingIndex = current.findIndex((t) => t.name === trimmed);
        const entry: SavedTheme = {
          name: trimmed,
          colors: {
            linked: colors.linked,
            light: { ...colors.light },
            dark: { ...colors.dark },
          },
          savedAt: Date.now(),
        };

        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = entry;
          set({ themes: next });
          return true;
        }

        if (current.length >= MAX_SAVED_THEMES) return false;
        set({ themes: [...current, entry] });
        return true;
      },

      deleteTheme: (name) => {
        set({ themes: get().themes.filter((t) => t.name !== name) });
      },

      renameTheme: (oldName, newName) => {
        const trimmed = newName.trim();
        if (!trimmed) return false;
        const current = get().themes;
        if (current.some((t) => t.name === trimmed && t.name !== oldName)) return false;
        set({
          themes: current.map((t) => (t.name === oldName ? { ...t, name: trimmed } : t)),
        });
        return true;
      },
    }),
    {
      name: "saved-themes-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
    },
  ),
);
