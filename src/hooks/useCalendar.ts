/**
 * 日历集成 Hook
 * 封装日历服务的 UI 交互逻辑
 */

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useSessionStore } from "../stores/useSessionStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  isCalendarAvailable,
  requestCalendarPermission,
  checkCalendarPermission,
  getCalendarEvent,
  syncSessionToCalendar,
  createPlanEvent,
  updatePlanEvent,
  deleteCalendarEvent,
  openEventInSystemCalendar,
  editEventInSystemCalendar,
  buildPlanEventDetails,
  buildSessionEventDetails,
  createEventViaSystemUI,
} from "../lib/calendar";
import type { ObservationSession, ObservationPlan } from "../lib/fits/types";
import { Logger } from "../lib/logger";

type CalendarRefreshOutcome = "updated" | "cleared" | "unchanged" | "skipped" | "error";

interface CalendarRefreshSummary {
  sessionsUpdated: number;
  plansUpdated: number;
  sessionsCleared: number;
  plansCleared: number;
  errors: number;
  permissionDenied?: boolean;
}

function toLocalDateString(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseReminderMinutesFromAlarms(
  alarms: Array<{ relativeOffset?: number }> | undefined,
): number | undefined {
  if (!alarms) return undefined;
  if (alarms.length === 0) return 0;

  const relativeOffsets = alarms
    .map((alarm) => alarm.relativeOffset)
    .filter((offset): offset is number => typeof offset === "number" && Number.isFinite(offset));
  if (relativeOffsets.length === 0) return undefined;

  return Math.max(0, Math.round(Math.abs(relativeOffsets[0])));
}

export function useCalendar() {
  const [syncing, setSyncing] = useState(false);

  const updateSession = useSessionStore((s) => s.updateSession);
  const addPlan = useSessionStore((s) => s.addPlan);
  const updatePlan = useSessionStore((s) => s.updatePlan);
  const removePlan = useSessionStore((s) => s.removePlan);
  const getSessionById = useSessionStore((s) => s.getSessionById);
  const plans = useSessionStore((s) => s.plans);

  const defaultReminderMinutes = useSettingsStore((s) => s.defaultReminderMinutes);

  const ensurePermission = useCallback(async (withPrompt: boolean = false): Promise<boolean> => {
    const available = await isCalendarAvailable();
    if (!available) {
      if (withPrompt) {
        Alert.alert("Calendar unavailable", "Calendar API is not available on this device.");
      }
      return false;
    }

    const hasPermission = await checkCalendarPermission();
    if (hasPermission) return true;

    const granted = await requestCalendarPermission();
    if (!granted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (withPrompt) {
        Alert.alert(
          "Calendar permission denied",
          "Please grant calendar permission in system settings to continue.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Settings",
              onPress: () => {
                Linking.openSettings().catch(() => {
                  // no-op
                });
              },
            },
          ],
        );
      }
      return false;
    }
    return true;
  }, []);

  const syncSession = useCallback(
    async (session: ObservationSession): Promise<boolean> => {
      if (session.calendarEventId) return true;

      const permitted = await ensurePermission(true);
      if (!permitted) return false;

      try {
        setSyncing(true);
        const eventId = await syncSessionToCalendar(session, defaultReminderMinutes);
        updateSession(session.id, { calendarEventId: eventId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Logger.info("Calendar", `Session synced: ${session.id}`);
        return true;
      } catch (e) {
        Logger.error("Calendar", `Session sync failed: ${session.id}`, e);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [ensurePermission, defaultReminderMinutes, updateSession],
  );

  const syncAllSessions = useCallback(
    async (sessions: ObservationSession[]): Promise<number> => {
      const permitted = await ensurePermission(true);
      if (!permitted) return 0;

      setSyncing(true);
      let count = 0;
      try {
        for (const session of sessions) {
          if (session.calendarEventId) continue;
          try {
            const eventId = await syncSessionToCalendar(session, defaultReminderMinutes);
            updateSession(session.id, { calendarEventId: eventId });
            count++;
          } catch {
            // 跳过失败的单个会话
          }
        }
        if (count > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } finally {
        setSyncing(false);
      }
      return count;
    },
    [ensurePermission, defaultReminderMinutes, updateSession],
  );

  const unsyncSession = useCallback(
    async (session: ObservationSession): Promise<void> => {
      if (!session.calendarEventId) return;

      try {
        await deleteCalendarEvent(session.calendarEventId);
        updateSession(session.id, { calendarEventId: undefined });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }
    },
    [updateSession],
  );

  const createObservationPlan = useCallback(
    async (
      plan: Omit<ObservationPlan, "id" | "calendarEventId" | "createdAt">,
    ): Promise<boolean> => {
      const permitted = await ensurePermission(true);
      if (!permitted) return false;

      const fullPlan: ObservationPlan = {
        ...plan,
        id: `plan_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        createdAt: Date.now(),
      };

      try {
        setSyncing(true);
        const eventId = await createPlanEvent(fullPlan);
        fullPlan.calendarEventId = eventId;
        addPlan(fullPlan);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Logger.info("Calendar", `Plan created: ${fullPlan.id}`);
        return true;
      } catch (e) {
        // 即使日历同步失败，也保存计划到本地
        Logger.warn("Calendar", "Calendar sync failed for plan, saved locally", e);
        addPlan(fullPlan);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return true;
      } finally {
        setSyncing(false);
      }
    },
    [ensurePermission, addPlan],
  );

  const updateObservationPlan = useCallback(
    async (planId: string, updates: Partial<ObservationPlan>): Promise<boolean> => {
      const existing = plans.find((p) => p.id === planId);
      if (!existing) return false;

      const mergedPlan: ObservationPlan = { ...existing, ...updates };

      try {
        setSyncing(true);
        if (existing.calendarEventId) {
          try {
            await updatePlanEvent(existing.calendarEventId, mergedPlan);
            updatePlan(planId, updates);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            return true;
          } catch (e) {
            Logger.warn("Calendar", `Plan event update failed: ${existing.calendarEventId}`, e);
            // 事件可能已被用户手动删除，改为创建新事件并回写 eventId
            const eventId = await createPlanEvent(mergedPlan);
            updatePlan(planId, { ...updates, calendarEventId: eventId });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            return true;
          }
        }

        const permitted = await ensurePermission();
        if (!permitted) {
          updatePlan(planId, updates);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          return true;
        }

        const eventId = await createPlanEvent(mergedPlan);
        updatePlan(planId, { ...updates, calendarEventId: eventId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      } catch (e) {
        Logger.error("Calendar", `Plan update failed: ${planId}`, e);
        // 日历失败时仍保留本地变更
        updatePlan(planId, updates);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return true;
      } finally {
        setSyncing(false);
      }
    },
    [plans, updatePlan, ensurePermission],
  );

  const syncObservationPlan = useCallback(
    async (planId: string): Promise<boolean> => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return false;
      if (plan.calendarEventId) return true;

      const permitted = await ensurePermission(true);
      if (!permitted) return false;

      try {
        setSyncing(true);
        const eventId = await createPlanEvent(plan);
        updatePlan(planId, { calendarEventId: eventId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      } catch (e) {
        Logger.error("Calendar", `Plan sync failed: ${planId}`, e);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        return false;
      } finally {
        setSyncing(false);
      }
    },
    [plans, updatePlan, ensurePermission],
  );

  const syncAllObservationPlans = useCallback(
    async (targetPlans: ObservationPlan[] = plans): Promise<number> => {
      const permitted = await ensurePermission(true);
      if (!permitted) return 0;

      let count = 0;
      try {
        setSyncing(true);
        for (const plan of targetPlans) {
          if (plan.calendarEventId) continue;
          try {
            const eventId = await createPlanEvent(plan);
            updatePlan(plan.id, { calendarEventId: eventId });
            count++;
          } catch {
            // 跳过失败的单个计划
          }
        }
        if (count > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } finally {
        setSyncing(false);
      }
      return count;
    },
    [plans, ensurePermission, updatePlan],
  );

  const refreshSessionFromCalendarCore = useCallback(
    async (session: ObservationSession): Promise<CalendarRefreshOutcome> => {
      if (!session.calendarEventId) return "skipped";
      try {
        const event = await getCalendarEvent(session.calendarEventId);
        if (!event) {
          updateSession(session.id, { calendarEventId: undefined });
          return "cleared";
        }

        const startMs = event.startDate ? new Date(event.startDate).getTime() : Number.NaN;
        const endMs = event.endDate ? new Date(event.endDate).getTime() : Number.NaN;
        if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) {
          return "unchanged";
        }

        const nextDuration = Math.max(0, Math.round((endMs - startMs) / 1000));
        const nextDate = toLocalDateString(startMs);
        const updates: Partial<ObservationSession> = {};

        if (session.startTime !== startMs) updates.startTime = startMs;
        if (session.endTime !== endMs) updates.endTime = endMs;
        if (session.duration !== nextDuration) updates.duration = nextDuration;
        if (session.date !== nextDate) updates.date = nextDate;

        if (Object.keys(updates).length === 0) {
          return "unchanged";
        }

        updateSession(session.id, updates);
        return "updated";
      } catch (e) {
        Logger.warn("Calendar", `Refresh session from calendar failed: ${session.id}`, e);
        return "error";
      }
    },
    [updateSession],
  );

  const refreshPlanFromCalendarCore = useCallback(
    async (plan: ObservationPlan): Promise<CalendarRefreshOutcome> => {
      if (!plan.calendarEventId) return "skipped";
      try {
        const event = await getCalendarEvent(plan.calendarEventId);
        if (!event) {
          updatePlan(plan.id, { calendarEventId: undefined });
          return "cleared";
        }

        const updates: Partial<ObservationPlan> = {};

        const startMs = event.startDate ? new Date(event.startDate).getTime() : Number.NaN;
        const endMs = event.endDate ? new Date(event.endDate).getTime() : Number.NaN;
        if (Number.isFinite(startMs)) {
          const nextStartDate = new Date(startMs).toISOString();
          if (nextStartDate !== plan.startDate) {
            updates.startDate = nextStartDate;
          }
        }
        if (Number.isFinite(endMs)) {
          const nextEndDate = new Date(endMs).toISOString();
          if (nextEndDate !== plan.endDate) {
            updates.endDate = nextEndDate;
          }
        }

        if (typeof event.title === "string") {
          const nextTitle = event.title.replace(/^🔭\s*/u, "").trim();
          if (nextTitle !== plan.title) {
            updates.title = nextTitle;
          }
        }

        if (typeof event.notes === "string" || event.notes === null) {
          const nextNotes = event.notes ? event.notes : undefined;
          if ((plan.notes ?? undefined) !== nextNotes) {
            updates.notes = nextNotes;
          }
        }

        const nextReminderMinutes = parseReminderMinutesFromAlarms(
          event.alarms as Array<{ relativeOffset?: number }> | undefined,
        );
        if (
          typeof nextReminderMinutes === "number" &&
          nextReminderMinutes !== plan.reminderMinutes
        ) {
          updates.reminderMinutes = nextReminderMinutes;
        }

        if (Object.keys(updates).length === 0) {
          return "unchanged";
        }

        updatePlan(plan.id, updates);
        return "updated";
      } catch (e) {
        Logger.warn("Calendar", `Refresh plan from calendar failed: ${plan.id}`, e);
        return "error";
      }
    },
    [updatePlan],
  );

  const refreshSessionFromCalendar = useCallback(
    async (session: ObservationSession): Promise<CalendarRefreshOutcome> => {
      const permitted = await ensurePermission(true);
      if (!permitted) return "error";

      try {
        setSyncing(true);
        const outcome = await refreshSessionFromCalendarCore(session);
        if (outcome === "updated") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (outcome === "cleared") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        return outcome;
      } finally {
        setSyncing(false);
      }
    },
    [ensurePermission, refreshSessionFromCalendarCore],
  );

  const refreshPlanFromCalendar = useCallback(
    async (plan: ObservationPlan): Promise<CalendarRefreshOutcome> => {
      const permitted = await ensurePermission(true);
      if (!permitted) return "error";

      try {
        setSyncing(true);
        const outcome = await refreshPlanFromCalendarCore(plan);
        if (outcome === "updated") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (outcome === "cleared") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
        return outcome;
      } finally {
        setSyncing(false);
      }
    },
    [ensurePermission, refreshPlanFromCalendarCore],
  );

  const refreshAllFromCalendar = useCallback(
    async (
      sessions: ObservationSession[],
      targetPlans: ObservationPlan[] = plans,
    ): Promise<CalendarRefreshSummary> => {
      const permitted = await ensurePermission(true);
      if (!permitted) {
        return {
          sessionsUpdated: 0,
          plansUpdated: 0,
          sessionsCleared: 0,
          plansCleared: 0,
          errors: 0,
          permissionDenied: true,
        };
      }

      const summary: CalendarRefreshSummary = {
        sessionsUpdated: 0,
        plansUpdated: 0,
        sessionsCleared: 0,
        plansCleared: 0,
        errors: 0,
      };

      try {
        setSyncing(true);

        for (const session of sessions) {
          const outcome = await refreshSessionFromCalendarCore(session);
          if (outcome === "updated") summary.sessionsUpdated++;
          else if (outcome === "cleared") summary.sessionsCleared++;
          else if (outcome === "error") summary.errors++;
        }

        for (const plan of targetPlans) {
          const outcome = await refreshPlanFromCalendarCore(plan);
          if (outcome === "updated") summary.plansUpdated++;
          else if (outcome === "cleared") summary.plansCleared++;
          else if (outcome === "error") summary.errors++;
        }

        if (summary.sessionsUpdated + summary.plansUpdated > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (summary.sessionsCleared + summary.plansCleared > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } finally {
        setSyncing(false);
      }

      return summary;
    },
    [plans, ensurePermission, refreshPlanFromCalendarCore, refreshSessionFromCalendarCore],
  );

  const cleanupMissingCalendarLinks = useCallback(
    async (
      sessions: ObservationSession[],
      targetPlans: ObservationPlan[] = plans,
    ): Promise<{ sessionsCleared: number; plansCleared: number }> => {
      const permitted = await ensurePermission(true);
      if (!permitted) return { sessionsCleared: 0, plansCleared: 0 };

      let sessionsCleared = 0;
      let plansCleared = 0;
      try {
        setSyncing(true);

        for (const session of sessions) {
          if (!session.calendarEventId) continue;
          const event = await getCalendarEvent(session.calendarEventId);
          if (!event) {
            updateSession(session.id, { calendarEventId: undefined });
            sessionsCleared++;
          }
        }

        for (const plan of targetPlans) {
          if (!plan.calendarEventId) continue;
          const event = await getCalendarEvent(plan.calendarEventId);
          if (!event) {
            updatePlan(plan.id, { calendarEventId: undefined });
            plansCleared++;
          }
        }

        if (sessionsCleared > 0 || plansCleared > 0) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
      } finally {
        setSyncing(false);
      }

      return { sessionsCleared, plansCleared };
    },
    [plans, ensurePermission, updatePlan, updateSession],
  );

  const openSessionInCalendar = useCallback(
    async (session: ObservationSession): Promise<boolean> => {
      try {
        let eventId = session.calendarEventId;
        if (eventId) {
          const event = await getCalendarEvent(eventId);
          if (!event) {
            const permitted = await ensurePermission(true);
            if (!permitted) return false;

            setSyncing(true);
            try {
              eventId = await syncSessionToCalendar(session, defaultReminderMinutes);
              updateSession(session.id, { calendarEventId: eventId });
            } finally {
              setSyncing(false);
            }
          }
        } else {
          const synced = await syncSession(session);
          if (!synced) return false;
          eventId = getSessionById(session.id)?.calendarEventId;
        }

        if (!eventId) return false;
        await openEventInSystemCalendar(eventId);
        return true;
      } catch {
        Alert.alert("Error", "Could not open calendar event");
        return false;
      }
    },
    [defaultReminderMinutes, ensurePermission, syncSession, getSessionById, updateSession],
  );

  const openPlanInCalendar = useCallback(
    async (plan: ObservationPlan): Promise<boolean> => {
      try {
        let eventId = plan.calendarEventId;
        if (eventId) {
          const event = await getCalendarEvent(eventId);
          if (!event) {
            const permitted = await ensurePermission(true);
            if (!permitted) return false;

            setSyncing(true);
            try {
              eventId = await createPlanEvent(plan);
              updatePlan(plan.id, { calendarEventId: eventId });
            } finally {
              setSyncing(false);
            }
          }
        } else {
          const synced = await syncObservationPlan(plan.id);
          if (!synced) return false;
          eventId = plans.find((p) => p.id === plan.id)?.calendarEventId;
        }

        if (!eventId) return false;
        await openEventInSystemCalendar(eventId);
        return true;
      } catch {
        Alert.alert("Error", "Could not open calendar event");
        return false;
      }
    },
    [ensurePermission, syncObservationPlan, plans, updatePlan],
  );

  const editSessionInCalendar = useCallback(
    async (session: ObservationSession): Promise<boolean> => {
      const eventId = session.calendarEventId;
      if (!eventId) return false;

      try {
        const result = await editEventInSystemCalendar(eventId);
        if (result.action === "deleted") {
          updateSession(session.id, { calendarEventId: undefined });
        } else if (result.action === "saved") {
          try {
            setSyncing(true);
            await refreshSessionFromCalendarCore(session);
          } finally {
            setSyncing(false);
          }
        }
        return true;
      } catch {
        Alert.alert("Error", "Could not open calendar event editor");
        return false;
      }
    },
    [refreshSessionFromCalendarCore, updateSession],
  );

  const editPlanInCalendar = useCallback(
    async (plan: ObservationPlan): Promise<boolean> => {
      const eventId = plan.calendarEventId;
      if (!eventId) return false;

      try {
        const result = await editEventInSystemCalendar(eventId);
        if (result.action === "deleted") {
          updatePlan(plan.id, { calendarEventId: undefined });
        } else if (result.action === "saved") {
          try {
            setSyncing(true);
            await refreshPlanFromCalendarCore(plan);
          } finally {
            setSyncing(false);
          }
        }
        return true;
      } catch {
        Alert.alert("Error", "Could not open calendar event editor");
        return false;
      }
    },
    [refreshPlanFromCalendarCore, updatePlan],
  );

  const createSessionViaSystemCalendar = useCallback(
    async (session: ObservationSession): Promise<boolean> => {
      try {
        const result = await createEventViaSystemUI(
          buildSessionEventDetails(session, defaultReminderMinutes),
          { startNewActivityTask: false },
        );
        if (result.id) {
          updateSession(session.id, { calendarEventId: result.id });
        }
        return result.action !== "canceled";
      } catch {
        Alert.alert("Error", "Could not open system calendar create dialog");
        return false;
      }
    },
    [defaultReminderMinutes, updateSession],
  );

  const createPlanViaSystemCalendar = useCallback(
    async (plan: ObservationPlan): Promise<boolean> => {
      try {
        const result = await createEventViaSystemUI(buildPlanEventDetails(plan), {
          startNewActivityTask: false,
        });
        if (result.id) {
          updatePlan(plan.id, { calendarEventId: result.id });
        }
        return result.action !== "canceled";
      } catch {
        Alert.alert("Error", "Could not open system calendar create dialog");
        return false;
      }
    },
    [updatePlan],
  );

  const deleteObservationPlan = useCallback(
    async (planId: string): Promise<void> => {
      const plan = plans.find((p) => p.id === planId);
      if (!plan) return;

      if (plan.calendarEventId) {
        try {
          await deleteCalendarEvent(plan.calendarEventId);
        } catch {
          // 事件可能已被手动删除
        }
      }
      removePlan(planId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [plans, removePlan],
  );

  const openInCalendar = useCallback(async (eventId: string): Promise<void> => {
    try {
      await openEventInSystemCalendar(eventId);
    } catch {
      Alert.alert("Error", "Could not open calendar event");
    }
  }, []);

  return {
    syncing,
    syncSession,
    syncAllSessions,
    unsyncSession,
    createObservationPlan,
    updateObservationPlan,
    syncObservationPlan,
    syncAllObservationPlans,
    refreshSessionFromCalendar,
    refreshPlanFromCalendar,
    refreshAllFromCalendar,
    cleanupMissingCalendarLinks,
    deleteObservationPlan,
    openInCalendar,
    openSessionInCalendar,
    openPlanInCalendar,
    editSessionInCalendar,
    editPlanInCalendar,
    createSessionViaSystemCalendar,
    createPlanViaSystemCalendar,
    plans,
    ensurePermission,
  };
}
