import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAutoBackup } from "../useAutoBackup";
import { useBackupStore } from "../../stores/useBackupStore";

const mockBackupFn = jest.fn();
const mockUseBackupState = {
  backup: mockBackupFn,
  backupInProgress: false,
  restoreInProgress: false,
};
const mockGetNetworkStateAsync = jest.fn();

jest.mock("../useBackup", () => ({
  useBackup: () => mockUseBackupState,
}));

jest.mock("expo-network", () => ({
  getNetworkStateAsync: (...args: unknown[]) => mockGetNetworkStateAsync(...args),
  NetworkStateType: {
    WIFI: "WIFI",
    CELLULAR: "CELLULAR",
  },
}));

jest.mock("../../lib/logger", () => ({
  Logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe("useAutoBackup", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useBackupStore.setState({
      connections: [{ provider: "webdav", connected: true }],
      activeProvider: null,
      backupInProgress: false,
      restoreInProgress: false,
      progress: { phase: "idle", current: 0, total: 0 },
      autoBackupEnabled: true,
      autoBackupIntervalHours: 24,
      autoBackupNetwork: "wifi",
      lastAutoBackupCheck: 0,
      lastError: null,
    });
    mockUseBackupState.backupInProgress = false;
    mockUseBackupState.restoreInProgress = false;
    mockBackupFn.mockResolvedValue({ success: true });
  });

  it("skips auto backup on non-wifi when policy is wifi", async () => {
    mockGetNetworkStateAsync.mockResolvedValue({
      type: "CELLULAR",
      isConnected: true,
      isInternetReachable: true,
    });

    renderHook(() => useAutoBackup());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBackupFn).not.toHaveBeenCalled();
  });

  it("runs auto backup on cellular when policy is any", async () => {
    useBackupStore.setState({ autoBackupNetwork: "any" });
    mockGetNetworkStateAsync.mockResolvedValue({
      type: "CELLULAR",
      isConnected: true,
      isInternetReachable: true,
    });

    renderHook(() => useAutoBackup());

    await waitFor(() => {
      expect(mockBackupFn).toHaveBeenCalledWith("webdav");
    });
  });

  it("skips auto backup when interval has not elapsed", async () => {
    useBackupStore.setState({
      lastAutoBackupCheck: Date.now(),
      autoBackupIntervalHours: 24,
      autoBackupNetwork: "any",
    });
    mockGetNetworkStateAsync.mockResolvedValue({
      type: "WIFI",
      isConnected: true,
      isInternetReachable: true,
    });

    renderHook(() => useAutoBackup());

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBackupFn).not.toHaveBeenCalled();
  });

  it("skips auto backup when no connected provider is available", async () => {
    useBackupStore.setState({
      connections: [],
      activeProvider: null,
      autoBackupNetwork: "any",
      lastAutoBackupCheck: 0,
    });
    mockGetNetworkStateAsync.mockResolvedValue({
      type: "WIFI",
      isConnected: true,
      isInternetReachable: true,
    });

    renderHook(() => useAutoBackup());
    await act(async () => {
      await Promise.resolve();
    });

    expect(mockBackupFn).not.toHaveBeenCalled();
  });
});
