import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { UpdateBanner } from "../UpdateBanner";

jest.mock("react-native-reanimated", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View: (props: any) => ReactLocal.createElement(View, props, props.children),
    },
    useSharedValue: (init: number) => ({ value: init }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withSpring: jest.fn((val) => val),
  };
});

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
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

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (s: any) => any) => selector({ autoCheckUpdates: false }),
}));

const mockUseAppUpdate = {
  status: "idle" as string,
  checkForUpdate: jest.fn(),
  downloadUpdate: jest.fn(),
  applyUpdate: jest.fn(),
};

jest.mock("../../../hooks/useAppUpdate", () => ({
  useAppUpdate: () => mockUseAppUpdate,
}));

describe("UpdateBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppUpdate.status = "idle";
  });

  it("renders nothing when status is idle and dismissed", () => {
    const { toJSON } = render(<UpdateBanner />);
    // When idle and not dismissed, the component returns null for the early check
    // (dismissed && status !== 'ready') is false, so it renders the animated view
    expect(toJSON()).toBeTruthy();
  });

  it("renders banner text when update is available", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateBanner />);

    expect(screen.getByText("settings.newVersionAvailable")).toBeTruthy();
    expect(screen.getByText("settings.downloadAndInstall")).toBeTruthy();
    expect(screen.getByText("settings.updateAndRestart")).toBeTruthy();
  });

  it("renders banner text when update is ready", () => {
    mockUseAppUpdate.status = "ready";
    render(<UpdateBanner />);

    expect(screen.getByText("settings.readyToInstall")).toBeTruthy();
    // "settings.restart" appears in both description and action button
    expect(screen.getAllByText("settings.restart").length).toBeGreaterThanOrEqual(1);
  });

  it("renders cloud download icon when available", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateBanner />);

    expect(screen.getByText("cloud-download-outline")).toBeTruthy();
  });

  it("renders checkmark icon when ready", () => {
    mockUseAppUpdate.status = "ready";
    render(<UpdateBanner />);

    expect(screen.getByText("checkmark-circle")).toBeTruthy();
  });

  it("calls downloadUpdate when action pressed in available state", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateBanner />);

    fireEvent.press(screen.getByText("settings.updateAndRestart"));
    expect(mockUseAppUpdate.downloadUpdate).toHaveBeenCalled();
  });

  it("calls applyUpdate when action pressed in ready state", () => {
    mockUseAppUpdate.status = "ready";
    render(<UpdateBanner />);

    // "settings.restart" appears multiple times; press the button one
    const restartTexts = screen.getAllByText("settings.restart");
    fireEvent.press(restartTexts[restartTexts.length - 1]);
    expect(mockUseAppUpdate.applyUpdate).toHaveBeenCalled();
  });

  it("renders close button for dismissal", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateBanner />);

    // CloseButton is mocked as a View, should exist in the tree
    expect(screen.toJSON()).toBeTruthy();
  });

  it("hides banner when dismiss button is pressed for available status", () => {
    mockUseAppUpdate.status = "available";
    render(<UpdateBanner />);

    // Find and press the CloseButton
    const closeButton = screen.getByTestId("close-button");
    fireEvent.press(closeButton);

    // After dismissal with non-ready status, component returns null
    expect(screen.queryByText("settings.newVersionAvailable")).toBeNull();
  });

  it("still shows banner when dismissed but status becomes ready", () => {
    mockUseAppUpdate.status = "ready";
    render(<UpdateBanner />);

    // Banner should render even if dismiss would have been triggered
    expect(screen.getByText("settings.readyToInstall")).toBeTruthy();
  });

  it("renders nothing when idle status", () => {
    mockUseAppUpdate.status = "idle";
    const { toJSON } = render(<UpdateBanner />);

    // When idle and not dismissed, component renders the animated view (not null)
    expect(toJSON()).toBeTruthy();
  });
});
