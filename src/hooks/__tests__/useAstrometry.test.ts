import { act, renderHook } from "@testing-library/react-native";
import { useAstrometry } from "../useAstrometry";

jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(),
}));
jest.mock("../../stores/useAstrometryStore", () => ({
  useAstrometryStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));
jest.mock("../../stores/useFitsStore", () => ({
  useFitsStore: Object.assign(jest.fn(), { getState: jest.fn() }),
}));
jest.mock("../../lib/astrometry/astrometryService", () => ({
  solveFile: jest.fn(),
  solveUrl: jest.fn(),
  cancelJob: jest.fn(),
  cancelAllJobs: jest.fn(),
  getActiveJobCount: jest.fn(),
  getServerUrl: jest.fn(() => "https://server"),
  clearSession: jest.fn(),
}));
jest.mock("../../lib/astrometry/astrometryClient", () => ({
  getApiKey: jest.fn(),
  testConnection: jest.fn(),
  saveApiKey: jest.fn(),
}));
jest.mock("../useHapticFeedback", () => ({
  useHapticFeedback: jest.fn(),
}));
jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: "Success" },
}));
jest.mock("../../lib/logger", () => ({
  LOG_TAGS: {
    useAstrometry: "useAstrometry",
  },
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const cryptoLib = jest.requireMock("expo-crypto") as {
  randomUUID: jest.Mock;
};
const { useAstrometryStore } = jest.requireMock("../../stores/useAstrometryStore") as {
  useAstrometryStore: jest.Mock & { getState: jest.Mock };
};
const { useFitsStore } = jest.requireMock("../../stores/useFitsStore") as {
  useFitsStore: jest.Mock & { getState: jest.Mock };
};
const serviceLib = jest.requireMock("../../lib/astrometry/astrometryService") as {
  solveFile: jest.Mock;
  solveUrl: jest.Mock;
  cancelJob: jest.Mock;
  cancelAllJobs: jest.Mock;
  getActiveJobCount: jest.Mock;
  getServerUrl: jest.Mock;
  clearSession: jest.Mock;
};
const clientLib = jest.requireMock("../../lib/astrometry/astrometryClient") as {
  getApiKey: jest.Mock;
  testConnection: jest.Mock;
  saveApiKey: jest.Mock;
};
const { useHapticFeedback } = jest.requireMock("../useHapticFeedback") as {
  useHapticFeedback: jest.Mock;
};

describe("useAstrometry", () => {
  let uid = 0;
  let filesMap: Map<
    string,
    { id: string; filename: string; filepath: string; thumbnailUri?: string }
  >;
  let astrometryState: {
    config: { maxConcurrent: number; apiKey: string };
    jobs: Array<Record<string, unknown>>;
    addJob: jest.Mock;
    updateJob: jest.Mock;
    removeJob: jest.Mock;
    clearCompletedJobs: jest.Mock;
    getActiveJobs: jest.Mock;
    getCompletedJobs: jest.Mock;
    getFailedJobs: jest.Mock;
    setConfig: jest.Mock;
    getJobById: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    uid = 0;
    cryptoLib.randomUUID.mockImplementation(() => `job-${++uid}`);
    filesMap = new Map([
      ["f1", { id: "f1", filename: "a.fits", filepath: "/tmp/a.fits", thumbnailUri: "thumb://a" }],
      ["f2", { id: "f2", filename: "b.fits", filepath: "/tmp/b.fits", thumbnailUri: "thumb://b" }],
    ]);

    astrometryState = {
      config: { maxConcurrent: 1, apiKey: "configured" },
      jobs: [],
      addJob: jest.fn((job: Record<string, unknown>) => {
        astrometryState.jobs = [job, ...astrometryState.jobs];
      }),
      updateJob: jest.fn((id: string, updates: Record<string, unknown>) => {
        astrometryState.jobs = astrometryState.jobs.map((j) =>
          j.id === id ? { ...j, ...updates } : j,
        );
      }),
      removeJob: jest.fn(),
      clearCompletedJobs: jest.fn(),
      getActiveJobs: jest.fn(() =>
        astrometryState.jobs.filter((j) =>
          ["pending", "uploading", "submitted", "solving"].includes(String(j.status)),
        ),
      ),
      getCompletedJobs: jest.fn(() =>
        astrometryState.jobs.filter((j) => String(j.status) === "success"),
      ),
      getFailedJobs: jest.fn(() =>
        astrometryState.jobs.filter((j) => String(j.status) === "failure"),
      ),
      setConfig: jest.fn((updates: Record<string, unknown>) => {
        astrometryState.config = { ...astrometryState.config, ...updates };
      }),
      getJobById: jest.fn((id: string) => astrometryState.jobs.find((j) => j.id === id)),
    };

    useAstrometryStore.mockImplementation((selector: (s: typeof astrometryState) => unknown) =>
      selector(astrometryState),
    );
    useAstrometryStore.getState.mockImplementation(() => astrometryState);

    const fitsState = {
      getFileById: (id: string) => filesMap.get(id),
    };
    useFitsStore.mockImplementation((selector: (s: typeof fitsState) => unknown) =>
      selector(fitsState),
    );
    useFitsStore.getState.mockImplementation(() => fitsState);

    serviceLib.getActiveJobCount.mockReturnValue(0);
    clientLib.getApiKey.mockResolvedValue("api-key");
    clientLib.testConnection.mockResolvedValue(true);
    clientLib.saveApiKey.mockResolvedValue(undefined);
    useHapticFeedback.mockReturnValue({
      hapticsEnabled: true,
      selection: jest.fn(),
      impact: jest.fn(),
      notify: jest.fn(),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("submits file/image/url jobs and respects concurrency", () => {
    const { result } = renderHook(() => useAstrometry());

    filesMap.delete("f1");
    expect(result.current.submitFile("f1")).toBeNull();

    filesMap.set("f1", {
      id: "f1",
      filename: "a.fits",
      filepath: "/tmp/a.fits",
      thumbnailUri: "thumb://a",
    });
    const fileJob = result.current.submitFile("f1");
    expect(fileJob).toBe("job-1");
    expect(serviceLib.solveFile).toHaveBeenCalledWith(
      "job-1",
      "/tmp/a.fits",
      astrometryState.config,
      expect.any(Function),
    );

    serviceLib.getActiveJobCount.mockReturnValue(99);
    const imageJob = result.current.submitImage("file:///x.png", "x.png");
    expect(imageJob).toBe("job-2");
    expect(serviceLib.solveFile).toHaveBeenCalledTimes(1);

    serviceLib.getActiveJobCount.mockReturnValue(0);
    const urlJob = result.current.submitUrl("https://x/y.png", "y.png");
    expect(urlJob).toBe("job-3");
    expect(serviceLib.solveUrl).toHaveBeenCalledWith(
      "job-3",
      "https://x/y.png",
      astrometryState.config,
      expect.any(Function),
    );
  });

  it("retries/cancels jobs and cancels all active jobs", () => {
    astrometryState.jobs = [
      { id: "j1", fileId: "f1", status: "failure", progress: 0 },
      { id: "j2", fileId: "f2", status: "pending", progress: 0 },
    ];
    const { result } = renderHook(() => useAstrometry());

    act(() => {
      result.current.retryJob("j1");
    });
    expect(astrometryState.updateJob).toHaveBeenCalledWith(
      "j1",
      expect.objectContaining({ status: "pending", progress: 0 }),
    );
    expect(serviceLib.solveFile).toHaveBeenCalledWith(
      "j1",
      "/tmp/a.fits",
      astrometryState.config,
      expect.any(Function),
    );

    act(() => {
      result.current.cancelJob("j2");
    });
    expect(serviceLib.cancelJob).toHaveBeenCalledWith("j2");
    expect(astrometryState.updateJob).toHaveBeenCalledWith("j2", {
      status: "cancelled",
      progress: 0,
    });

    act(() => {
      result.current.cancelAllJobs();
    });
    expect(serviceLib.cancelAllJobs).toHaveBeenCalled();
    expect(astrometryState.updateJob).toHaveBeenCalledWith("j2", {
      status: "cancelled",
      progress: 0,
    });
  });

  it("tests connection, saves api key and submits batch", async () => {
    const { result } = renderHook(() => useAstrometry());

    clientLib.getApiKey.mockResolvedValueOnce(null);
    await expect(result.current.testConnection()).resolves.toBe(false);

    clientLib.getApiKey.mockResolvedValueOnce("api-key");
    await expect(result.current.testConnection()).resolves.toBe(true);
    expect(clientLib.testConnection).toHaveBeenCalledWith("api-key", "https://server");

    await act(async () => {
      await result.current.saveApiKey("new-key");
    });
    expect(clientLib.saveApiKey).toHaveBeenCalledWith("new-key");
    expect(astrometryState.setConfig).toHaveBeenCalledWith({ apiKey: "configured" });
    expect(serviceLib.clearSession).toHaveBeenCalled();

    const ids = result.current.submitBatch(["f1", "f2"]);
    expect(ids).toHaveLength(2);
    expect(useHapticFeedback).toHaveBeenCalled();
  });

  it("resumes stale jobs on mount and processes queue after timeout", () => {
    astrometryState.jobs = [
      { id: "stale-1", fileId: "f1", status: "uploading" },
      { id: "ok-1", fileId: "f2", status: "success" },
    ];

    renderHook(() => useAstrometry());
    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(astrometryState.updateJob).toHaveBeenCalledWith("stale-1", {
      status: "pending",
      progress: 0,
    });
  });
});
