import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { zustandMMKVStorage } from "../lib/storage";
import type { VideoProcessingRequest } from "../lib/video/engine";

export type VideoTaskStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

export interface VideoTaskRecord {
  id: string;
  request: VideoProcessingRequest;
  status: VideoTaskStatus;
  progress: number;
  processedMs: number;
  durationMs?: number;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  outputUris: string[];
  error?: string;
  retries: number;
  logLines: string[];
}

interface VideoTaskStoreState {
  tasks: VideoTaskRecord[];
  enqueueTask: (request: VideoProcessingRequest) => string;
  updateTask: (id: string, patch: Partial<VideoTaskRecord>) => void;
  markRunning: (id: string) => void;
  markCompleted: (id: string, outputUris: string[], logLines?: string[]) => void;
  markFailed: (id: string, error: string, logLines?: string[]) => void;
  markCancelled: (id: string) => void;
  retryTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearFinished: () => void;
}

export const useVideoTaskStore = create<VideoTaskStoreState>()(
  persist(
    (set, get) => ({
      tasks: [],

      enqueueTask: (request) => {
        const id = `video_task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const now = Date.now();
        const next: VideoTaskRecord = {
          id,
          request,
          status: "pending",
          progress: 0,
          processedMs: 0,
          durationMs: request.sourceDurationMs,
          createdAt: now,
          outputUris: [],
          retries: 0,
          logLines: [],
        };
        set((state) => ({ tasks: [next, ...state.tasks] }));
        return id;
      },

      updateTask: (id, patch) =>
        set((state) => ({
          tasks: state.tasks.map((task) => (task.id === id ? { ...task, ...patch } : task)),
        })),

      markRunning: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "running",
                  startedAt: task.startedAt ?? Date.now(),
                  error: undefined,
                }
              : task,
          ),
        })),

      markCompleted: (id, outputUris, logLines = []) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "completed",
                  progress: 1,
                  finishedAt: Date.now(),
                  outputUris,
                  error: undefined,
                  logLines: logLines.length ? logLines : task.logLines,
                }
              : task,
          ),
        })),

      markFailed: (id, error, logLines = []) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "failed",
                  finishedAt: Date.now(),
                  error,
                  logLines: logLines.length ? logLines : task.logLines,
                }
              : task,
          ),
        })),

      markCancelled: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "cancelled",
                  finishedAt: Date.now(),
                }
              : task,
          ),
        })),

      retryTask: (id) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === id
              ? {
                  ...task,
                  status: "pending",
                  progress: 0,
                  processedMs: 0,
                  startedAt: undefined,
                  finishedAt: undefined,
                  error: undefined,
                  outputUris: [],
                  retries: task.retries + 1,
                }
              : task,
          ),
        })),

      removeTask: (id) => set((state) => ({ tasks: state.tasks.filter((task) => task.id !== id) })),

      clearFinished: () =>
        set((state) => ({
          tasks: state.tasks.filter(
            (task) =>
              task.status !== "completed" &&
              task.status !== "cancelled" &&
              task.status !== "failed",
          ),
        })),
    }),
    {
      name: "video-task-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({ tasks: state.tasks }),
    },
  ),
);
