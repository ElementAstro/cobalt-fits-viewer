/**
 * 目标分组状态
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { TargetGroup } from "../lib/fits/types";

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface TargetGroupStoreState {
  groups: TargetGroup[];

  // Actions
  addGroup: (group: Omit<TargetGroup, "id" | "createdAt" | "updatedAt">) => string;
  removeGroup: (id: string) => void;
  updateGroup: (id: string, updates: Partial<TargetGroup>) => void;

  addTargetToGroup: (groupId: string, targetId: string) => void;
  removeTargetFromGroup: (groupId: string, targetId: string) => void;

  // Getters
  getGroupById: (id: string) => TargetGroup | undefined;
  getGroupByName: (name: string) => TargetGroup | undefined;
  getAllGroups: () => TargetGroup[];
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

      getGroupById: (id) => get().groups.find((g) => g.id === id),

      getGroupByName: (name) => {
        const lower = name.toLowerCase();
        return get().groups.find((g) => g.name.toLowerCase() === lower);
      },

      getAllGroups: () => get().groups,
    }),
    {
      name: "target-group-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({ groups: state.groups }),
    },
  ),
);
