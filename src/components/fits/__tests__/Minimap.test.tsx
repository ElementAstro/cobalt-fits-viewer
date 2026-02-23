import React from "react";
import { render } from "@testing-library/react-native";
import { Minimap } from "../Minimap";

jest.mock("../../../lib/viewer/transform", () => ({
  computeFitGeometry: () => ({ fitScale: 1, offsetX: 0, offsetY: 0 }),
  screenToImagePoint: (
    point: { x: number; y: number },
    _transform: unknown,
    imgW: number,
    imgH: number,
  ) => ({
    x: Math.min(Math.max(point.x, 0), imgW),
    y: Math.min(Math.max(point.y, 0), imgH),
  }),
}));

jest.mock("@shopify/react-native-skia", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    Canvas: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(View, { testID: "skia-canvas", ...props }, children),
    Image: () => null,
    Rect: () => null,
    Skia: {
      Data: { fromBytes: jest.fn() },
      Image: { MakeImage: jest.fn(() => ({ width: () => 100, height: () => 50 })) },
      Paint: () => ({
        setColor: jest.fn(),
        setStrokeWidth: jest.fn(),
        setStyle: jest.fn(),
        setAlphaf: jest.fn(),
      }),
      Color: (c: string) => c,
    },
    PaintStyle: { Stroke: 1, Fill: 0 },
    AlphaType: { Unpremul: 0, Premul: 1 },
    ColorType: { RGBA_8888: 0 },
  };
});

jest.mock("react-native-reanimated", () => {
  const Reanimated = require("react-native-reanimated/mock");
  return {
    ...Reanimated,
    FadeIn: { duration: () => ({}) },
    FadeOut: { duration: () => ({}) },
  };
});

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(View, { testID: "gesture-detector" }, children),
    Gesture: {
      Tap: () => ({
        onEnd: function () {
          return this;
        },
      }),
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
        minDistance: function () {
          return this;
        },
      }),
      Exclusive: (...args: unknown[]) => args[0],
    },
  };
});

describe("Minimap", () => {
  const baseProps = {
    rgbaData: new Uint8ClampedArray(100 * 50 * 4),
    imgWidth: 100,
    imgHeight: 50,
    visible: true,
    size: 120,
  };

  it("returns null when not visible", () => {
    const { toJSON } = render(<Minimap {...baseProps} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it("returns null when rgbaData is null", () => {
    const { toJSON } = render(<Minimap {...baseProps} rgbaData={null} />);
    expect(toJSON()).toBeNull();
  });

  it("returns null when image dimensions are zero", () => {
    const { toJSON } = render(<Minimap {...baseProps} imgWidth={0} imgHeight={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders canvas when visible with valid data", () => {
    const { getByTestId } = render(<Minimap {...baseProps} />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("shows zoom label when viewportScale > 1", () => {
    const { getByText } = render(<Minimap {...baseProps} viewportScale={2.5} />);
    expect(getByText("2.5x")).toBeTruthy();
  });

  it("does not show zoom label when viewportScale is 1", () => {
    const { queryByText } = render(<Minimap {...baseProps} viewportScale={1} />);
    expect(queryByText("1.0x")).toBeNull();
  });
});
