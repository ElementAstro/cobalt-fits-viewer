import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { FileGroup } from "../lib/fits/types";

interface FileGroupStoreState {
  groups: FileGroup[];
  fileGroupMap: Record<string, string[]>;
  createGroup: (name: string, color?: string) => string;
  updateGroup: (groupId: string, updates: Partial<Pick<FileGroup, "name" | "color">>) => void;
  removeGroup: (groupId: string) => void;
  assignFilesToGroup: (fileIds: string[], groupId: string) => void;
  removeFilesFromGroup: (fileIds: string[], groupId: string) => void;
  removeFileMappings: (fileIds: string[]) => void;
  getFileGroupIds: (fileId: string) => string[];
  getGroupById: (groupId: string) => FileGroup | undefined;
}

function buildGroupId() {
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useFileGroupStore = create<FileGroupStoreState>()(
  persist(
    (set, get) => ({
      groups: [],
      fileGroupMap: {},

      createGroup: (name, color) => {
        const now = Date.now();
        const groupId = buildGroupId();
        const trimmedName = name.trim();
        set((state) => ({
          groups: [
            ...state.groups,
            {
              id: groupId,
              name: trimmedName || `Group ${state.groups.length + 1}`,
              color,
              createdAt: now,
              updatedAt: now,
            },
          ],
        }));
        return groupId;
      },

      updateGroup: (groupId, updates) => {
        if (!groupId) return;
        set((state) => ({
          groups: state.groups.map((group) =>
            group.id === groupId ? { ...group, ...updates, updatedAt: Date.now() } : group,
          ),
        }));
      },

      removeGroup: (groupId) => {
        if (!groupId) return;
        set((state) => {
          const nextMap: Record<string, string[]> = {};
          for (const [fileId, groupIds] of Object.entries(state.fileGroupMap)) {
            const filtered = groupIds.filter((id) => id !== groupId);
            if (filtered.length > 0) {
              nextMap[fileId] = filtered;
            }
          }
          return {
            groups: state.groups.filter((group) => group.id !== groupId),
            fileGroupMap: nextMap,
          };
        });
      },

      assignFilesToGroup: (fileIds, groupId) => {
        if (fileIds.length === 0 || !groupId) return;
        set((state) => {
          const nextMap = { ...state.fileGroupMap };
          for (const fileId of fileIds) {
            const existing = nextMap[fileId] ?? [];
            if (!existing.includes(groupId)) {
              nextMap[fileId] = [...existing, groupId];
            }
          }
          return { fileGroupMap: nextMap };
        });
      },

      removeFilesFromGroup: (fileIds, groupId) => {
        if (fileIds.length === 0 || !groupId) return;
        set((state) => {
          const nextMap = { ...state.fileGroupMap };
          for (const fileId of fileIds) {
            const existing = nextMap[fileId];
            if (!existing) continue;
            const filtered = existing.filter((id) => id !== groupId);
            if (filtered.length === 0) {
              delete nextMap[fileId];
            } else {
              nextMap[fileId] = filtered;
            }
          }
          return { fileGroupMap: nextMap };
        });
      },

      removeFileMappings: (fileIds) => {
        if (fileIds.length === 0) return;
        const fileIdSet = new Set(fileIds);
        set((state) => {
          const nextMap: Record<string, string[]> = {};
          for (const [fileId, groupIds] of Object.entries(state.fileGroupMap)) {
            if (fileIdSet.has(fileId)) continue;
            nextMap[fileId] = groupIds;
          }
          return { fileGroupMap: nextMap };
        });
      },

      getFileGroupIds: (fileId) => get().fileGroupMap[fileId] ?? [],
      getGroupById: (groupId) => get().groups.find((group) => group.id === groupId),
    }),
    {
      name: "file-group-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        groups: state.groups,
        fileGroupMap: state.fileGroupMap,
      }),
    },
  ),
);
