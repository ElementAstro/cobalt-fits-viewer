import type { FitsMetadata, ObservationLogEntry, ObservationSession } from "../../fits/types";
import { reconcileSessionsFromLinkedFilesGraph } from "../sessionReconciliation";

function makeSession(overrides: Partial<ObservationSession> = {}): ObservationSession {
  return {
    id: "session-1",
    date: "2026-01-01",
    startTime: 1,
    endTime: 2,
    duration: 1,
    targetRefs: [{ name: "Old Target" }],
    imageIds: [],
    equipment: {},
    createdAt: 1,
    ...overrides,
  };
}

function makeFile(overrides: Partial<FitsMetadata> = {}): FitsMetadata {
  return {
    id: "file-1",
    filename: "file-1.fits",
    filepath: "/tmp/file-1.fits",
    fileSize: 1,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  };
}

function makeLog(overrides: Partial<ObservationLogEntry> = {}): ObservationLogEntry {
  return {
    id: "log_file-1",
    sessionId: "session-1",
    imageId: "file-1",
    dateTime: "2026-01-01T00:00:00.000Z",
    object: "M42",
    filter: "Ha",
    exptime: 120,
    ...overrides,
  };
}

describe("reconcileSessionsFromLinkedFilesGraph", () => {
  it("rebuilds metadata from linked files and removes invalid logs", () => {
    const sessions = [
      makeSession({
        id: "session-1",
        imageIds: ["file-1", "file-2"],
        targetRefs: [{ name: "Old Target" }],
        equipment: { telescope: "Old Scope", camera: "Old Cam", filters: ["L"] },
      }),
      makeSession({
        id: "session-2",
        imageIds: ["file-x"],
      }),
    ];
    const files = [
      makeFile({
        id: "file-1",
        sessionId: "session-1",
        object: "M42",
        telescope: "Scope A",
        instrument: "Cam A",
        filter: "Ha",
        location: {
          latitude: 10,
          longitude: 20,
          placeName: "Site A",
        },
      }),
      makeFile({
        id: "file-x",
        sessionId: "session-2",
      }),
    ];
    const logEntries = [
      makeLog({ id: "log_file-1", sessionId: "session-1", imageId: "file-1" }),
      makeLog({ id: "log_file-2", sessionId: "session-1", imageId: "file-2" }),
      makeLog({ id: "log_file-x", sessionId: "session-2", imageId: "file-x" }),
    ];

    const {
      sessions: nextSessions,
      logEntries: nextLogs,
      summary,
    } = reconcileSessionsFromLinkedFilesGraph({
      sessionIds: ["session-1"],
      sessions,
      files,
      logEntries,
    });

    const updated = nextSessions.find((session) => session.id === "session-1");
    expect(updated).toBeDefined();
    expect(updated?.imageIds).toEqual(["file-1"]);
    expect(updated?.targetRefs).toEqual([{ name: "M42" }]);
    expect(updated?.equipment).toEqual({
      telescope: "Scope A",
      camera: "Cam A",
      filters: ["Ha"],
    });
    expect(updated?.location).toEqual({
      latitude: 10,
      longitude: 20,
      placeName: "Site A",
    });

    expect(nextLogs.map((entry) => entry.id).sort()).toEqual(["log_file-1", "log_file-x"]);
    expect(summary).toEqual(
      expect.objectContaining({
        requested: 1,
        processed: 1,
        updated: 1,
        cleared: 0,
        unchanged: 0,
        logsAdded: 0,
        logsRemoved: 1,
        changed: true,
      }),
    );
  });

  it("adds missing logs and is idempotent on repeated runs", () => {
    const sessions = [
      makeSession({
        id: "session-1",
        imageIds: ["file-1"],
        targetRefs: [{ name: "M42" }],
      }),
    ];
    const files = [
      makeFile({
        id: "file-1",
        sessionId: "session-1",
        dateObs: "2026-01-01T01:00:00.000Z",
        object: "M42",
      }),
      makeFile({
        id: "file-2",
        sessionId: "session-1",
        dateObs: "2026-01-01T01:10:00.000Z",
        object: "M31",
      }),
    ];
    const logEntries = [makeLog({ id: "log_file-1", imageId: "file-1", object: "M42" })];

    const first = reconcileSessionsFromLinkedFilesGraph({
      sessions,
      files,
      logEntries,
    });

    expect(first.summary.logsAdded).toBe(1);
    expect(first.logEntries.map((entry) => entry.id).sort()).toEqual(["log_file-1", "log_file-2"]);
    expect(first.summary.changed).toBe(true);

    const second = reconcileSessionsFromLinkedFilesGraph({
      sessions: first.sessions,
      files,
      logEntries: first.logEntries,
    });

    expect(second.summary.logsAdded).toBe(0);
    expect(second.summary.logsRemoved).toBe(0);
    expect(second.summary.changed).toBe(false);
    expect(second.summary.unchanged).toBe(1);
  });

  it("clears session fields and related logs when no linked files remain", () => {
    const sessions = [
      makeSession({
        id: "session-1",
        imageIds: ["file-1"],
        targetRefs: [{ name: "M42" }],
        equipment: { telescope: "Scope A", camera: "Cam A", filters: ["Ha"] },
        location: {
          latitude: 1,
          longitude: 2,
          placeName: "Site A",
        },
      }),
    ];
    const files: FitsMetadata[] = [];
    const logEntries = [makeLog({ id: "log_file-1", sessionId: "session-1", imageId: "file-1" })];

    const {
      sessions: nextSessions,
      logEntries: nextLogs,
      summary,
    } = reconcileSessionsFromLinkedFilesGraph({
      sessions,
      files,
      logEntries,
    });

    expect(nextSessions[0]).toEqual(
      expect.objectContaining({
        imageIds: [],
        targetRefs: [],
        equipment: {},
        location: undefined,
      }),
    );
    expect(nextLogs).toEqual([]);
    expect(summary).toEqual(
      expect.objectContaining({
        processed: 1,
        updated: 1,
        cleared: 1,
        logsRemoved: 1,
        changed: true,
      }),
    );
  });
});
