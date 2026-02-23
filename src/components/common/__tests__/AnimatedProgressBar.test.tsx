import React from "react";
import { render, screen } from "@testing-library/react-native";
import { Animated } from "react-native";
import { AnimatedProgressBar } from "../AnimatedProgressBar";

describe("AnimatedProgressBar", () => {
  it("renders without crashing with default props", () => {
    render(<AnimatedProgressBar progress={50} />);
    // The component renders a container View with an inner Animated.View
    expect(screen.toJSON()).toBeTruthy();
  });

  it("renders with custom color prop", () => {
    const { toJSON } = render(<AnimatedProgressBar progress={30} color="#ff0000" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it("renders with custom className prop", () => {
    render(<AnimatedProgressBar progress={70} className="custom-class" />);
    expect(screen.toJSON()).toBeTruthy();
  });

  it("clamps progress interpolation to 0-100 range", () => {
    const interpolateSpy = jest.spyOn(Animated.Value.prototype, "interpolate");

    render(<AnimatedProgressBar progress={50} />);

    expect(interpolateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        inputRange: [0, 100],
        outputRange: ["0%", "100%"],
        extrapolate: "clamp",
      }),
    );

    interpolateSpy.mockRestore();
  });

  it("starts animation when progress changes", () => {
    const timingSpy = jest.spyOn(Animated, "timing");

    const { rerender } = render(<AnimatedProgressBar progress={0} />);
    const initialCallCount = timingSpy.mock.calls.length;

    rerender(<AnimatedProgressBar progress={75} />);

    expect(timingSpy.mock.calls.length).toBeGreaterThan(initialCallCount);
    timingSpy.mockRestore();
  });

  it("uses 400ms animation duration", () => {
    const timingSpy = jest.spyOn(Animated, "timing");

    render(<AnimatedProgressBar progress={50} />);

    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        duration: 400,
        useNativeDriver: false,
      }),
    );

    timingSpy.mockRestore();
  });
});
