import React from "react";
import { render } from "@testing-library/react-native";
import { PixelInspector } from "../PixelInspector";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  return {
    ...Reanimated,
    useSharedValue: (value: number) => ({ value }),
    useAnimatedStyle: (fn: () => Record<string, unknown>) => fn(),
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
        onStart: function () {
          return this;
        },
        onUpdate: function () {
          return this;
        },
        onEnd: function () {
          return this;
        },
      }),
    },
  };
});

describe("PixelInspector", () => {
  it("returns null when not visible", () => {
    const { toJSON } = render(<PixelInspector x={10} y={20} value={100.5} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it("returns null when value is null", () => {
    const { toJSON } = render(<PixelInspector x={10} y={20} value={null} />);
    expect(toJSON()).toBeNull();
  });

  it("renders pixel info title", () => {
    const { getByText } = render(<PixelInspector x={10} y={20} value={100.5} />);
    expect(getByText("viewer.pixelInfo")).toBeTruthy();
  });

  it("renders X and Y coordinates", () => {
    const { getByText } = render(<PixelInspector x={42} y={99} value={100.5} />);
    expect(getByText("X: 42 Y: 99")).toBeTruthy();
  });

  it("renders value with default 2 decimal places", () => {
    const { getByText } = render(<PixelInspector x={0} y={0} value={123.456} />);
    expect(getByText("viewer.value: 123.46")).toBeTruthy();
  });

  it("renders value with custom decimal places", () => {
    const { getByText } = render(
      <PixelInspector x={0} y={0} value={123.456789} decimalPlaces={4} />,
    );
    expect(getByText("viewer.value: 123.4568")).toBeTruthy();
  });

  it("renders RA and Dec when provided", () => {
    const { getByText } = render(
      <PixelInspector x={0} y={0} value={100} ra="12h30m00s" dec="+45d00m00s" />,
    );
    expect(getByText("RA: 12h30m00s Dec: +45d00m00s")).toBeTruthy();
  });

  it("does not render RA/Dec when not provided", () => {
    const { queryByText } = render(<PixelInspector x={0} y={0} value={100} />);
    expect(queryByText(/RA:/)).toBeNull();
  });

  it("renders drag handle indicator", () => {
    const { getByText } = render(<PixelInspector x={0} y={0} value={100} />);
    expect(getByText("⠿")).toBeTruthy();
  });
});
