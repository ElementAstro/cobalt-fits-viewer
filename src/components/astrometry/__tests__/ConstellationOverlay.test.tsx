/**
 * ConstellationOverlay 组件测试
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { ConstellationOverlay } from "../ConstellationOverlay";
import type { AstrometryCalibration } from "../../../lib/astrometry/types";
import type { CanvasTransform } from "../../fits/FitsCanvas";

jest.mock("@shopify/react-native-skia", () => {
  const { createSkiaMock } = require("./helpers/mockSkia");
  return createSkiaMock();
});

jest.mock("../../../lib/astrometry/wcsProjection", () => ({
  computeProjectionContext: jest.fn(() => ({ mock: true })),
  raDecToPixelWithContext: jest.fn((_ra: number, _dec: number, _ctx: unknown) => ({
    x: 400,
    y: 300,
  })),
}));

jest.mock("../../../lib/viewer/transform", () => {
  const { createTransformMock } = require("./helpers/mockTransform");
  return createTransformMock();
});

jest.mock("../../../lib/astrometry/constellationData", () => ({
  CONSTELLATIONS: [
    {
      id: "Ori",
      name: "Orion",
      stars: [
        { ra: 88.793, dec: 7.407 },
        { ra: 78.634, dec: -8.202 },
        { ra: 83.858, dec: -1.943 },
      ],
      lines: [
        [0, 1],
        [1, 2],
        [0, 2],
      ],
    },
    {
      id: "UMa",
      name: "Ursa Major",
      stars: [
        { ra: 165.46, dec: 61.75 },
        { ra: 166.0, dec: 56.38 },
      ],
      lines: [[0, 1]],
    },
  ],
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

describe("ConstellationOverlay", () => {
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
    const { toJSON } = render(<ConstellationOverlay {...baseProps} visible={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when sourceWidth is zero", () => {
    const { toJSON } = render(<ConstellationOverlay {...baseProps} sourceWidth={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when sourceHeight is zero", () => {
    const { toJSON } = render(<ConstellationOverlay {...baseProps} sourceHeight={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders null when renderWidth is zero", () => {
    const { toJSON } = render(<ConstellationOverlay {...baseProps} renderWidth={0} />);
    expect(toJSON()).toBeNull();
  });

  it("renders Skia canvas when visible with constellation data", () => {
    const { getByTestId } = render(<ConstellationOverlay {...baseProps} />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("renders constellation name labels", () => {
    const { getAllByTestId } = render(<ConstellationOverlay {...baseProps} />);
    const textElements = getAllByTestId("skia-text");
    const texts = textElements.map((el) => el.props.children);
    expect(texts).toContain("Orion");
  });

  it("renders path elements for constellation lines", () => {
    const { getAllByTestId } = render(<ConstellationOverlay {...baseProps} />);
    const paths = getAllByTestId("skia-path");
    expect(paths.length).toBeGreaterThan(0);
  });

  it("accepts custom color prop", () => {
    const { getByTestId } = render(<ConstellationOverlay {...baseProps} color="#ff0000" />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("accepts custom opacity prop", () => {
    const { getByTestId } = render(<ConstellationOverlay {...baseProps} opacity={0.8} />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });
});
