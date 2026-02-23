import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { XisfExportOptions } from "../XisfExportOptions";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("XisfExportOptions", () => {
  const defaultProps = {
    xisfCompression: "none" as const,
    onXisfCompressionChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders compression section label", () => {
    render(<XisfExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.xisfCompression")).toBeTruthy();
  });

  it("renders all compression preset chips", () => {
    render(<XisfExportOptions {...defaultProps} />);

    // Chip.Label has uppercase CSS class but text is rendered lowercase in mock
    expect(screen.getByText("none")).toBeTruthy();
    expect(screen.getByText("zlib")).toBeTruthy();
    expect(screen.getByText("lz4")).toBeTruthy();
  });

  it("calls onXisfCompressionChange with 'zlib' when pressed", () => {
    render(<XisfExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("zlib"));
    expect(defaultProps.onXisfCompressionChange).toHaveBeenCalledWith("zlib");
  });

  it("calls onXisfCompressionChange with 'lz4' when pressed", () => {
    render(<XisfExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("lz4"));
    expect(defaultProps.onXisfCompressionChange).toHaveBeenCalledWith("lz4");
  });

  it("calls onXisfCompressionChange with 'none' when pressed", () => {
    render(<XisfExportOptions {...defaultProps} xisfCompression="zlib" />);

    fireEvent.press(screen.getByText("none"));
    expect(defaultProps.onXisfCompressionChange).toHaveBeenCalledWith("none");
  });

  it("highlights selected compression chip as primary variant", () => {
    render(<XisfExportOptions {...defaultProps} xisfCompression="zlib" />);

    const chips = screen.getAllByTestId("chip");
    // none=secondary, zlib=primary, lz4=secondary
    expect(chips[0].props.variant).toBe("secondary");
    expect(chips[1].props.variant).toBe("primary");
    expect(chips[2].props.variant).toBe("secondary");
  });
});
