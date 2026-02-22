import React from "react";
import { render } from "@testing-library/react-native";
import { ToolParamsAdjust } from "../ToolParamsAdjust";

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
} as never;

describe("ToolParamsAdjust", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders sigma slider for blur", () => {
    const { getByTestId } = render(<ToolParamsAdjust activeTool="blur" params={mockParams} />);
    expect(getByTestId("slider-editor.paramSigma")).toBeTruthy();
  });

  it("renders amount + sigma sliders for sharpen", () => {
    const { getByTestId } = render(<ToolParamsAdjust activeTool="sharpen" params={mockParams} />);
    expect(getByTestId("slider-editor.paramAmount")).toBeTruthy();
    expect(getByTestId("slider-editor.paramSigma")).toBeTruthy();
  });

  it("renders radius slider for denoise", () => {
    const { getByTestId } = render(<ToolParamsAdjust activeTool="denoise" params={mockParams} />);
    expect(getByTestId("slider-editor.paramRadius")).toBeTruthy();
  });

  it("renders 3 sliders for levels", () => {
    const { getByTestId } = render(<ToolParamsAdjust activeTool="levels" params={mockParams} />);
    expect(getByTestId("slider-editor.paramInputBlack")).toBeTruthy();
    expect(getByTestId("slider-editor.paramInputWhite")).toBeTruthy();
    expect(getByTestId("slider-editor.paramGamma")).toBeTruthy();
  });

  it("renders curve preset buttons for curves", () => {
    const { getByText } = render(<ToolParamsAdjust activeTool="curves" params={mockParams} />);
    expect(getByText("editor.paramLinear")).toBeTruthy();
    expect(getByText("editor.paramSCurve")).toBeTruthy();
    expect(getByText("editor.paramBrighten")).toBeTruthy();
  });

  it("returns null for unknown tool", () => {
    const { toJSON } = render(<ToolParamsAdjust activeTool="unknown" params={mockParams} />);
    expect(toJSON()).toBeNull();
  });
});
