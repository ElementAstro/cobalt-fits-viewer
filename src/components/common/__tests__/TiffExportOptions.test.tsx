import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { TiffExportOptions } from "../TiffExportOptions";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("TiffExportOptions", () => {
  const defaultProps = {
    tiffCompression: "lzw" as const,
    tiffMultipage: "preserve" as const,
    onTiffCompressionChange: jest.fn(),
    onTiffMultipageChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders compression section label", () => {
    render(<TiffExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.tiffCompression")).toBeTruthy();
  });

  it("renders compression chips (lzw, deflate, none)", () => {
    render(<TiffExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.tiffCompressionLzw")).toBeTruthy();
    expect(screen.getByText("converter.tiffCompressionDeflate")).toBeTruthy();
    expect(screen.getByText("converter.tiffCompressionNone")).toBeTruthy();
  });

  it("calls onTiffCompressionChange when compression chip is pressed", () => {
    render(<TiffExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("converter.tiffCompressionDeflate"));
    expect(defaultProps.onTiffCompressionChange).toHaveBeenCalledWith("deflate");
  });

  it("renders multipage section label", () => {
    render(<TiffExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.multipage")).toBeTruthy();
  });

  it("renders multipage mode chips", () => {
    render(<TiffExportOptions {...defaultProps} />);

    expect(screen.getByText("converter.multipagePreserve")).toBeTruthy();
    expect(screen.getByText("converter.multipageFirstFrame")).toBeTruthy();
  });

  it("calls onTiffMultipageChange when multipage chip is pressed", () => {
    render(<TiffExportOptions {...defaultProps} />);

    fireEvent.press(screen.getByText("converter.multipageFirstFrame"));
    expect(defaultProps.onTiffMultipageChange).toHaveBeenCalledWith("firstFrame");
  });

  it("renders bit depth chips when onTiffBitDepthChange and tiffBitDepth are provided", () => {
    const onBitDepthChange = jest.fn();
    render(
      <TiffExportOptions
        {...defaultProps}
        tiffBitDepth={16}
        onTiffBitDepthChange={onBitDepthChange}
      />,
    );

    expect(screen.getByText("converter.bitDepth")).toBeTruthy();
    expect(screen.getByText("8-bit")).toBeTruthy();
    expect(screen.getByText("16-bit")).toBeTruthy();
    expect(screen.getByText("32-bit")).toBeTruthy();
  });

  it("calls onTiffBitDepthChange when bit depth chip is pressed", () => {
    const onBitDepthChange = jest.fn();
    render(
      <TiffExportOptions
        {...defaultProps}
        tiffBitDepth={16}
        onTiffBitDepthChange={onBitDepthChange}
      />,
    );

    fireEvent.press(screen.getByText("32-bit"));
    expect(onBitDepthChange).toHaveBeenCalledWith(32);
  });

  it("does not render bit depth section when props are missing", () => {
    render(<TiffExportOptions {...defaultProps} />);

    expect(screen.queryByText("converter.bitDepth")).toBeNull();
  });

  it("renders DPI chips when onTiffDpiChange and tiffDpi are provided", () => {
    const onDpiChange = jest.fn();
    render(<TiffExportOptions {...defaultProps} tiffDpi={72} onTiffDpiChange={onDpiChange} />);

    expect(screen.getByText("converter.dpi")).toBeTruthy();
    expect(screen.getByText("72")).toBeTruthy();
    expect(screen.getByText("150")).toBeTruthy();
    expect(screen.getByText("300")).toBeTruthy();
    expect(screen.getByText("600")).toBeTruthy();
  });

  it("calls onTiffDpiChange when DPI chip is pressed", () => {
    const onDpiChange = jest.fn();
    render(<TiffExportOptions {...defaultProps} tiffDpi={72} onTiffDpiChange={onDpiChange} />);

    fireEvent.press(screen.getByText("300"));
    expect(onDpiChange).toHaveBeenCalledWith(300);
  });

  it("does not render DPI section when props are missing", () => {
    render(<TiffExportOptions {...defaultProps} />);

    expect(screen.queryByText("converter.dpi")).toBeNull();
  });
});
