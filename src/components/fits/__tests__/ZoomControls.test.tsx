import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ZoomControls } from "../ZoomControls";
import { zoomAroundCenter } from "../../../lib/viewer/transform";

describe("ZoomControls", () => {
  it("triggers fit and step zoom callbacks with center-zoom", () => {
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

    // Fit resets to origin
    fireEvent.press(getByText("Fit"));
    expect(onSetTransform).toHaveBeenNthCalledWith(1, 0, 0, 1);

    // Zoom in: scale 2 → 3, translate adjusted to keep center stable
    fireEvent.press(getByText("add"));
    const zoomIn = zoomAroundCenter(2, 3, 30, -20, 1000, 800);
    expect(onSetTransform).toHaveBeenNthCalledWith(2, zoomIn.x, zoomIn.y, 3);

    // Zoom out: scale 2 → 2/1.5, translate adjusted to keep center stable
    fireEvent.press(getByText("remove"));
    const zoomOutScale = Math.max(0.1, 2 / 1.5);
    const zoomOut = zoomAroundCenter(2, zoomOutScale, 30, -20, 1000, 800);
    expect(onSetTransform).toHaveBeenNthCalledWith(
      3,
      expect.closeTo(zoomOut.x, 6),
      expect.closeTo(zoomOut.y, 6),
      expect.closeTo(zoomOutScale, 6),
    );
  });

  it("uses custom zoomStep prop for zoom in/out", () => {
    const onSetTransform = jest.fn();
    const customStep = 2;
    const { getByText } = render(
      <ZoomControls
        scale={1}
        translateX={0}
        translateY={0}
        canvasWidth={400}
        canvasHeight={400}
        imageWidth={400}
        imageHeight={400}
        zoomStep={customStep}
        onSetTransform={onSetTransform}
      />,
    );

    fireEvent.press(getByText("add"));
    const zoomIn = zoomAroundCenter(1, 1 * customStep, 0, 0, 400, 400);
    expect(onSetTransform).toHaveBeenLastCalledWith(zoomIn.x, zoomIn.y, 1 * customStep);

    onSetTransform.mockClear();
    fireEvent.press(getByText("remove"));
    const zoomOutScale = Math.max(0.1, 1 / customStep);
    const zoomOut = zoomAroundCenter(1, zoomOutScale, 0, 0, 400, 400);
    expect(onSetTransform).toHaveBeenLastCalledWith(
      expect.closeTo(zoomOut.x, 6),
      expect.closeTo(zoomOut.y, 6),
      expect.closeTo(zoomOutScale, 6),
    );
  });

  it("displays scale percentage", () => {
    const onSetTransform = jest.fn();
    const { getByText } = render(
      <ZoomControls
        scale={2.5}
        translateX={0}
        translateY={0}
        canvasWidth={400}
        canvasHeight={400}
        onSetTransform={onSetTransform}
      />,
    );

    expect(getByText("250%")).toBeTruthy();
  });

  it("hides 1:1 button logic when image dimensions are missing", () => {
    const onSetTransform = jest.fn();
    const { getByText } = render(
      <ZoomControls
        scale={1}
        translateX={0}
        translateY={0}
        canvasWidth={400}
        canvasHeight={400}
        onSetTransform={onSetTransform}
      />,
    );

    // 1:1 button exists but should not call onSetTransform without image dims
    fireEvent.press(getByText("1:1"));
    expect(onSetTransform).not.toHaveBeenCalled();
  });

  it("computes 1:1 scale with center-zoom using both width and height constraints", () => {
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

    // 1:1 for 4000×1000 in 1000×1000 → oneToOneScale=4, center-zoomed
    fireEvent.press(getByText("1:1"));
    const oneToOne1 = zoomAroundCenter(1, 4, 0, 0, 1000, 1000);
    expect(onSetTransform).toHaveBeenLastCalledWith(oneToOne1.x, oneToOne1.y, 4);

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
    const oneToOne2 = zoomAroundCenter(1, 4, 0, 0, 1000, 1000);
    expect(onSetTransform).toHaveBeenLastCalledWith(oneToOne2.x, oneToOne2.y, 4);
  });
});
