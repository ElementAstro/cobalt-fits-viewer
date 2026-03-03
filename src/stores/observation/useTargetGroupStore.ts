/**
 * 目标分组状态
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandAsyncStorage } from "../../lib/storage";
import type { TargetGroup } from "../../lib/fits/types";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface TargetGroupStoreState {
  groups: TargetGroup[];

  // Actions
  addGroup: (group: Omit<TargetGroup, "id" | "createdAt" | "updatedAt">) => string;
  upsertGroup: (group: TargetGroup) => void;
  removeGroup: (id: string) => void;
  updateGroup: (id: string, updates: Partial<TargetGroup>) => void;

  addTargetToGroup: (groupId: string, targetId: string) => void;
  removeTargetFromGroup: (groupId: string, targetId: string) => void;
  removeTargetFromAllGroups: (targetId: string) => void;
  replaceTargetInGroups: (sourceId: string, destId: string) => void;

  // Group-level actions
  togglePinned: (groupId: string) => void;
  reorderGroups: (orderedIds: string[]) => void;
  setCoverImage: (groupId: string, imageId: string | undefined) => void;

  // Getters
  getGroupById: (id: string) => TargetGroup | undefined;
  getGroupByName: (name: string) => TargetGroup | undefined;
  getAllGroups: () => TargetGroup[];
  getSortedGroups: () => TargetGroup[];
}

export const useTargetGroupStore = create<TargetGroupStoreState>()(
  persist(
    (set, get) => ({
      groups: [],

      addGroup: (groupData) => {
        const id = generateId();
        const now = Date.now();
        const group: TargetGroup = {
          ...groupData,
          id,
          targetIds: groupData.targetIds ?? [],
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ groups: [...state.groups, group] }));
        return id;
      },

      upsertGroup: (group) =>
        set((state) => {
          const existing = state.groups.find((item) => item.id === group.id);
          if (!existing) {
            return { groups: [...state.groups, group] };
          }
          return {
            groups: state.groups.map((item) =>
              item.id === group.id
                ? {
                    ...item,
                    ...group,
                    targetIds: [...new Set(group.targetIds ?? [])],
                    updatedAt: Date.now(),
                  }
                : item,
            ),
          };
        }),

      removeGroup: (id) => set((state) => ({ groups: state.groups.filter((g) => g.id !== id) })),

      updateGroup: (id, updates) =>
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === id ? { ...g, ...updates, updatedAt: Date.now() } : g,
          ),
        })),

      addTargetToGroup: (groupId, targetId) =>
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId || g.targetIds.includes(targetId)) return g;
            return {
              ...g,
              targetIds: [...g.targetIds, targetId],
              updatedAt: Date.now(),
            };
          }),
        })),

      removeTargetFromGroup: (groupId, targetId) =>
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId) return g;
            return {
              ...g,
              targetIds: g.targetIds.filter((id) => id !== targetId),
              updatedAt: Date.now(),
            };
          }),
        })),

      removeTargetFromAllGroups: (targetId) =>
        set((state) => ({
          groups: state.groups.map((group) => {
            if (!group.targetIds.includes(targetId)) return group;
            return {
              ...group,
              targetIds: group.targetIds.filter((id) => id !== targetId),
              updatedAt: Date.now(),
            };
          }),
        })),

      replaceTargetInGroups: (sourceId, destId) =>
        set((state) => ({
          groups: state.groups.map((group) => {
            if (!group.targetIds.includes(sourceId)) return group;
            const nextTargetIds = [
              ...new Set(group.targetIds.map((id) => (id === sourceId ? destId : id))),
            ];
            return {
              ...group,
              targetIds: nextTargetIds,
              updatedAt: Date.now(),
            };
          }),
        })),

      togglePinned: (groupId) =>
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId) return g;
            return { ...g, isPinned: !g.isPinned, updatedAt: Date.now() };
          }),
        })),

      reorderGroups: (orderedIds) =>
        set((state) => {
          const groupMap = new Map(state.groups.map((g) => [g.id, g]));
          const now = Date.now();
          const reordered: TargetGroup[] = [];
          for (let i = 0; i < orderedIds.length; i++) {
            const g = groupMap.get(orderedIds[i]);
            if (!g) continue;
            groupMap.delete(orderedIds[i]);
            reordered.push({ ...g, sortOrder: i, updatedAt: now });
          }
          // Append any groups not in orderedIds
          for (const g of groupMap.values()) {
            reordered.push({ ...g, sortOrder: reordered.length, updatedAt: now });
          }
          return { groups: reordered };
        }),

      setCoverImage: (groupId, imageId) =>
        set((state) => ({
          groups: state.groups.map((g) => {
            if (g.id !== groupId) return g;
            return { ...g, coverImageId: imageId, updatedAt: Date.now() };
          }),
        })),

      getGroupById: (id) => get().groups.find((g) => g.id === id),

      getGroupByName: (name) => {
        const lower = name.toLowerCase();
        return get().groups.find((g) => g.name.toLowerCase() === lower);
      },

      getAllGroups: () => get().groups,

      getSortedGroups: () => {
        return [...get().groups].sort((a, b) => {
          // Pinned first
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          // Then by sortOrder
          const aOrder = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
          const bOrder = b.sortOrder ?? Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          // Then by creation date
          return a.createdAt - b.createdAt;
        });
      },
    }),
    {
      name: "target-group-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({ groups: state.groups }),
      version: 3,
      migrate: (persistedState, _version) => {
        const state = persistedState as { groups?: TargetGroup[] };
        const groups = (state.groups ?? []).map((group, index) => ({
          ...group,
          targetIds: [...new Set(group.targetIds ?? [])],
          updatedAt: group.updatedAt ?? Date.now(),
          createdAt: group.createdAt ?? Date.now(),
          icon: group.icon ?? undefined,
          isPinned: group.isPinned ?? false,
          sortOrder: group.sortOrder ?? index,
          coverImageId: group.coverImageId ?? undefined,
        }));
        return { groups };
      },
    },
  ),
);
