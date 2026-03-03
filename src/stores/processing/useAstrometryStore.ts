/**
 * Astrometry.net 状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandAsyncStorage } from "../../lib/storage";
import type { AstrometryJob, AstrometryConfig } from "../../lib/astrometry/types";
import { DEFAULT_ASTROMETRY_CONFIG } from "../../lib/astrometry/types";

interface AstrometryStoreState {
  // 配置 (持久化)
  config: AstrometryConfig;

  // 任务管理 (持久化)
  jobs: AstrometryJob[];

  // 配置 Actions
  setConfig: (updates: Partial<AstrometryConfig>) => void;
  resetConfig: () => void;

  // 任务 Actions
  addJob: (job: AstrometryJob) => void;
  updateJob: (id: string, updates: Partial<AstrometryJob>) => void;
  removeJob: (id: string) => void;
  clearCompletedJobs: () => void;
  clearAllJobs: () => void;

  // 查询
  getJobById: (id: string) => AstrometryJob | undefined;
  getJobsByFileId: (fileId: string) => AstrometryJob[];
  getActiveJobs: () => AstrometryJob[];
  getCompletedJobs: () => AstrometryJob[];
  getFailedJobs: () => AstrometryJob[];
}

export const useAstrometryStore = create<AstrometryStoreState>()(
  persist(
    (set, get) => ({
      config: { ...DEFAULT_ASTROMETRY_CONFIG },
      jobs: [],

      setConfig: (updates) => set((s) => ({ config: { ...s.config, ...updates } })),

      resetConfig: () => set({ config: { ...DEFAULT_ASTROMETRY_CONFIG } }),

      addJob: (job) => set((s) => ({ jobs: [job, ...s.jobs] })),

      updateJob: (id, updates) =>
        set((s) => ({
          jobs: s.jobs.map((j) => (j.id === id ? { ...j, ...updates, updatedAt: Date.now() } : j)),
        })),

      removeJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),

      clearCompletedJobs: () =>
        set((s) => ({
          jobs: s.jobs.filter(
            (j) => j.status !== "success" && j.status !== "failure" && j.status !== "cancelled",
          ),
        })),

      clearAllJobs: () => set({ jobs: [] }),

      getJobById: (id) => get().jobs.find((j) => j.id === id),

      getJobsByFileId: (fileId) => get().jobs.filter((j) => j.fileId === fileId),

      getActiveJobs: () =>
        get().jobs.filter(
          (j) =>
            j.status === "pending" ||
            j.status === "uploading" ||
            j.status === "submitted" ||
            j.status === "solving",
        ),

      getCompletedJobs: () => get().jobs.filter((j) => j.status === "success"),

      getFailedJobs: () => get().jobs.filter((j) => j.status === "failure"),
    }),
    {
      name: "astrometry-store",
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({
        config: state.config,
        jobs: state.jobs,
      }),
    },
  ),
);
