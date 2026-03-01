import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ToolParamsGeometry } from "../ToolParamsGeometry";

jest.mock("../../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../common/SimpleSlider", () => ({
  SimpleSlider: (props: Record<string, unknown>) => {
    const RN = require("react-native");
    const R = require("react");
    const cb = props.onValueChange;
    return R.createElement(
      RN.Pressable,
      { testID: `slider-${props.label}`, onPress: () => typeof cb === "function" && cb(5.7) },
      R.createElement(RN.Text, null, props.label),
    );
  },
}));

const mockParamsRaw = {
  rotateAngle: 0,
  setRotateAngle: jest.fn(),
  bgGridSize: 8,
  setBgGridSize: jest.fn(),
};
const mockParams = mockParamsRaw as never;

const mockQuickAction = jest.fn();

describe("ToolParamsGeometry", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders rotate buttons for rotate tool", () => {
    const { getByText } = render(
      <ToolParamsGeometry
        activeTool="rotate"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    expect(getByText("editor.paramRotate90CW")).toBeTruthy();
    expect(getByText("editor.paramRotate90CCW")).toBeTruthy();
    expect(getByText("editor.paramRotate180")).toBeTruthy();
  });

  it("renders flip buttons for flip tool", () => {
    const { getByText } = render(
      <ToolParamsGeometry activeTool="flip" params={mockParams} onQuickAction={mockQuickAction} />,
    );
    expect(getByText("editor.paramHorizontal")).toBeTruthy();
    expect(getByText("editor.paramVertical")).toBeTruthy();
  });

  it("renders angle slider for rotateCustom tool", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotateCustom"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    expect(getByTestId("slider-editor.paramAngle")).toBeTruthy();
  });

  it("renders grid size slider for background tool", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="background"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    expect(getByTestId("slider-editor.paramGridSize")).toBeTruthy();
  });

  it("returns null for unknown tool", () => {
    const { toJSON } = render(
      <ToolParamsGeometry
        activeTool={"unknown" as never}
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it("rounds bgGridSize via Math.round", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="background"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("slider-editor.paramGridSize"));
    expect(mockParamsRaw.setBgGridSize).toHaveBeenCalledWith(6);
  });

  it("calls onQuickAction with rotate90cw when CW button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotate"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-rotate90cw"));
    expect(mockQuickAction).toHaveBeenCalledWith({ type: "rotate90cw" });
  });

  it("calls onQuickAction with rotate90ccw when CCW button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotate"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-rotate90ccw"));
    expect(mockQuickAction).toHaveBeenCalledWith({ type: "rotate90ccw" });
  });

  it("calls onQuickAction with rotate180 when 180 button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotate"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-rotate180"));
    expect(mockQuickAction).toHaveBeenCalledWith({ type: "rotate180" });
  });

  it("calls onQuickAction with flipH when horizontal button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry activeTool="flip" params={mockParams} onQuickAction={mockQuickAction} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-flip-h"));
    expect(mockQuickAction).toHaveBeenCalledWith({ type: "flipH" });
  });

  it("calls onQuickAction with flipV when vertical button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry activeTool="flip" params={mockParams} onQuickAction={mockQuickAction} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-flip-v"));
    expect(mockQuickAction).toHaveBeenCalledWith({ type: "flipV" });
  });

  it("calls setRotateAngle via rotateCustom slider", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotateCustom"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("slider-editor.paramAngle"));
    expect(mockParamsRaw.setRotateAngle).toHaveBeenCalledWith(5.7);
  });
});
