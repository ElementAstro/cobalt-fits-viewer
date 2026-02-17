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
jest.mock("../../lib/sessions/sessionDetector", () => ({
  detectSessions: jest.fn(),
  getDatesWithObservations: jest.fn(),
  isSessionDuplicate: jest.fn(),
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
  useSessionStore: jest.Mock;
};
const { useFitsStore } = jest.requireMock("../../stores/useFitsStore") as {
  useFitsStore: jest.Mock;
};
const { useSettingsStore } = jest.requireMock("../../stores/useSettingsStore") as {
  useSettingsStore: jest.Mock;
};
const detectorLib = jest.requireMock("../../lib/sessions/sessionDetector") as {
  detectSessions: jest.Mock;
  getDatesWithObservations: jest.Mock;
  isSessionDuplicate: jest.Mock;
};
const logLib = jest.requireMock("../../lib/sessions/observationLog") as {
  generateLogFromFiles: jest.Mock;
  exportToCSV: jest.Mock;
  exportToText: jest.Mock;
  exportSessionToJSON: jest.Mock;
  exportAllSessionsToJSON: jest.Mock;
};
const statsLib = jest.requireMock("../../lib/sessions/statsCalculator") as {
  calculateObservationStats: jest.Mock;
  getMonthlyTrend: jest.Mock;
};

describe("useSessions", () => {
  const addSession = jest.fn();
  const addLogEntries = jest.fn();
  const updateSession = jest.fn();
  const removeSession = jest.fn();
  const mergeSessions = jest.fn();
  const getDatesWithSessions = jest.fn(() => ["2025-01-01"]);
  const batchSetSessionId = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    const sessions = [{ id: "s-old" }];
    const logEntries = [{ id: "l1", sessionId: "s-old" }];
    const files = [
      { id: "f1", location: { city: "A", latitude: 1, longitude: 2 } },
      { id: "f2", location: { city: "A", latitude: 1, longitude: 2 } },
      { id: "f3", location: { city: "B", latitude: 3, longitude: 4 } },
    ];
    useSessionStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        sessions,
        logEntries,
        addSession,
        addLogEntries,
        updateSession,
        removeSession,
        mergeSessions,
        getDatesWithSessions,
      }),
    );
    useFitsStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ files, batchSetSessionId }),
    );
    useSettingsStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({ sessionGapMinutes: 120 }),
    );
    detectorLib.detectSessions.mockReturnValue([{ id: "s1", imageIds: ["f1", "f2"] }]);
    detectorLib.isSessionDuplicate.mockReturnValue(false);
    detectorLib.getDatesWithObservations.mockReturnValue([1, 2]);
    logLib.generateLogFromFiles.mockReturnValue([{ id: "l2" }]);
  });

  it("auto detects sessions, links files and logs", () => {
    const { result } = renderHook(() => useSessions());

    let out: { newCount: number; totalDetected: number } | null = null;
    act(() => {
      out = result.current.autoDetectSessions();
    });

    expect(out).toEqual({ newCount: 1, totalDetected: 1 });
    expect(addSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "s1",
        location: expect.objectContaining({ city: "A" }),
      }),
    );
    expect(batchSetSessionId).toHaveBeenCalledWith(["f1", "f2"], "s1");
    expect(addLogEntries).toHaveBeenCalledWith([{ id: "l2" }]);
  });

  it("skips duplicate sessions", () => {
    detectorLib.isSessionDuplicate.mockReturnValue(true);
    const { result } = renderHook(() => useSessions());

    const out = result.current.autoDetectSessions();
    expect(out).toEqual({ newCount: 0, totalDetected: 1 });
    expect(addSession).not.toHaveBeenCalled();
  });

  it("exports session logs and stats helpers", () => {
    const { result } = renderHook(() => useSessions());

    expect(result.current.getSessionStats()).toEqual({ total: 1 });
    expect(statsLib.calculateObservationStats).toHaveBeenCalled();

    expect(result.current.getMonthlyData(6)).toEqual([{ month: "2025-01" }]);
    expect(statsLib.getMonthlyTrend).toHaveBeenCalledWith(expect.any(Array), 6);

    expect(result.current.getObservationDates(2025, 1)).toEqual([1, 2]);
    expect(detectorLib.getDatesWithObservations).toHaveBeenCalled();

    expect(result.current.exportSessionLog("s-old", "csv")).toBe("csv");
    expect(result.current.exportSessionLog("s-old", "text")).toBe("text");
    expect(result.current.exportSessionLog("missing", "json")).toBe("");
    expect(result.current.exportAllSessions("json")).toBe("json-all");
  });
});
