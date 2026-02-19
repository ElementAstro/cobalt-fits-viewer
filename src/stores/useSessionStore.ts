/**
 * 观测会话状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { zustandMMKVStorage } from "../lib/storage";
import { LOG_TAGS, Logger } from "../lib/logger";
import type { ObservationSession, ObservationLogEntry, ObservationPlan } from "../lib/fits/types";
import {
  mergeSessionLike,
  normalizeSessionLike,
  type ObservationSessionWriteInput,
  type SessionLikeInput,
} from "../lib/sessions/sessionNormalization";
import { useFitsStore } from "./useFitsStore";

interface ActiveSessionState {
  id: string;
  startedAt: number;
  pausedAt?: number;
  totalPausedMs: number;
  notes: { timestamp: number; text: string }[];
  status: "running" | "paused";
}

interface SessionStoreState {
  sessions: ObservationSession[];
  logEntries: ObservationLogEntry[];
  plans: ObservationPlan[];
  activeSession: ActiveSessionState | null;

  // Live session actions
  startLiveSession: () => void;
  pauseLiveSession: () => void;
  resumeLiveSession: () => void;
  endLiveSession: () => ObservationSession | null;
  addActiveNote: (text: string) => void;

  // Actions
  addSession: (session: ObservationSessionWriteInput) => void;
  removeSession: (id: string) => void;
  removeMultipleSessions: (ids: string[]) => void;
  clearAllSessions: () => void;
  updateSession: (id: string, updates: SessionLikeInput) => void;
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

type LegacyObservationSession = SessionLikeInput;

function toLocalDateKey(timestamp: number): string | undefined {
  if (!Number.isFinite(timestamp)) return undefined;
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function migrateSession(session: LegacyObservationSession): ObservationSession {
  const normalized = normalizeSessionLike(session, {
    forceTargetRefs: true,
    forceImageIds: true,
  });
  const migrated = {
    ...(normalized as ObservationSession),
    equipment: normalized.equipment ?? {},
  };

  const derivedDate = toLocalDateKey(migrated.startTime);
  if (derivedDate) {
    migrated.date = derivedDate;
  }

  if (Number.isFinite(migrated.startTime) && Number.isFinite(migrated.endTime)) {
    if (migrated.endTime < migrated.startTime) {
      Logger.warn(
        LOG_TAGS.Sessions,
        `Session has invalid time range during migration: ${migrated.id}`,
        {
          startTime: migrated.startTime,
          endTime: migrated.endTime,
        },
      );
    }
  }

  return migrated;
}

function migratePlan(plan: ObservationPlan): ObservationPlan {
  return {
    ...plan,
    targetName: plan.targetName?.trim() ?? "",
    targetId: plan.targetId,
    status: plan.status ?? "planned",
  };
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      logEntries: [],
      plans: [],
      activeSession: null,

      startLiveSession: () => {
        const now = Date.now();
        set({
          activeSession: {
            id: `live-${now}`,
            startedAt: now,
            totalPausedMs: 0,
            notes: [],
            status: "running",
          },
        });
      },

      pauseLiveSession: () =>
        set((state) => ({
          activeSession: state.activeSession
            ? { ...state.activeSession, status: "paused", pausedAt: Date.now() }
            : null,
        })),

      resumeLiveSession: () =>
        set((state) => {
          if (!state.activeSession?.pausedAt) return {};
          const pausedDuration = Date.now() - state.activeSession.pausedAt;
          return {
            activeSession: {
              ...state.activeSession,
              status: "running",
              pausedAt: undefined,
              totalPausedMs: state.activeSession.totalPausedMs + pausedDuration,
            },
          };
        }),

      endLiveSession: () => {
        const active = get().activeSession;
        if (!active) return null;
        const now = Date.now();
        let totalPaused = active.totalPausedMs;
        if (active.pausedAt) totalPaused += now - active.pausedAt;
        const duration = Math.floor((now - active.startedAt - totalPaused) / 1000);
        const startDate = new Date(active.startedAt);
        const dateStr = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}`;

        const session: ObservationSession = {
          id: active.id,
          date: dateStr,
          startTime: active.startedAt,
          endTime: now,
          duration,
          targetRefs: [],
          imageIds: [],
          equipment: {},
          createdAt: now,
          notes:
            active.notes
              .map((n) => `[${new Date(n.timestamp).toLocaleTimeString()}] ${n.text}`)
              .join("\n") || undefined,
        };

        set((state) => ({
          activeSession: null,
          sessions: [...state.sessions, session],
        }));
        return session;
      },

      addActiveNote: (text) =>
        set((state) => ({
          activeSession: state.activeSession
            ? {
                ...state.activeSession,
                notes: [...state.activeSession.notes, { timestamp: Date.now(), text }],
              }
            : null,
        })),

      addSession: (session) =>
        set((state) => ({
          sessions: [
            ...state.sessions,
            {
              ...(normalizeSessionLike(session, {
                forceTargetRefs: true,
                forceImageIds: true,
              }) as ObservationSession),
              equipment: session.equipment ?? {},
            },
          ],
        })),

      removeSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          logEntries: state.logEntries.filter((e) => e.sessionId !== id),
        }));

        useFitsStore.setState((state) => ({
          files: state.files.map((file) =>
            file.sessionId === id ? { ...file, sessionId: undefined } : file,
          ),
        }));
      },

      removeMultipleSessions: (ids) => {
        const idSet = new Set(ids);
        set((state) => ({
          sessions: state.sessions.filter((s) => !idSet.has(s.id)),
          logEntries: state.logEntries.filter((e) => !idSet.has(e.sessionId)),
        }));

        if (idSet.size === 0) return;
        useFitsStore.setState((state) => ({
          files: state.files.map((file) =>
            file.sessionId && idSet.has(file.sessionId) ? { ...file, sessionId: undefined } : file,
          ),
        }));
      },

      clearAllSessions: () => {
        set({ sessions: [], logEntries: [] });
        useFitsStore.setState((state) => ({
          files: state.files.map((file) =>
            file.sessionId ? { ...file, sessionId: undefined } : file,
          ),
        }));
      },

      updateSession: (id, updates) =>
        set((state) => ({
          sessions: state.sessions.map((session) => {
            if (session.id !== id) return session;
            const normalizedUpdates = normalizeSessionLike(updates);
            const merged = { ...session, ...normalizedUpdates };
            return {
              ...(normalizeSessionLike(merged, {
                forceTargetRefs: true,
                forceImageIds: true,
              }) as ObservationSession),
              equipment: merged.equipment ?? session.equipment ?? {},
            };
          }),
        })),

      mergeSessions: (ids) => {
        const state = get();
        const toMerge = state.sessions.filter((s) => ids.includes(s.id));
        if (toMerge.length < 2) return;

        const sorted = [...toMerge].sort((a, b) => a.startTime - b.startTime);
        const mergedBase = sorted
          .slice(1)
          .reduce<SessionLikeInput>((acc, session) => mergeSessionLike(acc, session), sorted[0]);
        const normalizedMerged = normalizeSessionLike(mergedBase, {
          forceTargetRefs: true,
          forceImageIds: true,
        });

        const merged: ObservationSession = {
          ...(normalizedMerged as ObservationSession),
          id: sorted[0].id,
          date: sorted[0].date,
          startTime: sorted[0].startTime,
          endTime: sorted[sorted.length - 1].endTime,
          duration: sorted.reduce((sum, s) => sum + s.duration, 0),
          createdAt: sorted[0].createdAt,
          equipment: normalizedMerged.equipment ?? sorted[0].equipment ?? {},
        };

        const otherIds = ids.filter((id) => id !== merged.id);

        set((state) => ({
          sessions: [...state.sessions.filter((s) => !ids.includes(s.id)), merged],
          logEntries: state.logEntries.map((e) =>
            otherIds.includes(e.sessionId) ? { ...e, sessionId: merged.id } : e,
          ),
        }));

        if (otherIds.length > 0) {
          const otherIdSet = new Set(otherIds);
          useFitsStore.setState((state) => ({
            files: state.files.map((file) =>
              file.sessionId && otherIdSet.has(file.sessionId)
                ? { ...file, sessionId: merged.id }
                : file,
            ),
          }));
        }
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
        activeSession: state.activeSession,
        plans: state.plans,
      }),
      version: 3,
      migrate: (persistedState, _version) => {
        const state = persistedState as Partial<SessionStoreState> & {
          sessions?: LegacyObservationSession[];
          plans?: ObservationPlan[];
          logEntries?: ObservationLogEntry[];
        };
        const sessions = (state.sessions ?? []).map(migrateSession);
        const plans = (state.plans ?? []).map(migratePlan);
        return {
          sessions,
          plans,
          logEntries: state.logEntries ?? [],
          activeSession: state.activeSession ?? null,
        };
      },
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
