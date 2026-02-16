/**
 * FITS 文件列表状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { FitsMetadata } from "../lib/fits/types";

interface FitsStoreState {
  files: FitsMetadata[];
  selectedIds: string[];
  isSelectionMode: boolean;
  sortBy: "name" | "date" | "size" | "quality";
  sortOrder: "asc" | "desc";
  searchQuery: string;
  filterTags: string[];

  // Actions
  addFile: (file: FitsMetadata) => void;
  addFiles: (files: FitsMetadata[]) => void;
  removeFile: (id: string) => void;
  removeFiles: (ids: string[]) => void;
  updateFile: (id: string, updates: Partial<FitsMetadata>) => void;
  batchSetSessionId: (fileIds: string[], sessionId: string | undefined) => void;
  toggleFavorite: (id: string) => void;
  addTag: (id: string, tag: string) => void;
  removeTag: (id: string, tag: string) => void;
  batchAddTag: (ids: string[], tag: string) => void;
  batchRemoveTag: (ids: string[], tag: string) => void;
  batchSetTags: (ids: string[], tags: string[]) => void;

  // Selection
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelectionMode: (mode: boolean) => void;

  // Sorting & Filtering
  setSortBy: (sortBy: "name" | "date" | "size" | "quality") => void;
  setSortOrder: (order: "asc" | "desc") => void;
  setSearchQuery: (query: string) => void;
  setFilterTags: (tags: string[]) => void;

  // Getters
  getFileById: (id: string) => FitsMetadata | undefined;
  getFilteredFiles: () => FitsMetadata[];
  getAdjacentFileIds: (currentId: string) => { prevId: string | null; nextId: string | null };
}

export const useFitsStore = create<FitsStoreState>()(
  persist(
    (set, get) => ({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],

      addFile: (file) => set((state) => ({ files: [...state.files, file] })),

      addFiles: (files) => set((state) => ({ files: [...state.files, ...files] })),

      removeFile: (id) =>
        set((state) => ({
          files: state.files.filter((f) => f.id !== id),
          selectedIds: state.selectedIds.filter((sid) => sid !== id),
        })),

      removeFiles: (ids) =>
        set((state) => ({
          files: state.files.filter((f) => !ids.includes(f.id)),
          selectedIds: state.selectedIds.filter((sid) => !ids.includes(sid)),
        })),

      updateFile: (id, updates) =>
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? { ...f, ...updates } : f)),
        })),

      batchSetSessionId: (fileIds, sessionId) =>
        set((state) => ({
          files: state.files.map((f) => (fileIds.includes(f.id) ? { ...f, sessionId } : f)),
        })),

      toggleFavorite: (id) =>
        set((state) => ({
          files: state.files.map((f) => (f.id === id ? { ...f, isFavorite: !f.isFavorite } : f)),
        })),

      addTag: (id, tag) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id && !f.tags.includes(tag) ? { ...f, tags: [...f.tags, tag] } : f,
          ),
        })),

      removeTag: (id, tag) =>
        set((state) => ({
          files: state.files.map((f) =>
            f.id === id ? { ...f, tags: f.tags.filter((t) => t !== tag) } : f,
          ),
        })),

      batchAddTag: (ids, tag) =>
        set((state) => ({
          files: state.files.map((f) =>
            ids.includes(f.id) && !f.tags.includes(tag) ? { ...f, tags: [...f.tags, tag] } : f,
          ),
        })),

      batchRemoveTag: (ids, tag) =>
        set((state) => ({
          files: state.files.map((f) =>
            ids.includes(f.id) ? { ...f, tags: f.tags.filter((t) => t !== tag) } : f,
          ),
        })),

      batchSetTags: (ids, tags) =>
        set((state) => ({
          files: state.files.map((f) => (ids.includes(f.id) ? { ...f, tags } : f)),
        })),

      toggleSelection: (id) =>
        set((state) => ({
          selectedIds: state.selectedIds.includes(id)
            ? state.selectedIds.filter((sid) => sid !== id)
            : [...state.selectedIds, id],
        })),

      selectAll: () =>
        set((state) => ({
          selectedIds: state.files.map((f) => f.id),
        })),

      clearSelection: () => set({ selectedIds: [], isSelectionMode: false }),

      setSelectionMode: (mode) =>
        set((state) => ({
          isSelectionMode: mode,
          selectedIds: mode ? state.selectedIds : [],
        })),

      setSortBy: (sortBy) => set({ sortBy }),
      setSortOrder: (order) => set({ sortOrder: order }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      setFilterTags: (tags) => set({ filterTags: tags }),

      getFileById: (id) => get().files.find((f) => f.id === id),

      getAdjacentFileIds: (currentId) => {
        const { files } = get();
        const idx = files.findIndex((f) => f.id === currentId);
        if (idx === -1) return { prevId: null, nextId: null };
        return {
          prevId: idx > 0 ? files[idx - 1].id : null,
          nextId: idx < files.length - 1 ? files[idx + 1].id : null,
        };
      },

      getFilteredFiles: () => {
        const { files, searchQuery, filterTags, sortBy, sortOrder } = get();

        let filtered = [...files];

        if (searchQuery) {
          const q = searchQuery.toLowerCase();
          filtered = filtered.filter(
            (f) =>
              f.filename.toLowerCase().includes(q) ||
              f.sourceFormat?.toLowerCase().includes(q) ||
              f.object?.toLowerCase().includes(q) ||
              f.filter?.toLowerCase().includes(q),
          );
        }

        if (filterTags.length > 0) {
          filtered = filtered.filter((f) => filterTags.some((tag) => f.tags.includes(tag)));
        }

        filtered.sort((a, b) => {
          let cmp = 0;
          switch (sortBy) {
            case "name":
              cmp = a.filename.localeCompare(b.filename);
              break;
            case "date":
              cmp = a.importDate - b.importDate;
              break;
            case "size":
              cmp = a.fileSize - b.fileSize;
              break;
            case "quality":
              cmp = (a.qualityScore ?? -1) - (b.qualityScore ?? -1);
              break;
          }
          return sortOrder === "asc" ? cmp : -cmp;
        });

        return filtered;
      },
    }),
    {
      name: "fits-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        files: state.files,
      }),
    },
  ),
);
