import React from "react";
import { Alert } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { BatchRenameSheet } from "../BatchRenameSheet";
import { DEFAULT_TEMPLATE } from "../../../lib/gallery/fileRenamer";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "common.cancel": "Cancel",
          "common.confirm": "Confirm",
          "common.success": "Success",
          "common.error": "Error",
          "album.selected": "selected",
          "gallery.batchRename": "Batch Rename",
          "gallery.renameTemplate": "Template",
          "gallery.renamePreview": "Preview",
          "files.renamePartial": "Renamed {success} file(s), {failed} failed",
          "files.renameNoChanges": "No filename changes to apply",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("../../../hooks/useFileManager", () => ({
  useFileManager: jest.fn(),
}));

describe("BatchRenameSheet", () => {
  const files: FitsMetadata[] = [
    {
      id: "file-1",
      filename: "M42.fits",
      filepath: "file:///document/fits_files/M42.fits",
      fileSize: 1024,
      importDate: 1700000000000,
      frameType: "light",
      isFavorite: false,
      tags: [],
      albumIds: [],
      object: "M42",
      filter: "Ha",
      exptime: 300,
    },
    {
      id: "file-2",
      filename: "M31.fits",
      filepath: "file:///document/fits_files/M31.fits",
      fileSize: 1024,
      importDate: 1700000001000,
      frameType: "light",
      isFavorite: false,
      tags: [],
      albumIds: [],
      object: "M31",
      filter: "OIII",
      exptime: 180,
    },
  ];

  const onClose = jest.fn();
  const onApplyRenames = jest.fn(() => ({ success: 2, failed: 0 }));
  let alertSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });

  afterEach(() => {
    alertSpy.mockRestore();
  });

  it("shows no-change message and does not submit operations when template keeps original names", () => {
    render(
      <BatchRenameSheet
        visible
        files={files}
        selectedIds={["file-1", "file-2"]}
        onApplyRenames={onApplyRenames}
        onClose={onClose}
      />,
    );

    fireEvent.changeText(screen.getByTestId("batch-rename-template-input"), "{original}");
    fireEvent.press(screen.getByTestId("batch-rename-apply"));

    expect(onApplyRenames).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith("Success", "No filename changes to apply");
  });

  it("renders rename preview from template variables", () => {
    render(
      <BatchRenameSheet
        visible
        files={files}
        selectedIds={["file-1", "file-2"]}
        onApplyRenames={onApplyRenames}
        onClose={onClose}
      />,
    );

    fireEvent.changeText(screen.getByTestId("batch-rename-template-input"), "{object}_{seq}");

    expect(screen.getByText("M42_001.fits")).toBeTruthy();
    expect(screen.getByText("M31_002.fits")).toBeTruthy();
  });

  it("shows partial failure message from submit result", () => {
    onApplyRenames.mockReturnValueOnce({ success: 1, failed: 1 });

    render(
      <BatchRenameSheet
        visible
        files={files}
        selectedIds={["file-1", "file-2"]}
        onApplyRenames={onApplyRenames}
        onClose={onClose}
      />,
    );

    fireEvent.changeText(screen.getByTestId("batch-rename-template-input"), "{object}_{seq}");
    fireEvent.press(screen.getByTestId("batch-rename-apply"));

    expect(onApplyRenames).toHaveBeenCalledTimes(1);
    expect(Alert.alert).toHaveBeenCalledWith("Error", "Renamed 1 file(s), 1 failed");
    expect(onClose).toHaveBeenCalled();
  });

  it("resets template to default when closed", () => {
    render(
      <BatchRenameSheet
        visible
        files={files}
        selectedIds={["file-1"]}
        onApplyRenames={onApplyRenames}
        onClose={onClose}
      />,
    );

    fireEvent.changeText(screen.getByTestId("batch-rename-template-input"), "custom_{seq}");
    fireEvent.press(screen.getByTestId("batch-rename-cancel"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("batch-rename-template-input").props.value).toBe(DEFAULT_TEMPLATE);
  });

  it("does not instantiate file manager hook inside component", () => {
    const { useFileManager } = require("../../../hooks/useFileManager") as {
      useFileManager: jest.Mock;
    };

    render(
      <BatchRenameSheet
        visible
        files={files}
        selectedIds={["file-1"]}
        onApplyRenames={onApplyRenames}
        onClose={onClose}
      />,
    );

    expect(useFileManager).not.toHaveBeenCalled();
  });
});
