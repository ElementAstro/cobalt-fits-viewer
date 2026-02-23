import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ViewerControls } from "../ViewerControls";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  }),
}));

jest.mock("../../common/SimpleSlider", () => ({
  SimpleSlider: ({ label }: { label: string }) => {
    const ReactLocal = require("react");
    const { Text } = require("react-native");
    return ReactLocal.createElement(Text, { testID: "slider" }, label);
  },
}));

jest.mock("../../../lib/viewer/presets", () => ({
  VIEWER_CURVE_PRESETS: [
    { key: "linear", labelKey: "viewer.curveLinear" },
    { key: "sCurve", labelKey: "viewer.curveSCurve" },
  ],
}));

describe("ViewerControls", () => {
  const baseProps = {
    stretch: "linear" as const,
    colormap: "grayscale" as const,
    brightness: 0,
    contrast: 1,
    mtfMidtone: 0.5,
    curvePreset: "linear" as const,
    showGrid: false,
    showCrosshair: false,
    showPixelInfo: false,
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
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders stretch section title", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    expect(getByText("viewer.stretch")).toBeTruthy();
  });

  it("renders colormap section title", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    expect(getByText("viewer.colormap")).toBeTruthy();
  });

  it("renders all stretch options", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    expect(getByText("viewer.stretchLinear")).toBeTruthy();
    expect(getByText("viewer.stretchSqrt")).toBeTruthy();
    expect(getByText("viewer.stretchLog")).toBeTruthy();
    expect(getByText("viewer.stretchAsinh")).toBeTruthy();
  });

  it("calls onStretchChange when stretch chip is pressed", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    fireEvent.press(getByText("viewer.stretchLog"));
    expect(baseProps.onStretchChange).toHaveBeenCalledWith("log");
  });

  it("calls onColormapChange when colormap chip is pressed", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    fireEvent.press(getByText("viewer.colormapHeat"));
    expect(baseProps.onColormapChange).toHaveBeenCalledWith("heat");
  });

  it("renders slider labels for brightness, contrast, mtf", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    expect(getByText("editor.brightness")).toBeTruthy();
    expect(getByText("editor.contrast")).toBeTruthy();
    expect(getByText("editor.mtf")).toBeTruthy();
  });

  it("renders curve presets section", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    expect(getByText("editor.curves")).toBeTruthy();
    expect(getByText("viewer.curveLinear")).toBeTruthy();
    expect(getByText("viewer.curveSCurve")).toBeTruthy();
  });

  it("calls onCurvePresetChange when curve preset is pressed", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    fireEvent.press(getByText("viewer.curveSCurve"));
    expect(baseProps.onCurvePresetChange).toHaveBeenCalledWith("sCurve");
  });

  it("renders HDU options", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    expect(getByText("viewer.hdu")).toBeTruthy();
    expect(getByText("#0 Image")).toBeTruthy();
    expect(getByText("#1 Table")).toBeTruthy();
  });

  it("calls onHDUChange for selectable image HDU", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    fireEvent.press(getByText("#0 Image"));
    expect(baseProps.onHDUChange).toHaveBeenCalledWith(0);
  });

  it("does not call onHDUChange for table HDU (non-image)", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    fireEvent.press(getByText("#1 Table"));
    expect(baseProps.onHDUChange).not.toHaveBeenCalled();
  });

  it("renders toggle buttons for grid, crosshair, pixel info, minimap", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    expect(getByText("grid-outline")).toBeTruthy();
    expect(getByText("add-outline")).toBeTruthy();
    expect(getByText("information-circle-outline")).toBeTruthy();
    expect(getByText("map-outline")).toBeTruthy();
  });

  it("calls toggle callbacks on button press", () => {
    const { getByText } = render(<ViewerControls {...baseProps} />);
    fireEvent.press(getByText("grid-outline"));
    expect(baseProps.onToggleGrid).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText("add-outline"));
    expect(baseProps.onToggleCrosshair).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText("information-circle-outline"));
    expect(baseProps.onTogglePixelInfo).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText("map-outline"));
    expect(baseProps.onToggleMinimap).toHaveBeenCalledTimes(1);
  });

  it("renders auto stretch button when handler provided", () => {
    const onAutoStretch = jest.fn();
    const { getByText } = render(<ViewerControls {...baseProps} onAutoStretch={onAutoStretch} />);
    expect(getByText("flash-outline")).toBeTruthy();
  });

  it("renders reset view button when handler provided", () => {
    const onResetView = jest.fn();
    const { getByText } = render(<ViewerControls {...baseProps} onResetView={onResetView} />);
    expect(getByText("scan-outline")).toBeTruthy();
  });

  it("renders quick presets when handler provided", () => {
    const onApplyQuickPreset = jest.fn();
    const { getByText } = render(
      <ViewerControls {...baseProps} onApplyQuickPreset={onApplyQuickPreset} />,
    );
    expect(getByText("viewer.presetAuto")).toBeTruthy();
    expect(getByText("viewer.presetDeepSky")).toBeTruthy();
  });

  it("calls onApplyQuickPreset with correct key", () => {
    const onApplyQuickPreset = jest.fn();
    const { getByText } = render(
      <ViewerControls {...baseProps} onApplyQuickPreset={onApplyQuickPreset} />,
    );
    fireEvent.press(getByText("viewer.presetDeepSky"));
    expect(onApplyQuickPreset).toHaveBeenCalledWith("deepSky");
  });

  it("renders frame navigation when isDataCube and totalFrames > 1", () => {
    const { getByText } = render(
      <ViewerControls {...baseProps} isDataCube={true} totalFrames={10} currentFrame={3} />,
    );
    expect(getByText("viewer.frame")).toBeTruthy();
    expect(getByText("4 / 10")).toBeTruthy();
  });

  it("does not render frame navigation when not a data cube", () => {
    const { queryByText } = render(<ViewerControls {...baseProps} />);
    expect(queryByText("viewer.frame")).toBeNull();
  });

  it("does not render HDU section when hduList is empty", () => {
    const { queryByText } = render(<ViewerControls {...baseProps} hduList={[]} />);
    expect(queryByText("viewer.hdu")).toBeNull();
  });
});
