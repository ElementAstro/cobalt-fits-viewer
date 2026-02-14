/**
 * 目标管理状态
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { Target, TargetType, TargetStatus } from "../lib/fits/types";
import { mergeTargets } from "../lib/targets/targetMatcher";

interface TargetStoreState {
  targets: Target[];

  // Actions
  addTarget: (target: Target) => void;
  removeTarget: (id: string) => void;
  updateTarget: (id: string, updates: Partial<Target>) => void;

  addImageToTarget: (targetId: string, imageId: string) => void;
  removeImageFromTarget: (targetId: string, imageId: string) => void;

  addAlias: (targetId: string, alias: string) => void;
  removeAlias: (targetId: string, alias: string) => void;

  setStatus: (targetId: string, status: TargetStatus) => void;
  setPlannedExposure: (targetId: string, filter: string, seconds: number) => void;

  mergeIntoTarget: (destId: string, sourceId: string) => void;

  // Getters
  getTargetById: (id: string) => Target | undefined;
  getTargetByName: (name: string) => Target | undefined;
  getTargetsByType: (type: TargetType) => Target[];
  getTargetsByStatus: (status: TargetStatus) => Target[];
}

export const useTargetStore = create<TargetStoreState>()(
  persist(
    (set, get) => ({
      targets: [],

      addTarget: (target) => set((state) => ({ targets: [...state.targets, target] })),

      removeTarget: (id) => set((state) => ({ targets: state.targets.filter((t) => t.id !== id) })),

      updateTarget: (id, updates) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t,
          ),
        })),

      addImageToTarget: (targetId, imageId) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === targetId && !t.imageIds.includes(imageId)
              ? { ...t, imageIds: [...t.imageIds, imageId], updatedAt: Date.now() }
              : t,
          ),
        })),

      removeImageFromTarget: (targetId, imageId) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === targetId
              ? { ...t, imageIds: t.imageIds.filter((id) => id !== imageId), updatedAt: Date.now() }
              : t,
          ),
        })),

      addAlias: (targetId, alias) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === targetId && !t.aliases.includes(alias)
              ? { ...t, aliases: [...t.aliases, alias], updatedAt: Date.now() }
              : t,
          ),
        })),

      removeAlias: (targetId, alias) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === targetId
              ? { ...t, aliases: t.aliases.filter((a) => a !== alias), updatedAt: Date.now() }
              : t,
          ),
        })),

      setStatus: (targetId, status) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === targetId ? { ...t, status, updatedAt: Date.now() } : t,
          ),
        })),

      setPlannedExposure: (targetId, filter, seconds) =>
        set((state) => ({
          targets: state.targets.map((t) =>
            t.id === targetId
              ? {
                  ...t,
                  plannedExposure: { ...t.plannedExposure, [filter]: seconds },
                  updatedAt: Date.now(),
                }
              : t,
          ),
        })),

      mergeIntoTarget: (destId, sourceId) => {
        const dest = get().targets.find((t) => t.id === destId);
        const source = get().targets.find((t) => t.id === sourceId);
        if (!dest || !source || destId === sourceId) return;

        const merged = mergeTargets(dest, source);
        set((state) => ({
          targets: state.targets
            .map((t) => (t.id === destId ? merged : t))
            .filter((t) => t.id !== sourceId),
        }));
      },

      getTargetById: (id) => get().targets.find((t) => t.id === id),

      getTargetByName: (name) => {
        const lower = name.toLowerCase();
        return get().targets.find(
          (t) => t.name.toLowerCase() === lower || t.aliases.some((a) => a.toLowerCase() === lower),
        );
      },

      getTargetsByType: (type) => get().targets.filter((t) => t.type === type),

      getTargetsByStatus: (status) => get().targets.filter((t) => t.status === status),
    }),
    {
      name: "target-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({ targets: state.targets }),
    },
  ),
);
