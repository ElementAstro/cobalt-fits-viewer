import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react-native";
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
});
