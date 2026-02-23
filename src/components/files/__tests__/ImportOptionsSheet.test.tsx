import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ImportOptionsSheet } from "../ImportOptionsSheet";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  visible: true,
  onOpenChange: jest.fn(),
  screenHeight: 800,
  isZipImportAvailable: true,
  isLandscape: false,
  onImportFile: jest.fn(),
  onImportFolder: jest.fn(),
  onImportZip: jest.fn(),
  onImportUrl: jest.fn(),
  onImportClipboard: jest.fn(),
  onImportMediaLibrary: jest.fn(),
  onRecordVideo: jest.fn(),
};

describe("ImportOptionsSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders sheet title", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    expect(screen.getByText("files.importOptions")).toBeTruthy();
  });

  it("renders subtitle", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    expect(screen.getByText("files.selectImportMethod")).toBeTruthy();
  });

  it("renders all import option items", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    expect(screen.getByText("files.importFile")).toBeTruthy();
    expect(screen.getByText("files.importFolder")).toBeTruthy();
    expect(screen.getByText("files.importZip")).toBeTruthy();
    expect(screen.getByText("files.importFromUrl")).toBeTruthy();
    expect(screen.getByText("files.importFromClipboard")).toBeTruthy();
    expect(screen.getByText("files.importFromMediaLibrary")).toBeTruthy();
    expect(screen.getByText("files.recordVideo")).toBeTruthy();
  });

  it("renders supported formats subtitle for file import", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    expect(screen.getAllByText("files.supportedFormatsShort").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onImportFile when file import option is pressed", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.importFile"));
    expect(defaultProps.onImportFile).toHaveBeenCalled();
  });

  it("calls onImportFolder when folder import option is pressed", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.importFolder"));
    expect(defaultProps.onImportFolder).toHaveBeenCalled();
  });

  it("calls onImportZip when zip import option is pressed", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.importZip"));
    expect(defaultProps.onImportZip).toHaveBeenCalled();
  });

  it("calls onImportUrl when url import option is pressed", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.importFromUrl"));
    expect(defaultProps.onImportUrl).toHaveBeenCalled();
  });

  it("calls onImportClipboard when clipboard import option is pressed", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.importFromClipboard"));
    expect(defaultProps.onImportClipboard).toHaveBeenCalled();
  });

  it("calls onImportMediaLibrary when media library option is pressed", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.importFromMediaLibrary"));
    expect(defaultProps.onImportMediaLibrary).toHaveBeenCalled();
  });

  it("calls onRecordVideo when record video option is pressed", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    fireEvent.press(screen.getByText("files.recordVideo"));
    expect(defaultProps.onRecordVideo).toHaveBeenCalled();
  });

  it("shows zip unavailable text when isZipImportAvailable is false", () => {
    render(<ImportOptionsSheet {...defaultProps} isZipImportAvailable={false} />);
    expect(screen.getByText("files.importZipUnavailable")).toBeTruthy();
  });

  it("shows ZIP subtitle when isZipImportAvailable is true", () => {
    render(<ImportOptionsSheet {...defaultProps} isZipImportAvailable />);
    expect(screen.getByText("ZIP")).toBeTruthy();
  });

  it("renders when not visible", () => {
    const { toJSON } = render(<ImportOptionsSheet {...defaultProps} visible={false} />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders folder import subtitle", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    expect(screen.getByText("files.supportedFormatsHint")).toBeTruthy();
  });

  it("renders media library hint", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    expect(screen.getByText("files.mediaLibraryHint")).toBeTruthy();
  });

  it("renders record video hint", () => {
    render(<ImportOptionsSheet {...defaultProps} />);
    expect(screen.getByText("files.recordVideoHint")).toBeTruthy();
  });
});
