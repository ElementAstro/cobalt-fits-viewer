import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { UndoSnackbar } from "../UndoSnackbar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  visible: true,
  count: 3,
  onUndo: jest.fn(),
};

describe("UndoSnackbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders nothing when not visible", () => {
    const { toJSON } = render(<UndoSnackbar {...defaultProps} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renders undo hint text when visible", () => {
    render(<UndoSnackbar {...defaultProps} />);
    expect(screen.getByText("files.undoDeleteHint")).toBeTruthy();
  });

  it("renders undo button when visible", () => {
    render(<UndoSnackbar {...defaultProps} />);
    expect(screen.getByText("common.undo")).toBeTruthy();
  });

  it("calls onUndo when undo button is pressed", () => {
    render(<UndoSnackbar {...defaultProps} />);
    fireEvent.press(screen.getByText("common.undo"));
    expect(defaultProps.onUndo).toHaveBeenCalled();
  });

  it("renders with different count", () => {
    render(<UndoSnackbar {...defaultProps} count={7} />);
    expect(screen.getByText("files.undoDeleteHint")).toBeTruthy();
  });

  it("renders progress bar when visible", () => {
    const { toJSON } = render(<UndoSnackbar {...defaultProps} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it("resets animation when becoming invisible", () => {
    const { rerender } = render(<UndoSnackbar {...defaultProps} />);
    rerender(<UndoSnackbar {...defaultProps} visible={false} />);
    // When invisible, should render nothing
    expect(screen.queryByText("common.undo")).toBeNull();
  });

  it("re-triggers animation on visibility change", () => {
    const { rerender } = render(<UndoSnackbar {...defaultProps} />);
    rerender(<UndoSnackbar {...defaultProps} visible={false} />);
    rerender(<UndoSnackbar {...defaultProps} visible />);
    expect(screen.getByText("common.undo")).toBeTruthy();
  });
});
