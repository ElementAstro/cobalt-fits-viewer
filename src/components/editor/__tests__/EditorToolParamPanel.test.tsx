import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { EditorToolParamPanel } from "../EditorToolParamPanel";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../toolparams", () => {
  const RN = require("react-native");
  const R = require("react");
  return {
    ToolParamsGeometry: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: "tool-params-geometry", ...props }),
    ToolParamsSlider: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: "tool-params-adjust", ...props }),
    ToolParamsProcess: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: "tool-params-process", ...props }),
    ToolParamsMask: (props: Record<string, unknown>) =>
      R.createElement(RN.View, { testID: "tool-params-mask", ...props }),
  };
});

const mockParams = {} as never;

const defaultProps = {
  activeTool: "blur" as import("../../../hooks/useEditorToolState").EditorTool,
  params: mockParams,
  successColor: "#00ff00",
  onApply: jest.fn(),
  onCancel: jest.fn(),
  onQuickAction: jest.fn(),
};

describe("EditorToolParamPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns null when activeTool is null", () => {
    const { toJSON } = render(<EditorToolParamPanel {...defaultProps} activeTool={null} />);
    expect(toJSON()).toBeNull();
  });

  it("renders the tool label", () => {
    const { getByText } = render(<EditorToolParamPanel {...defaultProps} activeTool="blur" />);
    expect(getByText("editor.blur")).toBeTruthy();
  });

  it("renders Apply and Cancel buttons", () => {
    const { getByText } = render(<EditorToolParamPanel {...defaultProps} />);
    expect(getByText("editor.apply")).toBeTruthy();
    expect(getByText("common.cancel")).toBeTruthy();
  });

  it("renders Reset button when onReset is provided", () => {
    const { getByText } = render(<EditorToolParamPanel {...defaultProps} onReset={jest.fn()} />);
    expect(getByText("common.reset")).toBeTruthy();
  });

  it("does not render Reset button when onReset is not provided", () => {
    const { queryByText } = render(<EditorToolParamPanel {...defaultProps} />);
    expect(queryByText("common.reset")).toBeNull();
  });

  it("routes geometry tool to ToolParamsGeometry", () => {
    const { getByTestId } = render(<EditorToolParamPanel {...defaultProps} activeTool="rotate" />);
    expect(getByTestId("tool-params-geometry")).toBeTruthy();
  });

  it("routes adjust tool to ToolParamsAdjust", () => {
    const { getByTestId } = render(<EditorToolParamPanel {...defaultProps} activeTool="blur" />);
    expect(getByTestId("tool-params-adjust")).toBeTruthy();
  });

  it("routes mask tool to ToolParamsMask", () => {
    const { getByTestId } = render(
      <EditorToolParamPanel {...defaultProps} activeTool="starMask" />,
    );
    expect(getByTestId("tool-params-mask")).toBeTruthy();
  });

  it("routes other tools to ToolParamsProcess (default)", () => {
    const { getByTestId } = render(<EditorToolParamPanel {...defaultProps} activeTool="clahe" />);
    expect(getByTestId("tool-params-process")).toBeTruthy();
  });

  it("calls onApply when Apply button is pressed", () => {
    const onApply = jest.fn();
    const { getByText } = render(<EditorToolParamPanel {...defaultProps} onApply={onApply} />);
    fireEvent.press(getByText("editor.apply"));
    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Cancel button is pressed", () => {
    const onCancel = jest.fn();
    const { getByText } = render(<EditorToolParamPanel {...defaultProps} onCancel={onCancel} />);
    fireEvent.press(getByText("common.cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onReset when Reset button is pressed", () => {
    const onReset = jest.fn();
    const { getByText } = render(<EditorToolParamPanel {...defaultProps} onReset={onReset} />);
    fireEvent.press(getByText("common.reset"));
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
