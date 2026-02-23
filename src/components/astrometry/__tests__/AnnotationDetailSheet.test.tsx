/**
 * AnnotationDetailSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AnnotationDetailSheet } from "../AnnotationDetailSheet";
import type { AstrometryAnnotation, AstrometryCalibration } from "../../../lib/astrometry/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

jest.mock("../../../lib/astrometry/wcsProjection", () => ({
  pixelToRaDec: jest.fn(() => ({ ra: 83.633, dec: -5.375 })),
  formatRaFromDeg: jest.fn((ra: number) => `${(ra / 15).toFixed(2)}h`),
  formatDecFromDeg: jest.fn((dec: number) => `${dec.toFixed(2)}°`),
}));

const baseCalibration: AstrometryCalibration = {
  ra: 83.633,
  dec: -5.375,
  radius: 1.5,
  pixscale: 1.1,
  orientation: 45,
  parity: 0,
  fieldWidth: 2.0,
  fieldHeight: 1.5,
};

const baseAnnotation: AstrometryAnnotation = {
  type: "messier",
  names: ["M42", "Orion Nebula"],
  pixelx: 500,
  pixely: 400,
  radius: 30,
  vmag: 4.0,
};

describe("AnnotationDetailSheet", () => {
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the annotation primary name", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("M42")).toBeTruthy();
  });

  it("renders the type label", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Messier")).toBeTruthy();
  });

  it("renders all names when there are multiple", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    // Both names should appear (with separator for the first)
    expect(screen.getByText("M42 · ")).toBeTruthy();
    expect(screen.getByText("Orion Nebula")).toBeTruthy();
  });

  it("does not render names row when only one name", () => {
    const singleName: AstrometryAnnotation = {
      ...baseAnnotation,
      names: ["M42"],
    };
    render(
      <AnnotationDetailSheet
        annotation={singleName}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    // The single name appears in the header, not in a multi-names row
    expect(screen.getByText("M42")).toBeTruthy();
    // " · " separator should not appear
    expect(screen.queryByText("M42 · ")).toBeNull();
  });

  it("renders pixel coordinates", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Pixel")).toBeTruthy();
    expect(screen.getByText("(500, 400)")).toBeTruthy();
  });

  it("renders RA/Dec row when pixelToRaDec returns value", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("RA / Dec")).toBeTruthy();
  });

  it("renders magnitude when vmag is present", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Magnitude")).toBeTruthy();
    expect(screen.getByText("4.00 mag")).toBeTruthy();
  });

  it("does not render magnitude when vmag is absent", () => {
    const noVmag: AstrometryAnnotation = {
      ...baseAnnotation,
      vmag: undefined,
    };
    render(
      <AnnotationDetailSheet annotation={noVmag} calibration={baseCalibration} onClose={onClose} />,
    );
    expect(screen.queryByText("Magnitude")).toBeNull();
  });

  it("renders radius when present", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Radius")).toBeTruthy();
    expect(screen.getByText("30.0 px")).toBeTruthy();
  });

  it("does not render radius when absent", () => {
    const noRadius: AstrometryAnnotation = {
      ...baseAnnotation,
      radius: undefined,
    };
    render(
      <AnnotationDetailSheet
        annotation={noRadius}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText("Radius")).toBeNull();
  });

  it("calls onClose when close button is pressed", () => {
    render(
      <AnnotationDetailSheet
        annotation={baseAnnotation}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    // close-circle icon renders as Text with name "close-circle"
    const closeBtn = screen.getByText("close-circle");
    fireEvent.press(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("falls back to type label when names array is empty", () => {
    const noNames: AstrometryAnnotation = {
      ...baseAnnotation,
      names: [],
      type: "ngc",
    };
    render(
      <AnnotationDetailSheet
        annotation={noNames}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    // "NGC" appears both as header fallback and as type label
    expect(screen.getAllByText("NGC").length).toBe(2);
  });

  it("falls back to 'Unknown' for unrecognized types", () => {
    const unknownType: AstrometryAnnotation = {
      ...baseAnnotation,
      names: [],
      type: "xyz" as AstrometryAnnotation["type"],
    };
    render(
      <AnnotationDetailSheet
        annotation={unknownType}
        calibration={baseCalibration}
        onClose={onClose}
      />,
    );
    // "Unknown" appears both as header fallback and as type label
    expect(screen.getAllByText("Unknown").length).toBe(2);
  });
});
