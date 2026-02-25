import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import SettingsHubScreen from "../SettingsHubScreen";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (k: string) => k }),
}));

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    contentPaddingTop: 0,
    horizontalPadding: 16,
    isLandscapeTablet: false,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

describe("SettingsHubScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders screen container with testID", () => {
    render(<SettingsHubScreen />);

    expect(screen.getByTestId("e2e-screen-settings__index")).toBeTruthy();
  });

  it("renders settings title", () => {
    render(<SettingsHubScreen />);

    expect(screen.getByText("settings.title")).toBeTruthy();
  });

  it("renders all 7 category cards", () => {
    render(<SettingsHubScreen />);

    expect(screen.getByTestId("e2e-action-settings__index-open-viewer")).toBeTruthy();
    expect(screen.getByTestId("e2e-action-settings__index-open-gallery")).toBeTruthy();
    expect(screen.getByTestId("e2e-action-settings__index-open-processing")).toBeTruthy();
    expect(screen.getByTestId("e2e-action-settings__index-open-observation")).toBeTruthy();
    expect(screen.getByTestId("e2e-action-settings__index-open-appearance")).toBeTruthy();
    expect(screen.getByTestId("e2e-action-settings__index-open-storage")).toBeTruthy();
    expect(screen.getByTestId("e2e-action-settings__index-open-about")).toBeTruthy();
  });

  it("navigates to correct route when category card is pressed", () => {
    render(<SettingsHubScreen />);

    fireEvent.press(screen.getByTestId("e2e-action-settings__index-open-viewer"));
    expect(mockPush).toHaveBeenCalledWith("/settings/viewer");
  });

  it("renders search input", () => {
    render(<SettingsHubScreen />);

    expect(screen.getByTestId("e2e-action-settings__index-search")).toBeTruthy();
  });

  it("filters categories based on search query", () => {
    render(<SettingsHubScreen />);

    const searchInput = screen.getByTestId("e2e-action-settings__index-search");
    fireEvent.changeText(searchInput, "zscale");

    expect(screen.getByTestId("e2e-action-settings__index-open-viewer")).toBeTruthy();
    expect(screen.queryByTestId("e2e-action-settings__index-open-gallery")).toBeNull();
  });

  it("shows empty state when search has no matches", () => {
    render(<SettingsHubScreen />);

    const searchInput = screen.getByTestId("e2e-action-settings__index-search");
    fireEvent.changeText(searchInput, "xyznonexistent");

    expect(screen.getByText("common.noData")).toBeTruthy();
  });
});
