/**
 * CompassIndicator 组件测试
 */

import React from "react";
import { render } from "@testing-library/react-native";
import { CompassIndicator } from "../CompassIndicator";
import type { AstrometryCalibration } from "../../../lib/astrometry/types";

jest.mock("@shopify/react-native-skia", () => {
  const { createSkiaMock } = require("./helpers/mockSkia");
  return createSkiaMock();
});

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

describe("CompassIndicator", () => {
  it("renders Skia canvas", () => {
    const { getByTestId } = render(<CompassIndicator calibration={baseCalibration} />);
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });

  it("renders N and E labels", () => {
    const { getAllByTestId } = render(<CompassIndicator calibration={baseCalibration} />);
    const textElements = getAllByTestId("skia-text");
    const texts = textElements.map((el) => el.props.children);
    expect(texts).toContain("N");
    expect(texts).toContain("E");
  });

  it("renders two direction lines (N arm and E arm)", () => {
    const { getAllByTestId } = render(<CompassIndicator calibration={baseCalibration} />);
    const lines = getAllByTestId("skia-line");
    expect(lines.length).toBe(2);
  });

  it("uses default size of 60", () => {
    const { getByTestId } = render(<CompassIndicator calibration={baseCalibration} />);
    const canvas = getByTestId("skia-canvas");
    expect(canvas.props.style).toEqual(expect.objectContaining({ width: 60, height: 60 }));
  });

  it("uses custom size when provided", () => {
    const { getByTestId } = render(<CompassIndicator calibration={baseCalibration} size={80} />);
    const canvas = getByTestId("skia-canvas");
    expect(canvas.props.style).toEqual(expect.objectContaining({ width: 80, height: 80 }));
  });

  it("renders with rotated orientation", () => {
    const rotated: AstrometryCalibration = {
      ...baseCalibration,
      orientation: 90,
    };
    const { getAllByTestId } = render(<CompassIndicator calibration={rotated} />);
    // Still renders 2 lines and 2 text labels
    expect(getAllByTestId("skia-line").length).toBe(2);
    expect(getAllByTestId("skia-text").length).toBe(2);
  });

  it("handles mirrored parity", () => {
    const mirrored: AstrometryCalibration = {
      ...baseCalibration,
      parity: 1,
    };
    const { getAllByTestId } = render(<CompassIndicator calibration={mirrored} />);
    expect(getAllByTestId("skia-line").length).toBe(2);
    expect(getAllByTestId("skia-text").length).toBe(2);
  });

  it("renders with custom color", () => {
    const { getByTestId } = render(
      <CompassIndicator calibration={baseCalibration} color="#ff0000" />,
    );
    expect(getByTestId("skia-canvas")).toBeTruthy();
  });
});
