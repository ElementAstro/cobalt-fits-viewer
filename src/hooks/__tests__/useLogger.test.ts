import { act, renderHook } from "@testing-library/react-native";
import { useLogViewer, useLogger, useSystemInfo } from "../useLogger";
import { flushPromises } from "./helpers/testUtils";

jest.mock("../../stores/useLogStore", () => ({
  useLogStore: jest.fn(),
}));

jest.mock("../../lib/logger", () => ({
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

const { useLogStore } = jest.requireMock("../../stores/useLogStore") as {
  useLogStore: jest.Mock;
};
const loggerLib = jest.requireMock("../../lib/logger") as {
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

  it("manages log viewer filters and export lifecycle", async () => {
    const setFilterLevel = jest.fn();
    const setFilterTag = jest.fn();
    const setFilterQuery = jest.fn();
    const clearLogs = jest.fn();
    const state = {
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
