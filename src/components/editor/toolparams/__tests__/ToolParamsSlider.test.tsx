import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ToolParamsSlider } from "../ToolParamsSlider";

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
  blurSigma: 2,
  setBlurSigma: jest.fn(),
  sharpenAmount: 1.5,
  setSharpenAmount: jest.fn(),
  sharpenSigma: 1.0,
  setSharpenSigma: jest.fn(),
  denoiseRadius: 1,
  setDenoiseRadius: jest.fn(),
  brightnessAmount: 0,
  setBrightnessAmount: jest.fn(),
  contrastFactor: 1.0,
  setContrastFactor: jest.fn(),
  gammaValue: 1.0,
  setGammaValue: jest.fn(),
  levelsInputBlack: 0,
  setLevelsInputBlack: jest.fn(),
  levelsInputWhite: 1,
  setLevelsInputWhite: jest.fn(),
  levelsGamma: 1.0,
  setLevelsGamma: jest.fn(),
  mtfMidtone: 0.25,
  setMtfMidtone: jest.fn(),
  mtfShadows: 0,
  setMtfShadows: jest.fn(),
  mtfHighlights: 1,
  setMtfHighlights: jest.fn(),
  curvesPreset: "sCurve" as const,
  setCurvesPreset: jest.fn(),
};
const mockParams = mockParamsRaw as never;

describe("ToolParamsSlider", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders sigma slider for blur", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="blur" params={mockParams} />);
    expect(getByTestId("slider-editor.paramSigma")).toBeTruthy();
  });

  it("renders amount + sigma sliders for sharpen", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="sharpen" params={mockParams} />);
    expect(getByTestId("slider-editor.paramAmount")).toBeTruthy();
    expect(getByTestId("slider-editor.paramSigma")).toBeTruthy();
  });

  it("renders radius slider for denoise", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="denoise" params={mockParams} />);
    expect(getByTestId("slider-editor.paramRadius")).toBeTruthy();
  });

  it("renders 3 sliders for levels", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="levels" params={mockParams} />);
    expect(getByTestId("slider-editor.paramInputBlack")).toBeTruthy();
    expect(getByTestId("slider-editor.paramInputWhite")).toBeTruthy();
    expect(getByTestId("slider-editor.paramGamma")).toBeTruthy();
  });

  it("renders curve preset buttons for curves", () => {
    const { getByText } = render(<ToolParamsSlider activeTool="curves" params={mockParams} />);
    expect(getByText("editor.paramLinear")).toBeTruthy();
    expect(getByText("editor.paramSCurve")).toBeTruthy();
    expect(getByText("editor.paramBrighten")).toBeTruthy();
  });

  it("returns null for unknown tool", () => {
    const { toJSON } = render(
      <ToolParamsSlider activeTool={"unknown" as never} params={mockParams} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("rounds denoiseRadius via Math.round", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="denoise" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramRadius"));
    expect(mockParamsRaw.setDenoiseRadius).toHaveBeenCalledWith(6);
  });

  it("renders amount slider for brightness", () => {
    const { getByTestId } = render(
      <ToolParamsSlider activeTool="brightness" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramAmount")).toBeTruthy();
  });

  it("renders factor slider for contrast", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="contrast" params={mockParams} />);
    expect(getByTestId("slider-editor.paramFactor")).toBeTruthy();
  });

  it("renders gamma slider for gamma", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="gamma" params={mockParams} />);
    expect(getByTestId("slider-editor.paramGamma")).toBeTruthy();
  });

  it("renders 3 sliders for mtf", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="mtf" params={mockParams} />);
    expect(getByTestId("slider-editor.paramMidtone")).toBeTruthy();
    expect(getByTestId("slider-editor.paramShadowsClip")).toBeTruthy();
    expect(getByTestId("slider-editor.paramHighlightsClip")).toBeTruthy();
  });

  it("calls setCurvesPreset when a curves preset button is pressed", () => {
    const { getByText } = render(<ToolParamsSlider activeTool="curves" params={mockParams} />);
    fireEvent.press(getByText("editor.paramBrighten"));
    expect(mockParamsRaw.setCurvesPreset).toHaveBeenCalledWith("brighten");
  });

  it("calls setBlurSigma via blur slider", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="blur" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramSigma"));
    expect(mockParamsRaw.setBlurSigma).toHaveBeenCalledWith(5.7);
  });

  it("calls setSharpenAmount via sharpen amount slider", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="sharpen" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramAmount"));
    expect(mockParamsRaw.setSharpenAmount).toHaveBeenCalledWith(5.7);
  });

  it("calls setBrightnessAmount via brightness slider", () => {
    const { getByTestId } = render(
      <ToolParamsSlider activeTool="brightness" params={mockParams} />,
    );
    fireEvent.press(getByTestId("slider-editor.paramAmount"));
    expect(mockParamsRaw.setBrightnessAmount).toHaveBeenCalledWith(5.7);
  });

  it("calls setContrastFactor via contrast slider", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="contrast" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramFactor"));
    expect(mockParamsRaw.setContrastFactor).toHaveBeenCalledWith(5.7);
  });

  it("calls setGammaValue via gamma slider", () => {
    const { getByTestId } = render(<ToolParamsSlider activeTool="gamma" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramGamma"));
    expect(mockParamsRaw.setGammaValue).toHaveBeenCalledWith(5.7);
  });
});
