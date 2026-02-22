import React from "react";
import { render } from "@testing-library/react-native";
import { ToolParamsProcess } from "../ToolParamsProcess";

jest.mock("heroui-native", () => {
  const { Text, Pressable } = require("react-native");
  return {
    Button: Object.assign(
      ({ children, onPress, ...props }: Record<string, unknown>) => (
        <Pressable onPress={onPress as () => void} {...props}>
          {children as React.ReactNode}
        </Pressable>
      ),
      {
        Label: ({ children, ...props }: Record<string, unknown>) => (
          <Text {...props}>{children as React.ReactNode}</Text>
        ),
      },
    ),
  };
});

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
} as never;

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
    expect(getByText("erode")).toBeTruthy();
    expect(getByText("dilate")).toBeTruthy();
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
    const { toJSON } = render(<ToolParamsProcess activeTool="unknown" params={mockParams} />);
    expect(toJSON()).toBeNull();
  });
});
