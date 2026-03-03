import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandAsyncStorage } from "../../lib/storage";
import type { FileGroup, FitsMetadata } from "../../lib/fits/types";

type FileGroupUpdatable = Partial<
  Pick<
    FileGroup,
    | "name"
    | "color"
    | "description"
    | "icon"
    | "coverImageId"
    | "sortOrder"
    | "isPinned"
    | "parentId"
  >
>;

export interface FileGroupStats {
  fileCount: number;
  totalSize: number;
}

interface FileGroupStoreState {
  groups: FileGroup[];
  fileGroupMap: Record<string, string[]>;
  createGroup: (
    name: string,
    options?: { color?: string; description?: string; parentId?: string; icon?: string },
  ) => string;
  updateGroup: (groupId: string, updates: FileGroupUpdatable) => void;
  removeGroup: (groupId: string) => void;
  assignFilesToGroup: (fileIds: string[], groupId: string) => void;
  removeFilesFromGroup: (fileIds: string[], groupId: string) => void;
  removeFileMappings: (fileIds: string[]) => void;
  getFileGroupIds: (fileId: string) => string[];
  getGroupById: (groupId: string) => FileGroup | undefined;
  getRootGroups: () => FileGroup[];
  getChildGroups: (parentId?: string) => FileGroup[];
  getGroupPath: (groupId: string) => FileGroup[];
  getGroupStats: (groupId: string, files: FitsMetadata[]) => FileGroupStats;
  getFilesInGroup: (groupId: string) => string[];
  moveGroup: (groupId: string, newParentId: string | undefined) => void;
  moveFilesToGroup: (fileIds: string[], fromGroupId: string | undefined, toGroupId: string) => void;
}

function buildGroupId() {
  return `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useFileGroupStore = create<FileGroupStoreState>()(
  persist(
    (set, get) => ({
      groups: [],
      fileGroupMap: {},

      createGroup: (name, options) => {
        const now = Date.now();
        const groupId = buildGroupId();
        const trimmedName = name.trim();
        set((state) => ({
          groups: [
            ...state.groups,
            {
              id: groupId,
              name: trimmedName || `Group ${state.groups.length + 1}`,
              color: options?.color,
              description: options?.description,
              parentId: options?.parentId,
              icon: options?.icon,
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

      getRootGroups: () => get().groups.filter((g) => !g.parentId),

      getChildGroups: (parentId) =>
        get().groups.filter((g) => (parentId ? g.parentId === parentId : !g.parentId)),

      getGroupPath: (groupId) => {
        const { groups } = get();
        const path: FileGroup[] = [];
        let current = groups.find((g) => g.id === groupId);
        const visited = new Set<string>();
        while (current) {
          if (visited.has(current.id)) break;
          visited.add(current.id);
          path.unshift(current);
          current = current.parentId ? groups.find((g) => g.id === current!.parentId) : undefined;
        }
        return path;
      },

      getGroupStats: (groupId, files) => {
        const { fileGroupMap } = get();
        let fileCount = 0;
        let totalSize = 0;
        const fileIdSet = new Set<string>();
        for (const [fileId, groupIds] of Object.entries(fileGroupMap)) {
          if (groupIds.includes(groupId)) {
            fileIdSet.add(fileId);
          }
        }
        for (const file of files) {
          if (fileIdSet.has(file.id)) {
            fileCount++;
            totalSize += file.fileSize;
          }
        }
        return { fileCount, totalSize };
      },

      getFilesInGroup: (groupId) => {
        const { fileGroupMap } = get();
        const result: string[] = [];
        for (const [fileId, groupIds] of Object.entries(fileGroupMap)) {
          if (groupIds.includes(groupId)) {
            result.push(fileId);
          }
        }
        return result;
      },

      moveGroup: (groupId, newParentId) => {
        if (!groupId || groupId === newParentId) return;
        set((state) => ({
          groups: state.groups.map((g) =>
            g.id === groupId ? { ...g, parentId: newParentId, updatedAt: Date.now() } : g,
          ),
        }));
      },

      moveFilesToGroup: (fileIds, fromGroupId, toGroupId) => {
        if (fileIds.length === 0 || !toGroupId) return;
        set((state) => {
          const nextMap = { ...state.fileGroupMap };
          for (const fileId of fileIds) {
            let existing = nextMap[fileId] ?? [];
            if (fromGroupId) {
              existing = existing.filter((id) => id !== fromGroupId);
            }
            if (!existing.includes(toGroupId)) {
              existing = [...existing, toGroupId];
            }
            if (existing.length === 0) {
              delete nextMap[fileId];
            } else {
              nextMap[fileId] = existing;
            }
          }
          return { fileGroupMap: nextMap };
        });
      },
    }),
    {
      name: "file-group-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({
        groups: state.groups,
        fileGroupMap: state.fileGroupMap,
      }),
    },
  ),
);
