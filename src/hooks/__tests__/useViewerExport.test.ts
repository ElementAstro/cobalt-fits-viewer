import { act, renderHook } from "@testing-library/react-native";
import * as Haptics from "expo-haptics";
import { useViewerExport } from "../useViewerExport";

const mockToastShow = jest.fn();

jest.mock("heroui-native", () => ({
  useToast: () => ({ toast: { show: mockToastShow } }),
}));

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
  const exportImageDetailed = jest.fn();
  const shareImage = jest.fn();
  const saveImage = jest.fn();
  const copyImageToClipboard = jest.fn();
  const printImage = jest.fn();
  const printToPdf = jest.fn();
  const onDone = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useHapticFeedback.mockReturnValue({
      hapticsEnabled: true,
      selection: jest.fn(),
      impact: jest.fn(),
      notify: notifyMock,
    });
    useExport.mockReturnValue({
      isExporting: false,
      exportPhase: "idle",
      exportImageDetailed,
      shareImage,
      saveImage,
      copyImageToClipboard,
      printImage,
      printToPdf,
    });
    exportImageDetailed.mockResolvedValue({
      path: "/tmp/a.png",
      diagnostics: {
        fallbackApplied: false,
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      },
    });
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

    expect(mockToastShow).toHaveBeenCalledWith({ variant: "warning", label: "viewer.noImageData" });
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
    expect(exportImageDetailed).toHaveBeenCalled();
    expect(notifyMock).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(mockToastShow).toHaveBeenCalledWith({
      variant: "success",
      label: "viewer.exportSuccess",
      description: undefined,
    });
    expect(onDone).toHaveBeenCalledTimes(1);

    exportImageDetailed.mockResolvedValueOnce({
      path: null,
      diagnostics: {
        fallbackApplied: false,
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      },
    });
    await act(async () => {
      await result.current.handleExport(90);
    });
    expect(notifyMock).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    expect(mockToastShow).toHaveBeenCalledWith({ variant: "danger", label: "viewer.exportFailed" });
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("shows fallback reason message when diagnostics includes fallback", async () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    exportImageDetailed.mockResolvedValueOnce({
      path: "/tmp/a.png",
      diagnostics: {
        fallbackApplied: true,
        fallbackReasonMessageKey: "converter.fitsFallbackScientificUnavailable",
        warnings: [],
        annotationsDrawn: 0,
        watermarkApplied: false,
      },
    });

    const { result } = renderHook(() =>
      useViewerExport({
        rgbaData: rgba,
        width: 1,
        height: 1,
        filename: "x",
        format: "fits",
        onDone,
      }),
    );

    await act(async () => {
      await result.current.handleExport(90);
    });

    expect(mockToastShow).toHaveBeenCalledWith({
      variant: "success",
      label: "viewer.exportSuccess",
      description: "converter.fitsFallbackScientificUnavailable",
    });
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
    expect(mockToastShow).toHaveBeenCalledWith({ variant: "danger", label: "share.failed" });

    saveImage.mockResolvedValueOnce(null);
    await act(async () => {
      await result.current.handleSaveToDevice(80);
    });
    expect(mockToastShow).toHaveBeenCalledWith({ variant: "danger", label: "viewer.exportFailed" });

    printImage.mockRejectedValueOnce(new Error("print fail"));
    await act(async () => {
      await result.current.handlePrint();
    });
    expect(mockToastShow).toHaveBeenCalledWith({ variant: "danger", label: "viewer.printFailed" });

    printToPdf.mockRejectedValueOnce(new Error("pdf fail"));
    await act(async () => {
      await result.current.handlePrintToPdf();
    });
    expect(mockToastShow).toHaveBeenCalledWith({ variant: "danger", label: "viewer.printFailed" });
    expect(onDone).toHaveBeenCalledTimes(4);
  });

  it("handles copy to clipboard success and failure", async () => {
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

    copyImageToClipboard.mockResolvedValueOnce(true);
    await act(async () => {
      await result.current.handleCopyToClipboard();
    });
    expect(notifyMock).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(mockToastShow).toHaveBeenCalledWith({
      variant: "success",
      label: "viewer.copiedToClipboard",
    });

    mockToastShow.mockClear();
    copyImageToClipboard.mockResolvedValueOnce(false);
    await act(async () => {
      await result.current.handleCopyToClipboard();
    });
    expect(notifyMock).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Error);
    expect(mockToastShow).toHaveBeenCalledWith({
      variant: "danger",
      label: "viewer.copyFailed",
    });
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("forwards compression options to export/share/save requests", async () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    const { result } = renderHook(() =>
      useViewerExport({
        rgbaData: rgba,
        width: 1,
        height: 1,
        filename: "x",
        format: "webp",
        onDone,
      }),
    );

    const options = {
      customFilename: "custom",
      outputSize: { maxWidth: 1280, maxHeight: 1280 },
      targetFileSize: 200 * 1024,
      webpLossless: true,
    };

    await act(async () => {
      await result.current.handleExport(90, options);
    });
    expect(exportImageDetailed).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "custom",
        outputSize: options.outputSize,
        targetFileSize: options.targetFileSize,
        webpLossless: true,
      }),
    );

    await act(async () => {
      await result.current.handleShare(90, options);
    });
    expect(shareImage).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "custom",
        outputSize: options.outputSize,
        targetFileSize: options.targetFileSize,
        webpLossless: true,
      }),
    );

    await act(async () => {
      await result.current.handleSaveToDevice(90, options);
    });
    expect(saveImage).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: "custom",
        outputSize: options.outputSize,
        targetFileSize: options.targetFileSize,
        webpLossless: true,
      }),
    );
  });
});
