import React from "react";
import { render, screen } from "@testing-library/react-native";
import { AnimatedProgressBar } from "../AnimatedProgressBar";

const mockWithTiming = jest.fn((val: number, _config?: object) => val);

jest.mock("react-native-reanimated", () => {
  const ReactLocal = require("react");
  const { View } = require("react-native");
  return {
    __esModule: true,
    default: {
      View: (props: any) => ReactLocal.createElement(View, props, props.children),
    },
    useSharedValue: (init: number) => ({ value: init }),
    useAnimatedStyle: (fn: () => any) => fn(),
    withTiming: (value: number, config?: object) => mockWithTiming(value, config),
    interpolate: (value: number, input: number[], output: number[]) => {
      const ratio = (value - input[0]) / (input[1] - input[0]);
      return output[0] + ratio * (output[1] - output[0]);
    },
    Extrapolation: { CLAMP: "clamp" },
  };
});

describe("AnimatedProgressBar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders without crashing with default props", () => {
    render(<AnimatedProgressBar progress={50} />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders with custom color prop", () => {
    const { toJSON } = render(<AnimatedProgressBar progress={30} color="#ff0000" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders with custom className prop", () => {
    render(<AnimatedProgressBar progress={70} className="custom-class" />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it("starts animation when progress changes", () => {
    const { rerender } = render(<AnimatedProgressBar progress={0} />);
    const initialCallCount = mockWithTiming.mock.calls.length;

    rerender(<AnimatedProgressBar progress={75} />);

    expect(mockWithTiming.mock.calls.length).toBeGreaterThan(initialCallCount);
  });

  it("uses 400ms animation duration", () => {
    render(<AnimatedProgressBar progress={50} />);

    expect(mockWithTiming).toHaveBeenCalledWith(50, { duration: 400 });
  });
});
