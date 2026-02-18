import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ZoomControls } from "../ZoomControls";

describe("ZoomControls", () => {
  it("triggers fit and step zoom callbacks", () => {
    const onSetTransform = jest.fn();
    const { getByText } = render(
      <ZoomControls
        scale={2}
        translateX={30}
        translateY={-20}
        canvasWidth={1000}
        canvasHeight={800}
        imageWidth={2000}
        imageHeight={1200}
        onSetTransform={onSetTransform}
      />,
    );

    fireEvent.press(getByText("Fit"));
    fireEvent.press(getByText("add"));
    fireEvent.press(getByText("remove"));

    expect(onSetTransform).toHaveBeenNthCalledWith(1, 0, 0, 1);
    expect(onSetTransform).toHaveBeenNthCalledWith(2, 30, -20, 3);
    expect(onSetTransform).toHaveBeenNthCalledWith(3, 30, -20, Math.max(0.1, 2 / 1.5));
  });

  it("computes 1:1 scale using both width and height constraints", () => {
    const onSetTransform = jest.fn();
    const { getByText, rerender } = render(
      <ZoomControls
        scale={1}
        translateX={0}
        translateY={0}
        canvasWidth={1000}
        canvasHeight={1000}
        imageWidth={4000}
        imageHeight={1000}
        onSetTransform={onSetTransform}
      />,
    );

    fireEvent.press(getByText("1:1"));
    expect(onSetTransform).toHaveBeenLastCalledWith(0, 0, 4);

    rerender(
      <ZoomControls
        scale={1}
        translateX={0}
        translateY={0}
        canvasWidth={1000}
        canvasHeight={1000}
        imageWidth={1000}
        imageHeight={4000}
        onSetTransform={onSetTransform}
      />,
    );

    fireEvent.press(getByText("1:1"));
    expect(onSetTransform).toHaveBeenLastCalledWith(0, 0, 4);
  });
});
