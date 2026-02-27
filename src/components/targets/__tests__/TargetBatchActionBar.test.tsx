import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { TargetBatchActionBar } from "../TargetBatchActionBar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

describe("TargetBatchActionBar", () => {
  const defaultProps = {
    selectedCount: 3,
    totalCount: 10,
    onSelectAll: jest.fn(),
    onDeselectAll: jest.fn(),
    onBatchDelete: jest.fn(),
    onBatchFavorite: jest.fn(),
    onExitSelectionMode: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders selected count text", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    expect(screen.getByText(/3.*common\.selected/)).toBeTruthy();
  });

  it("shows Select All when not all selected", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    expect(screen.getByText("common.selectAll")).toBeTruthy();
  });

  it("shows Deselect All when all selected", () => {
    render(<TargetBatchActionBar {...defaultProps} selectedCount={10} />);
    expect(screen.getByText("common.deselectAll")).toBeTruthy();
  });

  it("calls onSelectAll when Select All pressed", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    fireEvent.press(screen.getByText("common.selectAll"));
    expect(defaultProps.onSelectAll).toHaveBeenCalledTimes(1);
  });

  it("calls onDeselectAll when Deselect All pressed", () => {
    render(<TargetBatchActionBar {...defaultProps} selectedCount={10} />);
    fireEvent.press(screen.getByText("common.deselectAll"));
    expect(defaultProps.onDeselectAll).toHaveBeenCalledTimes(1);
  });

  it("renders delete confirmation dialog with title and description", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    // Dialog is always rendered in the global mock (isOpen ignored)
    expect(screen.getByText("targets.batch.deleteSelected")).toBeTruthy();
    expect(
      screen.getByText(`targets.batch.deleteConfirm:${JSON.stringify({ count: 3 })}`),
    ).toBeTruthy();
  });

  it("calls onBatchDelete when dialog confirm is pressed", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    fireEvent.press(screen.getByText("common.delete"));
    expect(defaultProps.onBatchDelete).toHaveBeenCalledTimes(1);
  });

  it("calls onExitSelectionMode when close pressed", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    // The first button is the close button
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);
    expect(defaultProps.onExitSelectionMode).toHaveBeenCalledTimes(1);
  });
});
