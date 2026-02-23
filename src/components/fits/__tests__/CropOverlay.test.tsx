import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { CropOverlay } from "../CropOverlay";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  return {
    ...Reanimated,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
    runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
  };
});

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(View, { testID: "gesture-detector" }, children),
    Gesture: {
      Pan: () => ({
        onBegin: () => ({
          onUpdate: () => ({
            minDistance: () => ({}),
          }),
        }),
      }),
    },
  };
});

describe("CropOverlay", () => {
  const baseProps = {
    imageWidth: 1000,
    imageHeight: 800,
    containerWidth: 500,
    containerHeight: 400,
    onCropConfirm: jest.fn(),
    onCropCancel: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dimension info text", () => {
    const { getByText } = render(<CropOverlay {...baseProps} />);
    // Initial crop region is 80% center: x=100, y=80, w=800, h=640
    expect(getByText("800 × 640")).toBeTruthy();
    expect(getByText("(100, 80)")).toBeTruthy();
  });

  it("renders cancel and apply buttons", () => {
    const { getByText } = render(<CropOverlay {...baseProps} />);
    expect(getByText("common.cancel")).toBeTruthy();
    expect(getByText("editor.apply")).toBeTruthy();
  });

  it("calls onCropCancel when cancel button is pressed", () => {
    const { getByText } = render(<CropOverlay {...baseProps} />);
    fireEvent.press(getByText("common.cancel"));
    expect(baseProps.onCropCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCropConfirm with crop region when apply is pressed", () => {
    const { getByText } = render(<CropOverlay {...baseProps} />);
    fireEvent.press(getByText("editor.apply"));
    expect(baseProps.onCropConfirm).toHaveBeenCalledWith(100, 80, 800, 640);
  });

  it("renders 8 resize handle dots", () => {
    const { getAllByTestId } = render(<CropOverlay {...baseProps} />);
    // Each resize handle is inside a GestureDetector
    const detectors = getAllByTestId("gesture-detector");
    // 1 for the move gesture + 8 for resize handles = 9
    expect(detectors.length).toBe(9);
  });

  it("adjusts crop region for different image sizes", () => {
    const { getByText } = render(<CropOverlay {...baseProps} imageWidth={200} imageHeight={100} />);
    // 80% center: x=20, y=10, w=160, h=80
    expect(getByText("160 × 80")).toBeTruthy();
    expect(getByText("(20, 10)")).toBeTruthy();
  });
});
