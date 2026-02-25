import React from "react";
import { render } from "@testing-library/react-native";
import { ToolParamsMask } from "../ToolParamsMask";

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
  starMaskScale: 1.5,
  setStarMaskScale: jest.fn(),
  starMaskInvert: false,
  setStarMaskInvert: jest.fn(),
  rangeMaskLow: 0,
  setRangeMaskLow: jest.fn(),
  rangeMaskHigh: 1,
  setRangeMaskHigh: jest.fn(),
  rangeMaskFuzz: 0.1,
  setRangeMaskFuzz: jest.fn(),
  binarizeThreshold: 0.5,
  setBinarizeThreshold: jest.fn(),
} as never;

describe("ToolParamsMask", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders scale slider and mode buttons for starMask", () => {
    const { getByTestId, getByText } = render(
      <ToolParamsMask activeTool="starMask" params={mockParams} />,
    );
    expect(getByTestId("slider-editor.paramScale")).toBeTruthy();
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
});
