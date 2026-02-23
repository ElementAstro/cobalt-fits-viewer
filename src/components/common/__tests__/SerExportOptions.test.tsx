import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SerExportOptions } from "../SerExportOptions";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("SerExportOptions", () => {
  const defaultProps = {
    serLayout: "cube" as const,
    onSerLayoutChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders layout section label", () => {
    render(<SerExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.serLayout")).toBeTruthy();
  });

  it("renders cube and multi-hdu layout chips", () => {
    render(<SerExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.serLayoutCube")).toBeTruthy();
    expect(screen.getByText("converter.serLayoutMultiHdu")).toBeTruthy();
  });

  it("calls onSerLayoutChange with 'multi-hdu' when pressed", () => {
    render(<SerExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("converter.serLayoutMultiHdu"));
    expect(defaultProps.onSerLayoutChange).toHaveBeenCalledWith("multi-hdu");
  });

  it("calls onSerLayoutChange with 'cube' when pressed", () => {
    render(<SerExportOptions {...defaultProps} serLayout="multi-hdu" />);

    fireEvent.press(screen.getByText("converter.serLayoutCube"));
    expect(defaultProps.onSerLayoutChange).toHaveBeenCalledWith("cube");
  });

  it("highlights selected layout chip as primary variant", () => {
    render(<SerExportOptions {...defaultProps} serLayout="cube" />);

    // The cube chip should have primary variant, multi-hdu should have secondary
    const chips = screen.getAllByTestId("chip");
    expect(chips[0].props.variant).toBe("primary");
    expect(chips[1].props.variant).toBe("secondary");
  });
});
