import { act, renderHook } from "@testing-library/react-native";
import { useLogViewer, useLogger, usePageLogger, useSystemInfo } from "../useLogger";
import { flushPromises } from "../../__test-helpers__/testUtils";

jest.mock("../../../stores/app/useLogStore", () => ({
  useLogStore: jest.fn(),
}));

jest.mock("../../../lib/logger", () => ({
  Logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    exportJSON: jest.fn(() => '{"ok":true}'),
    exportText: jest.fn(() => "ok"),
  },
  formatSystemInfo: jest.fn(() => "formatted"),
  exportLogsToFile: jest.fn(async () => "file://logs.txt"),
  shareLogFile: jest.fn(async () => true),
}));

const { useLogStore } = jest.requireMock("../../../stores/app/useLogStore") as {
  useLogStore: jest.Mock;
};
const loggerLib = jest.requireMock("../../../lib/logger") as {
  Logger: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    exportJSON: jest.Mock;
    exportText: jest.Mock;
  };
  formatSystemInfo: jest.Mock;
  exportLogsToFile: jest.Mock;
  shareLogFile: jest.Mock;
};

describe("useLogger hooks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const state = {
      entries: [
        { id: "1", level: "warn", tag: "Viewer", message: "needle", timestamp: 1 },
        { id: "2", level: "info", tag: "Network", message: "connected", timestamp: 2 },
        { id: "3", level: "warn", tag: "Viewer", message: "timeout", timestamp: 3 },
      ],
      getFilteredEntries: () => [{ id: "1" }],
      totalCount: 3,
      filterLevel: "warn",
      filterTag: "Viewer",
      filterQuery: "needle",
      setFilterLevel: jest.fn(),
      setFilterTag: jest.fn(),
      setFilterQuery: jest.fn(),
      clearLogs: jest.fn(),
      systemInfo: null,
      isCollecting: false,
      refreshSystemInfo: jest.fn(async () => undefined),
    };
    useLogStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state));
  });

  it("forwards tagged logging functions", () => {
    const { result } = renderHook(() => useLogger("Viewer"));

    act(() => {
      result.current.debug("d", { a: 1 });
      result.current.info("i");
      result.current.warn("w");
      result.current.error("e");
    });

    expect(loggerLib.Logger.debug).toHaveBeenCalledWith("Viewer", "d", { a: 1 });
    expect(loggerLib.Logger.info).toHaveBeenCalledWith("Viewer", "i", undefined);
    expect(loggerLib.Logger.warn).toHaveBeenCalledWith("Viewer", "w", undefined);
    expect(loggerLib.Logger.error).toHaveBeenCalledWith("Viewer", "e", undefined);
  });

  it("logs page enter/leave lifecycle events", () => {
    const { unmount } = renderHook(() => usePageLogger("FilesScreen", { screen: "files" }));

    expect(loggerLib.Logger.info).toHaveBeenCalledWith("FilesScreen", "page_enter", {
      eventType: "page_enter",
      screen: "files",
    });

    unmount();

    expect(loggerLib.Logger.info).toHaveBeenCalledWith("FilesScreen", "page_leave", {
      eventType: "page_leave",
      screen: "files",
    });
  });

  it("logs page action/success/failure payloads", () => {
    const { result } = renderHook(() =>
      usePageLogger("FilesScreen", { screen: "files", logLifecycle: false }),
    );

    act(() => {
      result.current.logAction("import_file", { source: "sheet" });
      result.current.logSuccess("batch_export", { count: 2 });
      result.current.logFailure("batch_delete", new Error("delete failed"), { selected: 3 });
    });

    expect(loggerLib.Logger.info).toHaveBeenCalledWith("FilesScreen", "import_file", {
      eventType: "action",
      screen: "files",
      action: "import_file",
      source: "sheet",
    });
    expect(loggerLib.Logger.info).toHaveBeenCalledWith("FilesScreen", "batch_export", {
      eventType: "success",
      screen: "files",
      action: "batch_export",
      count: 2,
    });
    expect(loggerLib.Logger.error).toHaveBeenCalledWith(
      "FilesScreen",
      "batch_delete",
      expect.objectContaining({
        eventType: "failure",
        screen: "files",
        action: "batch_delete",
        selected: 3,
        error: expect.objectContaining({ message: "delete failed" }),
      }),
    );
  });

  it("refreshes system info when missing and formats data", () => {
    const refresh = jest.fn();
    const state = {
      systemInfo: null,
      isCollecting: false,
      refreshSystemInfo: refresh,
    };
    useLogStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state));

    const { result } = renderHook(() => useSystemInfo());

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.current.getFormattedInfo()).toBe("");
  });

  it("computes levelCounts and availableTags from entries", () => {
    const state = {
      entries: [
        { id: "1", level: "warn", tag: "Viewer", message: "a", timestamp: 1 },
        { id: "2", level: "info", tag: "Network", message: "b", timestamp: 2 },
        { id: "3", level: "warn", tag: "Viewer", message: "c", timestamp: 3 },
        { id: "4", level: "error", tag: "Auth", message: "d", timestamp: 4 },
      ],
      getFilteredEntries: () => [
        { id: "1", level: "warn", tag: "Viewer", message: "a", timestamp: 1 },
        { id: "2", level: "info", tag: "Network", message: "b", timestamp: 2 },
        { id: "3", level: "warn", tag: "Viewer", message: "c", timestamp: 3 },
        { id: "4", level: "error", tag: "Auth", message: "d", timestamp: 4 },
      ],
      totalCount: 4,
      filterLevel: null,
      filterTag: "",
      filterQuery: "",
      setFilterLevel: jest.fn(),
      setFilterTag: jest.fn(),
      setFilterQuery: jest.fn(),
      clearLogs: jest.fn(),
      systemInfo: null,
      isCollecting: false,
      refreshSystemInfo: jest.fn(),
    };
    useLogStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state));

    const { result } = renderHook(() => useLogViewer());

    expect(result.current.levelCounts).toEqual({
      debug: 0,
      info: 1,
      warn: 2,
      error: 1,
    });
    expect(result.current.availableTags).toEqual(["Auth", "Network", "Viewer"]);
  });

  it("manages log viewer filters and export lifecycle", async () => {
    const setFilterLevel = jest.fn();
    const setFilterTag = jest.fn();
    const setFilterQuery = jest.fn();
    const clearLogs = jest.fn();
    const state = {
      entries: [{ id: "1", level: "warn", tag: "Viewer", message: "needle", timestamp: 1 }],
      getFilteredEntries: () => [{ id: "1" }],
      totalCount: 3,
      filterLevel: "warn",
      filterTag: "Viewer",
      filterQuery: "needle",
      setFilterLevel,
      setFilterTag,
      setFilterQuery,
      clearLogs,
      systemInfo: { platform: "x" },
      isCollecting: false,
      refreshSystemInfo: jest.fn(),
    };
    useLogStore.mockImplementation((selector: (s: typeof state) => unknown) => selector(state));

    const { result } = renderHook(() => useLogViewer());

    act(() => {
      result.current.setFilter("warn", "Viewer");
      result.current.setFilterQuery("needle");
      result.current.clearLogs();
    });

    expect(setFilterLevel).toHaveBeenCalledWith("warn");
    expect(setFilterTag).toHaveBeenCalledWith("Viewer");
    expect(setFilterQuery).toHaveBeenCalledWith("needle");
    expect(clearLogs).toHaveBeenCalled();

    expect(result.current.exportLogs("text")).toBe("ok");
    expect(result.current.exportLogs("json")).toBe('{"ok":true}');
    expect(result.current.exportLogs("json", true)).toBe('{"ok":true}');

    await act(async () => {
      const out = await result.current.exportToFile({ format: "text", filteredOnly: true });
      expect(out).toBe("file://logs.txt");
    });
    await flushPromises();
    expect(result.current.isExporting).toBe(false);
    expect(loggerLib.exportLogsToFile).toHaveBeenCalledWith({
      format: "text",
      query: {
        level: "warn",
        tag: "Viewer",
        query: "needle",
      },
    });

    await act(async () => {
      const ok = await result.current.shareLogs({ format: "text", filteredOnly: true });
      expect(ok).toBe(true);
    });
    await flushPromises();
    expect(result.current.isExporting).toBe(false);
    expect(loggerLib.shareLogFile).toHaveBeenCalledWith({
      format: "text",
      query: {
        level: "warn",
        tag: "Viewer",
        query: "needle",
      },
    });
  });
});
