import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ToolParamsMask } from "../ToolParamsMask";

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
  starMaskScale: 1.5,
  setStarMaskScale: jest.fn(),
  starMaskInvert: false,
  setStarMaskInvert: jest.fn(),
  starMaskGrowth: 0,
  setStarMaskGrowth: jest.fn(),
  starMaskSoftness: 0,
  setStarMaskSoftness: jest.fn(),
  rangeMaskLow: 0,
  setRangeMaskLow: jest.fn(),
  rangeMaskHigh: 1,
  setRangeMaskHigh: jest.fn(),
  rangeMaskFuzz: 0.1,
  setRangeMaskFuzz: jest.fn(),
  binarizeThreshold: 0.5,
  setBinarizeThreshold: jest.fn(),
  edgeMaskPreBlur: 1,
  setEdgeMaskPreBlur: jest.fn(),
  edgeMaskThreshold: 0.1,
  setEdgeMaskThreshold: jest.fn(),
  edgeMaskPostBlur: 1,
  setEdgeMaskPostBlur: jest.fn(),
};
const mockParams = mockParamsRaw as never;

describe("ToolParamsMask", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders scale slider and mode buttons for starMask", () => {
    const { getByTestId, getByText } = render(
      <ToolParamsMask activeTool="starMask" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramScale")).toBeTruthy();
    expect(getByTestId("slider-editor.paramGrowth")).toBeTruthy();
    expect(getByTestId("slider-editor.paramSoftness")).toBeTruthy();
    expect(getByText("editor.paramIsolateStars")).toBeTruthy();
    expect(getByText("editor.paramRemoveStars")).toBeTruthy();
  });

  it("renders 3 sliders for rangeMask", () => {
    const { getByTestId } = render(<ToolParamsMask activeTool="rangeMask" params={mockParams} />);
    expect(getByTestId("slider-editor.paramLow")).toBeTruthy();
    expect(getByTestId("slider-editor.paramHigh")).toBeTruthy();
    expect(getByTestId("slider-editor.paramFuzziness")).toBeTruthy();
  });

  it("renders threshold slider for binarize", () => {
    const { getByTestId } = render(<ToolParamsMask activeTool="binarize" params={mockParams} />);
    expect(getByTestId("slider-editor.paramThreshold")).toBeTruthy();
  });

  it("returns null for unknown tool", () => {
    const { toJSON } = render(
      <ToolParamsMask activeTool={"unknown" as never} params={mockParams} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("calls setStarMaskInvert(true) when remove stars button is pressed", () => {
    const { getByText } = render(<ToolParamsMask activeTool="starMask" params={mockParams} />);
    fireEvent.press(getByText("editor.paramRemoveStars"));
    expect(mockParamsRaw.setStarMaskInvert).toHaveBeenCalledWith(true);
  });

  it("calls setStarMaskInvert(false) when isolate stars button is pressed", () => {
    const { getByText } = render(<ToolParamsMask activeTool="starMask" params={mockParams} />);
    fireEvent.press(getByText("editor.paramIsolateStars"));
    expect(mockParamsRaw.setStarMaskInvert).toHaveBeenCalledWith(false);
  });

  it("calls setStarMaskScale via starMask scale slider", () => {
    const { getByTestId } = render(<ToolParamsMask activeTool="starMask" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramScale"));
    expect(mockParamsRaw.setStarMaskScale).toHaveBeenCalledWith(5.7);
  });

  it("calls growth and softness setters via starMask sliders", () => {
    const { getByTestId } = render(<ToolParamsMask activeTool="starMask" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramGrowth"));
    fireEvent.press(getByTestId("slider-editor.paramSoftness"));
    expect(mockParamsRaw.setStarMaskGrowth).toHaveBeenCalledWith(6);
    expect(mockParamsRaw.setStarMaskSoftness).toHaveBeenCalledWith(5.7);
  });

  it("calls setRangeMaskLow via rangeMask low slider", () => {
    const { getByTestId } = render(<ToolParamsMask activeTool="rangeMask" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramLow"));
    expect(mockParamsRaw.setRangeMaskLow).toHaveBeenCalledWith(5.7);
  });

  it("calls setBinarizeThreshold via binarize threshold slider", () => {
    const { getByTestId } = render(<ToolParamsMask activeTool="binarize" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramThreshold"));
    expect(mockParamsRaw.setBinarizeThreshold).toHaveBeenCalledWith(5.7);
  });

  it("calls onParamChange when mask params are updated", () => {
    const onParamChange = jest.fn();
    const { getByTestId, getByText } = render(
      <ToolParamsMask activeTool="starMask" params={mockParams} onParamChange={onParamChange} />,
    );
    fireEvent.press(getByTestId("slider-editor.paramScale"));
    fireEvent.press(getByText("editor.paramRemoveStars"));
    expect(onParamChange).toHaveBeenCalledTimes(2);
  });
});
