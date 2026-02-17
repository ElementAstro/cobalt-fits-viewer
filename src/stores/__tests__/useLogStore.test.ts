import { Logger, collectSystemInfo } from "../../lib/logger";
import { useLogStore } from "../useLogStore";

jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger");
  return {
    ...actual,
    collectSystemInfo: jest.fn(),
  };
});

describe("useLogStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Logger.clear();
    Logger.configure({
      minLevel: "debug",
      maxEntries: 500,
      consoleOutput: false,
    });

    useLogStore.setState({
      ...useLogStore.getState(),
      filterLevel: null,
      filterTag: "",
      filterQuery: "",
      systemInfo: null,
      isCollecting: false,
    });
  });

  it("syncs entries and totalCount from logger updates", () => {
    expect(useLogStore.getState().totalCount).toBe(0);
    Logger.info("LogStoreTest", "first");
    Logger.warn("LogStoreTest", "second");

    const state = useLogStore.getState();
    expect(state.totalCount).toBe(2);
    expect(state.entries).toHaveLength(2);
    expect(state.entries[1].message).toBe("second");
  });

  it("filters by level, tag and query together", () => {
    Logger.info("Network", "connected");
    Logger.warn("Network", "request timeout", { code: 504 });
    Logger.error("Auth", "request timeout", { reason: "invalid_token" });

    useLogStore.getState().setFilterLevel("warn");
    useLogStore.getState().setFilterTag("network");
    useLogStore.getState().setFilterQuery("timeout");

    const filtered = useLogStore.getState().getFilteredEntries();
    expect(filtered).toHaveLength(1);
    expect(filtered[0].tag).toBe("Network");
    expect(filtered[0].level).toBe("warn");
  });

  it("clearLogs updates reactive snapshot without forcing set({})", () => {
    Logger.info("LogStoreTest", "to be cleared");
    expect(useLogStore.getState().totalCount).toBe(1);

    useLogStore.getState().clearLogs();

    const state = useLogStore.getState();
    expect(state.totalCount).toBe(0);
    expect(state.entries).toHaveLength(0);
  });

  it("refreshSystemInfo success updates state and logs info", async () => {
    const mockInfo = {
      appVersion: "1.0.0",
      osName: "ios",
    } as unknown;
    const collectMock = collectSystemInfo as jest.MockedFunction<typeof collectSystemInfo>;
    collectMock.mockResolvedValueOnce(mockInfo as never);
    const infoSpy = jest.spyOn(Logger, "info").mockImplementation(() => {});

    const promise = useLogStore.getState().refreshSystemInfo();
    expect(useLogStore.getState().isCollecting).toBe(true);
    await promise;

    expect(useLogStore.getState().isCollecting).toBe(false);
    expect(useLogStore.getState().systemInfo).toEqual(mockInfo);
    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith("SystemInfo", "System information collected successfully");
  });

  it("refreshSystemInfo failure resets loading and logs error", async () => {
    const error = new Error("collect failed");
    const collectMock = collectSystemInfo as jest.MockedFunction<typeof collectSystemInfo>;
    collectMock.mockRejectedValueOnce(error);
    const errorSpy = jest.spyOn(Logger, "error").mockImplementation(() => {});

    await useLogStore.getState().refreshSystemInfo();

    expect(useLogStore.getState().isCollecting).toBe(false);
    expect(collectMock).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(
      "SystemInfo",
      "Failed to collect system information",
      error,
    );
  });
});
