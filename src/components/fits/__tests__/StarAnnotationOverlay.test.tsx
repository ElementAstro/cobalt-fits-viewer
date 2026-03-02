import React from "react";
import { render } from "@testing-library/react-native";
import { StarAnnotationOverlay } from "../StarAnnotationOverlay";

jest.mock("@shopify/react-native-skia", () => {
  const React = require("react");
  const { View, Text } = require("react-native");
  return {
    Canvas: ({ children, ...props }: { children?: React.ReactNode; [k: string]: unknown }) =>
      React.createElement(View, { testID: "skia-canvas", ...props }, children),
    Circle: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: `circle-${props.cx}-${props.cy}` }),
    Group: ({ children }: { children?: React.ReactNode }) =>
      React.createElement(View, null, children),
    RoundedRect: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: `rect-${props.x}` }),
    Text: (props: { text?: string; [k: string]: unknown }) =>
      React.createElement(Text, { testID: `skia-text-${props.text}` }, props.text),
    useFont: () => ({ measureText: () => ({ width: 10 }) }),
    vec: (x: number, y: number) => ({ x, y }),
  };
});

describe("StarAnnotationOverlay", () => {
  const baseProps = {
    renderWidth: 100,
    renderHeight: 100,
    sourceWidth: 100,
    sourceHeight: 100,
    transform: {
      scale: 1,
      translateX: 0,
      translateY: 0,
      canvasWidth: 200,
      canvasHeight: 200,
    },
  };

  it("renders anchor label when visible", () => {
    const view = render(
      <StarAnnotationOverlay
        {...baseProps}
        visible
        points={[
          {
            id: "p1",
            x: 20,
            y: 30,
            source: "manual",
            enabled: true,
            anchorIndex: 1,
          },
        ]}
      />,
    );
    expect(view.getByText("1")).toBeTruthy();
  });

  it("returns null when hidden or no points", () => {
    const hidden = render(<StarAnnotationOverlay {...baseProps} visible={false} points={[]} />);
    expect(hidden.toJSON()).toBeNull();
  });

  it("does not render points transformed outside of viewport bounds", () => {
    const view = render(
      <StarAnnotationOverlay
        {...baseProps}
        visible
        points={[
          {
            id: "far-away",
            x: 20,
            y: 30,
            source: "manual",
            enabled: true,
            anchorIndex: 2,
          },
        ]}
        transform={{
          ...baseProps.transform,
          translateX: 1000,
          translateY: 1000,
        }}
      />,
    );
    expect(view.queryByText("2")).toBeNull();
  });
});
