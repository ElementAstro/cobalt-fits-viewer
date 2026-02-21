import { act, renderHook } from "@testing-library/react-native";
import { useSessions } from "../useSessions";

jest.mock("../../stores/useSessionStore", () => ({
  useSessionStore: jest.fn(),
}));
jest.mock("../../stores/useFitsStore", () => ({
  useFitsStore: jest.fn(),
}));
jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: jest.fn(),
}));
jest.mock("../../stores/useTargetStore", () => ({
  useTargetStore: jest.fn(),
}));
jest.mock("../../lib/sessions/sessionDetector", () => ({
  detectSessions: jest.fn(),
  findMatchingSession: jest.fn(),
  getDatesWithObservations: jest.fn(),
}));
jest.mock("../../lib/sessions/observationLog", () => ({
  generateLogFromFiles: jest.fn(),
  exportToCSV: jest.fn(() => "csv"),
  exportToText: jest.fn(() => "text"),
  exportSessionToJSON: jest.fn(() => "json-session"),
  exportAllSessionsToJSON: jest.fn(() => "json-all"),
}));
jest.mock("../../lib/sessions/statsCalculator", () => ({
  calculateObservationStats: jest.fn(() => ({ total: 1 })),
  getMonthlyTrend: jest.fn(() => [{ month: "2025-01" }]),
}));
jest.mock("../../lib/sessions/sessionLinking", () => ({
  deriveSessionMetadataFromFiles: jest.fn(),
  buildMissingLogEntries: jest.fn(),
}));
jest.mock("../../lib/sessions/sessionNormalization", () => ({
  mergeSessionLike: jest.fn((base: object, incoming: object) => ({ ...base, ...incoming })),
}));
jest.mock("../../lib/sessions/sessionReconciliation", () => ({
  reconcileSessionsFromLinkedFilesGraph: jest.fn(),
}));
jest.mock("../../lib/logger", () => ({
  LOG_TAGS: {
    Sessions: "Sessions",
  },
  Logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

const { useSessionStore } = jest.requireMock("../../stores/useSessionStore") as {
  useSessionStore: jest.Mock & { getState?: jest.Mock; setState?: jest.Mock };
};
const { useFitsStore } = jest.requireMock("../../stores/useFitsStore") as {
  useFitsStore: jest.Mock & { getState?: jest.Mock };
};
const { useSettingsStore } = jest.requireMock("../../stores/useSettingsStore") as {
  useSettingsStore: jest.Mock;
};
const { useTargetStore } = jest.requireMock("../../stores/useTargetStore") as {
  useTargetStore: jest.Mock & { getState?: jest.Mock };
};
const detectorLib = jest.requireMock("../../lib/sessions/sessionDetector") as {
  detectSessions: jest.Mock;
  findMatchingSession: jest.Mock;
  getDatesWithObservations: jest.Mock;
};
const logLib = jest.requireMock("../../lib/sessions/observationLog") as {
  generateLogFromFiles: jest.Mock;
};
const statsLib = jest.requireMock("../../lib/sessions/statsCalculator") as {
  calculateObservationStats: jest.Mock;
  getMonthlyTrend: jest.Mock;
};
const linkingLib = jest.requireMock("../../lib/sessions/sessionLinking") as {
  deriveSessionMetadataFromFiles: jest.Mock;
  buildMissingLogEntries: jest.Mock;
};
const sessionNormalizationLib = jest.requireMock("../../lib/sessions/sessionNormalization") as {
  mergeSessionLike: jest.Mock;
};
const reconciliationLib = jest.requireMock("../../lib/sessions/sessionReconciliation") as {
  reconcileSessionsFromLinkedFilesGraph: jest.Mock;
};

describe("useSessions", () => {
  const addSession = jest.fn();
  const addLogEntries = jest.fn();
  const updateSession = jest.fn();
  const removeSession = jest.fn();
  const mergeSessions = jest.fn();
  const endLiveSession = jest.fn();
  const getDatesWithSessions = jest.fn(() => ["2025-01-01"]);
  const batchSetSessionId = jest.fn();

  let sessionState: {
    sessions: Array<Record<string, unknown>>;
    logEntries: Array<Record<string, unknown>>;
    addSession: jest.Mock;
    addLogEntries: jest.Mock;
    updateSession: jest.Mock;
    removeSession: jest.Mock;
    mergeSessions: jest.Mock;
    endLiveSession: jest.Mock;
    getDatesWithSessions: jest.Mock;
  };
  let fitsState: {
    files: Array<Record<string, unknown>>;
    batchSetSessionId: jest.Mock;
  };
  let targetState: { targets: Array<Record<string, unknown>> };

  beforeEach(() => {
    jest.clearAllMocks();

    sessionState = {
      sessions: [
        {
          id: "s-old",
          date: "2025-01-01",
          startTime: 1000,
          endTime: 2000,
          duration: 1000,
          targetRefs: [{ name: "M42", targetId: "t1" }],
          imageIds: ["f1"],
          equipment: { telescope: "Old Scope" },
          createdAt: 1,
        },
      ],
      logEntries: [{ id: "log_f1", sessionId: "s-old", imageId: "f1" }],
      addSession,
      addLogEntries,
      updateSession,
      removeSession,
      mergeSessions,
      endLiveSession,
      getDatesWithSessions,
    };
    fitsState = {
      files: [
        { id: "f1", sessionId: "live-1", dateObs: "2025-01-01T00:00:00Z", object: "M42" },
        { id: "f2", sessionId: "live-1", dateObs: "2025-01-01T00:10:00Z", object: "M31" },
      ],
      batchSetSessionId,
    };
    targetState = {
      targets: [{ id: "t1", name: "M42", aliases: [] }],
    };

    useSessionStore.mockImplementation((selector: (s: typeof sessionState) => unknown) =>
      selector(sessionState),
    );
    useSessionStore.getState = jest.fn(() => sessionState);
    useSessionStore.setState = jest.fn((partial: Partial<typeof sessionState>) => {
      sessionState = { ...sessionState, ...partial };
    });

    useFitsStore.mockImplementation((selector: (s: typeof fitsState) => unknown) =>
      selector(fitsState),
    );
    useFitsStore.getState = jest.fn(() => fitsState);

    useTargetStore.mockImplementation((selector: (s: typeof targetState) => unknown) =>
      selector(targetState),
    );
    useTargetStore.getState = jest.fn(() => targetState);

    useSettingsStore.mockImplementation((selector: (s: { sessionGapMinutes: number }) => unknown) =>
      selector({ sessionGapMinutes: 120 }),
    );

    detectorLib.detectSessions.mockReturnValue([
      {
        id: "s-new",
        date: "2025-01-01",
        startTime: 3000,
        endTime: 5000,
        duration: 2000,
        targetRefs: [],
        imageIds: ["f1", "f2"],
        equipment: {},
        createdAt: 2,
      },
    ]);
    detectorLib.findMatchingSession.mockReturnValue(null);
    detectorLib.getDatesWithObservations.mockReturnValue([1, 2]);

    linkingLib.deriveSessionMetadataFromFiles.mockReturnValue({
      targetRefs: [{ name: "M42", targetId: "t1" }],
      imageIds: ["f1", "f2"],
      equipment: { telescope: "RC8" },
      location: { city: "A", latitude: 1, longitude: 2 },
    });
    linkingLib.buildMissingLogEntries.mockReturnValue([]);

    logLib.generateLogFromFiles.mockReturnValue([{ id: "log_f2", sessionId: "s-new" }]);
    sessionNormalizationLib.mergeSessionLike.mockImplementation(
      (base: object, incoming: object) => ({ ...base, ...incoming }),
    );

    reconciliationLib.reconcileSessionsFromLinkedFilesGraph.mockReturnValue({
      sessions: sessionState.sessions,
      logEntries: sessionState.logEntries,
      summary: {
        requested: 1,
        processed: 1,
        updated: 0,
        cleared: 0,
        unchanged: 1,
        logsAdded: 0,
        logsRemoved: 0,
        changed: false,
        sessionIds: ["s-old"],
      },
    });
  });

  it("auto detects new sessions and returns extended summary stats", () => {
    const { result } = renderHook(() => useSessions());

    let out: ReturnType<typeof result.current.autoDetectSessions> | null = null;
    act(() => {
      out = result.current.autoDetectSessions();
    });

    expect(out).toEqual({
      newCount: 1,
      totalDetected: 1,
      updatedCount: 0,
      mergedCount: 0,
      skippedCount: 0,
    });
    expect(addSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "s-new",
        imageIds: ["f1", "f2"],
      }),
    );
    expect(batchSetSessionId).toHaveBeenCalledWith(["f1", "f2"], "s-new");
    expect(addLogEntries).toHaveBeenCalledWith([{ id: "log_f2", sessionId: "s-new" }]);
  });

  it("updates matched duplicate sessions instead of skipping", () => {
    const matched = {
      id: "s-old",
      date: "2025-01-01",
      startTime: 1000,
      endTime: 2000,
      duration: 1000,
      targetRefs: [{ name: "M42", targetId: "t1" }],
      imageIds: ["f1"],
      equipment: { telescope: "Old Scope" },
      createdAt: 1,
    };
    detectorLib.findMatchingSession.mockReturnValue(matched);
    linkingLib.buildMissingLogEntries.mockReturnValue([{ id: "log_f2", sessionId: "s-old" }]);

    const { result } = renderHook(() => useSessions());
    const out = result.current.autoDetectSessions();

    expect(out).toEqual({
      newCount: 0,
      totalDetected: 1,
      updatedCount: 1,
      mergedCount: 1,
      skippedCount: 0,
    });
    expect(addSession).not.toHaveBeenCalled();
    expect(updateSession).toHaveBeenCalledWith(
      "s-old",
      expect.objectContaining({
        imageIds: ["f1", "f2"],
      }),
    );
    expect(batchSetSessionId).toHaveBeenCalledWith(["f1", "f2"], "s-old");
    expect(addLogEntries).toHaveBeenCalledWith([{ id: "log_f2", sessionId: "s-old" }]);
  });

  it("counts skipped detections when detected sessions have no linked files", () => {
    detectorLib.detectSessions.mockReturnValueOnce([
      {
        id: "s-missing",
        date: "2025-01-01",
        startTime: 1,
        endTime: 2,
        duration: 1,
        targetRefs: [],
        imageIds: ["missing-file"],
        equipment: {},
        createdAt: 2,
      },
    ]);

    const { result } = renderHook(() => useSessions());
    const out = result.current.autoDetectSessions();

    expect(out).toEqual({
      newCount: 0,
      totalDetected: 1,
      updatedCount: 0,
      mergedCount: 0,
      skippedCount: 1,
    });
    expect(addSession).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("reconcileSessionsFromLinkedFiles applies graph changes only when summary.changed", () => {
    reconciliationLib.reconcileSessionsFromLinkedFilesGraph.mockReturnValueOnce({
      sessions: [{ id: "s-next" }],
      logEntries: [{ id: "log-next" }],
      summary: {
        requested: 1,
        processed: 1,
        updated: 1,
        cleared: 0,
        unchanged: 0,
        logsAdded: 1,
        logsRemoved: 0,
        changed: true,
        sessionIds: ["s-old"],
      },
    });

    const { result } = renderHook(() => useSessions());

    let summary: ReturnType<typeof result.current.reconcileSessionsFromLinkedFiles> | undefined;
    act(() => {
      summary = result.current.reconcileSessionsFromLinkedFiles(["s-old"]);
    });

    expect(reconciliationLib.reconcileSessionsFromLinkedFilesGraph).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionIds: ["s-old"],
      }),
    );
    expect(useSessionStore.setState).toHaveBeenCalledWith({
      sessions: [{ id: "s-next" }],
      logEntries: [{ id: "log-next" }],
    });
    expect(summary).toEqual(
      expect.objectContaining({
        changed: true,
        updated: 1,
      }),
    );
  });

  it("exports stats and date helpers", () => {
    const { result } = renderHook(() => useSessions());

    expect(result.current.getSessionStats()).toEqual({ total: 1 });
    expect(statsLib.calculateObservationStats).toHaveBeenCalled();

    expect(result.current.getMonthlyData(6)).toEqual([{ month: "2025-01" }]);
    expect(statsLib.getMonthlyTrend).toHaveBeenCalledWith(expect.any(Array), 6);

    expect(result.current.getObservationDates(2025, 1)).toEqual([1, 2]);
    expect(detectorLib.getDatesWithObservations).toHaveBeenCalled();
  });
});
