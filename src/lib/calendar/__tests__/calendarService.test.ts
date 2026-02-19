import type { ObservationPlan, ObservationSession } from "../../fits/types";

const mockCalendar = {
  requestCalendarPermissionsAsync: jest.fn(),
  getCalendarPermissionsAsync: jest.fn(),
  isAvailableAsync: jest.fn(),
  getCalendarsAsync: jest.fn(),
  getDefaultCalendarAsync: jest.fn(),
  createCalendarAsync: jest.fn(),
  createEventAsync: jest.fn(),
  updateEventAsync: jest.fn(),
  getEventAsync: jest.fn(),
  deleteEventAsync: jest.fn(),
  openEventInCalendarAsync: jest.fn(),
  editEventInCalendarAsync: jest.fn(),
  createEventInCalendarAsync: jest.fn(),
  EntityTypes: { EVENT: "event" },
  CalendarAccessLevel: { OWNER: "owner" },
};

const mockPlatform = { OS: "ios" };

function loadCalendarService() {
  jest.resetModules();
  jest.doMock("expo-calendar", () => ({
    __esModule: true,
    ...mockCalendar,
    default: mockCalendar,
  }));
  jest.doMock("react-native", () => ({
    Platform: mockPlatform,
  }));

  return require("../calendarService") as {
    requestCalendarPermission: () => Promise<boolean>;
    checkCalendarPermission: () => Promise<boolean>;
    isCalendarAvailable: () => Promise<boolean>;
    getOrCreateAppCalendar: () => Promise<string>;
    buildPlanEventDetails: (plan: ObservationPlan) => Record<string, unknown>;
    buildSessionEventDetails: (
      session: ObservationSession,
      reminder: number,
    ) => Record<string, unknown>;
    syncSessionToCalendar: (session: ObservationSession, reminder: number) => Promise<string>;
    createPlanEvent: (plan: ObservationPlan) => Promise<string>;
    updatePlanEvent: (eventId: string, plan: ObservationPlan) => Promise<void>;
    getCalendarEvent: (eventId: string) => Promise<unknown>;
    editEventInSystemCalendar: (eventId: string) => Promise<unknown>;
    openEventInSystemCalendar: (eventId: string) => Promise<void>;
    createEventViaSystemUI: (eventData?: unknown, opts?: unknown) => Promise<unknown>;
    deleteCalendarEvent: (eventId: string) => Promise<void>;
  };
}

const plan: ObservationPlan = {
  id: "p1",
  title: "Plan A",
  targetName: "M42",
  startDate: "2024-01-01T20:00:00.000Z",
  endDate: "2024-01-01T22:00:00.000Z",
  reminderMinutes: 30,
  location: { latitude: 10, longitude: 20, city: "Tokyo" },
  createdAt: 1,
};

const session: ObservationSession = {
  id: "s1",
  date: "2024-01-01",
  startTime: new Date("2024-01-01T20:00:00.000Z").getTime(),
  endTime: new Date("2024-01-01T22:00:00.000Z").getTime(),
  duration: 7200,
  targetRefs: [{ name: "M42" }],
  imageIds: ["f1", "f2"],
  equipment: { telescope: "RC8", camera: "ASI2600", filters: ["Ha"] },
  notes: "clear sky",
  createdAt: 1,
};

describe("calendarService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlatform.OS = "ios";
    if (!mockCalendar.editEventInCalendarAsync) {
      mockCalendar.editEventInCalendarAsync = jest.fn();
    }
  });

  it("checks availability and permission state", async () => {
    const mod = loadCalendarService();
    mockCalendar.requestCalendarPermissionsAsync.mockResolvedValue({ status: "granted" });
    mockCalendar.getCalendarPermissionsAsync.mockResolvedValue({ status: "denied" });
    mockCalendar.isAvailableAsync.mockResolvedValue(true);

    await expect(mod.requestCalendarPermission()).resolves.toBe(true);
    await expect(mod.checkCalendarPermission()).resolves.toBe(false);
    await expect(mod.isCalendarAvailable()).resolves.toBe(true);
  });

  it("returns existing app calendar or creates one by platform", async () => {
    const mod = loadCalendarService();
    mockCalendar.getCalendarsAsync.mockResolvedValue([
      { id: "cal-1", title: "Cobalt Observations" },
    ]);
    await expect(mod.getOrCreateAppCalendar()).resolves.toBe("cal-1");

    mockCalendar.getCalendarsAsync.mockResolvedValue([]);
    mockCalendar.getDefaultCalendarAsync.mockResolvedValue({
      source: { id: "src-ios", type: "caldav" },
    });
    mockCalendar.createCalendarAsync.mockResolvedValue("new-ios");
    await expect(mod.getOrCreateAppCalendar()).resolves.toBe("new-ios");

    mockPlatform.OS = "android";
    mockCalendar.createCalendarAsync.mockResolvedValue("new-android");
    await expect(mod.getOrCreateAppCalendar()).resolves.toBe("new-android");
  });

  it("builds plan and session event details", () => {
    const mod = loadCalendarService();
    const planDetails = mod.buildPlanEventDetails(plan);
    expect(planDetails.title).toBe("🔭 Plan A");
    expect(planDetails.location).toBe("10.0000, 20.0000");
    expect(planDetails.alarms).toEqual([{ relativeOffset: -30 }]);

    const sessionDetails = mod.buildSessionEventDetails(session, 15);
    expect(sessionDetails.title).toContain("M42");
    expect(sessionDetails.notes).toContain("Duration: 2h 0m");
    expect(sessionDetails.notes).toContain("Images: 2");
    expect(sessionDetails.alarms).toEqual([{ relativeOffset: -15 }]);
  });

  it("creates/updates/deletes and opens events", async () => {
    const mod = loadCalendarService();
    mockCalendar.getCalendarsAsync.mockResolvedValue([
      { id: "cal-1", title: "Cobalt Observations" },
    ]);
    mockCalendar.createEventAsync.mockResolvedValue("event-1");
    mockCalendar.updateEventAsync.mockResolvedValue(undefined);
    mockCalendar.getEventAsync.mockResolvedValue({ id: "event-1" });
    mockCalendar.editEventInCalendarAsync.mockResolvedValue({ action: "saved" });
    mockCalendar.createEventInCalendarAsync.mockResolvedValue(undefined);
    mockCalendar.openEventInCalendarAsync.mockResolvedValue(undefined);

    await expect(mod.syncSessionToCalendar(session, 5)).resolves.toBe("event-1");
    await expect(mod.createPlanEvent(plan)).resolves.toBe("event-1");
    await expect(mod.updatePlanEvent("event-1", plan)).resolves.toBeUndefined();
    await expect(mod.getCalendarEvent("event-1")).resolves.toEqual({ id: "event-1" });
    await expect(mod.editEventInSystemCalendar("event-1")).resolves.toEqual({ action: "saved" });
    await expect(mod.openEventInSystemCalendar("event-1")).resolves.toBeUndefined();
    await expect(
      mod.createEventViaSystemUI({ title: "x" }, { allowsEditing: true }),
    ).resolves.toBeUndefined();

    mockCalendar.getEventAsync.mockRejectedValue(new Error("missing"));
    await expect(mod.getCalendarEvent("missing")).resolves.toBeNull();

    mockCalendar.deleteEventAsync.mockRejectedValue(new Error("already deleted"));
    await expect(mod.deleteCalendarEvent("missing")).resolves.toBeUndefined();
  });

  it("falls back to open event flow when edit API is unavailable", async () => {
    delete (mockCalendar as { editEventInCalendarAsync?: jest.Mock }).editEventInCalendarAsync;
    const mod = loadCalendarService();
    mockCalendar.openEventInCalendarAsync.mockResolvedValue(undefined);

    await expect(mod.editEventInSystemCalendar("event-opened")).resolves.toEqual({
      action: "opened",
      id: "event-opened",
    });
    expect(mockCalendar.openEventInCalendarAsync).toHaveBeenCalledWith({ id: "event-opened" });
  });
});
