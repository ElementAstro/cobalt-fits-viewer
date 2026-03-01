import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { EditorHeader } from "../EditorHeader";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const defaultProps = {
  filename: "test.fits",
  successColor: "#00ff00",
  mutedColor: "#999999",
  contentPaddingTop: 0,
  horizontalPadding: 16,
  canUndo: false,
  canRedo: false,
  hasData: true,
  showOriginal: false,
  historyIndex: 0,
  historyLength: 1,
  editorError: null as string | null,
  fitsError: null as string | null,
  onBack: jest.fn(),
  onUndo: jest.fn(),
  onRedo: jest.fn(),
  onExport: jest.fn(),
  onToggleOriginal: jest.fn(),
  onClearError: jest.fn(),
};

describe("EditorHeader", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders the filename", () => {
    const { getByText } = render(<EditorHeader {...defaultProps} />);
    expect(getByText(/test\.fits/)).toBeTruthy();
  });

  it("renders undo button as disabled when canUndo is false", () => {
    const { getByTestId } = render(<EditorHeader {...defaultProps} canUndo={false} />);
    const btn = getByTestId("e2e-action-editor__param_id-undo");
    expect(btn.props.isDisabled).toBe(true);
  });

  it("renders redo button as disabled when canRedo is false", () => {
    const { getByTestId } = render(<EditorHeader {...defaultProps} canRedo={false} />);
    const btn = getByTestId("e2e-action-editor__param_id-redo");
    expect(btn.props.isDisabled).toBe(true);
  });

  it("shows editor error alert when editorError is set", () => {
    const { getByText } = render(
      <EditorHeader {...defaultProps} editorError="Something went wrong" />,
    );
    expect(getByText("Something went wrong")).toBeTruthy();
  });

  it("shows fits error alert when fitsError is set", () => {
    const { getByText } = render(<EditorHeader {...defaultProps} fitsError="FITS load error" />);
    expect(getByText("FITS load error")).toBeTruthy();
  });

  it("does not render error section when no errors", () => {
    const { queryByText } = render(<EditorHeader {...defaultProps} />);
    expect(queryByText("common.error")).toBeNull();
  });

  it("shows history indicator when historyLength > 1", () => {
    const { getByText } = render(
      <EditorHeader {...defaultProps} historyIndex={2} historyLength={5} />,
    );
    expect(getByText(/2\/4/)).toBeTruthy();
  });

  it("does not show history indicator when historyLength <= 1", () => {
    const { queryByText } = render(
      <EditorHeader {...defaultProps} historyIndex={0} historyLength={1} />,
    );
    expect(queryByText("editor.edits")).toBeNull();
  });

  it("calls onBack when back button is pressed", () => {
    const onBack = jest.fn();
    const { getByTestId } = render(<EditorHeader {...defaultProps} onBack={onBack} />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-back"));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("calls onExport when export button is pressed", () => {
    const onExport = jest.fn();
    const { getByTestId } = render(<EditorHeader {...defaultProps} onExport={onExport} />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-open-export"));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("calls onUndo when undo button is pressed", () => {
    const onUndo = jest.fn();
    const { getByTestId } = render(
      <EditorHeader {...defaultProps} canUndo={true} onUndo={onUndo} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-undo"));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it("calls onRedo when redo button is pressed", () => {
    const onRedo = jest.fn();
    const { getByTestId } = render(
      <EditorHeader {...defaultProps} canRedo={true} onRedo={onRedo} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-redo"));
    expect(onRedo).toHaveBeenCalledTimes(1);
  });

  it("calls onToggleOriginal when toggle button is pressed", () => {
    const onToggleOriginal = jest.fn();
    const { getByTestId } = render(
      <EditorHeader
        {...defaultProps}
        hasData={true}
        historyLength={3}
        onToggleOriginal={onToggleOriginal}
      />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-toggle-original"));
    expect(onToggleOriginal).toHaveBeenCalledTimes(1);
  });

  it("disables toggle-original when hasData is false", () => {
    const { getByTestId } = render(<EditorHeader {...defaultProps} hasData={false} />);
    const btn = getByTestId("e2e-action-editor__param_id-toggle-original");
    expect(btn.props.isDisabled).toBe(true);
  });

  it("disables export when hasData is false", () => {
    const { getByTestId } = render(<EditorHeader {...defaultProps} hasData={false} />);
    const btn = getByTestId("e2e-action-editor__param_id-open-export");
    expect(btn.props.isDisabled).toBe(true);
  });

  it("calls onClearError when close button in error alert is pressed", () => {
    const onClearError = jest.fn();
    const { getByText } = render(
      <EditorHeader {...defaultProps} editorError="err" onClearError={onClearError} />,
    );
    fireEvent.press(getByText("common.close"));
    expect(onClearError).toHaveBeenCalledTimes(1);
  });

  it("shows both editorError and fitsError simultaneously", () => {
    const { getByText } = render(
      <EditorHeader {...defaultProps} editorError="Editor fail" fitsError="FITS fail" />,
    );
    expect(getByText("Editor fail")).toBeTruthy();
    expect(getByText("FITS fail")).toBeTruthy();
  });

  it("disables toggle-original when historyLength <= 1 even with hasData", () => {
    const { getByTestId } = render(
      <EditorHeader {...defaultProps} hasData={true} historyLength={1} />,
    );
    const btn = getByTestId("e2e-action-editor__param_id-toggle-original");
    expect(btn.props.isDisabled).toBe(true);
  });

  it("renders toggle-original as primary variant when showOriginal is true", () => {
    const { getByTestId } = render(
      <EditorHeader {...defaultProps} hasData={true} historyLength={3} showOriginal={true} />,
    );
    const btn = getByTestId("e2e-action-editor__param_id-toggle-original");
    expect(btn.props.variant).toBe("primary");
  });
});
