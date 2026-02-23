/**
 * CoordinateGridOverlay 组件测试
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { CoordinateGridOverlay } from "../CoordinateGridOverlay";
import type { AstrometryCalibration } from "../../../lib/astrometry/types";
import type { CanvasTransform } from "../../fits/FitsCanvas";

jest.mock("@shopify/react-native-skia", () => {
  const ReactLocal = require("react");
  const { View: RNView, Text: RNText } = require("react-native");

  const Canvas = (props: { children?: React.ReactNode; [k: string]: unknown }) =>
    ReactLocal.createElement(RNView, { testID: "skia-canvas", ...props }, props.children);
  const Group = (props: { children?: React.ReactNode }) =>
    ReactLocal.createElement(RNView, { testID: "skia-group" }, props.children);
  const SkiaPath = (props: Record<string, unknown>) =>
    ReactLocal.createElement(RNView, { testID: "skia-path", ...props });
  const SkiaText = (props: { text?: string; [k: string]: unknown }) =>
    ReactLocal.createElement(RNText, { testID: "skia-text" }, props.text);

  const mockPath = {
    moveTo: jest.fn(),
    lineTo: jest.fn(),
  };

  return {
    Canvas,
    Group,
    Path: SkiaPath,
    Text: SkiaText,
    Skia: {
      Path: {
        Make: () => ({ ...mockPath }),
      },
    },
    useFont: () => ({ measureText: () => ({ width: 30 }) }),
  };
});

const mockGridLines = [
  {
    points: [
      { x: 0, y: 100 },
      { x: 800, y: 100 },
    ],
    label: "+10°",
    labelPos: { x: 50, y: 100 },
    isRA: false,
  },
  {
    points: [
      { x: 0, y: 300 },
      { x: 800, y: 300 },
    ],
    label: "+20°",
    labelPos: { x: 50, y: 300 },
    isRA: false,
  },
  {
    points: [
      { x: 400, y: 0 },
      { x: 400, y: 600 },
    ],
    label: "6h",
    labelPos: { x: 400, y: 20 },
    isRA: true,
  },
];

jest.mock("../../../lib/astrometry/coordinateGrid", () => ({
  generateGridLines: jest.fn(() => mockGridLines),
}));

jest.mock("../../../lib/viewer/transform", () => ({
  imageToScreenPoint: jest.fn((pt: { x: number; y: number }) => pt),
  remapPointBetweenSpaces: jest.fn((pt: { x: number; y: number }) => pt),
}));

const baseCalibration: AstrometryCalibration = {
  ra: 83.633,
  dec: -5.375,
  radius: 1.5,
  pixscale: 1.1,
  orientation: 0,
  parity: 0,
  fieldWidth: 2.0,
  fieldHeight: 1.5,
};

const baseTransform: CanvasTransform = {
  scale: 1,
  translateX: 0,
  translateY: 0,
  canvasWidth: 800,
  canvasHeight: 600,
};

describe("CoordinateGridOverlay", () => {
  const baseProps = {
    calibration: baseCalibration,
    renderWidth: 800,
    renderHeight: 600,
    sourceWidth: 800,
    sourceHeight: 600,
    transform: baseTransform,
    visible: true,
  };

  it("renders null when visible is false", () => {
    const { toJSON } = render(<CoordinateGridOverlay {...baseProps} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when sourceWidth is zero", () => {
    const { toJSON } = render(<CoordinateGridOverlay {...baseProps} sourceWidth={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when sourceHeight is zero", () => {
    const { toJSON } = render(<CoordinateGridOverlay {...baseProps} sourceHeight={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when renderWidth is zero", () => {
    const { toJSON } = render(<CoordinateGridOverlay {...baseProps} renderWidth={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when renderHeight is zero", () => {
    const { toJSON } = render(<CoordinateGridOverlay {...baseProps} renderHeight={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders Skia canvas when visible with grid data", () => {
    const { getByTestId } = render(<CoordinateGridOverlay {...baseProps} />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("renders grid line labels", () => {
    const { getAllByTestId } = render(<CoordinateGridOverlay {...baseProps} />);
    const textElements = getAllByTestId("skia-text");
    const texts = textElements.map((el) => el.props.children);
    expect(texts).toContain("+10°");
    expect(texts).toContain("+20°");
    expect(texts).toContain("6h");
  });

  it("renders path elements for grid lines", () => {
    const { getAllByTestId } = render(<CoordinateGridOverlay {...baseProps} />);
    const paths = getAllByTestId("skia-path");
    expect(paths.length).toBe(3);
  });

  it("accepts custom color prop", () => {
    const { getByTestId } = render(<CoordinateGridOverlay {...baseProps} color="#ff0000" />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("accepts custom opacity prop", () => {
    const { getByTestId } = render(<CoordinateGridOverlay {...baseProps} opacity={0.8} />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("calls generateGridLines with calibration and dimensions", () => {
    const { generateGridLines } = require("../../../lib/astrometry/coordinateGrid");
    render(<CoordinateGridOverlay {...baseProps} />);
    expect(generateGridLines).toHaveBeenCalledWith(baseCalibration, 800, 600);
  });
});
