import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ToolParamsProcess } from "../ToolParamsProcess";

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
  claheTileSize: 8,
  setClaheTileSize: jest.fn(),
  claheClipLimit: 3.0,
  setClaheClipLimit: jest.fn(),
  hdrLayers: 5,
  setHdrLayers: jest.fn(),
  hdrAmount: 0.7,
  setHdrAmount: jest.fn(),
  morphOp: "dilate" as const,
  setMorphOp: jest.fn(),
  morphRadius: 1,
  setMorphRadius: jest.fn(),
  deconvPsfSigma: 2.0,
  setDeconvPsfSigma: jest.fn(),
  deconvIterations: 20,
  setDeconvIterations: jest.fn(),
  deconvRegularization: 0.1,
  setDeconvRegularization: jest.fn(),
  dbeSamplesX: 12,
  setDbeSamplesX: jest.fn(),
  dbeSamplesY: 8,
  setDbeSamplesY: jest.fn(),
  dbeSigma: 2.5,
  setDbeSigma: jest.fn(),
  multiscaleLayers: 4,
  setMultiscaleLayers: jest.fn(),
  multiscaleThreshold: 2.5,
  setMultiscaleThreshold: jest.fn(),
  localContrastSigma: 8,
  setLocalContrastSigma: jest.fn(),
  localContrastAmount: 0.35,
  setLocalContrastAmount: jest.fn(),
  starReductionScale: 1.2,
  setStarReductionScale: jest.fn(),
  starReductionStrength: 0.6,
  setStarReductionStrength: jest.fn(),
  deconvAutoIterations: 20,
  setDeconvAutoIterations: jest.fn(),
  deconvAutoRegularization: 0.1,
  setDeconvAutoRegularization: jest.fn(),
  scnrMethod: "averageNeutral" as const,
  setScnrMethod: jest.fn(),
  scnrAmount: 0.5,
  setScnrAmount: jest.fn(),
  colorCalibrationPercentile: 0.92,
  setColorCalibrationPercentile: jest.fn(),
  saturationAmount: 0,
  setSaturationAmount: jest.fn(),
  colorBalanceRedGain: 1,
  setColorBalanceRedGain: jest.fn(),
  colorBalanceGreenGain: 1,
  setColorBalanceGreenGain: jest.fn(),
  colorBalanceBlueGain: 1,
  setColorBalanceBlueGain: jest.fn(),
  pixelMathExpr: "$T",
  setPixelMathExpr: jest.fn(),
};
const mockParams = mockParamsRaw as never;

describe("ToolParamsProcess", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders 2 sliders for clahe", () => {
    const { getByTestId } = render(<ToolParamsProcess activeTool="clahe" params={mockParams} />);
    expect(getByTestId("slider-editor.paramTileSize")).toBeTruthy();
    expect(getByTestId("slider-editor.paramClipLimit")).toBeTruthy();
  });

  it("renders 3 sliders for deconvolution", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="deconvolution" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramPsfSigma")).toBeTruthy();
    expect(getByTestId("slider-editor.paramIterations")).toBeTruthy();
    expect(getByTestId("slider-editor.paramRegularization")).toBeTruthy();
  });

  it("renders morphology op buttons + radius slider", () => {
    const { getByTestId, getByText } = render(
      <ToolParamsProcess activeTool="morphology" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramRadius")).toBeTruthy();
    expect(getByText("editor.paramMorphErode")).toBeTruthy();
    expect(getByText("editor.paramMorphDilate")).toBeTruthy();
  });

  it("renders scnr amount slider + method buttons", () => {
    const { getByTestId, getByText } = render(
      <ToolParamsProcess activeTool="scnr" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramAmount")).toBeTruthy();
    expect(getByText("editor.paramAverage")).toBeTruthy();
    expect(getByText("editor.paramMaximum")).toBeTruthy();
  });

  it("renders 3 gain sliders for colorBalance", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="colorBalance" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramRedGain")).toBeTruthy();
    expect(getByTestId("slider-editor.paramGreenGain")).toBeTruthy();
    expect(getByTestId("slider-editor.paramBlueGain")).toBeTruthy();
  });

  it("renders text input for pixelMath", () => {
    const { getByText } = render(<ToolParamsProcess activeTool="pixelMath" params={mockParams} />);
    expect(getByText("editor.paramPixelMathVars")).toBeTruthy();
  });

  it("returns null for unknown tool", () => {
    const { toJSON } = render(
      <ToolParamsProcess activeTool={"unknown" as never} params={mockParams} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("rounds claheTileSize via Math.round", () => {
    const { getByTestId } = render(<ToolParamsProcess activeTool="clahe" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramTileSize"));
    expect(mockParamsRaw.setClaheTileSize).toHaveBeenCalledWith(6);
  });

  it("rounds hdrLayers via Math.round", () => {
    const { getByTestId } = render(<ToolParamsProcess activeTool="hdr" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramLayers"));
    expect(mockParamsRaw.setHdrLayers).toHaveBeenCalledWith(6);
  });

  it("rounds morphRadius via Math.round", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="morphology" params={mockParams} />,
    );
    fireEvent.press(getByTestId("slider-editor.paramRadius"));
    expect(mockParamsRaw.setMorphRadius).toHaveBeenCalledWith(6);
  });

  it("rounds deconvIterations via Math.round", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="deconvolution" params={mockParams} />,
    );
    fireEvent.press(getByTestId("slider-editor.paramIterations"));
    expect(mockParamsRaw.setDeconvIterations).toHaveBeenCalledWith(6);
  });

  it("rounds dbeSamplesX via Math.round", () => {
    const { getByTestId } = render(<ToolParamsProcess activeTool="dbe" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramSamplesX"));
    expect(mockParamsRaw.setDbeSamplesX).toHaveBeenCalledWith(6);
  });

  it("rounds dbeSamplesY via Math.round", () => {
    const { getByTestId } = render(<ToolParamsProcess activeTool="dbe" params={mockParams} />);
    fireEvent.press(getByTestId("slider-editor.paramSamplesY"));
    expect(mockParamsRaw.setDbeSamplesY).toHaveBeenCalledWith(6);
  });

  it("rounds multiscaleLayers via Math.round", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="multiscaleDenoise" params={mockParams} />,
    );
    fireEvent.press(getByTestId("slider-editor.paramLayers"));
    expect(mockParamsRaw.setMultiscaleLayers).toHaveBeenCalledWith(6);
  });

  it("rounds deconvAutoIterations via Math.round", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="deconvolutionAuto" params={mockParams} />,
    );
    fireEvent.press(getByTestId("slider-editor.paramIterations"));
    expect(mockParamsRaw.setDeconvAutoIterations).toHaveBeenCalledWith(6);
  });

  it("renders 2 sliders for hdr", () => {
    const { getByTestId } = render(<ToolParamsProcess activeTool="hdr" params={mockParams} />);
    expect(getByTestId("slider-editor.paramLayers")).toBeTruthy();
    expect(getByTestId("slider-editor.paramAmount")).toBeTruthy();
  });

  it("renders 3 sliders for dbe", () => {
    const { getByTestId } = render(<ToolParamsProcess activeTool="dbe" params={mockParams} />);
    expect(getByTestId("slider-editor.paramSamplesX")).toBeTruthy();
    expect(getByTestId("slider-editor.paramSamplesY")).toBeTruthy();
    expect(getByTestId("slider-editor.paramSigma")).toBeTruthy();
  });

  it("renders 2 sliders for multiscaleDenoise", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="multiscaleDenoise" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramLayers")).toBeTruthy();
    expect(getByTestId("slider-editor.paramThreshold")).toBeTruthy();
  });

  it("renders 2 sliders for localContrast", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="localContrast" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramSigma")).toBeTruthy();
    expect(getByTestId("slider-editor.paramAmount")).toBeTruthy();
  });

  it("renders 2 sliders for starReduction", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="starReduction" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramScale")).toBeTruthy();
    expect(getByTestId("slider-editor.paramStrength")).toBeTruthy();
  });

  it("renders 2 sliders for deconvolutionAuto", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="deconvolutionAuto" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramIterations")).toBeTruthy();
    expect(getByTestId("slider-editor.paramRegularization")).toBeTruthy();
  });

  it("renders amount slider for saturation", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="saturation" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramAmount")).toBeTruthy();
  });

  it("renders percentile slider for colorCalibration", () => {
    const { getByTestId } = render(
      <ToolParamsProcess activeTool="colorCalibration" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramRefPercentile")).toBeTruthy();
  });

  it("calls setMorphOp when a morphology op button is pressed", () => {
    const { getByText } = render(<ToolParamsProcess activeTool="morphology" params={mockParams} />);
    fireEvent.press(getByText("editor.paramMorphOpen"));
    expect(mockParamsRaw.setMorphOp).toHaveBeenCalledWith("open");
  });

  it("calls setScnrMethod when a scnr method button is pressed", () => {
    const { getByText } = render(<ToolParamsProcess activeTool="scnr" params={mockParams} />);
    fireEvent.press(getByText("editor.paramMaximum"));
    expect(mockParamsRaw.setScnrMethod).toHaveBeenCalledWith("maximumNeutral");
  });

  it("calls setPixelMathExpr when pixelMath text input changes", () => {
    const { getByDisplayValue } = render(
      <ToolParamsProcess activeTool="pixelMath" params={mockParams} />,
    );
    fireEvent.changeText(getByDisplayValue("$T"), "($T - 0.1)");
    expect(mockParamsRaw.setPixelMathExpr).toHaveBeenCalledWith("($T - 0.1)");
  });
});
