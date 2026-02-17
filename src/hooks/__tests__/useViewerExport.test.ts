import { act, renderHook } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as Haptics from "expo-haptics";
import { useViewerExport } from "../useViewerExport";

jest.mock("../useExport", () => ({
  useExport: jest.fn(),
}));

jest.mock("../useHapticFeedback", () => ({
  useHapticFeedback: jest.fn(),
}));

jest.mock("../../i18n/useI18n", () => ({
  useI18n: jest.fn(() => ({
    t: (key: string) => key,
  })),
}));

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: {
    Success: "Success",
    Error: "Error",
  },
}));

const { useExport } = jest.requireMock("../useExport") as {
  useExport: jest.Mock;
};
const { useHapticFeedback } = jest.requireMock("../useHapticFeedback") as {
  useHapticFeedback: jest.Mock;
};
const notifyMock = jest.fn();

describe("useViewerExport", () => {
  const exportImage = jest.fn();
  const shareImage = jest.fn();
  const saveImage = jest.fn();
  const printImage = jest.fn();
  const printToPdf = jest.fn();
  const onDone = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert").mockImplementation(jest.fn());
    useHapticFeedback.mockReturnValue({
      hapticsEnabled: true,
      selection: jest.fn(),
      impact: jest.fn(),
      notify: notifyMock,
    });
    useExport.mockReturnValue({
      isExporting: false,
      exportImage,
      shareImage,
      saveImage,
      printImage,
      printToPdf,
    });
    exportImage.mockResolvedValue("/tmp/a.png");
    saveImage.mockResolvedValue("asset://a.png");
    shareImage.mockResolvedValue(undefined);
    printImage.mockResolvedValue(undefined);
    printToPdf.mockResolvedValue(undefined);
  });

  it("shows guard alert when no image data", async () => {
    const { result } = renderHook(() =>
      useViewerExport({
        rgbaData: null,
        width: 10,
        height: 10,
        filename: "x",
        format: "png",
        onDone,
      }),
    );

    await act(async () => {
      await result.current.handleExport(90);
    });

    expect(Alert.alert).toHaveBeenCalledWith("common.error", "viewer.noImageData");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("handles export success and failure branches", async () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const { result } = renderHook(() =>
      useViewerExport({
        rgbaData: rgba,
        width: 1,
        height: 1,
        filename: "x",
        format: "png",
        onDone,
      }),
    );

    await act(async () => {
      await result.current.handleExport(90);
    });
    expect(exportImage).toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(Alert.alert).toHaveBeenCalledWith("common.success", "viewer.exportSuccess");
    expect(onDone).toHaveBeenCalledTimes(1);

    exportImage.mockResolvedValueOnce(null);
    await act(async () => {
      await result.current.handleExport(90);
    });
    expect(notifyMock).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    expect(Alert.alert).toHaveBeenCalledWith("common.error", "viewer.exportFailed");
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("handles share/save/print actions and error alerts", async () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const { result } = renderHook(() =>
      useViewerExport({
        rgbaData: rgba,
        width: 1,
        height: 1,
        filename: "x",
        format: "png",
        onDone,
      }),
    );

    shareImage.mockRejectedValueOnce(new Error("share fail"));
    await act(async () => {
      await result.current.handleShare(80);
    });
    expect(Alert.alert).toHaveBeenCalledWith("common.error", "share.failed");

    saveImage.mockResolvedValueOnce(null);
    await act(async () => {
      await result.current.handleSaveToDevice(80);
    });
    expect(Alert.alert).toHaveBeenCalledWith("common.error", "viewer.exportFailed");

    printImage.mockRejectedValueOnce(new Error("print fail"));
    await act(async () => {
      await result.current.handlePrint();
    });
    expect(Alert.alert).toHaveBeenCalledWith("common.error", "viewer.printFailed");

    printToPdf.mockRejectedValueOnce(new Error("pdf fail"));
    await act(async () => {
      await result.current.handlePrintToPdf();
    });
    expect(Alert.alert).toHaveBeenCalledWith("common.error", "viewer.printFailed");
    expect(onDone).toHaveBeenCalledTimes(4);
  });
});
