import { act, renderHook } from "@testing-library/react-native";
import { useCalendar } from "../useCalendar";
import { useSessionStore } from "../../../stores/observation/useSessionStore";
import type { ObservationPlan, ObservationSession } from "../../../lib/fits/types";

jest.mock("../../../lib/storage", () => ({
  zustandAsyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../../stores/app/useSettingsStore", () => ({
  useSettingsStore: (
    selector: (state: {
      defaultReminderMinutes: number;
      calendarSyncEnabled: boolean;
      hapticsEnabled: boolean;
    }) => unknown,
  ) =>
    selector({
      defaultReminderMinutes: 30,
      calendarSyncEnabled: true,
      hapticsEnabled: true,
    }),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
  notificationAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-linking", () => ({
  openSettings: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../../lib/calendar", () => ({
  isCalendarAvailable: jest.fn().mockResolvedValue(true),
  requestCalendarPermission: jest.fn().mockResolvedValue(true),
  checkCalendarPermission: jest.fn().mockResolvedValue(true),
  getCalendarEvent: jest.fn(),
  syncSessionToCalendar: jest.fn(),
  createPlanEvent: jest.fn(),
  updatePlanEvent: jest.fn(),
  deleteCalendarEvent: jest.fn(),
  openEventInSystemCalendar: jest.fn(),
  editEventInSystemCalendar: jest.fn(),
  buildPlanEventDetails: jest.fn().mockReturnValue({}),
  buildSessionEventDetails: jest.fn().mockReturnValue({}),
  createEventViaSystemUI: jest.fn(),
}));

jest.mock("../../../lib/logger", () => ({
  LOG_TAGS: {
    Calendar: "Calendar",
  },
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const calendarApi = jest.requireMock("../../../lib/calendar") as {
  isCalendarAvailable: jest.Mock;
  requestCalendarPermission: jest.Mock;
  checkCalendarPermission: jest.Mock;
  getCalendarEvent: jest.Mock;
  syncSessionToCalendar: jest.Mock;
  createPlanEvent: jest.Mock;
  updatePlanEvent: jest.Mock;
  deleteCalendarEvent: jest.Mock;
  openEventInSystemCalendar: jest.Mock;
  editEventInSystemCalendar: jest.Mock;
  buildPlanEventDetails: jest.Mock;
  buildSessionEventDetails: jest.Mock;
  createEventViaSystemUI: jest.Mock;
};

const makePlan = (overrides: Partial<ObservationPlan> = {}): ObservationPlan => ({
  id: "plan-1",
  title: "Plan One",
  targetName: "M42",
  startDate: "2025-03-10T20:00:00.000Z",
  endDate: "2025-03-10T22:00:00.000Z",
  reminderMinutes: 30,
  createdAt: 1,
  ...overrides,
});

const makeSession = (overrides: Partial<ObservationSession> = {}): ObservationSession => ({
  id: "session-1",
  date: "2025-03-10",
  startTime: 1741636800000,
  endTime: 1741640400000,
  duration: 3600,
  targetRefs: [{ name: "M42" }],
  imageIds: [],
  equipment: {},
  createdAt: 1,
  ...overrides,
});

describe("useCalendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSessionStore.setState({
      sessions: [],
      logEntries: [],
      plans: [],
      activeSession: null,
    });
    calendarApi.isCalendarAvailable.mockResolvedValue(true);
    calendarApi.checkCalendarPermission.mockResolvedValue(true);
    calendarApi.requestCalendarPermission.mockResolvedValue(true);
    calendarApi.getCalendarEvent.mockResolvedValue({ id: "event-1" });
  });

  it("updateObservationPlan updates an existing calendar event and local store", async () => {
    const plan = makePlan({ calendarEventId: "event-1" });
    useSessionStore.setState({ plans: [plan] });
    calendarApi.updatePlanEvent.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.updateObservationPlan(plan.id, {
        title: "Updated Plan",
        reminderMinutes: 15,
      });
      expect(ok).toBe(true);
    });

    expect(calendarApi.updatePlanEvent).toHaveBeenCalledTimes(1);
    expect(calendarApi.updatePlanEvent.mock.calls[0][0]).toBe("event-1");
    expect(useSessionStore.getState().plans[0].title).toBe("Updated Plan");
    expect(useSessionStore.getState().plans[0].reminderMinutes).toBe(15);
    expect(useSessionStore.getState().plans[0].calendarEventId).toBe("event-1");
  });

  it("updateObservationPlan recreates calendar event when update fails", async () => {
    const plan = makePlan({ calendarEventId: "event-missing" });
    useSessionStore.setState({ plans: [plan] });
    calendarApi.updatePlanEvent.mockRejectedValue(new Error("Not found"));
    calendarApi.createPlanEvent.mockResolvedValue("event-new");

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.updateObservationPlan(plan.id, {
        title: "Recovered Plan",
      });
      expect(ok).toBe(true);
    });

    expect(calendarApi.updatePlanEvent).toHaveBeenCalledTimes(1);
    expect(calendarApi.createPlanEvent).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().plans[0].calendarEventId).toBe("event-new");
    expect(useSessionStore.getState().plans[0].title).toBe("Recovered Plan");
  });

  it("syncObservationPlan creates event for unsynced plan", async () => {
    const plan = makePlan({ id: "plan-unsynced", calendarEventId: undefined });
    useSessionStore.setState({ plans: [plan] });
    calendarApi.createPlanEvent.mockResolvedValue("event-sync");

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.syncObservationPlan(plan.id);
      expect(ok).toBe(true);
    });

    expect(calendarApi.createPlanEvent).toHaveBeenCalledTimes(1);
    expect(useSessionStore.getState().plans[0].calendarEventId).toBe("event-sync");
  });

  it("openPlanInCalendar repairs missing event and opens new event", async () => {
    const plan = makePlan({ id: "plan-open", calendarEventId: "missing-id" });
    useSessionStore.setState({ plans: [plan] });
    calendarApi.getCalendarEvent.mockResolvedValueOnce(null);
    calendarApi.createPlanEvent.mockResolvedValueOnce("event-restored");
    calendarApi.openEventInSystemCalendar.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.openPlanInCalendar(plan);
      expect(ok).toBe(true);
    });

    expect(calendarApi.createPlanEvent).toHaveBeenCalledTimes(1);
    expect(calendarApi.openEventInSystemCalendar).toHaveBeenCalledWith("event-restored");
    expect(useSessionStore.getState().plans[0].calendarEventId).toBe("event-restored");
  });

  it("syncAllObservationPlans syncs only unsynced plans", async () => {
    const plans = [
      makePlan({ id: "p1", calendarEventId: undefined }),
      makePlan({ id: "p2", calendarEventId: "exists-event" }),
      makePlan({ id: "p3", calendarEventId: undefined }),
    ];
    useSessionStore.setState({ plans });
    calendarApi.createPlanEvent.mockResolvedValueOnce("event-p1");
    calendarApi.createPlanEvent.mockResolvedValueOnce("event-p3");

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const count = await result.current.syncAllObservationPlans(plans);
      expect(count).toBe(2);
    });

    const statePlans = useSessionStore.getState().plans;
    expect(calendarApi.createPlanEvent).toHaveBeenCalledTimes(2);
    expect(statePlans.find((p) => p.id === "p1")?.calendarEventId).toBe("event-p1");
    expect(statePlans.find((p) => p.id === "p2")?.calendarEventId).toBe("exists-event");
    expect(statePlans.find((p) => p.id === "p3")?.calendarEventId).toBe("event-p3");
  });

  it("syncObservationPlansBatch returns success/skipped/failed summary", async () => {
    const plans = [
      makePlan({ id: "p-batch-1", calendarEventId: undefined }),
      makePlan({ id: "p-batch-2", calendarEventId: "existing-event" }),
      makePlan({ id: "p-batch-3", calendarEventId: undefined }),
    ];
    useSessionStore.setState({ plans });
    calendarApi.createPlanEvent
      .mockResolvedValueOnce("event-batch-1")
      .mockRejectedValueOnce(new Error("create failed"));

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.syncObservationPlansBatch(plans);
      expect(summary).toEqual({
        total: 3,
        success: 1,
        skipped: 1,
        failed: 1,
      });
    });

    const statePlans = useSessionStore.getState().plans;
    expect(statePlans.find((p) => p.id === "p-batch-1")?.calendarEventId).toBe("event-batch-1");
    expect(statePlans.find((p) => p.id === "p-batch-2")?.calendarEventId).toBe("existing-event");
    expect(statePlans.find((p) => p.id === "p-batch-3")?.calendarEventId).toBeUndefined();
  });

  it("cleanupMissingCalendarLinks clears missing session and plan event ids", async () => {
    const sessions = [
      makeSession({ id: "s1", calendarEventId: "ok-session-event" }),
      makeSession({ id: "s2", calendarEventId: "missing-session-event" }),
    ];
    const plans = [
      makePlan({ id: "p1", calendarEventId: "ok-plan-event" }),
      makePlan({ id: "p2", calendarEventId: "missing-plan-event" }),
    ];
    useSessionStore.setState({ sessions, plans });

    calendarApi.getCalendarEvent
      .mockResolvedValueOnce({ id: "ok-session-event" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "ok-plan-event" })
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const cleaned = await result.current.cleanupMissingCalendarLinks(sessions, plans);
      expect(cleaned).toEqual({ sessionsCleared: 1, plansCleared: 1 });
    });

    const state = useSessionStore.getState();
    expect(state.sessions.find((s) => s.id === "s1")?.calendarEventId).toBe("ok-session-event");
    expect(state.sessions.find((s) => s.id === "s2")?.calendarEventId).toBeUndefined();
    expect(state.plans.find((p) => p.id === "p1")?.calendarEventId).toBe("ok-plan-event");
    expect(state.plans.find((p) => p.id === "p2")?.calendarEventId).toBeUndefined();
  });

  it("refreshSessionFromCalendar updates local session timing fields", async () => {
    const session = makeSession({
      id: "session-refresh",
      date: "2025-03-10",
      startTime: 1741636800000,
      endTime: 1741640400000,
      duration: 3600,
      calendarEventId: "event-session-refresh",
    });
    useSessionStore.setState({ sessions: [session] });

    const eventStart = new Date("2025-03-11T01:15:00.000Z");
    const eventEnd = new Date("2025-03-11T03:45:00.000Z");
    calendarApi.getCalendarEvent.mockResolvedValueOnce({
      id: "event-session-refresh",
      startDate: eventStart,
      endDate: eventEnd,
    });

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const outcome = await result.current.refreshSessionFromCalendar(session);
      expect(outcome).toBe("updated");
    });

    const updated = useSessionStore.getState().sessions[0];
    const expectedDate = `${eventStart.getFullYear()}-${String(eventStart.getMonth() + 1).padStart(2, "0")}-${String(eventStart.getDate()).padStart(2, "0")}`;
    expect(updated.startTime).toBe(eventStart.getTime());
    expect(updated.endTime).toBe(eventEnd.getTime());
    expect(updated.duration).toBe(9000);
    expect(updated.date).toBe(expectedDate);
  });

  it("refreshPlanFromCalendar updates plan fields and reminder from event", async () => {
    const plan = makePlan({
      id: "plan-refresh",
      title: "Old Title",
      notes: "Old Notes",
      reminderMinutes: 15,
      calendarEventId: "event-plan-refresh",
    });
    useSessionStore.setState({ plans: [plan] });

    const nextStart = new Date("2025-04-01T02:30:00.000Z");
    const nextEnd = new Date("2025-04-01T05:00:00.000Z");
    calendarApi.getCalendarEvent.mockResolvedValueOnce({
      id: "event-plan-refresh",
      title: "🔭 New Plan Title",
      notes: "Updated notes",
      startDate: nextStart,
      endDate: nextEnd,
      alarms: [{ relativeOffset: -45 }],
    });

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const outcome = await result.current.refreshPlanFromCalendar(plan);
      expect(outcome).toBe("updated");
    });

    const updated = useSessionStore.getState().plans[0];
    expect(updated.title).toBe("New Plan Title");
    expect(updated.notes).toBe("Updated notes");
    expect(updated.startDate).toBe(nextStart.toISOString());
    expect(updated.endDate).toBe(nextEnd.toISOString());
    expect(updated.reminderMinutes).toBe(45);
  });

  it("refreshPlanFromCalendar clears link when calendar event is missing", async () => {
    const plan = makePlan({
      id: "plan-refresh-missing",
      calendarEventId: "missing-event",
    });
    useSessionStore.setState({ plans: [plan] });
    calendarApi.getCalendarEvent.mockResolvedValueOnce(null);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const outcome = await result.current.refreshPlanFromCalendar(plan);
      expect(outcome).toBe("cleared");
    });

    expect(useSessionStore.getState().plans[0].calendarEventId).toBeUndefined();
  });

  it("refreshAllFromCalendar returns aggregated update and cleared counts", async () => {
    const sessions = [
      makeSession({
        id: "s-refresh-1",
        startTime: 1741636800000,
        endTime: 1741640400000,
        duration: 3600,
        calendarEventId: "event-s-refresh-1",
      }),
      makeSession({ id: "s-refresh-2", calendarEventId: "event-s-refresh-2" }),
      makeSession({ id: "s-refresh-3", calendarEventId: undefined }),
    ];
    const plans = [
      makePlan({ id: "p-refresh-1", calendarEventId: "event-p-refresh-1" }),
      makePlan({ id: "p-refresh-2", calendarEventId: "event-p-refresh-2" }),
      makePlan({ id: "p-refresh-3", calendarEventId: undefined }),
    ];
    useSessionStore.setState({ sessions, plans });

    calendarApi.getCalendarEvent
      .mockResolvedValueOnce({
        id: "event-s-refresh-1",
        startDate: new Date("2025-03-12T01:00:00.000Z"),
        endDate: new Date("2025-03-12T03:00:00.000Z"),
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "event-p-refresh-1",
        title: "🔭 P Refresh",
        notes: "",
        startDate: new Date("2025-04-12T01:00:00.000Z"),
        endDate: new Date("2025-04-12T02:30:00.000Z"),
        alarms: [],
      })
      .mockResolvedValueOnce(null);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.refreshAllFromCalendar(sessions, plans);
      expect(summary).toEqual({
        sessionsUpdated: 1,
        plansUpdated: 1,
        sessionsCleared: 1,
        plansCleared: 1,
        errors: 0,
      });
    });

    const state = useSessionStore.getState();
    expect(state.sessions.find((s) => s.id === "s-refresh-2")?.calendarEventId).toBeUndefined();
    expect(state.plans.find((p) => p.id === "p-refresh-2")?.calendarEventId).toBeUndefined();
  });

  it("syncObservationPlan returns false when plan does not exist", async () => {
    const { result } = renderHook(() => useCalendar());

    await act(async () => {
      const ok = await result.current.syncObservationPlan("missing-plan-id");
      expect(ok).toBe(false);
    });
    expect(calendarApi.createPlanEvent).not.toHaveBeenCalled();
  });

  it("createObservationPlan saves locally when permission is denied", async () => {
    calendarApi.checkCalendarPermission.mockResolvedValueOnce(false);
    calendarApi.requestCalendarPermission.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.createObservationPlan({
        title: "Local Plan",
        targetName: "M31",
        startDate: "2025-03-20T20:00:00.000Z",
        endDate: "2025-03-20T22:00:00.000Z",
        reminderMinutes: 30,
      });
      expect(ok).toBe(true);
    });

    expect(calendarApi.createPlanEvent).not.toHaveBeenCalled();
    expect(useSessionStore.getState().plans).toHaveLength(1);
    expect(useSessionStore.getState().plans[0].calendarEventId).toBeUndefined();
    expect(useSessionStore.getState().plans[0].title).toBe("Local Plan");
  });

  it("create*ViaSystemCalendar bypasses permission precheck and keeps Android no-id unlinked", async () => {
    const session = makeSession({ id: "s-system" });
    const plan = makePlan({ id: "p-system" });
    useSessionStore.setState({ sessions: [session], plans: [plan] });

    calendarApi.checkCalendarPermission.mockResolvedValue(false);
    calendarApi.requestCalendarPermission.mockResolvedValue(false);
    calendarApi.createEventViaSystemUI
      .mockResolvedValueOnce({ action: "done", id: null })
      .mockResolvedValueOnce({ action: "saved", id: "event-plan-created" });

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const sessionOk = await result.current.createSessionViaSystemCalendar(session);
      const planOk = await result.current.createPlanViaSystemCalendar(plan);
      expect(sessionOk).toBe(true);
      expect(planOk).toBe(true);
    });

    expect(calendarApi.createEventViaSystemUI).toHaveBeenCalledTimes(2);
    expect(useSessionStore.getState().sessions[0].calendarEventId).toBeUndefined();
    expect(useSessionStore.getState().plans[0].calendarEventId).toBe("event-plan-created");
  });

  it("unsyncObservationPlan removes calendar link locally", async () => {
    const plan = makePlan({ id: "plan-unsync", calendarEventId: "event-plan-unsync" });
    useSessionStore.setState({ plans: [plan] });
    calendarApi.deleteCalendarEvent.mockResolvedValue(undefined);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.unsyncObservationPlan(plan.id);
      expect(ok).toBe(true);
    });

    expect(calendarApi.deleteCalendarEvent).toHaveBeenCalledWith("event-plan-unsync");
    expect(useSessionStore.getState().plans[0].calendarEventId).toBeUndefined();
  });

  it("unsyncObservationPlansBatch returns success/skipped/failed summary", async () => {
    const plans = [
      makePlan({ id: "plan-unsync-1", calendarEventId: "event-unsync-1" }),
      makePlan({ id: "plan-unsync-2", calendarEventId: undefined }),
      makePlan({ id: "plan-unsync-3", calendarEventId: "event-unsync-3" }),
    ];
    useSessionStore.setState({ plans });
    calendarApi.deleteCalendarEvent
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("delete failed"));

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.unsyncObservationPlansBatch(plans);
      expect(summary).toEqual({
        total: 3,
        success: 1,
        skipped: 1,
        failed: 1,
      });
    });

    const statePlans = useSessionStore.getState().plans;
    expect(statePlans.find((p) => p.id === "plan-unsync-1")?.calendarEventId).toBeUndefined();
    expect(statePlans.find((p) => p.id === "plan-unsync-2")?.calendarEventId).toBeUndefined();
    expect(statePlans.find((p) => p.id === "plan-unsync-3")?.calendarEventId).toBeUndefined();
  });

  it("editSessionInCalendar refreshes local session when action is done", async () => {
    const session = makeSession({
      id: "session-done-refresh",
      date: "2025-04-01",
      startTime: new Date("2025-04-01T01:00:00.000Z").getTime(),
      endTime: new Date("2025-04-01T02:00:00.000Z").getTime(),
      duration: 3600,
      calendarEventId: "event-session-done",
    });
    useSessionStore.setState({ sessions: [session] });

    calendarApi.editEventInSystemCalendar.mockResolvedValueOnce({ action: "done" });
    calendarApi.getCalendarEvent.mockResolvedValueOnce({
      id: "event-session-done",
      startDate: new Date("2025-04-01T03:00:00.000Z"),
      endDate: new Date("2025-04-01T05:00:00.000Z"),
    });

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.editSessionInCalendar(session);
      expect(ok).toBe(true);
    });

    expect(calendarApi.getCalendarEvent).toHaveBeenCalledWith("event-session-done");
    const updated = useSessionStore.getState().sessions[0];
    expect(updated.duration).toBe(7200);
    expect(updated.date).toBe("2025-04-01");
  });

  it("editPlanInCalendar refreshes local plan when action is done", async () => {
    const plan = makePlan({
      id: "plan-done-refresh",
      title: "Old Plan",
      calendarEventId: "event-plan-done",
    });
    useSessionStore.setState({ plans: [plan] });

    calendarApi.editEventInSystemCalendar.mockResolvedValueOnce({ action: "done" });
    calendarApi.getCalendarEvent.mockResolvedValueOnce({
      id: "event-plan-done",
      title: "🔭 Refreshed Plan",
      notes: "from system calendar",
      startDate: new Date("2025-05-01T02:00:00.000Z"),
      endDate: new Date("2025-05-01T04:00:00.000Z"),
      alarms: [{ relativeOffset: -20 }],
    });

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const ok = await result.current.editPlanInCalendar(plan);
      expect(ok).toBe(true);
    });

    expect(calendarApi.getCalendarEvent).toHaveBeenCalledWith("event-plan-done");
    const updated = useSessionStore.getState().plans[0];
    expect(updated.title).toBe("Refreshed Plan");
    expect(updated.reminderMinutes).toBe(20);
  });

  it("syncSessionsBatch returns summary counts", async () => {
    const sessions = [
      makeSession({ id: "s1", calendarEventId: undefined }),
      makeSession({ id: "s2", calendarEventId: "event-existing" }),
      makeSession({ id: "s3", calendarEventId: undefined }),
    ];
    useSessionStore.setState({ sessions });
    calendarApi.syncSessionToCalendar.mockResolvedValueOnce("event-s1");
    calendarApi.syncSessionToCalendar.mockRejectedValueOnce(new Error("sync failed"));

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.syncSessionsBatch(sessions);
      expect(summary).toEqual({
        total: 3,
        success: 1,
        skipped: 1,
        failed: 1,
      });
    });

    expect(
      useSessionStore.getState().sessions.find((session) => session.id === "s1")?.calendarEventId,
    ).toBe("event-s1");
    expect(calendarApi.syncSessionToCalendar).toHaveBeenCalledTimes(2);
  });

  it("syncAllSessions keeps legacy success-count return", async () => {
    const sessions = [
      makeSession({ id: "s1", calendarEventId: undefined }),
      makeSession({ id: "s2", calendarEventId: undefined }),
    ];
    useSessionStore.setState({ sessions });
    calendarApi.syncSessionToCalendar.mockResolvedValueOnce("event-s1");
    calendarApi.syncSessionToCalendar.mockRejectedValueOnce(new Error("sync failed"));

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const count = await result.current.syncAllSessions(sessions);
      expect(count).toBe(1);
    });
  });

  it("syncSessionsBatch reports permission denied", async () => {
    const sessions = [makeSession({ id: "s1", calendarEventId: undefined })];
    calendarApi.checkCalendarPermission.mockResolvedValueOnce(false);
    calendarApi.requestCalendarPermission.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.syncSessionsBatch(sessions);
      expect(summary).toEqual({
        total: 1,
        success: 0,
        skipped: 0,
        failed: 0,
        permissionDenied: true,
      });
    });
    expect(calendarApi.syncSessionToCalendar).not.toHaveBeenCalled();
  });

  it("unsyncSessionsBatch returns success/skipped/failed summary", async () => {
    const sessions = [
      makeSession({ id: "s1", calendarEventId: "event-s1" }),
      makeSession({ id: "s2", calendarEventId: undefined }),
      makeSession({ id: "s3", calendarEventId: "event-s3" }),
    ];
    useSessionStore.setState({ sessions });
    calendarApi.deleteCalendarEvent.mockResolvedValueOnce(undefined);
    calendarApi.deleteCalendarEvent.mockRejectedValueOnce(new Error("cannot delete"));

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.unsyncSessionsBatch(sessions);
      expect(summary).toEqual({
        total: 3,
        success: 1,
        skipped: 1,
        failed: 1,
      });
    });

    const state = useSessionStore.getState();
    expect(state.sessions.find((session) => session.id === "s1")?.calendarEventId).toBeUndefined();
    expect(state.sessions.find((session) => session.id === "s3")?.calendarEventId).toBeUndefined();
  });

  it("refreshSessionsBatch returns detailed summary", async () => {
    const unchangedStart = new Date("2025-06-01T01:00:00.000Z").getTime();
    const unchangedEnd = new Date("2025-06-01T02:00:00.000Z").getTime();
    const sessions = [
      makeSession({
        id: "s-updated",
        date: "2025-06-01",
        startTime: unchangedStart,
        endTime: unchangedEnd,
        duration: 3600,
        calendarEventId: "event-updated",
      }),
      makeSession({ id: "s-cleared", calendarEventId: "event-cleared" }),
      makeSession({ id: "s-skipped", calendarEventId: undefined }),
      makeSession({
        id: "s-unchanged",
        date: "2025-06-01",
        startTime: unchangedStart,
        endTime: unchangedEnd,
        duration: 3600,
        calendarEventId: "event-unchanged",
      }),
      makeSession({ id: "s-error", calendarEventId: "event-error" }),
    ];
    useSessionStore.setState({ sessions });

    calendarApi.getCalendarEvent
      .mockResolvedValueOnce({
        id: "event-updated",
        startDate: new Date("2025-06-01T03:00:00.000Z"),
        endDate: new Date("2025-06-01T04:30:00.000Z"),
      })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "event-unchanged",
        startDate: new Date(unchangedStart),
        endDate: new Date(unchangedEnd),
      })
      .mockRejectedValueOnce(new Error("event lookup failed"));

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.refreshSessionsBatch(sessions);
      expect(summary).toEqual({
        total: 5,
        updated: 1,
        cleared: 1,
        unchanged: 1,
        skipped: 1,
        errors: 1,
      });
    });
  });

  it("refreshSessionsBatch reports permission denied", async () => {
    const sessions = [makeSession({ id: "s1", calendarEventId: "event-s1" })];
    calendarApi.checkCalendarPermission.mockResolvedValueOnce(false);
    calendarApi.requestCalendarPermission.mockResolvedValueOnce(false);

    const { result } = renderHook(() => useCalendar());
    await act(async () => {
      const summary = await result.current.refreshSessionsBatch(sessions);
      expect(summary).toEqual({
        total: 1,
        updated: 0,
        cleared: 0,
        unchanged: 0,
        skipped: 0,
        errors: 0,
        permissionDenied: true,
      });
    });
    expect(calendarApi.getCalendarEvent).not.toHaveBeenCalled();
  });
});
