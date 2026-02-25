import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { StarAnnotationPanel } from "../StarAnnotationPanel";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const defaultProps = {
  successColor: "#00ff00",
  detectedStarCount: 10,
  manualStarCount: 3,
  enabledStarCount: 13,
  starAnnotationsStale: false,
  starAnnotationsStaleReason: undefined,
  isDetectingStars: false,
  starDetectionStage: "",
  starDetectionProgress: 0,
  pendingAnchorIndex: null as 1 | 2 | 3 | null,
  onClose: jest.fn(),
  onReDetect: jest.fn(),
  onCancelDetection: jest.fn(),
  onSetAnchor: jest.fn(),
  onClearAnchors: jest.fn(),
};

describe("StarAnnotationPanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders star counts", () => {
    const { getByTestId } = render(<StarAnnotationPanel {...defaultProps} />);
    const countsText = getByTestId("e2e-text-editor__param_id-star-counts");
    expect(countsText).toBeTruthy();
  });

  it("shows stale warning when starAnnotationsStale is true", () => {
    const { getByText } = render(
      <StarAnnotationPanel {...defaultProps} starAnnotationsStale={true} />,
    );
    expect(getByText("editor.annotationStale")).toBeTruthy();
  });

  it("does not show stale warning when starAnnotationsStale is false", () => {
    const { queryByText } = render(
      <StarAnnotationPanel {...defaultProps} starAnnotationsStale={false} />,
    );
    expect(queryByText("editor.annotationStale")).toBeNull();
  });

  it("shows detection progress when isDetectingStars is true", () => {
    const { getByText } = render(
      <StarAnnotationPanel
        {...defaultProps}
        isDetectingStars={true}
        starDetectionStage="scanning"
        starDetectionProgress={45}
      />,
    );
    expect(getByText(/scanning/)).toBeTruthy();
    expect(getByText(/45%/)).toBeTruthy();
  });

  it("shows cancel button when isDetectingStars is true", () => {
    const { getByText } = render(<StarAnnotationPanel {...defaultProps} isDetectingStars={true} />);
    expect(getByText("common.cancel")).toBeTruthy();
  });

  it("does not show cancel button when isDetectingStars is false", () => {
    const { queryAllByText } = render(
      <StarAnnotationPanel {...defaultProps} isDetectingStars={false} />,
    );
    const cancelButtons = queryAllByText("common.cancel");
    expect(cancelButtons.length).toBe(0);
  });

  it("renders 3 anchor buttons", () => {
    const { getByText } = render(<StarAnnotationPanel {...defaultProps} />);
    expect(getByText("editor.setAnchor1")).toBeTruthy();
    expect(getByText("editor.setAnchor2")).toBeTruthy();
    expect(getByText("editor.setAnchor3")).toBeTruthy();
  });

  it("renders re-detect button", () => {
    const { getByText } = render(<StarAnnotationPanel {...defaultProps} />);
    expect(getByText("editor.reDetectStars")).toBeTruthy();
  });

  it("calls onClose when close button is pressed", () => {
    const onClose = jest.fn();
    const { getByText } = render(<StarAnnotationPanel {...defaultProps} onClose={onClose} />);
    fireEvent.press(getByText("common.close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders clear anchors button", () => {
    const { getByText } = render(<StarAnnotationPanel {...defaultProps} />);
    expect(getByText("editor.clearAnchors")).toBeTruthy();
  });

  it("calls onReDetect when re-detect button is pressed", () => {
    const onReDetect = jest.fn();
    const { getByTestId } = render(
      <StarAnnotationPanel {...defaultProps} onReDetect={onReDetect} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-redetect-stars"));
    expect(onReDetect).toHaveBeenCalledTimes(1);
  });

  it("disables re-detect button during detection", () => {
    const { getByTestId } = render(
      <StarAnnotationPanel {...defaultProps} isDetectingStars={true} />,
    );
    const btn = getByTestId("e2e-action-editor__param_id-redetect-stars");
    expect(btn.props.isDisabled).toBe(true);
  });

  it("calls onClearAnchors when clear anchors button is pressed", () => {
    const onClearAnchors = jest.fn();
    const { getByText } = render(
      <StarAnnotationPanel {...defaultProps} onClearAnchors={onClearAnchors} />,
    );
    fireEvent.press(getByText("editor.clearAnchors"));
    expect(onClearAnchors).toHaveBeenCalledTimes(1);
  });

  it("calls onSetAnchor when anchor button is pressed", () => {
    const onSetAnchor = jest.fn();
    const { getByText } = render(
      <StarAnnotationPanel {...defaultProps} onSetAnchor={onSetAnchor} />,
    );
    fireEvent.press(getByText("editor.setAnchor1"));
    expect(onSetAnchor).toHaveBeenCalledWith(1);
  });

  it("shows stale reason when provided", () => {
    const { getByText } = render(
      <StarAnnotationPanel
        {...defaultProps}
        starAnnotationsStale={true}
        starAnnotationsStaleReason={"imageEdited" as never}
      />,
    );
    expect(getByText(/imageEdited/)).toBeTruthy();
  });
});
