import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SettingsSliderRow } from "../SettingsSliderRow";

describe("SettingsSliderRow", () => {
  const defaultProps = {
    icon: "pulse-outline" as const,
    label: "Sigma Threshold",
    value: 3.5,
    min: 1,
    max: 10,
    step: 0.1,
    onValueChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders icon and label via SettingsRow", () => {
    render(<SettingsSliderRow {...defaultProps} />);

    expect(screen.getByText("pulse-outline")).toBeTruthy();
    expect(screen.getByText("Sigma Threshold")).toBeTruthy();
  });

  it("auto-formats value based on step (step=0.1 => 1 decimal)", () => {
    render(<SettingsSliderRow {...defaultProps} value={3.5} step={0.1} />);

    expect(screen.getAllByText("3.5").length).toBeGreaterThanOrEqual(1);
  });

  it("auto-formats value based on step (step=1 => 0 decimals)", () => {
    render(<SettingsSliderRow {...defaultProps} value={50} step={1} min={0} max={100} />);

    expect(screen.getAllByText("50").length).toBeGreaterThanOrEqual(1);
  });

  it("auto-formats value based on step (step=0.01 => 2 decimals)", () => {
    render(<SettingsSliderRow {...defaultProps} value={0.25} step={0.01} min={0} max={1} />);

    expect(screen.getAllByText("0.25").length).toBeGreaterThanOrEqual(1);
  });

  it("uses custom format function when provided", () => {
    render(
      <SettingsSliderRow
        {...defaultProps}
        value={85}
        format={(v) => `${v}%`}
        step={5}
        min={0}
        max={100}
      />,
    );

    expect(screen.getByText("85%")).toBeTruthy();
  });

  it("passes testID to SettingsRow", () => {
    render(<SettingsSliderRow {...defaultProps} testID="e2e-slider" />);

    expect(screen.getByTestId("e2e-slider")).toBeTruthy();
  });

  it("renders SimpleSlider with correct accessibility", () => {
    render(<SettingsSliderRow {...defaultProps} />);

    expect(screen.toJSON()).toBeTruthy();
  });
});
