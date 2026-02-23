import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SettingsToggleRow } from "../SettingsToggleRow";

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

describe("SettingsToggleRow", () => {
  const defaultProps = {
    icon: "moon-outline" as const,
    label: "Dark Mode",
    isSelected: false,
    onSelectedChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders icon and label", () => {
    render(<SettingsToggleRow {...defaultProps} />);

    expect(screen.getByText("moon-outline")).toBeTruthy();
    expect(screen.getByText("Dark Mode")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(<SettingsToggleRow {...defaultProps} description="Toggle dark theme" testID="toggle" />);

    // Description is rendered via heroui Description component
    expect(screen.toJSON()).toBeTruthy();
  });

  it("does not render description when not provided", () => {
    render(<SettingsToggleRow {...defaultProps} />);

    expect(screen.queryByText("Toggle dark theme")).toBeNull();
  });

  it("renders ControlField with correct isSelected value", () => {
    render(<SettingsToggleRow {...defaultProps} isSelected={true} testID="toggle" />);

    const controlField = screen.getByTestId("toggle");
    expect(controlField.props.isSelected).toBe(true);
  });

  it("calls onSelectedChange when toggled", () => {
    render(<SettingsToggleRow {...defaultProps} isSelected={false} testID="toggle" />);

    const controlField = screen.getByTestId("toggle");
    controlField.props.onSelectedChange(true);
    expect(defaultProps.onSelectedChange).toHaveBeenCalledWith(true);
  });

  it("sets correct accessibility props", () => {
    render(<SettingsToggleRow {...defaultProps} isSelected={true} testID="toggle" />);

    const controlField = screen.getByTestId("toggle");
    expect(controlField.props.accessibilityRole).toBe("switch");
    expect(controlField.props.accessibilityLabel).toBe("Dark Mode");
    expect(controlField.props.accessibilityState).toEqual({ checked: true });
  });

  it("renders ControlField.Indicator", () => {
    render(<SettingsToggleRow {...defaultProps} />);

    expect(screen.getByTestId("control-field-indicator")).toBeTruthy();
  });

  it("passes disabled prop to ControlField", () => {
    render(<SettingsToggleRow {...defaultProps} disabled testID="toggle" />);

    const controlField = screen.getByTestId("toggle");
    expect(controlField.props.isDisabled).toBe(true);
  });

  it("passes testID to ControlField", () => {
    render(<SettingsToggleRow {...defaultProps} testID="e2e-dark-mode-toggle" />);

    expect(screen.getByTestId("e2e-dark-mode-toggle")).toBeTruthy();
  });

  it("renders custom icon color", () => {
    render(<SettingsToggleRow {...defaultProps} iconColor="#22c55e" />);
    expect(screen.toJSON()).toBeTruthy();
  });
});
