/**
 * 观测会话状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { zustandMMKVStorage } from "../lib/storage";
import type { ObservationSession, ObservationLogEntry, ObservationPlan } from "../lib/fits/types";

interface SessionStoreState {
  sessions: ObservationSession[];
  logEntries: ObservationLogEntry[];
  plans: ObservationPlan[];

  // Actions
  addSession: (session: ObservationSession) => void;
  removeSession: (id: string) => void;
  updateSession: (id: string, updates: Partial<ObservationSession>) => void;
  mergeSessions: (ids: string[]) => void;

  addLogEntry: (entry: ObservationLogEntry) => void;
  addLogEntries: (entries: ObservationLogEntry[]) => void;
  updateLogEntry: (id: string, updates: Partial<ObservationLogEntry>) => void;
  removeLogEntry: (id: string) => void;

  // Plan Actions
  addPlan: (plan: ObservationPlan) => void;
  updatePlan: (id: string, updates: Partial<ObservationPlan>) => void;
  removePlan: (id: string) => void;

  // Getters — WARNING: Do NOT call these inside zustand selectors.
  // Use the exported selector hooks (useSessionById, useLogEntriesBySession) instead.
  getSessionById: (id: string) => ObservationSession | undefined;
  getSessionsByDate: (date: string) => ObservationSession[];
  getLogEntriesBySession: (sessionId: string) => ObservationLogEntry[];
  getDatesWithSessions: () => string[];
  getPlannedDates: (year: number, month: number) => number[];
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      logEntries: [],
      plans: [],

      addSession: (session) => set((state) => ({ sessions: [...state.sessions, session] })),

      removeSession: (id) =>
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          logEntries: state.logEntries.filter((e) => e.sessionId !== id),
        })),

      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((s) => (s.id === id ? { ...s, ...updates } : s)),
        })),

      mergeSessions: (ids) => {
        const state = get();
        const toMerge = state.sessions.filter((s) => ids.includes(s.id));
        if (toMerge.length < 2) return;

        const sorted = [...toMerge].sort((a, b) => a.startTime - b.startTime);
        const merged: ObservationSession = {
          id: sorted[0].id,
          date: sorted[0].date,
          startTime: sorted[0].startTime,
          endTime: sorted[sorted.length - 1].endTime,
          duration: sorted.reduce((sum, s) => sum + s.duration, 0),
          targets: [...new Set(sorted.flatMap((s) => s.targets))],
          imageIds: [...new Set(sorted.flatMap((s) => s.imageIds))],
          equipment: sorted[0].equipment,
          notes: sorted
            .map((s) => s.notes)
            .filter(Boolean)
            .join("\n"),
          createdAt: sorted[0].createdAt,
        };

        const otherIds = ids.filter((id) => id !== merged.id);

        set((state) => ({
          sessions: [...state.sessions.filter((s) => !ids.includes(s.id)), merged],
          logEntries: state.logEntries.map((e) =>
            otherIds.includes(e.sessionId) ? { ...e, sessionId: merged.id } : e,
          ),
        }));
      },

      addLogEntry: (entry) => set((state) => ({ logEntries: [...state.logEntries, entry] })),

      addLogEntries: (entries) =>
        set((state) => ({ logEntries: [...state.logEntries, ...entries] })),

      updateLogEntry: (id, updates) =>
        set((state) => ({
          logEntries: state.logEntries.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),

      removeLogEntry: (id) =>
        set((state) => ({
          logEntries: state.logEntries.filter((e) => e.id !== id),
        })),

      getSessionById: (id) => get().sessions.find((s) => s.id === id),

      getSessionsByDate: (date) => get().sessions.filter((s) => s.date === date),

      getLogEntriesBySession: (sessionId) =>
        get().logEntries.filter((e) => e.sessionId === sessionId),

      getDatesWithSessions: () => [...new Set(get().sessions.map((s) => s.date))].sort(),

      // Plan Actions
      addPlan: (plan) => set((state) => ({ plans: [...state.plans, plan] })),

      updatePlan: (id, updates) =>
        set((state) => ({
          plans: state.plans.map((p) => (p.id === id ? { ...p, ...updates } : p)),
        })),

      removePlan: (id) =>
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== id),
        })),

      getPlannedDates: (year, month) => {
        const plans = get().plans;
        const dates: number[] = [];
        for (const plan of plans) {
          const start = new Date(plan.startDate);
          if (start.getFullYear() === year && start.getMonth() === month) {
            dates.push(start.getDate());
          }
        }
        return [...new Set(dates)];
      },
    }),
    {
      name: "session-store",
      storage: createJSONStorage(() => zustandMMKVStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        logEntries: state.logEntries,
        plans: state.plans,
      }),
    },
  ),
);

/**
 * Safe selector hook: find a session by ID.
 * Uses referential equality — returns same object if session hasn't changed.
 */
export function useSessionById(id: string | undefined) {
  return useSessionStore((s) => s.sessions.find((sess) => sess.id === (id ?? "")));
}

/**
 * Safe selector hook: get log entries for a session.
 * Uses shallow comparison to avoid infinite re-renders from .filter().
 */
export function useLogEntriesBySession(sessionId: string | undefined) {
  return useSessionStore(
    useShallow((s) => s.logEntries.filter((e) => e.sessionId === (sessionId ?? ""))),
  );
}
