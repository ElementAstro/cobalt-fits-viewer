import React from "react";
import { render } from "@testing-library/react-native";
import { StarAnnotationOverlay } from "../StarAnnotationOverlay";

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
});
