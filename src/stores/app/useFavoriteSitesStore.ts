/**
 * 观测站点收藏状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandAsyncStorage } from "../../lib/storage";
import { siteKey } from "../../lib/map/utils";

export interface FavoriteSite {
  id: string;
  label: string;
  latitude: number;
  longitude: number;
  notes?: string;
  createdAt: number;
}

interface FavoriteSitesStoreState {
  sites: FavoriteSite[];
  addSite: (site: Omit<FavoriteSite, "id" | "createdAt">) => void;
  removeSite: (id: string) => void;
  updateSite: (id: string, updates: Partial<Omit<FavoriteSite, "id" | "createdAt">>) => void;
  isFavorite: (latitude: number, longitude: number) => boolean;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useFavoriteSitesStore = create<FavoriteSitesStoreState>()(
  persist(
    (set, get) => ({
      sites: [],

      addSite(site) {
        set((state) => ({
          sites: [...state.sites, { ...site, id: generateId(), createdAt: Date.now() }],
        }));
      },

      removeSite(id) {
        set((state) => ({
          sites: state.sites.filter((s) => s.id !== id),
        }));
      },

      updateSite(id, updates) {
        set((state) => ({
          sites: state.sites.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        }));
      },

      isFavorite(latitude, longitude) {
        const key = siteKey(latitude, longitude);
        return get().sites.some((s) => siteKey(s.latitude, s.longitude) === key);
      },
    }),
    {
      name: "favorite-sites-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({ sites: state.sites }),
    },
  ),
);
