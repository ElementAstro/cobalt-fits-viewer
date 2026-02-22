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

const mockAlert = jest.spyOn(require("react-native").Alert, "alert");

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

  it("shows delete confirmation alert on trash press", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    const buttons = screen.getAllByTestId("button");
    // The last button is the trash button
    const trashButton = buttons[buttons.length - 1];
    fireEvent.press(trashButton);
    expect(mockAlert).toHaveBeenCalledWith(
      "targets.batch.deleteSelected",
      expect.stringContaining("targets.batch.deleteConfirm"),
      expect.arrayContaining([
        expect.objectContaining({ style: "cancel" }),
        expect.objectContaining({ style: "destructive" }),
      ]),
    );
  });

  it("calls onExitSelectionMode when close pressed", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    // The first button is the close button
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);
    expect(defaultProps.onExitSelectionMode).toHaveBeenCalledTimes(1);
  });
});
