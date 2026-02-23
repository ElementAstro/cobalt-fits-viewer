import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { FitsHistogram } from "../FitsHistogram";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../lib/utils/pixelMath", () => ({
  transformHistogramCounts: (counts: number[]) => counts,
}));

jest.mock("@shopify/react-native-skia", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    Canvas: ({ children, ...props }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(View, { testID: "skia-canvas", ...props }, children),
    Path: () => null,
    Line: () => null,
    Skia: {
      Path: { Make: () => ({ moveTo: jest.fn(), lineTo: jest.fn(), close: jest.fn() }) },
      Paint: () => ({ setColor: jest.fn(), setAlphaf: jest.fn() }),
      Color: (c: string) => c,
    },
    vec: (x: number, y: number) => ({ x, y }),
  };
});

jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: number) => ({ value }),
  runOnJS: (fn: (...args: unknown[]) => unknown) => fn,
}));

jest.mock("react-native-gesture-handler", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    GestureDetector: ({ children }: { children?: React.ReactNode }) =>
      ReactLocal.createElement(View, { testID: "gesture-detector" }, children),
    Gesture: {
      Pan: () => ({
        onBegin: function () {
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
        enabled: function () {
          return this;
        },
      }),
      Tap: () => ({
        onEnd: function () {
          return this;
        },
        enabled: function () {
          return this;
        },
      }),
      Race: (...args: unknown[]) => args[0],
    },
  };
});

describe("FitsHistogram", () => {
  const baseCounts = [10, 20, 50, 30, 15, 5, 2, 1];
  const baseEdges = [0, 100, 200, 300, 400, 500, 600, 700, 800];

  it("renders histogram title", () => {
    const { getByText } = render(<FitsHistogram counts={baseCounts} edges={baseEdges} />);
    expect(getByText("viewer.histogram")).toBeTruthy();
  });

  it("renders LIN mode chip by default", () => {
    const { getByText } = render(<FitsHistogram counts={baseCounts} edges={baseEdges} />);
    expect(getByText("LIN")).toBeTruthy();
  });

  it("cycles mode from LIN to LOG on chip press", () => {
    const { getByText } = render(<FitsHistogram counts={baseCounts} edges={baseEdges} />);
    fireEvent.press(getByText("LIN"));
    expect(getByText("LOG")).toBeTruthy();
  });

  it("cycles mode from LOG to CDF", () => {
    const { getByText } = render(
      <FitsHistogram counts={baseCounts} edges={baseEdges} initialMode="log" />,
    );
    expect(getByText("LOG")).toBeTruthy();
    fireEvent.press(getByText("LOG"));
    expect(getByText("CDF")).toBeTruthy();
  });

  it("cycles mode from CDF back to LIN", () => {
    const { getByText } = render(
      <FitsHistogram counts={baseCounts} edges={baseEdges} initialMode="cdf" />,
    );
    fireEvent.press(getByText("CDF"));
    expect(getByText("LIN")).toBeTruthy();
  });

  it("renders edge labels", () => {
    const { getByText } = render(<FitsHistogram counts={baseCounts} edges={baseEdges} />);
    expect(getByText("0")).toBeTruthy();
    expect(getByText("800")).toBeTruthy();
  });

  it("renders black/white point labels when interactive", () => {
    const { getByText } = render(
      <FitsHistogram
        counts={baseCounts}
        edges={baseEdges}
        blackPoint={0.1}
        whitePoint={0.9}
        onBlackPointChange={jest.fn()}
        onWhitePointChange={jest.fn()}
      />,
    );
    expect(getByText("0.10")).toBeTruthy();
    expect(getByText("0.90")).toBeTruthy();
  });

  it("does not render black/white point labels when not interactive", () => {
    const { queryByText } = render(
      <FitsHistogram counts={baseCounts} edges={baseEdges} blackPoint={0.1} whitePoint={0.9} />,
    );
    expect(queryByText("0.10")).toBeNull();
    expect(queryByText("0.90")).toBeNull();
  });

  it("renders with custom height", () => {
    const { getByText } = render(
      <FitsHistogram counts={baseCounts} edges={baseEdges} height={200} />,
    );
    expect(getByText("viewer.histogram")).toBeTruthy();
  });
});
