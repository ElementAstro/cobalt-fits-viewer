/**
 * 日历集成 Hook
 * 封装日历服务的 UI 交互逻辑
 */

import { useCallback, useState } from "react";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useSessionStore } from "../stores/useSessionStore";
import { useSettingsStore } from "../stores/useSettingsStore";
import {
  requestCalendarPermission,
  checkCalendarPermission,
  syncSessionToCalendar,
  createPlanEvent,
  deleteCalendarEvent,
  openEventInSystemCalendar,
} from "../lib/calendar";
import type { ObservationSession, ObservationPlan } from "../lib/fits/types";

export function useCalendar() {
  const [syncing, setSyncing] = useState(false);

  const updateSession = useSessionStore((s) => s.updateSession);
  const addPlan = useSessionStore((s) => s.addPlan);
  const _updatePlan = useSessionStore((s) => s.updatePlan);
  const removePlan = useSessionStore((s) => s.removePlan);
  const plans = useSessionStore((s) => s.plans);

  const defaultReminderMinutes = useSettingsStore((s) => s.defaultReminderMinutes);

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    const hasPermission = await checkCalendarPermission();
    if (hasPermission) return true;

    const granted = await requestCalendarPermission();
    if (!granted) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return false;
    }
    return true;
  }, []);

  const syncSession = useCallback(
    async (session: ObservationSession): Promise<boolean> => {
      if (session.calendarEventId) return true;

      const permitted = await ensurePermission();
      if (!permitted) return false;

      try {
        setSyncing(true);
        const eventId = await syncSessionToCalendar(session, defaultReminderMinutes);
        updateSession(session.id, { calendarEventId: eventId });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return true;
      } catch {
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
      const permitted = await ensurePermission();
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
      const permitted = await ensurePermission();
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
        return true;
      } catch {
        // 即使日历同步失败，也保存计划到本地
        addPlan(fullPlan);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        return true;
      } finally {
        setSyncing(false);
      }
    },
    [ensurePermission, addPlan],
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
    deleteObservationPlan,
    openInCalendar,
    plans,
    ensurePermission,
  };
}
