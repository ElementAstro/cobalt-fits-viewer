import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { TrashedFitsRecord } from "../lib/fits/types";

interface TrashStoreState {
  items: TrashedFitsRecord[];
  addItems: (records: TrashedFitsRecord[]) => void;
  removeByTrashIds: (trashIds: string[]) => void;
  getByTrashIds: (trashIds: string[]) => TrashedFitsRecord[];
  clearExpired: (now?: number) => TrashedFitsRecord[];
  clearAll: () => void;
}

export const useTrashStore = create<TrashStoreState>()(
  persist(
    (set, get) => ({
      items: [],

      addItems: (records) => {
        if (records.length === 0) return;
        set((state) => ({
          items: [...state.items, ...records],
        }));
      },

      removeByTrashIds: (trashIds) => {
        if (trashIds.length === 0) return;
        const idSet = new Set(trashIds);
        set((state) => ({
          items: state.items.filter((item) => !idSet.has(item.trashId)),
        }));
      },

      getByTrashIds: (trashIds) => {
        if (trashIds.length === 0) return [];
        const idSet = new Set(trashIds);
        return get().items.filter((item) => idSet.has(item.trashId));
      },

      clearExpired: (now = Date.now()) => {
        const expired = get().items.filter((item) => item.expireAt <= now);
        if (expired.length === 0) return [];
        const expiredSet = new Set(expired.map((item) => item.trashId));
        set((state) => ({
          items: state.items.filter((item) => !expiredSet.has(item.trashId)),
        }));
        return expired;
      },

      clearAll: () => set({ items: [] }),
    }),
    {
      name: "trash-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        items: state.items,
      }),
    },
  ),
);
