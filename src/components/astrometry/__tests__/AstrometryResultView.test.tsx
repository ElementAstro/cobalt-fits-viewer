/**
 * AstrometryResultView 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AstrometryResultView } from "../AstrometryResultView";
import type { AstrometryResult } from "../../../lib/astrometry/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

jest.mock("../../../lib/astrometry/formatUtils", () => ({
  formatRA: (deg: number) => `${(deg / 15).toFixed(2)}h`,
  formatDec: (deg: number) => `${deg >= 0 ? "+" : ""}${deg.toFixed(2)}°`,
  formatFieldSize: (deg: number) => `${deg.toFixed(2)}°`,
}));

const baseResult: AstrometryResult = {
  calibration: {
    ra: 83.633,
    dec: -5.375,
    radius: 1.5,
    pixscale: 1.1,
    orientation: 45.0,
    parity: 0,
    fieldWidth: 2.0,
    fieldHeight: 1.5,
  },
  annotations: [
    { type: "messier", names: ["M42", "Orion Nebula"], pixelx: 100, pixely: 200 },
    { type: "ngc", names: ["NGC 1976"], pixelx: 300, pixely: 400 },
    { type: "star", names: [], pixelx: 500, pixely: 600 },
  ],
  tags: ["Orion", "Nebula", "Winter"],
};

const emptyResult: AstrometryResult = {
  calibration: {
    ra: 0,
    dec: 0,
    radius: 0,
    pixscale: 0,
    orientation: 0,
    parity: 0,
    fieldWidth: 0,
    fieldHeight: 0,
  },
  annotations: [],
  tags: [],
};

describe("AstrometryResultView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders calibration data card with all fields", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("astrometry.calibrationData")).toBeTruthy();
    expect(screen.getByText("astrometry.center")).toBeTruthy();
    expect(screen.getByText("astrometry.fieldSize")).toBeTruthy();
    expect(screen.getByText("astrometry.pixelScale")).toBeTruthy();
    expect(screen.getByText("astrometry.orientation")).toBeTruthy();
    expect(screen.getByText("astrometry.parity")).toBeTruthy();
  });

  it("renders formatted RA and Dec", () => {
    render(<AstrometryResultView result={baseResult} />);
    // formatRA(83.633) => "5.58h", formatDec(-5.375) => "-5.38°"
    expect(screen.getByText(/5\.58h/)).toBeTruthy();
  });

  it("renders pixel scale value", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("1.100″/px")).toBeTruthy();
  });

  it("renders orientation value", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("45.00°")).toBeTruthy();
  });

  it("renders parity as Normal when 0", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("astrometry.parityNormal")).toBeTruthy();
  });

  it("renders parity as Flipped when non-zero", () => {
    const flipped: AstrometryResult = {
      ...baseResult,
      calibration: { ...baseResult.calibration, parity: 1 },
    };
    render(<AstrometryResultView result={flipped} />);
    expect(screen.getByText("astrometry.parityFlipped")).toBeTruthy();
  });

  it("renders detected objects card with annotation count", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("astrometry.detectedObjects (3)")).toBeTruthy();
  });

  it("renders annotation names for each annotation", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("M42, Orion Nebula")).toBeTruthy();
    expect(screen.getByText("NGC 1976")).toBeTruthy();
  });

  it("renders fallback name for annotations without names", () => {
    render(<AstrometryResultView result={baseResult} />);
    // The third annotation has no names => t("astrometry.unnamedObject") with mock returns key
    expect(screen.getByText("astrometry.unnamedObject")).toBeTruthy();
  });

  it("renders pixel coordinates for each annotation", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("(100, 200)")).toBeTruthy();
    expect(screen.getByText("(300, 400)")).toBeTruthy();
    expect(screen.getByText("(500, 600)")).toBeTruthy();
  });

  it("renders annotation type chips", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("messier")).toBeTruthy();
    expect(screen.getByText("ngc")).toBeTruthy();
    expect(screen.getByText("star")).toBeTruthy();
  });

  it("does not render annotations card when annotations is empty", () => {
    render(<AstrometryResultView result={emptyResult} />);
    expect(screen.queryByText(/astrometry.detectedObjects/)).toBeNull();
  });

  it("renders tags as chips", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.getByText("Orion")).toBeTruthy();
    expect(screen.getByText("Nebula")).toBeTruthy();
    expect(screen.getByText("Winter")).toBeTruthy();
  });

  it("does not render tags section when tags is empty", () => {
    render(<AstrometryResultView result={emptyResult} />);
    expect(screen.queryByText("Orion")).toBeNull();
  });

  it("renders writeToHeader button and fires callback", () => {
    const onWriteToHeader = jest.fn();
    render(<AstrometryResultView result={baseResult} onWriteToHeader={onWriteToHeader} />);
    fireEvent.press(screen.getByText(/astrometry.writeToHeader/));
    expect(onWriteToHeader).toHaveBeenCalledTimes(1);
  });

  it("renders exportWCS button and fires callback", () => {
    const onExportWCS = jest.fn();
    render(<AstrometryResultView result={baseResult} onExportWCS={onExportWCS} />);
    fireEvent.press(screen.getByText(/astrometry.exportWCS/));
    expect(onExportWCS).toHaveBeenCalledTimes(1);
  });

  it("renders syncToTarget button and fires callback", () => {
    const onSyncToTarget = jest.fn();
    render(<AstrometryResultView result={baseResult} onSyncToTarget={onSyncToTarget} />);
    fireEvent.press(screen.getByText(/astrometry.syncToTarget/));
    expect(onSyncToTarget).toHaveBeenCalledTimes(1);
  });

  it("does not render action buttons when callbacks not provided", () => {
    render(<AstrometryResultView result={baseResult} />);
    expect(screen.queryByText(/astrometry.writeToHeader/)).toBeNull();
    expect(screen.queryByText(/astrometry.exportWCS/)).toBeNull();
    expect(screen.queryByText(/astrometry.syncToTarget/)).toBeNull();
  });

  it("renders toggle annotations button showing hide text when visible", () => {
    const onToggle = jest.fn();
    render(
      <AstrometryResultView
        result={baseResult}
        onToggleAnnotations={onToggle}
        showAnnotations={true}
      />,
    );
    fireEvent.press(screen.getByText(/astrometry.hideAnnotations/));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("renders toggle annotations button showing show text when hidden", () => {
    const onToggle = jest.fn();
    render(
      <AstrometryResultView
        result={baseResult}
        onToggleAnnotations={onToggle}
        showAnnotations={false}
      />,
    );
    fireEvent.press(screen.getByText(/astrometry.showAnnotations/));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("limits tags display to 20 items", () => {
    const manyTags = Array.from({ length: 30 }, (_, i) => `Tag${i}`);
    const result: AstrometryResult = {
      ...baseResult,
      tags: manyTags,
    };
    render(<AstrometryResultView result={result} />);
    expect(screen.getByText("Tag0")).toBeTruthy();
    expect(screen.getByText("Tag19")).toBeTruthy();
    expect(screen.queryByText("Tag20")).toBeNull();
  });
});
