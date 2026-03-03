import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { RecipePipelinePanel } from "../RecipePipelinePanel";
import type { ProcessingPipelineSnapshot } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../common/SimpleSlider", () => ({
  SimpleSlider: (props: Record<string, unknown>) => {
    const RN = require("react-native");
    const R = require("react");
    const onValueChange = props.onValueChange;
    return R.createElement(
      RN.Pressable,
      {
        testID: `slider-${props.label}`,
        onPress: () => typeof onValueChange === "function" && onValueChange(0.35),
      },
      R.createElement(RN.Text, null, props.label),
    );
  },
}));

const baseRecipe: ProcessingPipelineSnapshot = {
  version: 2,
  savedAt: Date.now(),
  profile: "standard",
  scientificNodes: [
    {
      id: "mask-gen",
      operationId: "binarize",
      enabled: true,
      params: { threshold: 0.5 },
    },
    {
      id: "target",
      operationId: "invert",
      enabled: true,
      params: {},
      maskConfig: {
        sourceNodeId: "mask-gen",
        invert: false,
        blendStrength: 0.6,
      },
    },
  ],
  colorNodes: [],
};

const defaultProps = {
  recipe: baseRecipe,
  successColor: "#22c55e",
  onToggleNode: jest.fn(),
  onRemoveNode: jest.fn(),
  onSetNodeMaskConfig: jest.fn(),
  onClose: jest.fn(),
};

describe("RecipePipelinePanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders mask controls for scientific nodes with previous candidates", () => {
    const { getByText, getByTestId } = render(<RecipePipelinePanel {...defaultProps} />);

    expect(getByText("editor.paramMaskSource: Binarize")).toBeTruthy();
    expect(getByText("#1 Binarize")).toBeTruthy();
    expect(getByText("editor.paramInvertMask")).toBeTruthy();
    expect(getByText("editor.paramClearMask")).toBeTruthy();
    expect(getByTestId("slider-editor.paramMaskBlendStrength")).toBeTruthy();
  });

  it("sets mask source with default options when selecting a source candidate", () => {
    const onSetNodeMaskConfig = jest.fn();
    const recipeWithoutMask: ProcessingPipelineSnapshot = {
      ...baseRecipe,
      scientificNodes: [
        baseRecipe.scientificNodes[0]!,
        { ...baseRecipe.scientificNodes[1]!, maskConfig: undefined },
      ],
    };

    const { getByText } = render(
      <RecipePipelinePanel
        {...defaultProps}
        recipe={recipeWithoutMask}
        onSetNodeMaskConfig={onSetNodeMaskConfig}
      />,
    );
    fireEvent.press(getByText("#1 Binarize"));

    expect(onSetNodeMaskConfig).toHaveBeenCalledWith("target", {
      sourceNodeId: "mask-gen",
      invert: false,
      blendStrength: 1,
    });
  });

  it("updates blend strength and can clear mask config", () => {
    const onSetNodeMaskConfig = jest.fn();
    const { getByTestId, getByText } = render(
      <RecipePipelinePanel {...defaultProps} onSetNodeMaskConfig={onSetNodeMaskConfig} />,
    );

    fireEvent.press(getByTestId("slider-editor.paramMaskBlendStrength"));
    expect(onSetNodeMaskConfig).toHaveBeenCalledWith("target", {
      sourceNodeId: "mask-gen",
      invert: false,
      blendStrength: 0.35,
    });

    fireEvent.press(getByText("editor.paramClearMask"));
    expect(onSetNodeMaskConfig).toHaveBeenCalledWith("target", null);
  });
});
