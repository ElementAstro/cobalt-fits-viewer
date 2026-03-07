import React from "react";
import { Alert } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";
import { EditorToolBar } from "../EditorToolBar";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

const defaultProps = {
  activeTool: null as import("../../../hooks/editor/useEditorToolState").EditorTool,
  activeToolGroup: "adjust" as const,
  onToolPress: jest.fn(),
  onToolGroupChange: jest.fn(),
  successColor: "#00ff00",
  mutedColor: "#999999",
  fileId: "file-1",
  detectedStarsCount: 0,
  isStarAnnotationMode: false,
  onStarDetectToggle: jest.fn(),
};

describe("EditorToolBar", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders 4 tool group tabs", () => {
    const { getByText } = render(<EditorToolBar {...defaultProps} />);
    expect(getByText("editor.geometry")).toBeTruthy();
    expect(getByText("editor.adjust")).toBeTruthy();
    expect(getByText("editor.process")).toBeTruthy();
    expect(getByText("editor.maskTools")).toBeTruthy();
  });

  it("renders tools for the active group", () => {
    const { getByText } = render(<EditorToolBar {...defaultProps} activeToolGroup="geometry" />);
    expect(getByText("editor.crop")).toBeTruthy();
    expect(getByText("editor.rotate")).toBeTruthy();
    expect(getByText("editor.integerBin")).toBeTruthy();
    expect(getByText("editor.resample")).toBeTruthy();
  });

  it("renders newly wired adjust and process tools", () => {
    const { getByText, rerender } = render(
      <EditorToolBar {...defaultProps} activeToolGroup="adjust" />,
    );
    expect(getByText("editor.photometricCC")).toBeTruthy();
    expect(getByText("editor.backgroundNeutralize")).toBeTruthy();

    rerender(<EditorToolBar {...defaultProps} activeToolGroup="process" />);
    expect(getByText("editor.cosmeticCorrection")).toBeTruthy();
    expect(getByText("editor.mmt")).toBeTruthy();
  });

  it("calls onToolPress when a tool is pressed", () => {
    const onToolPress = jest.fn();
    const { getByTestId } = render(<EditorToolBar {...defaultProps} onToolPress={onToolPress} />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-tool-brightness"));
    expect(onToolPress).toHaveBeenCalledWith("brightness");
  });

  it("calls onToolPress for newly wired operator tool", () => {
    const onToolPress = jest.fn();
    const { getByTestId } = render(
      <EditorToolBar {...defaultProps} activeToolGroup="process" onToolPress={onToolPress} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-tool-cosmeticCorrection"));
    expect(onToolPress).toHaveBeenCalledWith("cosmeticCorrection");
  });

  it("calls onToolGroupChange when a tab is pressed", () => {
    const onToolGroupChange = jest.fn();
    const { getByText } = render(
      <EditorToolBar {...defaultProps} onToolGroupChange={onToolGroupChange} />,
    );
    fireEvent.press(getByText("editor.geometry"));
    expect(onToolGroupChange).toHaveBeenCalledWith("geometry");
  });

  it("shows Alert for coming soon advanced tools", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByTestId } = render(<EditorToolBar {...defaultProps} />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-advanced-calibration"));
    expect(alertSpy).toHaveBeenCalledWith("common.comingSoon");
    alertSpy.mockRestore();
  });

  it("calls onStarDetectToggle for starDetect tool", () => {
    const onStarDetectToggle = jest.fn();
    const { getByTestId } = render(
      <EditorToolBar {...defaultProps} onStarDetectToggle={onStarDetectToggle} />,
    );
    fireEvent.press(getByTestId("e2e-action-editor__param_id-advanced-starDetect"));
    expect(onStarDetectToggle).toHaveBeenCalledTimes(1);
  });

  it("shows star count when detectedStarsCount > 0", () => {
    const { getByText } = render(<EditorToolBar {...defaultProps} detectedStarsCount={42} />);
    expect(getByText(/42/)).toBeTruthy();
  });

  it("navigates to stacking route when stacking tool is pressed", () => {
    const mockPush = jest.fn();
    jest.spyOn(require("expo-router"), "useRouter").mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => false),
    });
    const { getByTestId } = render(<EditorToolBar {...defaultProps} />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-advanced-stacking"));
    expect(mockPush).toHaveBeenCalledWith("/stacking");
    jest.restoreAllMocks();
  });

  it("navigates to compose route with sourceId when compose tool is pressed", () => {
    const mockPush = jest.fn();
    jest.spyOn(require("expo-router"), "useRouter").mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => false),
    });
    const { getByTestId } = render(<EditorToolBar {...defaultProps} fileId="abc-123" />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-advanced-compose"));
    expect(mockPush).toHaveBeenCalledWith("/compose/advanced?sourceId=abc-123");
    jest.restoreAllMocks();
  });

  it("highlights the active tool", () => {
    const { getByText } = render(
      <EditorToolBar {...defaultProps} activeToolGroup="adjust" activeTool="brightness" />,
    );
    expect(getByText("editor.brightness")).toBeTruthy();
  });

  it("highlights starDetect when isStarAnnotationMode is true", () => {
    const { getByText } = render(
      <EditorToolBar {...defaultProps} isStarAnnotationMode={true} detectedStarsCount={0} />,
    );
    expect(getByText("editor.starDetect")).toBeTruthy();
  });

  it("navigates to compose generic route when fileId is undefined", () => {
    const mockPush = jest.fn();
    jest.spyOn(require("expo-router"), "useRouter").mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      back: jest.fn(),
      canGoBack: jest.fn(() => false),
    });
    const { getByTestId } = render(<EditorToolBar {...defaultProps} fileId={undefined} />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-advanced-compose"));
    expect(mockPush).toHaveBeenCalledWith("/compose/advanced");
    jest.restoreAllMocks();
  });

  it("shows Alert for statistics coming soon tool", () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByTestId } = render(<EditorToolBar {...defaultProps} />);
    fireEvent.press(getByTestId("e2e-action-editor__param_id-advanced-statistics"));
    expect(alertSpy).toHaveBeenCalledWith("common.comingSoon");
    alertSpy.mockRestore();
  });
});
