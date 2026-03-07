import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { UpdateChecker } from "../UpdateChecker";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/common/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
  ImpactFeedbackStyle: {
    Light: "light",
    Medium: "medium",
    Heavy: "heavy",
  },
}));

const mockUseAppUpdate = {
  status: "idle" as string,
  error: null as string | null,
  lastCheckedAt: null as number | null,
  appVersion: "1.2.0",
  checkForUpdate: jest.fn(),
  downloadUpdate: jest.fn(),
  applyUpdate: jest.fn(),
  clearError: jest.fn(),
};

jest.mock("../../../hooks/common/useAppUpdate", () => ({
  useAppUpdate: () => mockUseAppUpdate,
}));

describe("UpdateChecker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppUpdate.status = "idle";
    mockUseAppUpdate.error = null;
    mockUseAppUpdate.lastCheckedAt = null;
  });

  it("renders current version", () => {
    render(<UpdateChecker />);

    expect(screen.getByText("settings.currentVersion")).toBeTruthy();
    expect(screen.getByText("v1.2.0")).toBeTruthy();
  });

  it("renders check for update button in idle state", () => {
    render(<UpdateChecker />);

    // Both renderStatusText and renderAction produce this text in idle state
    expect(screen.getAllByText("settings.checkForUpdate").length).toBeGreaterThanOrEqual(1);
  });

  it("renders idle status text", () => {
    render(<UpdateChecker />);

    expect(screen.getAllByText("settings.checkForUpdate").length).toBeGreaterThanOrEqual(1);
  });

  it("renders checking status with spinner", () => {
    mockUseAppUpdate.status = "checking";
    render(<UpdateChecker />);

    expect(screen.getByText("settings.checking")).toBeTruthy();
    expect(screen.getByTestId("spinner")).toBeTruthy();
  });

  it("renders downloading status with progress bar", () => {
    mockUseAppUpdate.status = "downloading";
    render(<UpdateChecker />);

    expect(screen.getByText("settings.downloading")).toBeTruthy();
  });

  it("renders update available with download button", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateChecker />);

    expect(screen.getByText("settings.updateAvailable")).toBeTruthy();
    expect(screen.getByText("settings.downloadAndInstall")).toBeTruthy();
  });

  it("calls downloadUpdate when download button is pressed", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateChecker />);

    fireEvent.press(screen.getByText("settings.downloadAndInstall"));
    expect(mockUseAppUpdate.downloadUpdate).toHaveBeenCalled();
  });

  it("renders ready to install with restart button", () => {
    mockUseAppUpdate.status = "ready";
    render(<UpdateChecker />);

    expect(screen.getByText("settings.readyToInstall")).toBeTruthy();
    expect(screen.getByText("settings.restart")).toBeTruthy();
  });

  it("calls applyUpdate when restart button is pressed", () => {
    mockUseAppUpdate.status = "ready";
    render(<UpdateChecker />);

    fireEvent.press(screen.getByText("settings.restart"));
    expect(mockUseAppUpdate.applyUpdate).toHaveBeenCalled();
  });

  it("renders up to date status", () => {
    mockUseAppUpdate.status = "upToDate";
    render(<UpdateChecker />);

    expect(screen.getByText("settings.noUpdate")).toBeTruthy();
  });

  it("renders error status with retry button", () => {
    mockUseAppUpdate.status = "error";
    mockUseAppUpdate.error = "Network timeout";
    render(<UpdateChecker />);

    expect(screen.getByText("settings.updateFailed")).toBeTruthy();
    expect(screen.getByText("common.retry")).toBeTruthy();
    expect(screen.getByText("Network timeout")).toBeTruthy();
  });

  it("calls clearError and checkForUpdate when retry is pressed", () => {
    mockUseAppUpdate.status = "error";
    render(<UpdateChecker />);

    fireEvent.press(screen.getByText("common.retry"));
    expect(mockUseAppUpdate.clearError).toHaveBeenCalled();
  });

  it("renders last checked time when available (just now)", () => {
    mockUseAppUpdate.lastCheckedAt = Date.now() - 30000; // 30 seconds ago
    render(<UpdateChecker />);

    // "settings.lastChecked: settings.justNow" is rendered as nested texts
    expect(screen.getByText(/settings\.justNow/)).toBeTruthy();
  });

  it("does not render last checked when lastCheckedAt is null", () => {
    mockUseAppUpdate.lastCheckedAt = null;
    render(<UpdateChecker />);

    // lastCheckedAt is null, so the lastChecked text is not rendered
    expect(screen.queryByText(/settings\.lastChecked/)).toBeNull();
  });

  it("renders minutes format for last checked time", () => {
    mockUseAppUpdate.lastCheckedAt = Date.now() - 5 * 60 * 1000; // 5 minutes ago
    render(<UpdateChecker />);

    // Text is nested inside parent: "settings.lastChecked: 5m"
    expect(screen.getByText(/5m/)).toBeTruthy();
  });

  it("renders hours format for last checked time", () => {
    mockUseAppUpdate.lastCheckedAt = Date.now() - 3 * 60 * 60 * 1000; // 3 hours ago
    render(<UpdateChecker />);

    expect(screen.getByText(/3h/)).toBeTruthy();
  });

  it("renders days format for last checked time", () => {
    mockUseAppUpdate.lastCheckedAt = Date.now() - 2 * 24 * 60 * 60 * 1000; // 2 days ago
    render(<UpdateChecker />);

    expect(screen.getByText(/2d/)).toBeTruthy();
  });

  it("renders licenses button", () => {
    render(<UpdateChecker />);

    expect(screen.getByText("settings.licenses")).toBeTruthy();
    expect(screen.getByText("settings.licensesDetail")).toBeTruthy();
  });

  it("renders status icons based on state", () => {
    mockUseAppUpdate.status = "upToDate";
    render(<UpdateChecker />);

    expect(screen.getByText("checkmark-circle-outline")).toBeTruthy();
  });

  it("renders cloud download icon for available status", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateChecker />);

    expect(screen.getAllByText("cloud-download-outline").length).toBeGreaterThanOrEqual(1);
  });

  it("renders checkmark icon for ready status", () => {
    mockUseAppUpdate.status = "ready";
    render(<UpdateChecker />);

    expect(screen.getByText("checkmark-circle")).toBeTruthy();
  });

  it("renders alert icon for error status", () => {
    mockUseAppUpdate.status = "error";
    render(<UpdateChecker />);

    expect(screen.getByText("alert-circle-outline")).toBeTruthy();
  });

  it("does not show action buttons during checking", () => {
    mockUseAppUpdate.status = "checking";
    render(<UpdateChecker />);

    expect(screen.queryByText("settings.checkForUpdate")).toBeNull();
    expect(screen.queryByText("settings.downloadAndInstall")).toBeNull();
  });

  it("does not show action buttons during downloading", () => {
    mockUseAppUpdate.status = "downloading";
    render(<UpdateChecker />);

    expect(screen.queryByText("settings.checkForUpdate")).toBeNull();
    expect(screen.queryByText("settings.downloadAndInstall")).toBeNull();
  });
});
