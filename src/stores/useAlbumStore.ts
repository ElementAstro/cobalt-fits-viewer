/**
 * 相簿状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { Album, SmartAlbumRule } from "../lib/fits/types";

export type AlbumSortBy = "name" | "date" | "imageCount";

interface AlbumStoreState {
  albums: Album[];

  // Search & Sort State
  albumSearchQuery: string;
  albumSortBy: AlbumSortBy;
  albumSortOrder: "asc" | "desc";

  // Actions
  addAlbum: (album: Album) => void;
  removeAlbum: (id: string) => void;
  updateAlbum: (id: string, updates: Partial<Album>) => void;

  addImageToAlbum: (albumId: string, imageId: string) => void;
  removeImageFromAlbum: (albumId: string, imageId: string) => void;
  addImagesToAlbum: (albumId: string, imageIds: string[]) => void;

  setCoverImage: (albumId: string, imageId: string) => void;
  updateSmartRules: (albumId: string, rules: SmartAlbumRule[]) => void;

  reorderAlbums: (orderedIds: string[]) => void;

  getAlbumById: (id: string) => Album | undefined;
  getAlbumsForImage: (imageId: string) => Album[];
  getSortedAlbums: () => Album[];

  // NEW: Search & Sort Actions
  setAlbumSearchQuery: (query: string) => void;
  setAlbumSortBy: (sortBy: AlbumSortBy) => void;
  setAlbumSortOrder: (order: "asc" | "desc") => void;

  // NEW: Album Pinning
  toggleAlbumPin: (albumId: string) => void;

  // NEW: Album Merge
  mergeAlbums: (sourceId: string, targetId: string) => boolean;

  // NEW: Album Notes
  updateAlbumNotes: (albumId: string, notes: string) => void;

  // NEW: Get Filtered Albums
  getFilteredAlbums: () => Album[];
}

export const useAlbumStore = create<AlbumStoreState>()(
  persist(
    (set, get) => ({
      albums: [],
      albumSearchQuery: "",
      albumSortBy: "date" as AlbumSortBy,
      albumSortOrder: "desc" as "asc" | "desc",

      addAlbum: (album) => set((state) => ({ albums: [...state.albums, album] })),

      removeAlbum: (id) => set((state) => ({ albums: state.albums.filter((a) => a.id !== id) })),

      updateAlbum: (id, updates) =>
        set((state) => ({
          albums: state.albums.map((a) =>
            a.id === id ? { ...a, ...updates, updatedAt: Date.now() } : a,
          ),
        })),

      addImageToAlbum: (albumId, imageId) =>
        set((state) => ({
          albums: state.albums.map((a) =>
            a.id === albumId && !a.imageIds.includes(imageId)
              ? { ...a, imageIds: [...a.imageIds, imageId], updatedAt: Date.now() }
              : a,
          ),
        })),

      removeImageFromAlbum: (albumId, imageId) =>
        set((state) => ({
          albums: state.albums.map((a) =>
            a.id === albumId
              ? {
                  ...a,
                  imageIds: a.imageIds.filter((id) => id !== imageId),
                  updatedAt: Date.now(),
                }
              : a,
          ),
        })),

      addImagesToAlbum: (albumId, imageIds) =>
        set((state) => ({
          albums: state.albums.map((a) => {
            if (a.id !== albumId) return a;
            const newIds = imageIds.filter((id) => !a.imageIds.includes(id));
            return {
              ...a,
              imageIds: [...a.imageIds, ...newIds],
              updatedAt: Date.now(),
            };
          }),
        })),

      setCoverImage: (albumId, imageId) =>
        set((state) => ({
          albums: state.albums.map((a) =>
            a.id === albumId ? { ...a, coverImageId: imageId, updatedAt: Date.now() } : a,
          ),
        })),

      updateSmartRules: (albumId, rules) =>
        set((state) => ({
          albums: state.albums.map((a) =>
            a.id === albumId ? { ...a, smartRules: rules, updatedAt: Date.now() } : a,
          ),
        })),

      reorderAlbums: (orderedIds) =>
        set((state) => ({
          albums: state.albums.map((a) => ({
            ...a,
            sortOrder: orderedIds.indexOf(a.id),
          })),
        })),

      getAlbumById: (id) => get().albums.find((a) => a.id === id),

      getAlbumsForImage: (imageId) => get().albums.filter((a) => a.imageIds.includes(imageId)),

      getSortedAlbums: () =>
        [...get().albums].sort((a, b) => {
          const oa = a.sortOrder ?? Infinity;
          const ob = b.sortOrder ?? Infinity;
          if (oa !== ob) return oa - ob;
          return b.updatedAt - a.updatedAt;
        }),

      // NEW: Search & Sort Actions
      setAlbumSearchQuery: (query) => set({ albumSearchQuery: query }),

      setAlbumSortBy: (sortBy) => set({ albumSortBy: sortBy }),

      setAlbumSortOrder: (order) => set({ albumSortOrder: order }),

      // NEW: Album Pinning
      toggleAlbumPin: (albumId) =>
        set((state) => ({
          albums: state.albums.map((a) =>
            a.id === albumId ? { ...a, isPinned: !a.isPinned, updatedAt: Date.now() } : a,
          ),
        })),

      // NEW: Album Merge
      mergeAlbums: (sourceId, targetId) => {
        const state = get();
        const source = state.albums.find((a) => a.id === sourceId);
        const target = state.albums.find((a) => a.id === targetId);

        if (!source || !target || sourceId === targetId || source.isSmart || target.isSmart) {
          return false;
        }

        const mergedImageIds = [...new Set([...target.imageIds, ...source.imageIds])];
        const mergedCoverImageId = target.coverImageId ?? source.coverImageId;

        set({
          albums: state.albums
            .filter((a) => a.id !== sourceId)
            .map((a) =>
              a.id === targetId
                ? {
                    ...a,
                    imageIds: mergedImageIds,
                    coverImageId: mergedCoverImageId,
                    updatedAt: Date.now(),
                  }
                : a,
            ),
        });
        return true;
      },

      // NEW: Album Notes
      updateAlbumNotes: (albumId, notes) =>
        set((state) => ({
          albums: state.albums.map((a) =>
            a.id === albumId ? { ...a, notes, updatedAt: Date.now() } : a,
          ),
        })),

      // NEW: Get Filtered Albums
      getFilteredAlbums: () => {
        const { albums, albumSearchQuery, albumSortBy, albumSortOrder } = get();

        let filtered = [...albums];

        // Search filter
        if (albumSearchQuery) {
          const query = albumSearchQuery.toLowerCase();
          filtered = filtered.filter(
            (a) =>
              a.name.toLowerCase().includes(query) ||
              a.description?.toLowerCase().includes(query) ||
              a.notes?.toLowerCase().includes(query),
          );
        }

        // Sort
        filtered.sort((a, b) => {
          // Pinned first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;

          let comparison = 0;
          switch (albumSortBy) {
            case "name":
              comparison = a.name.localeCompare(b.name);
              break;
            case "date":
              comparison = a.updatedAt - b.updatedAt;
              break;
            case "imageCount":
              comparison = a.imageIds.length - b.imageIds.length;
              break;
          }
          return albumSortOrder === "asc" ? comparison : -comparison;
        });

        return filtered;
      },
    }),
    {
      name: "album-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        albums: state.albums,
        albumSortBy: state.albumSortBy,
        albumSortOrder: state.albumSortOrder,
      }),
    },
  ),
);
