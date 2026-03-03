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
  rotateMode: "rotate90cw" as const,
  setRotateMode: jest.fn(),
  flipMode: "flipH" as const,
  setFlipMode: jest.fn(),
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

  it("sets rotateMode to rotate90cw when CW button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotate"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-rotate90cw"));
    expect(mockParamsRaw.setRotateMode).toHaveBeenCalledWith("rotate90cw");
  });

  it("sets rotateMode to rotate90ccw when CCW button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotate"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-rotate90ccw"));
    expect(mockParamsRaw.setRotateMode).toHaveBeenCalledWith("rotate90ccw");
  });

  it("sets rotateMode to rotate180 when 180 button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry
        activeTool="rotate"
        params={mockParams}
        onQuickAction={mockQuickAction}
      />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-rotate180"));
    expect(mockParamsRaw.setRotateMode).toHaveBeenCalledWith("rotate180");
  });

  it("sets flipMode to flipH when horizontal button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry activeTool="flip" params={mockParams} onQuickAction={mockQuickAction} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-flip-h"));
    expect(mockParamsRaw.setFlipMode).toHaveBeenCalledWith("flipH");
  });

  it("sets flipMode to flipV when vertical button is pressed", () => {
    const { getByTestId } = render(
      <ToolParamsGeometry activeTool="flip" params={mockParams} onQuickAction={mockQuickAction} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-flip-v"));
    expect(mockParamsRaw.setFlipMode).toHaveBeenCalledWith("flipV");
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

  it("calls onParamChange when slider params are updated", () => {
    const onParamChange = jest.fn();
    const { getByTestId, rerender } = render(
      <ToolParamsGeometry
        activeTool="rotateCustom"
        params={mockParams}
        onQuickAction={mockQuickAction}
        onParamChange={onParamChange}
      />,
    );
    fireEvent.press(getByTestId("slider-editor.paramAngle"));
    expect(onParamChange).toHaveBeenCalledTimes(1);

    rerender(
      <ToolParamsGeometry
        activeTool="background"
        params={mockParams}
        onQuickAction={mockQuickAction}
        onParamChange={onParamChange}
      />,
    );
    fireEvent.press(getByTestId("slider-editor.paramGridSize"));
    expect(onParamChange).toHaveBeenCalledTimes(2);
  });
});
