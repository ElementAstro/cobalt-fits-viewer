import React from "react";
import { render } from "@testing-library/react-native";
import { ViewerBottomSheet } from "../ViewerBottomSheet";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../ViewerControlPanel", () => ({
  ViewerControlPanel: () => null,
}));

jest.mock("../HistogramLevels", () => ({
  HistogramLevels: () => null,
}));

jest.mock("../../../components/astrometry/AstrometryResultView", () => ({
  AstrometryResultView: () => null,
}));

describe("ViewerBottomSheet", () => {
  const baseProps = {
    visible: true,
    onVisibleChange: jest.fn(),
    file: {
      id: "f1",
      filename: "test.fits",
      filepath: "/test.fits",
      fileSize: 1024,
      importDate: Date.now(),
      frameType: "light" as const,
      isFavorite: false,
      tags: [],
      albumIds: [],
      object: "M31",
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
    hduList: [{ index: 0, type: "Image", hasData: true }],
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
    rgbHistogram: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders stretch and colormap labels in collapsed toolbar", () => {
    const { getByText } = render(<ViewerBottomSheet {...baseProps} />);
    expect(getByText("linear")).toBeTruthy();
    expect(getByText("grayscale")).toBeTruthy();
  });

  it("renders object chip when file has object", () => {
    const { getByText } = render(<ViewerBottomSheet {...baseProps} />);
    expect(getByText("M31")).toBeTruthy();
  });

  it("renders expand button (chevron-up icon)", () => {
    const { getByText } = render(<ViewerBottomSheet {...baseProps} />);
    expect(getByText("chevron-up")).toBeTruthy();
  });

  it("renders with visible=false without crashing", () => {
    const { getByText } = render(<ViewerBottomSheet {...baseProps} visible={false} />);
    // BottomSheet mock still renders children
    expect(getByText("linear")).toBeTruthy();
  });

  it("renders different stretch and colormap values", () => {
    const { getByText } = render(
      <ViewerBottomSheet {...baseProps} stretch="asinh" colormap="viridis" />,
    );
    expect(getByText("asinh")).toBeTruthy();
    expect(getByText("viridis")).toBeTruthy();
  });

  it("does not render object chip when file has no object", () => {
    const propsWithoutObject = {
      ...baseProps,
      file: { ...baseProps.file, object: undefined },
    };
    const { queryByText } = render(<ViewerBottomSheet {...propsWithoutObject} />);
    expect(queryByText("M31")).toBeNull();
  });
});
