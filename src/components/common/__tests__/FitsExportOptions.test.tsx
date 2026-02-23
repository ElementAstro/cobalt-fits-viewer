import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { FitsExportOptions } from "../FitsExportOptions";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  fitsMode: "scientific" as const,
  fitsCompression: "none" as const,
  fitsBitpix: 16 as const,
  fitsColorLayout: "rgbCube3d" as const,
  fitsPreserveOriginalHeader: true,
  fitsPreserveWcs: true,
  fitsScientificAvailable: true,
  onFitsModeChange: jest.fn(),
  onFitsCompressionChange: jest.fn(),
  onFitsBitpixChange: jest.fn(),
  onFitsColorLayoutChange: jest.fn(),
  onFitsPreserveOriginalHeaderChange: jest.fn(),
  onFitsPreserveWcsChange: jest.fn(),
};

describe("FitsExportOptions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders all section labels", () => {
    render(<FitsExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.fitsMode")).toBeTruthy();
    expect(screen.getByText("converter.fitsCompression")).toBeTruthy();
    expect(screen.getByText("converter.bitpix")).toBeTruthy();
    expect(screen.getByText("converter.fitsColorLayout")).toBeTruthy();
    expect(screen.getByText("converter.fitsPreserve")).toBeTruthy();
  });

  it("renders mode chips (scientific and rendered)", () => {
    render(<FitsExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.fitsModeScientific")).toBeTruthy();
    expect(screen.getByText("converter.fitsModeRendered")).toBeTruthy();
  });

  it("calls onFitsModeChange when rendered mode is pressed", () => {
    render(<FitsExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("converter.fitsModeRendered"));
    expect(defaultProps.onFitsModeChange).toHaveBeenCalledWith("rendered");
  });

  it("renders compression chips", () => {
    render(<FitsExportOptions {...defaultProps} />);

    // Chip.Label has uppercase CSS class but text content is lowercase in mock
    expect(screen.getByText("none")).toBeTruthy();
    expect(screen.getByText("gzip")).toBeTruthy();
  });

  it("calls onFitsCompressionChange when compression chip is pressed", () => {
    render(<FitsExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("gzip"));
    expect(defaultProps.onFitsCompressionChange).toHaveBeenCalledWith("gzip");
  });

  it("renders bitpix preset chips", () => {
    render(<FitsExportOptions {...defaultProps} />);

    expect(screen.getByText("8")).toBeTruthy();
    expect(screen.getByText("16")).toBeTruthy();
    expect(screen.getByText("32")).toBeTruthy();
    expect(screen.getByText("-32")).toBeTruthy();
    expect(screen.getByText("-64")).toBeTruthy();
  });

  it("calls onFitsBitpixChange when bitpix chip is pressed", () => {
    render(<FitsExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("-32"));
    expect(defaultProps.onFitsBitpixChange).toHaveBeenCalledWith(-32);
  });

  it("renders color layout chips", () => {
    render(<FitsExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.fitsColorLayoutRgbCube3d")).toBeTruthy();
    expect(screen.getByText("converter.fitsColorLayoutMono2d")).toBeTruthy();
  });

  it("calls onFitsColorLayoutChange when layout chip is pressed", () => {
    render(<FitsExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("converter.fitsColorLayoutMono2d"));
    expect(defaultProps.onFitsColorLayoutChange).toHaveBeenCalledWith("mono2d");
  });

  it("renders preserve header and WCS chips", () => {
    render(<FitsExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.fitsPreserveHeader")).toBeTruthy();
    expect(screen.getByText("converter.fitsPreserveWcs")).toBeTruthy();
  });

  it("calls onFitsPreserveOriginalHeaderChange when preserve header is toggled", () => {
    render(<FitsExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("converter.fitsPreserveHeader"));
    expect(defaultProps.onFitsPreserveOriginalHeaderChange).toHaveBeenCalledWith(false);
  });

  it("calls onFitsPreserveWcsChange when preserve WCS is toggled", () => {
    render(<FitsExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("converter.fitsPreserveWcs"));
    expect(defaultProps.onFitsPreserveWcsChange).toHaveBeenCalledWith(false);
  });

  it("shows unavailable message when scientific mode is not available", () => {
    render(<FitsExportOptions {...defaultProps} fitsScientificAvailable={false} />);

    expect(screen.getByTestId("e2e-text-export-dialog-fits-unavailable")).toBeTruthy();
    expect(screen.getByText("converter.fitsScientificUnavailable")).toBeTruthy();
  });

  it("does not show unavailable message when scientific mode is available", () => {
    render(<FitsExportOptions {...defaultProps} fitsScientificAvailable={true} />);

    expect(screen.queryByTestId("e2e-text-export-dialog-fits-unavailable")).toBeNull();
  });
});
