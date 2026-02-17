import { act, renderHook } from "@testing-library/react-native";
import * as Updates from "expo-updates";
import { useAppUpdate } from "../useAppUpdate";

jest.mock("expo-updates", () => ({
  useUpdates: jest.fn(),
  checkForUpdateAsync: jest.fn(),
  fetchUpdateAsync: jest.fn(),
  reloadAsync: jest.fn(),
}));

jest.mock("../../lib/version", () => ({
  getAppVersionInfo: jest.fn(() => ({
    nativeVersion: "1.0.0",
    runtimeVersion: "rv-1",
  })),
}));

jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger") as typeof import("../../lib/logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const useUpdatesMock = Updates.useUpdates as jest.Mock;
const checkForUpdateAsyncMock = Updates.checkForUpdateAsync as jest.Mock;
const fetchUpdateAsyncMock = Updates.fetchUpdateAsync as jest.Mock;
const reloadAsyncMock = Updates.reloadAsync as jest.Mock;

describe("useAppUpdate", () => {
  const originalDev = (global as unknown as { __DEV__?: boolean }).__DEV__;

  beforeEach(() => {
    jest.clearAllMocks();
    (global as unknown as { __DEV__?: boolean }).__DEV__ = false;
    useUpdatesMock.mockReturnValue({
      currentlyRunning: { isEmbeddedLaunch: true },
      isUpdateAvailable: false,
      isUpdatePending: false,
    });
    checkForUpdateAsyncMock.mockResolvedValue({ isAvailable: false });
    fetchUpdateAsyncMock.mockResolvedValue(undefined);
    reloadAsyncMock.mockResolvedValue(undefined);
  });

  afterAll(() => {
    (global as unknown as { __DEV__?: boolean }).__DEV__ = originalDev;
  });

  it("short-circuits check in dev mode", async () => {
    (global as unknown as { __DEV__?: boolean }).__DEV__ = true;
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdate();
    });

    expect(result.current.status).toBe("upToDate");
    expect(result.current.lastCheckedAt).not.toBeNull();
    expect(checkForUpdateAsyncMock).not.toHaveBeenCalled();
  });

  it("checks update and sets available status", async () => {
    checkForUpdateAsyncMock.mockResolvedValue({ isAvailable: true });
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdate();
    });

    expect(result.current.status).toBe("available");
    expect(result.current.isUpdateAvailable).toBe(true);
  });

  it("handles check/update/apply errors and clearError", async () => {
    checkForUpdateAsyncMock.mockRejectedValueOnce(new Error("check failed"));
    const { result } = renderHook(() => useAppUpdate());

    await act(async () => {
      await result.current.checkForUpdate();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("check failed");

    fetchUpdateAsyncMock.mockRejectedValueOnce(new Error("download failed"));
    await act(async () => {
      await result.current.downloadUpdate();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("download failed");

    reloadAsyncMock.mockRejectedValueOnce(new Error("restart failed"));
    await act(async () => {
      await result.current.applyUpdate();
    });
    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("restart failed");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
  });

  it("runs updateAndRestart with no update and with update", async () => {
    const { result } = renderHook(() => useAppUpdate());

    checkForUpdateAsyncMock.mockResolvedValueOnce({ isAvailable: false });
    await act(async () => {
      await result.current.updateAndRestart();
    });
    expect(result.current.status).toBe("upToDate");

    checkForUpdateAsyncMock.mockResolvedValueOnce({ isAvailable: true });
    await act(async () => {
      await result.current.updateAndRestart();
    });
    expect(fetchUpdateAsyncMock).toHaveBeenCalled();
    expect(reloadAsyncMock).toHaveBeenCalled();
  });

  it("syncs native pending state to ready", () => {
    useUpdatesMock.mockReturnValue({
      currentlyRunning: { isEmbeddedLaunch: false },
      isUpdateAvailable: false,
      isUpdatePending: true,
    });

    const { result } = renderHook(() => useAppUpdate());
    expect(result.current.status).toBe("ready");
    expect(result.current.isUpdatePending).toBe(true);
    expect(result.current.isEmbeddedLaunch).toBe(false);
    expect(result.current.appVersion).toBe("1.0.0");
    expect(result.current.runtimeVersion).toBe("rv-1");
  });
});
