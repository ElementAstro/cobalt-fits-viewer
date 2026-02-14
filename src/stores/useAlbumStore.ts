/**
 * 相簿状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { Album, SmartAlbumRule } from "../lib/fits/types";

interface AlbumStoreState {
  albums: Album[];

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
}

export const useAlbumStore = create<AlbumStoreState>()(
  persist(
    (set, get) => ({
      albums: [],

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
    }),
    {
      name: "album-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({ albums: state.albums }),
    },
  ),
);
