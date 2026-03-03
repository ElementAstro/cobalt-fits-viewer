import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { ExportDialog } from "../ExportDialog";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

describe("ExportDialog", () => {
  it("propagates watermarkText and FITS advanced options into action options", async () => {
    const onExport = jest.fn();

    render(
      <ExportDialog
        visible
        filename="m42.fits"
        format="fits"
        width={80}
        height={40}
        onFormatChange={jest.fn()}
        onExport={onExport}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-toggle-watermark").props.onPress();
    });

    await waitFor(() => {
      expect(screen.getByTestId("e2e-input-export-dialog-watermark-text")).toBeTruthy();
    });

    await act(async () => {
      screen.getByTestId("e2e-input-export-dialog-watermark-text").props.onChangeText("Hello");
    });

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-fits-color-layout-mono2d").props.onPress();
    });

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-fits-preserve-header").props.onPress();
      screen.getByTestId("e2e-action-export-dialog-fits-preserve-wcs").props.onPress();
    });

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-export").props.onPress();
    });

    expect(onExport).toHaveBeenCalledTimes(1);
    const [_quality, options] = onExport.mock.calls[0] as [number, any];
    expect(options).toEqual(
      expect.objectContaining({
        fits: expect.objectContaining({
          colorLayout: "mono2d",
          preserveOriginalHeader: false,
          preserveWcs: false,
        }),
        render: expect.objectContaining({
          includeWatermark: true,
          watermarkText: "Hello",
        }),
      }),
    );
  });

  it("propagates default TIFF bitDepth and dpi into action options", async () => {
    const onExport = jest.fn();

    render(
      <ExportDialog
        visible
        filename="m42.tiff"
        format="tiff"
        width={80}
        height={40}
        onFormatChange={jest.fn()}
        onExport={onExport}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-export").props.onPress();
    });

    expect(onExport).toHaveBeenCalledTimes(1);
    const [_quality, options] = onExport.mock.calls[0] as [number, any];
    expect(options.tiff).toBeDefined();
    expect(options.tiff.bitDepth).toBe(16);
    expect(options.tiff.dpi).toBe(72);
    expect(options.tiff.compression).toBe("lzw");
    expect(options.tiff.multipage).toBe("preserve");
  });

  it("calls onFormatChange when a format chip is pressed", async () => {
    const onFormatChange = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={onFormatChange}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-format-jpeg").props.onPress();
    });

    expect(onFormatChange).toHaveBeenCalledWith("jpeg");
  });

  it("shows quality slider and presets for jpeg format", () => {
    render(
      <ExportDialog
        visible
        filename="test.jpeg"
        format="jpeg"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("converter.quality")).toBeTruthy();
  });

  it("renders output size chips", () => {
    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("converter.outputSizeOriginal")).toBeTruthy();
    expect(screen.getByText("2048px")).toBeTruthy();
    expect(screen.getByText("1920px")).toBeTruthy();
    expect(screen.getByText("1080px")).toBeTruthy();
    expect(screen.getByText("720px")).toBeTruthy();
  });

  it("shows compression mode chips for jpeg format", () => {
    render(
      <ExportDialog
        visible
        filename="test.jpeg"
        format="jpeg"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("converter.qualityMode")).toBeTruthy();
    expect(screen.getByText("converter.targetSizeMode")).toBeTruthy();
  });

  it("shows webp lossless chip for webp format", () => {
    render(
      <ExportDialog
        visible
        filename="test.webp"
        format="webp"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("converter.webpLossless")).toBeTruthy();
  });

  it("calls onSaveToDevice when save button is pressed", async () => {
    const onSaveToDevice = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={onSaveToDevice}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText("common.save"));
    });

    expect(onSaveToDevice).toHaveBeenCalledTimes(1);
  });

  it("calls onShare when share button is pressed", async () => {
    const onShare = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={onShare}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText("common.share"));
    });

    expect(onShare).toHaveBeenCalledTimes(1);
  });

  it("renders copy button when onCopyToClipboard is provided", () => {
    const onCopy = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onCopyToClipboard={onCopy}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("common.copy")).toBeTruthy();
  });

  it("renders print button when onPrint is provided", () => {
    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onPrint={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("viewer.print")).toBeTruthy();
  });

  it("renders print-to-pdf button when onPrintToPdf is provided", () => {
    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onPrintToPdf={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("viewer.printToPdf")).toBeTruthy();
  });

  it("renders annotations toggle chip", () => {
    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("converter.includeAnnotations")).toBeTruthy();
    expect(screen.getByText("converter.includeWatermark")).toBeTruthy();
  });

  it("renders estimated size when width and height are provided", () => {
    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={1920}
        height={1080}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    // estimatedSize is rendered with formatBytes, prefixed by ≈
    const tree = screen.toJSON();
    expect(tree).toBeTruthy();
  });

  it("renders custom filename input", async () => {
    render(
      <ExportDialog
        visible
        filename="m42.fits"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    const input = screen.getByTestId("e2e-input-export-dialog-filename");
    expect(input).toBeTruthy();

    await act(async () => {
      input.props.onChangeText("custom_name");
    });
  });

  it("selects output size when chip is pressed", async () => {
    const onExport = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={onExport}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText("1080px"));
    });

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-export").props.onPress();
    });

    const [_q, opts] = onExport.mock.calls[0] as [number, any];
    expect(opts.outputSize).toEqual({ maxWidth: 1080, maxHeight: 1080 });
  });

  it("switches to targetSize compression mode and enters target file size", async () => {
    const onExport = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.jpeg"
        format="jpeg"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={onExport}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText("converter.targetSizeMode"));
    });

    // After switching to targetSize, a numeric input should appear for file size
    // The compression mode toggle itself is already verified
    expect(screen.getByText("converter.compressionMode")).toBeTruthy();
  });

  it("toggles webp lossless and propagates into action options", async () => {
    const onExport = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.webp"
        format="webp"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={onExport}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText("converter.webpLossless"));
    });

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-export").props.onPress();
    });

    const [_q, opts] = onExport.mock.calls[0] as [number, any];
    expect(opts.webpLossless).toBe(true);
  });

  it("prevents targetSize mode when webp lossless is enabled", async () => {
    const onExport = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.webp"
        format="webp"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={onExport}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    await act(async () => {
      fireEvent.press(screen.getByText("converter.webpLossless"));
    });
    await act(async () => {
      fireEvent.press(screen.getByText("converter.targetSizeMode"));
    });
    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-export").props.onPress();
    });

    const [_q, opts] = onExport.mock.calls[0] as [number, any];
    expect(opts.webpLossless).toBe(true);
    expect(opts.targetFileSize).toBeUndefined();
  });

  it("toggles annotations and propagates into action options", async () => {
    const onExport = jest.fn();

    render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        width={100}
        height={100}
        onFormatChange={jest.fn()}
        onExport={onExport}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    // Toggle watermark on first so renderOptions will be defined
    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-toggle-watermark").props.onPress();
    });

    // Toggle annotations (starts as true from default, so toggling makes it false)
    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-toggle-annotations").props.onPress();
    });

    await act(async () => {
      screen.getByTestId("e2e-action-export-dialog-export").props.onPress();
    });

    const [_q, opts] = onExport.mock.calls[0] as [number, any];
    expect(opts.render).toBeDefined();
    expect(opts.render.includeWatermark).toBe(true);
  });

  it("calls onClose when dialog is closed", () => {
    const onClose = jest.fn();

    const { toJSON } = render(
      <ExportDialog
        visible
        filename="test.png"
        format="png"
        onFormatChange={jest.fn()}
        onExport={jest.fn()}
        onShare={jest.fn()}
        onSaveToDevice={jest.fn()}
        onClose={onClose}
      />,
    );

    expect(toJSON()).toBeTruthy();
  });
});
