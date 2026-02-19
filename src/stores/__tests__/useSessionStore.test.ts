import { useSessionStore } from "../useSessionStore";
import { useFitsStore } from "../useFitsStore";
import type {
  ObservationSession,
  ObservationLogEntry,
  ObservationPlan,
} from "../../lib/fits/types";

// Mock storage
jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeSession = (overrides: Partial<ObservationSession> = {}): ObservationSession => ({
  id: `session-${Math.random().toString(36).slice(2, 8)}`,
  date: "2025-01-15",
  startTime: Date.now() - 7200000,
  endTime: Date.now(),
  duration: 7200,
  targetRefs: [{ name: "M42" }],
  imageIds: ["img-1", "img-2"],
  equipment: { telescope: "200P", camera: "ASI294" },
  createdAt: Date.now(),
  ...overrides,
});

const makeLogEntry = (overrides: Partial<ObservationLogEntry> = {}): ObservationLogEntry => ({
  id: `log-${Math.random().toString(36).slice(2, 8)}`,
  sessionId: "session-1",
  imageId: "img-1",
  dateTime: new Date().toISOString(),
  object: "M42",
  filter: "L",
  exptime: 300,
  ...overrides,
});

const makePlan = (overrides: Partial<ObservationPlan> = {}): ObservationPlan => ({
  id: `plan-${Math.random().toString(36).slice(2, 8)}`,
  title: "Test Plan",
  targetName: "M42",
  startDate: new Date().toISOString(),
  endDate: new Date(Date.now() + 14400000).toISOString(),
  reminderMinutes: 30,
  createdAt: Date.now(),
  ...overrides,
});

const makeFitsFile = (id: string, sessionId?: string) => ({
  id,
  filename: `${id}.fits`,
  filepath: `file:///document/fits_files/${id}.fits`,
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  sessionId,
});

describe("useSessionStore", () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessions: [],
      logEntries: [],
      plans: [],
      activeSession: null,
    });
    useFitsStore.setState({
      files: [],
    });
  });

  // ===== Session CRUD =====

  describe("session CRUD", () => {
    it("adds a session", () => {
      const s = makeSession({ id: "s1" });
      useSessionStore.getState().addSession(s);
      expect(useSessionStore.getState().sessions).toHaveLength(1);
      expect(useSessionStore.getState().sessions[0].id).toBe("s1");
    });

    it("addSession supports legacy targets and normalizes imageIds", () => {
      useSessionStore.getState().addSession({
        ...makeSession({ id: "legacy-add" }),
        targetRefs: undefined,
        targets: ["M42", "M42", "M31"],
        imageIds: ["img-1", "img-1", "img-2"],
      } as unknown as ObservationSession);

      const added = useSessionStore.getState().sessions[0];
      expect(added.targetRefs).toEqual([{ name: "M42" }, { name: "M31" }]);
      expect(added.imageIds).toEqual(["img-1", "img-2"]);
      expect((added as unknown as { targets?: string[] }).targets).toBeUndefined();
    });

    it("removes a session and its log entries", () => {
      useSessionStore.setState({
        sessions: [makeSession({ id: "s1" }), makeSession({ id: "s2" })],
        logEntries: [
          makeLogEntry({ id: "l1", sessionId: "s1" }),
          makeLogEntry({ id: "l2", sessionId: "s1" }),
          makeLogEntry({ id: "l3", sessionId: "s2" }),
        ],
      });

      useSessionStore.getState().removeSession("s1");
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe("s2");
      expect(state.logEntries).toHaveLength(1);
      expect(state.logEntries[0].sessionId).toBe("s2");
    });

    it("removeSession clears linked file sessionId", () => {
      useSessionStore.setState({
        sessions: [makeSession({ id: "s1" }), makeSession({ id: "s2" })],
      });
      useFitsStore.setState({
        files: [makeFitsFile("f1", "s1"), makeFitsFile("f2", "s2")],
      });

      useSessionStore.getState().removeSession("s1");
      const files = useFitsStore.getState().files;
      expect(files.find((file) => file.id === "f1")?.sessionId).toBeUndefined();
      expect(files.find((file) => file.id === "f2")?.sessionId).toBe("s2");
    });

    it("updates a session partially", () => {
      useSessionStore.setState({ sessions: [makeSession({ id: "s1", notes: "old" })] });
      useSessionStore.getState().updateSession("s1", { notes: "new note", weather: "clear" });
      const s = useSessionStore.getState().sessions[0];
      expect(s.notes).toBe("new note");
      expect(s.weather).toBe("clear");
      expect(s.id).toBe("s1");
    });

    it("updateSession supports legacy targets and normalization", () => {
      useSessionStore.setState({
        sessions: [makeSession({ id: "s1", targetRefs: [{ name: "M42" }], imageIds: ["img-1"] })],
      });

      useSessionStore.getState().updateSession("s1", {
        targets: ["M42", "M31", "M31"],
        imageIds: ["img-1", "img-2", "img-2"],
      });
      const updated = useSessionStore.getState().sessions[0];
      expect(updated.targetRefs).toEqual([{ name: "M42" }, { name: "M31" }]);
      expect(updated.imageIds).toEqual(["img-1", "img-2"]);
      expect((updated as unknown as { targets?: string[] }).targets).toBeUndefined();
    });

    it("update on non-existent session is no-op", () => {
      useSessionStore.setState({ sessions: [makeSession({ id: "s1" })] });
      useSessionStore.getState().updateSession("not-exist", { notes: "x" });
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });
  });

  // ===== Batch Operations =====

  describe("batch operations", () => {
    it("removeMultipleSessions removes matching sessions and their log entries", () => {
      useSessionStore.setState({
        sessions: [makeSession({ id: "s1" }), makeSession({ id: "s2" }), makeSession({ id: "s3" })],
        logEntries: [
          makeLogEntry({ id: "l1", sessionId: "s1" }),
          makeLogEntry({ id: "l2", sessionId: "s2" }),
          makeLogEntry({ id: "l3", sessionId: "s3" }),
        ],
      });

      useSessionStore.getState().removeMultipleSessions(["s1", "s3"]);
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe("s2");
      expect(state.logEntries).toHaveLength(1);
      expect(state.logEntries[0].sessionId).toBe("s2");
    });

    it("removeMultipleSessions with empty array is no-op", () => {
      useSessionStore.setState({ sessions: [makeSession({ id: "s1" })] });
      useSessionStore.getState().removeMultipleSessions([]);
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });

    it("clearAllSessions empties sessions and logEntries", () => {
      useSessionStore.setState({
        sessions: [makeSession(), makeSession()],
        logEntries: [makeLogEntry(), makeLogEntry()],
        plans: [makePlan()],
      });

      useSessionStore.getState().clearAllSessions();
      const state = useSessionStore.getState();
      expect(state.sessions).toHaveLength(0);
      expect(state.logEntries).toHaveLength(0);
      expect(state.plans).toHaveLength(1); // plans should not be cleared
    });
  });

  // ===== Merge Sessions =====

  describe("mergeSessions", () => {
    it("merges two sessions into one combined session", () => {
      const s1 = makeSession({
        id: "s1",
        date: "2025-01-15",
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        targetRefs: [{ name: "M42" }],
        imageIds: ["img-1"],
      });
      const s2 = makeSession({
        id: "s2",
        date: "2025-01-15",
        startTime: 2500,
        endTime: 4000,
        duration: 1500,
        targetRefs: [{ name: "M42" }, { name: "M31" }],
        imageIds: ["img-2"],
      });
      useSessionStore.setState({ sessions: [s1, s2] });

      useSessionStore.getState().mergeSessions(["s1", "s2"]);
      const sessions = useSessionStore.getState().sessions;
      expect(sessions).toHaveLength(1);
      expect(sessions[0].startTime).toBe(1000);
      expect(sessions[0].endTime).toBe(4000);
      expect(sessions[0].imageIds).toContain("img-1");
      expect(sessions[0].imageIds).toContain("img-2");
      expect(sessions[0].targetRefs).toEqual(
        expect.arrayContaining([{ name: "M42" }, { name: "M31" }]),
      );
    });

    it("mergeSessions de-duplicates targetRefs and imageIds", () => {
      const s1 = makeSession({
        id: "s1",
        startTime: 1000,
        endTime: 2000,
        duration: 1000,
        targetRefs: [{ name: "M42" }, { name: "M42" }],
        imageIds: ["img-1", "img-1"],
      });
      const s2 = makeSession({
        id: "s2",
        startTime: 2100,
        endTime: 2600,
        duration: 500,
        targetRefs: [{ name: "M42" }, { name: "M31" }],
        imageIds: ["img-1", "img-2"],
      });

      useSessionStore.setState({ sessions: [s1, s2] });
      useSessionStore.getState().mergeSessions(["s1", "s2"]);

      const merged = useSessionStore.getState().sessions[0];
      expect(merged.targetRefs).toEqual([{ name: "M42" }, { name: "M31" }]);
      expect(merged.imageIds).toEqual(["img-1", "img-2"]);
    });

    it("does nothing if less than 2 session IDs given", () => {
      useSessionStore.setState({ sessions: [makeSession({ id: "s1" })] });
      useSessionStore.getState().mergeSessions(["s1"]);
      expect(useSessionStore.getState().sessions).toHaveLength(1);
    });
  });

  // ===== Log Entries =====

  describe("log entries", () => {
    it("adds a single log entry", () => {
      const entry = makeLogEntry({ id: "l1" });
      useSessionStore.getState().addLogEntry(entry);
      expect(useSessionStore.getState().logEntries).toHaveLength(1);
    });

    it("adds multiple log entries at once", () => {
      const entries = [makeLogEntry({ id: "l1" }), makeLogEntry({ id: "l2" })];
      useSessionStore.getState().addLogEntries(entries);
      expect(useSessionStore.getState().logEntries).toHaveLength(2);
    });

    it("updates a log entry", () => {
      useSessionStore.setState({ logEntries: [makeLogEntry({ id: "l1", object: "M42" })] });
      useSessionStore.getState().updateLogEntry("l1", { object: "M31" });
      expect(useSessionStore.getState().logEntries[0].object).toBe("M31");
    });

    it("removes a log entry", () => {
      useSessionStore.setState({
        logEntries: [makeLogEntry({ id: "l1" }), makeLogEntry({ id: "l2" })],
      });
      useSessionStore.getState().removeLogEntry("l1");
      expect(useSessionStore.getState().logEntries).toHaveLength(1);
      expect(useSessionStore.getState().logEntries[0].id).toBe("l2");
    });
  });

  // ===== Plans =====

  describe("plan management", () => {
    it("adds a plan", () => {
      const plan = makePlan({ id: "p1" });
      useSessionStore.getState().addPlan(plan);
      expect(useSessionStore.getState().plans).toHaveLength(1);
      expect(useSessionStore.getState().plans[0].id).toBe("p1");
    });

    it("updates a plan", () => {
      useSessionStore.setState({ plans: [makePlan({ id: "p1", title: "Old" })] });
      useSessionStore.getState().updatePlan("p1", { title: "New Title" });
      expect(useSessionStore.getState().plans[0].title).toBe("New Title");
    });

    it("removes a plan", () => {
      useSessionStore.setState({
        plans: [makePlan({ id: "p1" }), makePlan({ id: "p2" })],
      });
      useSessionStore.getState().removePlan("p1");
      expect(useSessionStore.getState().plans).toHaveLength(1);
      expect(useSessionStore.getState().plans[0].id).toBe("p2");
    });

    it("getPlannedDates returns correct day numbers for given month", () => {
      const startDate1 = new Date(2025, 5, 10, 20, 0).toISOString();
      const startDate2 = new Date(2025, 5, 22, 21, 0).toISOString();
      const startDate3 = new Date(2025, 6, 1, 20, 0).toISOString(); // different month
      useSessionStore.setState({
        plans: [
          makePlan({ id: "p1", startDate: startDate1 }),
          makePlan({ id: "p2", startDate: startDate2 }),
          makePlan({ id: "p3", startDate: startDate3 }),
        ],
      });

      const dates = useSessionStore.getState().getPlannedDates(2025, 5);
      expect(dates).toHaveLength(2);
      expect(dates).toContain(10);
      expect(dates).toContain(22);
    });
  });

  // ===== Getters =====

  describe("getters", () => {
    beforeEach(() => {
      useSessionStore.setState({
        sessions: [
          makeSession({ id: "s1", date: "2025-01-15" }),
          makeSession({ id: "s2", date: "2025-01-15" }),
          makeSession({ id: "s3", date: "2025-02-10" }),
        ],
        logEntries: [
          makeLogEntry({ id: "l1", sessionId: "s1" }),
          makeLogEntry({ id: "l2", sessionId: "s1" }),
          makeLogEntry({ id: "l3", sessionId: "s2" }),
        ],
      });
    });

    it("getSessionById finds a session", () => {
      expect(useSessionStore.getState().getSessionById("s1")?.id).toBe("s1");
      expect(useSessionStore.getState().getSessionById("not-exist")).toBeUndefined();
    });

    it("getSessionsByDate returns sessions for a date", () => {
      const jan15 = useSessionStore.getState().getSessionsByDate("2025-01-15");
      expect(jan15).toHaveLength(2);
      const feb10 = useSessionStore.getState().getSessionsByDate("2025-02-10");
      expect(feb10).toHaveLength(1);
    });

    it("getLogEntriesBySession returns entries for a session", () => {
      const entries = useSessionStore.getState().getLogEntriesBySession("s1");
      expect(entries).toHaveLength(2);
    });

    it("getDatesWithSessions returns unique dates", () => {
      const dates = useSessionStore.getState().getDatesWithSessions();
      expect(dates).toHaveLength(2);
      expect(dates).toContain("2025-01-15");
      expect(dates).toContain("2025-02-10");
    });
  });

  // ===== Live Session =====

  describe("live session tracking", () => {
    it("starts a live session", () => {
      useSessionStore.getState().startLiveSession();
      const active = useSessionStore.getState().activeSession;
      expect(active).not.toBeNull();
      expect(active!.status).toBe("running");
      expect(active!.id).toMatch(/^live-/);
      expect(active!.notes).toHaveLength(0);
      expect(active!.totalPausedMs).toBe(0);
    });

    it("pauses a live session", () => {
      useSessionStore.getState().startLiveSession();
      useSessionStore.getState().pauseLiveSession();
      const active = useSessionStore.getState().activeSession;
      expect(active!.status).toBe("paused");
      expect(active!.pausedAt).toBeDefined();
    });

    it("pause when no active session is safe (null)", () => {
      useSessionStore.getState().pauseLiveSession();
      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    it("resumes a paused session and accumulates paused time", () => {
      useSessionStore.getState().startLiveSession();

      // Simulate pause for ~100ms
      const beforePause = Date.now();
      useSessionStore.setState((state) => ({
        activeSession: state.activeSession
          ? { ...state.activeSession, status: "paused", pausedAt: beforePause - 500 }
          : null,
      }));

      useSessionStore.getState().resumeLiveSession();
      const active = useSessionStore.getState().activeSession;
      expect(active!.status).toBe("running");
      expect(active!.pausedAt).toBeUndefined();
      expect(active!.totalPausedMs).toBeGreaterThanOrEqual(500);
    });

    it("resume when not paused is no-op", () => {
      useSessionStore.getState().startLiveSession();
      const before = useSessionStore.getState().activeSession;
      useSessionStore.getState().resumeLiveSession();
      const after = useSessionStore.getState().activeSession;
      expect(after!.totalPausedMs).toBe(before!.totalPausedMs);
    });

    it("adds notes to active session", () => {
      useSessionStore.getState().startLiveSession();
      useSessionStore.getState().addActiveNote("Focus adjusted");
      useSessionStore.getState().addActiveNote("Cloud passing");
      const active = useSessionStore.getState().activeSession;
      expect(active!.notes).toHaveLength(2);
      expect(active!.notes[0].text).toBe("Focus adjusted");
      expect(active!.notes[1].text).toBe("Cloud passing");
      expect(active!.notes[0].timestamp).toBeLessThanOrEqual(active!.notes[1].timestamp);
    });

    it("addActiveNote when no session is safe (null)", () => {
      useSessionStore.getState().addActiveNote("test");
      expect(useSessionStore.getState().activeSession).toBeNull();
    });

    it("ends a live session and creates an ObservationSession", () => {
      const startTime = Date.now() - 5000;
      useSessionStore.setState({
        activeSession: {
          id: "live-test",
          startedAt: startTime,
          totalPausedMs: 1000,
          notes: [{ timestamp: startTime + 1000, text: "note1" }],
          status: "running",
        },
      });

      const result = useSessionStore.getState().endLiveSession();
      expect(result).not.toBeNull();
      expect(result!.id).toBe("live-test");
      expect(result!.startTime).toBe(startTime);
      expect(result!.duration).toBeGreaterThan(0);
      expect(result!.notes).toContain("note1");
      expect(result!.createdAt).toBeDefined();

      // activeSession should be cleared
      expect(useSessionStore.getState().activeSession).toBeNull();
      // session added to sessions list
      expect(useSessionStore.getState().sessions).toHaveLength(1);
      expect(useSessionStore.getState().sessions[0].id).toBe("live-test");
    });

    it("endLiveSession returns null when no active session", () => {
      const result = useSessionStore.getState().endLiveSession();
      expect(result).toBeNull();
    });

    it("endLiveSession with paused session accounts for final paused time", () => {
      const startTime = Date.now() - 10000;
      const pausedAt = Date.now() - 3000;
      useSessionStore.setState({
        activeSession: {
          id: "live-paused",
          startedAt: startTime,
          totalPausedMs: 2000,
          pausedAt,
          notes: [],
          status: "paused",
        },
      });

      const result = useSessionStore.getState().endLiveSession();
      expect(result).not.toBeNull();
      // duration should exclude both previously paused time (2000ms) and current paused time (~3000ms)
      // total elapsed ~10000ms, paused ~5000ms, so active ~5s
      expect(result!.duration).toBeLessThanOrEqual(6);
      expect(result!.duration).toBeGreaterThanOrEqual(3);
    });

    it("live session date string is formatted correctly", () => {
      const startTime = new Date(2025, 6, 4, 22, 0, 0).getTime(); // July 4, 2025
      useSessionStore.setState({
        activeSession: {
          id: "live-date-test",
          startedAt: startTime,
          totalPausedMs: 0,
          notes: [],
          status: "running",
        },
      });

      const result = useSessionStore.getState().endLiveSession();
      expect(result!.date).toBe("2025-07-04");
    });
  });

  // ===== New fields: rating, bortle, tags =====

  describe("session new fields (rating, bortle, tags)", () => {
    it("stores and retrieves rating field", () => {
      const session = makeSession({ rating: 4 });
      useSessionStore.getState().addSession(session);
      expect(useSessionStore.getState().sessions[0].rating).toBe(4);
    });

    it("stores and retrieves bortle field", () => {
      const session = makeSession({ bortle: 5 });
      useSessionStore.getState().addSession(session);
      expect(useSessionStore.getState().sessions[0].bortle).toBe(5);
    });

    it("stores and retrieves tags field", () => {
      const session = makeSession({ tags: ["deep sky", "first light"] });
      useSessionStore.getState().addSession(session);
      expect(useSessionStore.getState().sessions[0].tags).toEqual(["deep sky", "first light"]);
    });

    it("updates rating via updateSession", () => {
      const session = makeSession();
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().updateSession(session.id, { rating: 3 });
      expect(useSessionStore.getState().sessions[0].rating).toBe(3);
    });

    it("updates bortle via updateSession", () => {
      const session = makeSession();
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().updateSession(session.id, { bortle: 7 });
      expect(useSessionStore.getState().sessions[0].bortle).toBe(7);
    });

    it("updates tags via updateSession", () => {
      const session = makeSession();
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().updateSession(session.id, { tags: ["planetary"] });
      expect(useSessionStore.getState().sessions[0].tags).toEqual(["planetary"]);
    });
  });

  // ===== Plan status field =====

  describe("plan status field", () => {
    it("stores plan with status", () => {
      const plan = makePlan({ status: "planned" });
      useSessionStore.getState().addPlan(plan);
      expect(useSessionStore.getState().plans[0].status).toBe("planned");
    });

    it("updates plan status", () => {
      const plan = makePlan();
      useSessionStore.getState().addPlan(plan);
      useSessionStore.getState().updatePlan(plan.id, { status: "completed" });
      expect(useSessionStore.getState().plans[0].status).toBe("completed");
    });

    it("plan status defaults to undefined when not set", () => {
      const plan = makePlan();
      useSessionStore.getState().addPlan(plan);
      expect(useSessionStore.getState().plans[0].status).toBeUndefined();
    });

    it("cycles plan status through all valid values", () => {
      const plan = makePlan();
      useSessionStore.getState().addPlan(plan);

      useSessionStore.getState().updatePlan(plan.id, { status: "planned" });
      expect(useSessionStore.getState().plans[0].status).toBe("planned");

      useSessionStore.getState().updatePlan(plan.id, { status: "completed" });
      expect(useSessionStore.getState().plans[0].status).toBe("completed");

      useSessionStore.getState().updatePlan(plan.id, { status: "cancelled" });
      expect(useSessionStore.getState().plans[0].status).toBe("cancelled");
    });
  });

  // ===== getDatesWithSessions additional tests =====

  describe("getDatesWithSessions additional", () => {
    it("returns empty array when no sessions", () => {
      useSessionStore.setState({ sessions: [] });
      const dates = useSessionStore.getState().getDatesWithSessions();
      expect(dates).toEqual([]);
    });

    it("deduplicates dates from multiple sessions on same day", () => {
      useSessionStore.setState({
        sessions: [
          makeSession({ id: "s1", date: "2025-03-10" }),
          makeSession({ id: "s2", date: "2025-03-10" }),
          makeSession({ id: "s3", date: "2025-03-10" }),
        ],
      });
      const dates = useSessionStore.getState().getDatesWithSessions();
      expect(dates).toHaveLength(1);
      expect(dates[0]).toBe("2025-03-10");
    });
  });

  // ===== Merge sessions with new fields =====

  describe("mergeSessions preserves fields", () => {
    it("merged session has combined imageIds from both", () => {
      const s1 = makeSession({ id: "s1", imageIds: ["a", "b"] });
      const s2 = makeSession({ id: "s2", imageIds: ["c", "d"] });
      useSessionStore.setState({ sessions: [s1, s2] });

      useSessionStore.getState().mergeSessions(["s1", "s2"]);
      const merged = useSessionStore.getState().sessions[0];
      expect(merged.imageIds).toHaveLength(4);
      expect(merged.imageIds).toContain("a");
      expect(merged.imageIds).toContain("d");
    });

    it("merge with no matching IDs is no-op", () => {
      useSessionStore.setState({
        sessions: [makeSession({ id: "s1" })],
      });
      useSessionStore.getState().mergeSessions(["s1", "nonexistent"]);
      // Should still have at least the original session
      expect(useSessionStore.getState().sessions.length).toBeGreaterThanOrEqual(1);
    });

    it("mergeSessions rewrites linked files to merged session id", () => {
      const s1 = makeSession({ id: "s1", startTime: 1000, endTime: 2000, duration: 1000 });
      const s2 = makeSession({ id: "s2", startTime: 3000, endTime: 4000, duration: 1000 });
      useSessionStore.setState({ sessions: [s1, s2] });
      useFitsStore.setState({
        files: [makeFitsFile("f1", "s1"), makeFitsFile("f2", "s2")],
      });

      useSessionStore.getState().mergeSessions(["s1", "s2"]);
      const mergedId = useSessionStore.getState().sessions[0]?.id;
      expect(mergedId).toBeTruthy();
      expect(useFitsStore.getState().files.map((file) => file.sessionId)).toEqual([
        mergedId,
        mergedId,
      ]);
    });
  });

  describe("persistence migration", () => {
    it("v3 migration recomputes session date from startTime local date", () => {
      const migrate = (
        useSessionStore as unknown as {
          persist: {
            getOptions: () => {
              migrate: (state: unknown, version: number) => unknown;
            };
          };
        }
      ).persist.getOptions().migrate;

      const startTime = new Date("2025-03-11T01:30:00.000Z").getTime();
      const migrated = migrate(
        {
          sessions: [
            {
              id: "legacy-1",
              date: "1999-01-01",
              startTime,
              endTime: startTime + 3_600_000,
              duration: 3600,
              targets: ["M42"],
              imageIds: ["img-1"],
              equipment: {},
              createdAt: 1,
            },
          ],
          plans: [],
          logEntries: [],
          activeSession: null,
        },
        2,
      ) as { sessions: ObservationSession[] };

      const localDate = new Date(startTime);
      const expectedDate = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, "0")}-${String(localDate.getDate()).padStart(2, "0")}`;
      expect(migrated.sessions[0].date).toBe(expectedDate);
    });
  });

  // ===== Combined new field operations =====

  describe("session new fields combined operations", () => {
    it("can update multiple new fields at once", () => {
      const session = makeSession();
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().updateSession(session.id, {
        rating: 5,
        bortle: 3,
        tags: ["astrophotography", "nebula"],
      });
      const updated = useSessionStore.getState().sessions[0];
      expect(updated.rating).toBe(5);
      expect(updated.bortle).toBe(3);
      expect(updated.tags).toEqual(["astrophotography", "nebula"]);
    });

    it("can clear optional fields by setting undefined", () => {
      const session = makeSession({ rating: 4, bortle: 5, tags: ["test"] });
      useSessionStore.getState().addSession(session);
      useSessionStore.getState().updateSession(session.id, {
        rating: undefined,
        bortle: undefined,
        tags: undefined,
      });
      const updated = useSessionStore.getState().sessions[0];
      expect(updated.rating).toBeUndefined();
      expect(updated.bortle).toBeUndefined();
      expect(updated.tags).toBeUndefined();
    });
  });
});
