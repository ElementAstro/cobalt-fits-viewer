/**
 * 目标管理状态
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { Target, TargetType, TargetStatus } from "../lib/fits/types";
import { mergeTargets } from "../lib/targets/targetMatcher";
import { createLogEntry } from "../lib/targets/changeLogger";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface TargetStoreState {
  targets: Target[];

  // Basic Actions
  addTarget: (target: Target) => void;
  removeTarget: (id: string) => void;
  updateTarget: (id: string, updates: Partial<Target>) => void;

  // Image Actions
  addImageToTarget: (targetId: string, imageId: string) => void;
  removeImageFromTarget: (targetId: string, imageId: string) => void;

  // Alias Actions
  addAlias: (targetId: string, alias: string) => void;
  removeAlias: (targetId: string, alias: string) => void;

  // Status Actions
  setStatus: (targetId: string, status: TargetStatus) => void;
  setPlannedExposure: (targetId: string, filter: string, seconds: number) => void;

  // Merge Actions
  mergeIntoTarget: (destId: string, sourceId: string) => void;

  // Favorite & Pin Actions
  toggleFavorite: (targetId: string) => void;
  togglePinned: (targetId: string) => void;

  // Tag Actions
  addTag: (targetId: string, tag: string) => void;
  removeTag: (targetId: string, tag: string) => void;
  setTags: (targetId: string, tags: string[]) => void;

  // Category Actions
  setCategory: (targetId: string, category: string | undefined) => void;

  // Group Actions (deprecated compatibility)
  setGroup: (targetId: string, groupId: string | undefined) => void;

  // Equipment Actions
  setRecommendedEquipment: (targetId: string, equipment: Target["recommendedEquipment"]) => void;

  // Best Image Actions
  setBestImage: (targetId: string, imageId: string | undefined) => void;

  // Image Rating Actions
  setImageRating: (targetId: string, imageId: string, rating: number) => void;
  removeImageRating: (targetId: string, imageId: string) => void;

  // Getters
  getTargetById: (id: string) => Target | undefined;
  getTargetByName: (name: string) => Target | undefined;
  getTargetsByType: (type: TargetType) => Target[];
  getTargetsByStatus: (status: TargetStatus) => Target[];
  getFavoriteTargets: () => Target[];
  getPinnedTargets: () => Target[];
  getTargetsByTag: (tag: string) => Target[];
  getTargetsByCategory: (category: string) => Target[];
}

const createDefaultTarget = (base: Partial<Target>): Target => ({
  id: base.id ?? generateId(),
  name: base.name ?? "",
  type: base.type ?? "other",
  aliases: [],
  tags: [],
  isFavorite: false,
  isPinned: false,
  imageIds: [],
  status: "planned",
  plannedFilters: [],
  plannedExposure: {},
  imageRatings: {},
  changeLog: [],
  createdAt: Date.now(),
  updatedAt: Date.now(),
  ...base,
});

export const useTargetStore = create<TargetStoreState>()(
  persist(
    (set, get) => ({
      targets: [],

      addTarget: (target) =>
        set((state) => {
          if (state.targets.some((existing) => existing.id === target.id)) {
            return state;
          }
          const newTarget = createDefaultTarget(target);
          if (!newTarget.changeLog || newTarget.changeLog.length === 0) {
            newTarget.changeLog = [createLogEntry("created")];
          }
          return { targets: [...state.targets, newTarget] };
        }),

      removeTarget: (id) => set((state) => ({ targets: state.targets.filter((t) => t.id !== id) })),

      updateTarget: (id, updates) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== id) return t;
            const updatedFields = Object.keys(updates).filter(
              (key) => updates[key as keyof Target] !== t[key as keyof Target],
            );
            if (updatedFields.length === 0) return t;
            const changeLogEntry = createLogEntry("updated", updatedFields.join(", "));
            return {
              ...t,
              ...updates,
              changeLog: [...t.changeLog, changeLogEntry],
              updatedAt: Date.now(),
            };
          }),
        })),

      addImageToTarget: (targetId, imageId) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId || t.imageIds.includes(imageId)) return t;
            return {
              ...t,
              imageIds: [...t.imageIds, imageId],
              changeLog: [
                ...t.changeLog,
                createLogEntry("image_added", "imageIds", undefined, imageId),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),

      removeImageFromTarget: (targetId, imageId) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            if (!t.imageIds.includes(imageId)) return t;
            return {
              ...t,
              imageIds: t.imageIds.filter((id) => id !== imageId),
              changeLog: [
                ...t.changeLog,
                createLogEntry("image_removed", "imageIds", imageId, undefined),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),

      addAlias: (targetId, alias) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId || t.aliases.includes(alias)) return t;
            return {
              ...t,
              aliases: [...t.aliases, alias],
              updatedAt: Date.now(),
            };
          }),
        })),

      removeAlias: (targetId, alias) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              aliases: t.aliases.filter((a) => a !== alias),
              updatedAt: Date.now(),
            };
          }),
        })),

      setStatus: (targetId, status) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            if (t.status === status) return t;
            return {
              ...t,
              status,
              changeLog: [
                ...t.changeLog,
                createLogEntry("status_changed", "status", t.status, status),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),

      setPlannedExposure: (targetId, filter, seconds) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              plannedExposure: { ...t.plannedExposure, [filter]: seconds },
              updatedAt: Date.now(),
            };
          }),
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

      toggleFavorite: (targetId) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            const newValue = !t.isFavorite;
            return {
              ...t,
              isFavorite: newValue,
              changeLog: [
                ...t.changeLog,
                createLogEntry(
                  newValue ? "favorited" : "unfavorited",
                  "isFavorite",
                  t.isFavorite,
                  newValue,
                ),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),

      togglePinned: (targetId) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            const newValue = !t.isPinned;
            return {
              ...t,
              isPinned: newValue,
              changeLog: [
                ...t.changeLog,
                createLogEntry(newValue ? "pinned" : "unpinned", "isPinned", t.isPinned, newValue),
              ],
              updatedAt: Date.now(),
            };
          }),
        })),

      addTag: (targetId, tag) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId || t.tags.includes(tag)) return t;
            return {
              ...t,
              tags: [...t.tags, tag],
              changeLog: [...t.changeLog, createLogEntry("tagged", "tags", undefined, tag)],
              updatedAt: Date.now(),
            };
          }),
        })),

      removeTag: (targetId, tag) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              tags: t.tags.filter((tg) => tg !== tag),
              changeLog: [...t.changeLog, createLogEntry("untagged", "tags", tag, undefined)],
              updatedAt: Date.now(),
            };
          }),
        })),

      setTags: (targetId, tags) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              tags,
              updatedAt: Date.now(),
            };
          }),
        })),

      setCategory: (targetId, category) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              category,
              updatedAt: Date.now(),
            };
          }),
        })),

      setGroup: (targetId, groupId) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              groupId,
              updatedAt: Date.now(),
            };
          }),
        })),

      setRecommendedEquipment: (targetId, equipment) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              recommendedEquipment: equipment,
              updatedAt: Date.now(),
            };
          }),
        })),

      setBestImage: (targetId, imageId) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              bestImageId: imageId,
              updatedAt: Date.now(),
            };
          }),
        })),

      setImageRating: (targetId, imageId, rating) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            return {
              ...t,
              imageRatings: { ...t.imageRatings, [imageId]: rating },
              updatedAt: Date.now(),
            };
          }),
        })),

      removeImageRating: (targetId, imageId) =>
        set((state) => ({
          targets: state.targets.map((t) => {
            if (t.id !== targetId) return t;
            const { [imageId]: _, ...rest } = t.imageRatings;
            return {
              ...t,
              imageRatings: rest,
              updatedAt: Date.now(),
            };
          }),
        })),

      getTargetById: (id) => get().targets.find((t) => t.id === id),

      getTargetByName: (name) => {
        const lower = name.toLowerCase();
        return get().targets.find(
          (t) => t.name.toLowerCase() === lower || t.aliases.some((a) => a.toLowerCase() === lower),
        );
      },

      getTargetsByType: (type) => get().targets.filter((t) => t.type === type),

      getTargetsByStatus: (status) => get().targets.filter((t) => t.status === status),

      getFavoriteTargets: () => get().targets.filter((t) => t.isFavorite),

      getPinnedTargets: () => get().targets.filter((t) => t.isPinned),

      getTargetsByTag: (tag) => get().targets.filter((t) => t.tags.includes(tag)),

      getTargetsByCategory: (category) => get().targets.filter((t) => t.category === category),
    }),
    {
      name: "target-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({ targets: state.targets }),
      migrate: (persistedState, _version) => {
        const state = persistedState as { targets: Target[] };
        if (!state.targets) return state;

        // Migrate old targets to new format
        const migratedTargets = state.targets.map((t) => ({
          ...t,
          tags: t.tags ?? [],
          isFavorite: t.isFavorite ?? false,
          isPinned: t.isPinned ?? false,
          imageRatings: t.imageRatings ?? {},
          changeLog: t.changeLog ?? [],
        }));

        return { targets: migratedTargets };
      },
      version: 3,
    },
  ),
);
