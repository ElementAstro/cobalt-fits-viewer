/**
 * 相册状态管理
 */

import { create } from "zustand";
import type { GalleryViewMode } from "../lib/fits/types";

interface GalleryStoreState {
  viewMode: GalleryViewMode;
  gridColumns: 2 | 3 | 4;
  isSelectionMode: boolean;
  selectedIds: string[];

  // 筛选
  filterObject: string;
  filterFilter: string;
  filterDateRange: [string, string] | null;
  filterExptimeRange: [number, number] | null;
  filterInstrument: string;
  filterTelescope: string;
  filterFavoriteOnly: boolean;
  filterTag: string;

  // Actions
  setViewMode: (mode: GalleryViewMode) => void;
  setGridColumns: (cols: 2 | 3 | 4) => void;
  setSelectionMode: (mode: boolean) => void;
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;

  setFilterObject: (value: string) => void;
  setFilterFilter: (value: string) => void;
  setFilterDateRange: (range: [string, string] | null) => void;
  setFilterExptimeRange: (range: [number, number] | null) => void;
  setFilterInstrument: (value: string) => void;
  setFilterTelescope: (value: string) => void;
  setFilterFavoriteOnly: (value: boolean) => void;
  setFilterTag: (value: string) => void;
  clearFilters: () => void;
}

export const useGalleryStore = create<GalleryStoreState>((set) => ({
  viewMode: "grid",
  gridColumns: 3,
  isSelectionMode: false,
  selectedIds: [],

  filterObject: "",
  filterFilter: "",
  filterDateRange: null,
  filterExptimeRange: null,
  filterInstrument: "",
  filterTelescope: "",
  filterFavoriteOnly: false,
  filterTag: "",

  setViewMode: (mode) => set({ viewMode: mode }),
  setGridColumns: (cols) => set({ gridColumns: cols }),
  setSelectionMode: (mode) => set({ isSelectionMode: mode, selectedIds: mode ? [] : [] }),

  toggleSelection: (id) =>
    set((s) => ({
      selectedIds: s.selectedIds.includes(id)
        ? s.selectedIds.filter((sid) => sid !== id)
        : [...s.selectedIds, id],
    })),

  selectAll: (ids) => set({ selectedIds: ids }),
  clearSelection: () => set({ selectedIds: [], isSelectionMode: false }),

  setFilterObject: (value) => set({ filterObject: value }),
  setFilterFilter: (value) => set({ filterFilter: value }),
  setFilterDateRange: (range) => set({ filterDateRange: range }),
  setFilterExptimeRange: (range) => set({ filterExptimeRange: range }),
  setFilterInstrument: (value) => set({ filterInstrument: value }),
  setFilterTelescope: (value) => set({ filterTelescope: value }),
  setFilterFavoriteOnly: (value) => set({ filterFavoriteOnly: value }),
  setFilterTag: (value) => set({ filterTag: value }),

  clearFilters: () =>
    set({
      filterObject: "",
      filterFilter: "",
      filterDateRange: null,
      filterExptimeRange: null,
      filterInstrument: "",
      filterTelescope: "",
      filterFavoriteOnly: false,
      filterTag: "",
    }),
}));
