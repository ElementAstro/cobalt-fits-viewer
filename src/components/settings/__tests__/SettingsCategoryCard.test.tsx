import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SettingsCategoryCard } from "../SettingsCategoryCard";

jest.mock("../../../hooks/common/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

describe("SettingsCategoryCard", () => {
  const defaultProps = {
    icon: "eye-outline" as const,
    title: "Viewer",
    description: "Configure viewer settings",
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders icon, title, and description", () => {
    render(<SettingsCategoryCard {...defaultProps} />);

    expect(screen.getByText("eye-outline")).toBeTruthy();
    expect(screen.getByText("Viewer")).toBeTruthy();
    expect(screen.getByText("Configure viewer settings")).toBeTruthy();
  });

  it("renders badge when provided", () => {
    render(<SettingsCategoryCard {...defaultProps} badge="New" />);

    expect(screen.getByText("New")).toBeTruthy();
  });

  it("does not render badge when not provided", () => {
    render(<SettingsCategoryCard {...defaultProps} />);

    expect(screen.queryByText("New")).toBeNull();
  });

  it("fires onPress when pressed", () => {
    render(<SettingsCategoryCard {...defaultProps} testID="card" />);

    fireEvent.press(screen.getAllByTestId("card")[0]);
    expect(defaultProps.onPress).toHaveBeenCalledTimes(1);
  });

  it("renders chevron-forward icon", () => {
    render(<SettingsCategoryCard {...defaultProps} />);

    expect(screen.getByText("chevron-forward")).toBeTruthy();
  });

  it("has correct accessibility props", () => {
    render(<SettingsCategoryCard {...defaultProps} testID="card" />);

    const pressable = screen.getAllByTestId("card")[0];
    expect(pressable.props.accessibilityRole).toBe("button");
    expect(pressable.props.accessibilityLabel).toBe("Viewer");
  });

  it("passes testID through", () => {
    render(<SettingsCategoryCard {...defaultProps} testID="e2e-card" />);

    expect(screen.getByTestId("e2e-card")).toBeTruthy();
  });
});
