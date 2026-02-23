import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { FilesSelectionBar } from "../FilesSelectionBar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  selectedCount: 3,
  isLandscape: false,
  onBatchConvert: jest.fn(),
  onStacking: jest.fn(),
};

describe("FilesSelectionBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders selected count text", () => {
    render(<FilesSelectionBar {...defaultProps} />);
    expect(screen.getByText(/3/)).toBeTruthy();
    expect(screen.getByText(/common\.selected/)).toBeTruthy();
  });

  it("renders batch convert button label in portrait", () => {
    render(<FilesSelectionBar {...defaultProps} />);
    expect(screen.getByText("converter.batchConvert")).toBeTruthy();
  });

  it("renders stacking button label in portrait", () => {
    render(<FilesSelectionBar {...defaultProps} />);
    expect(screen.getByText("gallery.batchStack")).toBeTruthy();
  });

  it("hides button labels in landscape mode", () => {
    render(<FilesSelectionBar {...defaultProps} isLandscape />);
    expect(screen.queryByText("converter.batchConvert")).toBeNull();
    expect(screen.queryByText("gallery.batchStack")).toBeNull();
  });

  it("calls onBatchConvert when convert button is pressed", () => {
    render(<FilesSelectionBar {...defaultProps} />);
    fireEvent.press(screen.getByText("converter.batchConvert"));
    expect(defaultProps.onBatchConvert).toHaveBeenCalled();
  });

  it("calls onStacking when stacking button is pressed", () => {
    render(<FilesSelectionBar {...defaultProps} />);
    fireEvent.press(screen.getByText("gallery.batchStack"));
    expect(defaultProps.onStacking).toHaveBeenCalled();
  });

  it("disables buttons when selectedCount is 0", () => {
    render(<FilesSelectionBar {...defaultProps} selectedCount={0} />);
    expect(screen.getByText(/0/)).toBeTruthy();
  });

  it("renders stacking button with testID", () => {
    render(<FilesSelectionBar {...defaultProps} />);
    expect(screen.getByTestId("files-go-to-stacking-button")).toBeTruthy();
  });
});
