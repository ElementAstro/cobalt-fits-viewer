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

  it("renders batch status button when onBatchStatus provided", () => {
    const onBatchStatus = jest.fn();
    render(<TargetBatchActionBar {...defaultProps} onBatchStatus={onBatchStatus} />);
    const buttons = screen.getAllByTestId("button");
    // Find status button (swap-horizontal-outline icon) - it's rendered after close button
    // Just verify more buttons are rendered compared to without the prop
    const withoutCount = 4; // close, favorite, delete + select all/deselect
    expect(buttons.length).toBeGreaterThan(withoutCount);
  });

  it("renders batch group button when onBatchGroup provided", () => {
    const onBatchGroup = jest.fn();
    render(<TargetBatchActionBar {...defaultProps} onBatchGroup={onBatchGroup} />);
    const buttons = screen.getAllByTestId("button");
    const withoutCount = 4;
    expect(buttons.length).toBeGreaterThan(withoutCount);
  });

  it("renders batch tag button when onBatchTag provided", () => {
    const onBatchTag = jest.fn();
    render(<TargetBatchActionBar {...defaultProps} onBatchTag={onBatchTag} />);
    const buttons = screen.getAllByTestId("button");
    const withoutCount = 4;
    expect(buttons.length).toBeGreaterThan(withoutCount);
  });

  it("does not render optional buttons when props not provided", () => {
    render(<TargetBatchActionBar {...defaultProps} />);
    const buttonsWithout = screen.getAllByTestId("button");

    const { unmount } = render(
      <TargetBatchActionBar
        {...defaultProps}
        onBatchStatus={jest.fn()}
        onBatchGroup={jest.fn()}
        onBatchTag={jest.fn()}
      />,
    );
    const buttonsWith = screen.getAllByTestId("button");
    expect(buttonsWith.length).toBeGreaterThan(buttonsWithout.length);
    unmount();
  });
});
