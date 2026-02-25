import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SettingsHeader } from "../SettingsHeader";

const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ back: mockBack }),
}));

describe("SettingsHeader", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title text", () => {
    render(<SettingsHeader title="Processing" />);

    expect(screen.getByText("Processing")).toBeTruthy();
  });

  it("renders back arrow icon", () => {
    render(<SettingsHeader title="Test" />);

    expect(screen.getByText("arrow-back")).toBeTruthy();
  });

  it("calls router.back() when back button is pressed", () => {
    render(<SettingsHeader title="Test" testID="back-btn" />);

    fireEvent.press(screen.getByTestId("back-btn"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("passes testID to back button", () => {
    render(<SettingsHeader title="Test" testID="e2e-back" />);

    expect(screen.getByTestId("e2e-back")).toBeTruthy();
  });

  it("has correct accessibility props on back button", () => {
    render(<SettingsHeader title="Test" testID="back-btn" />);

    const btn = screen.getByTestId("back-btn");
    expect(btn.props.accessibilityRole).toBe("button");
    expect(btn.props.accessibilityLabel).toBe("Go back");
  });
});
