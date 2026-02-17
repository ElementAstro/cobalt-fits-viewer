import { act, renderHook } from "@testing-library/react-native";
import { useCalendar } from "../useCalendar";
import { useSessionStore } from "../../stores/useSessionStore";
import type { ObservationPlan, ObservationSession } from "../../lib/fits/types";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: { defaultReminderMinutes: number }) => unknown) =>
    selector({ defaultReminderMinutes: 30 }),
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

jest.mock("../../lib/calendar", () => ({
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

jest.mock("../../lib/logger", () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const calendarApi = jest.requireMock("../../lib/calendar") as {
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
  targets: ["M42"],
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
});
