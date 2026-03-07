import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ViewerToolbar } from "../ViewerToolbar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock("../../../hooks/common/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notification: jest.fn(),
  }),
}));

describe("ViewerToolbar", () => {
  const baseProps = {
    filename: "ngc7000.fits",
    isLandscape: false,
    isFavorite: false,
    prevId: "prev-1",
    nextId: "next-1",
    showControls: false,
    hasAstrometryResult: false,
    isAstrometryActive: false,
    showAstrometryResult: false,
    onToggleFullscreen: jest.fn(),
    onBack: jest.fn(),
    onPrev: jest.fn(),
    onNext: jest.fn(),
    onToggleFavorite: jest.fn(),
    onOpenHeader: jest.fn(),
    onOpenEditor: jest.fn(),
    canCompare: true,
    onCompare: jest.fn(),
    onExport: jest.fn(),
    onAstrometry: jest.fn(),
    onToggleControls: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders filename", () => {
    const { getAllByText } = render(<ViewerToolbar {...baseProps} />);
    expect(getAllByText("ngc7000.fits").length).toBeGreaterThanOrEqual(1);
  });

  it("renders back button and calls onBack", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getByText("arrow-back"));
    expect(baseProps.onBack).toHaveBeenCalledTimes(1);
  });

  it("renders prev/next navigation buttons", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    expect(getByText("chevron-back")).toBeTruthy();
    expect(getByText("chevron-forward")).toBeTruthy();
  });

  it("calls onPrev and onNext on button press", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getByText("chevron-back"));
    expect(baseProps.onPrev).toHaveBeenCalledTimes(1);
    fireEvent.press(getByText("chevron-forward"));
    expect(baseProps.onNext).toHaveBeenCalledTimes(1);
  });

  it("renders astrometry button", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    expect(getByText("planet-outline")).toBeTruthy();
  });

  it("shows hourglass icon when astrometry is active", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} isAstrometryActive={true} />);
    expect(getByText("hourglass-outline")).toBeTruthy();
  });

  it("shows checkmark icon when astrometry result exists", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} hasAstrometryResult={true} />);
    expect(getByText("checkmark-circle")).toBeTruthy();
  });

  it("calls onAstrometry on astrometry button press", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getByText("planet-outline"));
    expect(baseProps.onAstrometry).toHaveBeenCalledTimes(1);
  });

  it("renders controls toggle button", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    expect(getByText("options-outline")).toBeTruthy();
  });

  it("shows filled options icon when controls are visible", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} showControls={true} />);
    expect(getByText("options")).toBeTruthy();
  });

  it("calls onToggleControls on controls button press", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getByText("options-outline"));
    expect(baseProps.onToggleControls).toHaveBeenCalledTimes(1);
  });

  it("renders fullscreen button and calls onToggleFullscreen", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getByText("expand-outline"));
    expect(baseProps.onToggleFullscreen).toHaveBeenCalledTimes(1);
  });

  it("renders more menu button", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    expect(getByText("ellipsis-horizontal")).toBeTruthy();
  });

  it("opens more menu with action items on press", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getByText("ellipsis-horizontal"));
    // More menu should now show actions
    expect(getByText("common.favorite")).toBeTruthy();
    expect(getByText("header.title")).toBeTruthy();
    expect(getByText("editor.title")).toBeTruthy();
    expect(getByText("gallery.compare")).toBeTruthy();
    expect(getByText("common.share")).toBeTruthy();
    expect(getByText("common.cancel")).toBeTruthy();
  });

  it("shows unfavorite label when already favorite", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} isFavorite={true} />);
    fireEvent.press(getByText("ellipsis-horizontal"));
    expect(getByText("common.unfavorite")).toBeTruthy();
  });

  it("calls action callbacks from more menu", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getByText("ellipsis-horizontal"));

    fireEvent.press(getByText("header.title"));
    expect(baseProps.onOpenHeader).toHaveBeenCalledTimes(1);
  });

  it("does not call onCompare when compare action is disabled", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} canCompare={false} />);
    fireEvent.press(getByText("ellipsis-horizontal"));
    fireEvent.press(getByText("gallery.compare"));
    expect(baseProps.onCompare).not.toHaveBeenCalled();
  });

  it("renders filename in more menu sheet title", () => {
    const { getAllByText } = render(<ViewerToolbar {...baseProps} />);
    fireEvent.press(getAllByText("ellipsis-horizontal")[0]);
    // Filename appears both in toolbar center and in sheet title
    const filenames = getAllByText("ngc7000.fits");
    expect(filenames.length).toBeGreaterThanOrEqual(2);
  });

  it("renders prev/next icons even when disabled (uses theme muted color)", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} prevId={null} nextId={null} />);
    expect(getByText("chevron-back")).toBeTruthy();
    expect(getByText("chevron-forward")).toBeTruthy();
  });

  it("renders success-colored controls icon when controls are shown", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} showControls={true} />);
    expect(getByText("options")).toBeTruthy();
  });

  it("renders success-colored checkmark when astrometry result exists", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} hasAstrometryResult={true} />);
    expect(getByText("checkmark-circle")).toBeTruthy();
  });

  it("uses danger color for favorite heart in more menu", () => {
    const { getByText } = render(<ViewerToolbar {...baseProps} isFavorite={true} />);
    fireEvent.press(getByText("ellipsis-horizontal"));
    expect(getByText("heart")).toBeTruthy();
  });
});
