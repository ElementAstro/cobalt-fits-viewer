/**
 * FITS 文件列表状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { FitsMetadata } from "../lib/fits/types";

export type FitsSortBy = "name" | "date" | "size" | "quality";
export type FitsSortOrder = "asc" | "desc";

interface FitsStoreState {
  files: FitsMetadata[];
  selectedIds: string[];
  isSelectionMode: boolean;
  sortBy: FitsSortBy;
  sortOrder: FitsSortOrder;
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
  setSelectedIds: (ids: string[]) => void;
  toggleSelectionBatch: (ids: string[]) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setSelectionMode: (mode: boolean) => void;

  // Sorting & Filtering
  setSortBy: (sortBy: FitsSortBy) => void;
  setSortOrder: (order: FitsSortOrder) => void;
  setSearchQuery: (query: string) => void;
  setFilterTags: (tags: string[]) => void;

  // Getters
  getFileById: (id: string) => FitsMetadata | undefined;
  getFilteredFiles: () => FitsMetadata[];
  getAdjacentFileIds: (currentId: string) => { prevId: string | null; nextId: string | null };
}

export function filterAndSortFiles(
  files: FitsMetadata[],
  searchQuery: string,
  filterTags: string[],
  sortBy: FitsSortBy,
  sortOrder: FitsSortOrder,
): FitsMetadata[] {
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

      setSelectedIds: (ids) =>
        set((state) => {
          if (ids.length === 0) {
            return { selectedIds: [] };
          }

          const existingIds = new Set(state.files.map((file) => file.id));
          const uniqueIds = new Set<string>();
          const selectedIds: string[] = [];

          for (const id of ids) {
            if (!existingIds.has(id) || uniqueIds.has(id)) continue;
            uniqueIds.add(id);
            selectedIds.push(id);
          }

          return { selectedIds };
        }),

      toggleSelectionBatch: (ids) =>
        set((state) => {
          if (ids.length === 0) return { selectedIds: state.selectedIds };

          const idSet = new Set(ids);
          const existingIds = new Set(state.files.map((file) => file.id));
          const selectedSet = new Set(state.selectedIds);

          for (const id of idSet) {
            if (!existingIds.has(id)) continue;
            if (selectedSet.has(id)) {
              selectedSet.delete(id);
            } else {
              selectedSet.add(id);
            }
          }

          const selectedIds = [
            ...state.selectedIds.filter((id) => selectedSet.has(id)),
            ...state.files
              .map((file) => file.id)
              .filter((id) => !state.selectedIds.includes(id) && selectedSet.has(id)),
          ];

          return { selectedIds };
        }),

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
        return filterAndSortFiles(files, searchQuery, filterTags, sortBy, sortOrder);
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
