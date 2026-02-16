import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import { ViewerControlPanel } from "../ViewerControlPanel";

jest.mock("../../../components/astrometry/AstrometryResultView", () => ({
  AstrometryResultView: () => null,
}));
jest.mock("../HistogramLevels", () => ({
  HistogramLevels: () => null,
}));

describe("ViewerControlPanel", () => {
  const baseProps = {
    file: {
      id: "f1",
      filename: "a.fits",
      filepath: "/a.fits",
      fileSize: 1,
      importDate: Date.now(),
      frameType: "light" as const,
      isFavorite: false,
      tags: [],
      albumIds: [],
    },
    histogram: null,
    regionHistogram: null,
    blackPoint: 0,
    whitePoint: 1,
    midtone: 0.5,
    outputBlack: 0,
    outputWhite: 1,
    onBlackPointChange: jest.fn(),
    onWhitePointChange: jest.fn(),
    onMidtoneChange: jest.fn(),
    onOutputBlackChange: jest.fn(),
    onOutputWhiteChange: jest.fn(),
    onAutoStretch: jest.fn(),
    onResetLevels: jest.fn(),
    onToggleRegionSelect: jest.fn(),
    isRegionSelectActive: false,
    stretch: "linear" as const,
    colormap: "grayscale" as const,
    brightness: 0,
    contrast: 1,
    mtfMidtone: 0.5,
    curvePreset: "linear" as const,
    showGrid: false,
    showCrosshair: false,
    showPixelInfo: true,
    showMinimap: false,
    currentHDU: 0,
    hduList: [
      { index: 0, type: "Image", hasData: true },
      { index: 1, type: "Table", hasData: true },
    ],
    currentFrame: 0,
    totalFrames: 1,
    isDataCube: false,
    onStretchChange: jest.fn(),
    onColormapChange: jest.fn(),
    onBrightnessChange: jest.fn(),
    onContrastChange: jest.fn(),
    onMtfMidtoneChange: jest.fn(),
    onCurvePresetChange: jest.fn(),
    onToggleGrid: jest.fn(),
    onToggleCrosshair: jest.fn(),
    onTogglePixelInfo: jest.fn(),
    onToggleMinimap: jest.fn(),
    onHDUChange: jest.fn(),
    onFrameChange: jest.fn(),
    onResetView: jest.fn(),
    onSavePreset: jest.fn(),
    onResetToSaved: jest.fn(),
    showAstrometryResult: false,
    showAnnotations: false,
    onToggleAnnotations: jest.fn(),
    showControls: true,
  };

  it("renders HDU options and allows selecting image HDU", () => {
    render(<ViewerControlPanel {...baseProps} />);
    expect(screen.getByText("#0 Image")).toBeTruthy();
    expect(screen.getByText("#1 Table")).toBeTruthy();
    fireEvent.press(screen.getByText("#0 Image"));
    expect(baseProps.onHDUChange).toHaveBeenCalledWith(0);
  });
});
