import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { HistogramLevels } from "../HistogramLevels";

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
    Rect: () => null,
    LinearGradient: () => null,
    Skia: {
      Path: { Make: () => ({ moveTo: jest.fn(), lineTo: jest.fn(), close: jest.fn() }) },
      Paint: () => ({
        setColor: jest.fn(),
        setAlphaf: jest.fn(),
        setStrokeWidth: jest.fn(),
        setStyle: jest.fn(),
      }),
      Color: (c: string) => c,
    },
    vec: (x: number, y: number) => ({ x, y }),
    PaintStyle: { Stroke: 1, Fill: 0 },
  };
});

jest.mock("react-native-reanimated", () => ({
  useSharedValue: (value: unknown) => ({ value }),
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

describe("HistogramLevels", () => {
  const baseCounts = [10, 20, 50, 30, 15, 5, 2, 1];
  const baseEdges = [0, 100, 200, 300, 400, 500, 600, 700, 800];

  const baseProps = {
    counts: baseCounts,
    edges: baseEdges,
    blackPoint: 0,
    whitePoint: 1,
    midtone: 0.5,
    outputBlack: 0,
    outputWhite: 1,
  };

  it("renders levels title", () => {
    const { getByText } = render(<HistogramLevels {...baseProps} />);
    expect(getByText("viewer.levels")).toBeTruthy();
  });

  it("renders LIN mode chip by default", () => {
    const { getByText } = render(<HistogramLevels {...baseProps} />);
    expect(getByText("LIN")).toBeTruthy();
  });

  it("cycles mode from LIN to LOG on chip press", () => {
    const { getByText } = render(<HistogramLevels {...baseProps} />);
    fireEvent.press(getByText("LIN"));
    expect(getByText("LOG")).toBeTruthy();
  });

  it("cycles mode LOG → CDF → LIN", () => {
    const { getByText } = render(<HistogramLevels {...baseProps} initialMode="log" />);
    fireEvent.press(getByText("LOG"));
    expect(getByText("CDF")).toBeTruthy();
    fireEvent.press(getByText("CDF"));
    expect(getByText("LIN")).toBeTruthy();
  });

  it("renders black and white point labels", () => {
    const { getAllByText } = render(
      <HistogramLevels
        {...baseProps}
        blackPoint={0.15}
        whitePoint={0.85}
        onBlackPointChange={jest.fn()}
        onWhitePointChange={jest.fn()}
      />,
    );
    expect(getAllByText(/0\.15/).length).toBeGreaterThanOrEqual(1);
    expect(getAllByText(/0\.85/).length).toBeGreaterThanOrEqual(1);
  });

  it("renders inputRange pixel value labels alongside normalized values", () => {
    const { getByText } = render(
      <HistogramLevels
        {...baseProps}
        inputRange={{ min: 100, max: 200 }}
        blackPoint={0.15}
        whitePoint={0.85}
        onBlackPointChange={jest.fn()}
        onWhitePointChange={jest.fn()}
      />,
    );

    expect(getByText(/0\.15\s*\(115/)).toBeTruthy();
    expect(getByText(/0\.85\s*\(185/)).toBeTruthy();
  });

  it("renders gamma value when midtone handler provided", () => {
    const { getByText } = render(
      <HistogramLevels
        {...baseProps}
        midtone={0.5}
        onBlackPointChange={jest.fn()}
        onWhitePointChange={jest.fn()}
        onMidtoneChange={jest.fn()}
      />,
    );
    // gamma = ln(0.5) / ln(0.5) = 1.00
    expect(getByText("γ1.00")).toBeTruthy();
  });

  it("renders auto stretch button when handler provided", () => {
    const onAutoStretch = jest.fn();
    const { getByText } = render(<HistogramLevels {...baseProps} onAutoStretch={onAutoStretch} />);
    expect(getByText("viewer.autoStretch")).toBeTruthy();
    fireEvent.press(getByText("viewer.autoStretch"));
    expect(onAutoStretch).toHaveBeenCalledTimes(1);
  });

  it("renders reset button when handler provided", () => {
    const onResetLevels = jest.fn();
    const { getByText } = render(<HistogramLevels {...baseProps} onResetLevels={onResetLevels} />);
    // Reset button has refresh-outline icon
    expect(getByText("refresh-outline")).toBeTruthy();
  });

  it("renders region select toggle when handler provided", () => {
    const onToggleRegionSelect = jest.fn();
    const { getByText } = render(
      <HistogramLevels {...baseProps} onToggleRegionSelect={onToggleRegionSelect} />,
    );
    expect(getByText("scan-outline")).toBeTruthy();
  });

  it("renders edge labels", () => {
    const { getByText } = render(<HistogramLevels {...baseProps} />);
    expect(getByText("0")).toBeTruthy();
    expect(getByText("800")).toBeTruthy();
  });

  it("renders output level labels when output handlers provided", () => {
    const { getByText } = render(
      <HistogramLevels
        {...baseProps}
        outputBlack={0.1}
        outputWhite={0.9}
        onOutputBlackChange={jest.fn()}
        onOutputWhiteChange={jest.fn()}
      />,
    );
    expect(getByText("viewer.outputLevels")).toBeTruthy();
    // Output level labels show rounded * 255 values
    expect(getByText("26")).toBeTruthy(); // Math.round(0.1 * 255)
    expect(getByText("230")).toBeTruthy(); // Math.round(0.9 * 255)
  });

  it("does not render output levels section without handlers", () => {
    const { queryByText } = render(<HistogramLevels {...baseProps} />);
    expect(queryByText("viewer.outputLevels")).toBeNull();
  });

  it("renders channel chip when rgbHistogram is provided", () => {
    const rgbHistogram = {
      r: { counts: baseCounts, edges: baseEdges },
      g: { counts: baseCounts, edges: baseEdges },
      b: { counts: baseCounts, edges: baseEdges },
    };
    const { getByText } = render(<HistogramLevels {...baseProps} rgbHistogram={rgbHistogram} />);
    expect(getByText("L")).toBeTruthy();
  });

  it("cycles channel display when channel chip pressed", () => {
    const rgbHistogram = {
      r: { counts: baseCounts, edges: baseEdges },
      g: { counts: baseCounts, edges: baseEdges },
      b: { counts: baseCounts, edges: baseEdges },
    };
    const { getByText } = render(<HistogramLevels {...baseProps} rgbHistogram={rgbHistogram} />);
    fireEvent.press(getByText("L"));
    expect(getByText("RGB")).toBeTruthy();
    fireEvent.press(getByText("RGB"));
    expect(getByText("R")).toBeTruthy();
    fireEvent.press(getByText("R"));
    expect(getByText("G")).toBeTruthy();
    fireEvent.press(getByText("G"));
    expect(getByText("B")).toBeTruthy();
    fireEvent.press(getByText("B"));
    expect(getByText("L")).toBeTruthy();
  });
});
