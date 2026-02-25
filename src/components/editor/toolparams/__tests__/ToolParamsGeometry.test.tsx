import React from "react";
import { render } from "@testing-library/react-native";
import { ToolParamsGeometry } from "../ToolParamsGeometry";

jest.mock("../../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../common/SimpleSlider", () => ({
  SimpleSlider: (props: Record<string, unknown>) => {
    const { Text } = require("react-native");
    return <Text testID={`slider-${props.label}`}>{props.label as string}</Text>;
  },
}));

const mockParams = {
  rotateAngle: 0,
  setRotateAngle: jest.fn(),
  bgGridSize: 8,
  setBgGridSize: jest.fn(),
} as never;

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
});
