/**
 * 观测会话状态管理
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { useShallow } from "zustand/shallow";
import { zustandAsyncStorage } from "../lib/storage";
import { LOG_TAGS, Logger } from "../lib/logger";
import type {
  GeoLocation,
  ObservationSession,
  ObservationLogEntry,
  ObservationPlan,
  SessionEquipment,
} from "../lib/fits/types";
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
  draftTargets?: string[];
  draftEquipment?: SessionEquipment;
  draftLocation?: GeoLocation;
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
  updateActiveSessionDraft: (
    updates: Partial<Pick<ActiveSessionState, "draftTargets" | "draftEquipment" | "draftLocation">>,
  ) => void;
  clearActiveSessionDraft: () => void;

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

function dedupeStringValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const next: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    next.push(trimmed);
  }

  return next;
}

function normalizeDraftEquipmentInput(equipment: unknown): SessionEquipment | undefined {
  if (!equipment || typeof equipment !== "object") return undefined;
  const raw = equipment as Record<string, unknown>;

  const telescope = typeof raw.telescope === "string" ? raw.telescope.trim() : "";
  const camera = typeof raw.camera === "string" ? raw.camera.trim() : "";
  const mount = typeof raw.mount === "string" ? raw.mount.trim() : "";
  const filters = Array.isArray(raw.filters)
    ? dedupeStringValues(raw.filters.filter((item): item is string => typeof item === "string"))
    : [];

  const normalized: SessionEquipment = {
    ...(telescope ? { telescope } : {}),
    ...(camera ? { camera } : {}),
    ...(mount ? { mount } : {}),
    ...(filters.length > 0 ? { filters } : {}),
  };

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeDraftLocationInput(location: unknown): GeoLocation | undefined {
  if (!location || typeof location !== "object") return undefined;
  const raw = location as Record<string, unknown>;

  const latitude =
    typeof raw.latitude === "number"
      ? raw.latitude
      : typeof raw.latitude === "string"
        ? Number(raw.latitude)
        : NaN;
  const longitude =
    typeof raw.longitude === "number"
      ? raw.longitude
      : typeof raw.longitude === "string"
        ? Number(raw.longitude)
        : NaN;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return undefined;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return undefined;

  const altitude =
    typeof raw.altitude === "number"
      ? raw.altitude
      : typeof raw.altitude === "string"
        ? Number(raw.altitude)
        : undefined;

  return {
    latitude,
    longitude,
    ...(Number.isFinite(altitude) ? { altitude } : {}),
    ...(typeof raw.placeName === "string" && raw.placeName.trim()
      ? { placeName: raw.placeName.trim() }
      : {}),
    ...(typeof raw.city === "string" && raw.city.trim() ? { city: raw.city.trim() } : {}),
    ...(typeof raw.region === "string" && raw.region.trim() ? { region: raw.region.trim() } : {}),
    ...(typeof raw.country === "string" && raw.country.trim()
      ? { country: raw.country.trim() }
      : {}),
  };
}

function normalizeActiveSessionInput(activeSession: unknown): ActiveSessionState | null {
  if (!activeSession || typeof activeSession !== "object") return null;
  const raw = activeSession as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id : undefined;
  const startedAt =
    typeof raw.startedAt === "number"
      ? raw.startedAt
      : typeof raw.startedAt === "string"
        ? Number(raw.startedAt)
        : NaN;

  if (!id || !Number.isFinite(startedAt)) return null;

  const pausedAt =
    typeof raw.pausedAt === "number"
      ? raw.pausedAt
      : typeof raw.pausedAt === "string"
        ? Number(raw.pausedAt)
        : NaN;
  const totalPausedMs =
    typeof raw.totalPausedMs === "number"
      ? raw.totalPausedMs
      : typeof raw.totalPausedMs === "string"
        ? Number(raw.totalPausedMs)
        : 0;
  const rawNotes = Array.isArray(raw.notes) ? raw.notes : [];
  const notes = rawNotes
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const note = entry as Record<string, unknown>;
      const timestamp =
        typeof note.timestamp === "number"
          ? note.timestamp
          : typeof note.timestamp === "string"
            ? Number(note.timestamp)
            : NaN;
      const text = typeof note.text === "string" ? note.text.trim() : "";
      if (!Number.isFinite(timestamp) || !text) return null;
      return { timestamp, text };
    })
    .filter((entry): entry is { timestamp: number; text: string } => Boolean(entry));

  const draftTargets = Array.isArray(raw.draftTargets)
    ? dedupeStringValues(
        raw.draftTargets.filter((item): item is string => typeof item === "string"),
      )
    : [];
  const draftEquipment = normalizeDraftEquipmentInput(raw.draftEquipment);
  const draftLocation = normalizeDraftLocationInput(raw.draftLocation);

  return {
    id,
    startedAt,
    ...(Number.isFinite(pausedAt) ? { pausedAt } : {}),
    totalPausedMs: Number.isFinite(totalPausedMs) ? totalPausedMs : 0,
    notes,
    status: raw.status === "paused" ? "paused" : "running",
    ...(draftTargets.length > 0 ? { draftTargets } : {}),
    ...(draftEquipment ? { draftEquipment } : {}),
    ...(draftLocation ? { draftLocation } : {}),
  };
}

export const useSessionStore = create<SessionStoreState>()(
  persist(
    (set, get) => ({
      sessions: [],
      logEntries: [],
      plans: [],
      activeSession: null,

      startLiveSession: () =>
        set((state) => {
          if (state.activeSession) return {};
          const now = Date.now();
          return {
            activeSession: {
              id: `live-${now}`,
              startedAt: now,
              totalPausedMs: 0,
              notes: [],
              status: "running",
            },
          };
        }),

      pauseLiveSession: () =>
        set((state) => {
          if (!state.activeSession) return {};
          if (state.activeSession.status === "paused") return {};
          return {
            activeSession: { ...state.activeSession, status: "paused", pausedAt: Date.now() },
          };
        }),

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

      updateActiveSessionDraft: (updates) =>
        set((state) => {
          if (!state.activeSession) return {};

          const hasDraftTargets = "draftTargets" in updates;
          const hasDraftEquipment = "draftEquipment" in updates;
          const hasDraftLocation = "draftLocation" in updates;

          const nextDraftTargets =
            hasDraftTargets && updates.draftTargets
              ? dedupeStringValues(updates.draftTargets)
              : updates.draftTargets === undefined
                ? undefined
                : state.activeSession.draftTargets;
          const nextDraftEquipment = hasDraftEquipment
            ? normalizeDraftEquipmentInput(updates.draftEquipment)
            : state.activeSession.draftEquipment;
          const nextDraftLocation = hasDraftLocation
            ? normalizeDraftLocationInput(updates.draftLocation)
            : state.activeSession.draftLocation;

          return {
            activeSession: {
              ...state.activeSession,
              ...(hasDraftTargets ? { draftTargets: nextDraftTargets } : {}),
              ...(hasDraftEquipment ? { draftEquipment: nextDraftEquipment } : {}),
              ...(hasDraftLocation ? { draftLocation: nextDraftLocation } : {}),
            },
          };
        }),

      clearActiveSessionDraft: () =>
        set((state) => {
          if (!state.activeSession) return {};
          return {
            activeSession: {
              ...state.activeSession,
              draftTargets: undefined,
              draftEquipment: undefined,
              draftLocation: undefined,
            },
          };
        }),

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
      storage: createJSONStorage(() => zustandAsyncStorage),
      partialize: (state) => ({
        sessions: state.sessions,
        logEntries: state.logEntries,
        activeSession: state.activeSession,
        plans: state.plans,
      }),
      version: 4,
      migrate: (persistedState, _version) => {
        const state = persistedState as Partial<SessionStoreState> & {
          sessions?: LegacyObservationSession[];
          plans?: ObservationPlan[];
          logEntries?: ObservationLogEntry[];
          activeSession?: unknown;
        };
        const sessions = (state.sessions ?? []).map(migrateSession);
        const plans = (state.plans ?? []).map(migratePlan);
        return {
          sessions,
          plans,
          logEntries: state.logEntries ?? [],
          activeSession: normalizeActiveSessionInput(state.activeSession),
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
