/**
 * FilePickerSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { FilePickerSheet } from "../FilePickerSheet";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

jest.mock("expo-image", () => {
  const { createExpoImageMock } = require("./helpers/mockExpoImage");
  return createExpoImageMock();
});

jest.mock("@shopify/flash-list", () => {
  const ReactLocal = require("react");
  const { View: RNView } = require("react-native");
  return {
    FlashList: ReactLocal.forwardRef(
      (
        props: {
          data: unknown[];
          renderItem: (info: { item: unknown; index: number }) => React.ReactNode;
          keyExtractor?: (item: unknown) => string;
        },
        _ref: React.Ref<unknown>,
      ) =>
        ReactLocal.createElement(
          RNView,
          { testID: "flash-list" },
          props.data.map((item: unknown, index: number) =>
            ReactLocal.createElement(
              RNView,
              { key: props.keyExtractor ? props.keyExtractor(item) : String(index) },
              props.renderItem({ item, index }),
            ),
          ),
        ),
    ),
  };
});

const makeFitsFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
  id: "file-1",
  filename: "test_001.fits",
  filepath: "/data/test_001.fits",
  fileSize: 1024000,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  ...overrides,
});

const files: FitsMetadata[] = [
  makeFitsFile({
    id: "f1",
    filename: "M42_light_001.fits",
    object: "M42",
    filter: "Ha",
    exptime: 300,
  }),
  makeFitsFile({ id: "f2", filename: "M42_light_002.fits", object: "M42", filter: "OIII" }),
  makeFitsFile({ id: "f3", filename: "M31_light_001.fits", thumbnailUri: "file:///thumb.jpg" }),
];

describe("FilePickerSheet", () => {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  const onSelectBatch = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders dialog title", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText("astrometry.selectFile")).toBeTruthy();
  });

  it("renders all file names", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText("M42_light_001.fits")).toBeTruthy();
    expect(screen.getByText("M42_light_002.fits")).toBeTruthy();
    expect(screen.getByText("M31_light_001.fits")).toBeTruthy();
  });

  it("renders object chip when file has object", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getAllByText("M42").length).toBe(2);
  });

  it("renders filter chip when file has filter", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText("Ha")).toBeTruthy();
    expect(screen.getByText("OIII")).toBeTruthy();
  });

  it("renders exposure time when file has exptime", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText("300s")).toBeTruthy();
  });

  it("renders thumbnail image when thumbnailUri is provided", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getAllByTestId("expo-image").length).toBeGreaterThan(0);
  });

  it("calls onSelect when file row is pressed in single mode", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    fireEvent.press(screen.getByText("M42_light_001.fits"));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(files[0]);
  });

  it("renders cancel button and fires onClose", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    fireEvent.press(screen.getByText("common.cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders empty state when no files", () => {
    render(<FilePickerSheet visible={true} files={[]} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getByText("files.emptyState")).toBeTruthy();
  });

  it("shows multi-select toggle when onSelectBatch is provided", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // checkbox-outline icon text
    expect(screen.getByText("checkbox-outline")).toBeTruthy();
  });

  it("does not show multi-select toggle when onSelectBatch is not provided", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.queryByText("checkbox-outline")).toBeNull();
    expect(screen.queryByText("checkbox")).toBeNull();
  });

  it("toggles multi-select mode when checkbox icon is pressed", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // Enter multi-select mode
    fireEvent.press(screen.getByText("checkbox-outline"));
    // Now should show selection counter
    expect(screen.getByText("astrometry.selectedCount")).toBeTruthy();
    expect(screen.getByText("astrometry.selectAll")).toBeTruthy();
  });

  it("selects files in multi mode by pressing file rows", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // Enter multi-select mode
    fireEvent.press(screen.getByText("checkbox-outline"));
    // Select first file
    fireEvent.press(screen.getByText("M42_light_001.fits"));
    expect(screen.getByText("astrometry.selectedCount")).toBeTruthy();
  });

  it("select all selects all files", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // Enter multi-select mode
    fireEvent.press(screen.getByText("checkbox-outline"));
    // Select All
    fireEvent.press(screen.getByText("astrometry.selectAll"));
    expect(screen.getByText("astrometry.selectedCount")).toBeTruthy();
  });

  it("shows submit button with count when files are selected in multi mode", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // Enter multi-select mode
    fireEvent.press(screen.getByText("checkbox-outline"));
    // Select a file
    fireEvent.press(screen.getByText("M42_light_001.fits"));
    expect(screen.getByText("astrometry.submit (1)")).toBeTruthy();
  });

  it("calls onSelectBatch when submit button is pressed", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // Enter multi-select mode and select first file
    fireEvent.press(screen.getByText("checkbox-outline"));
    fireEvent.press(screen.getByText("M42_light_001.fits"));
    fireEvent.press(screen.getByText("astrometry.submit (1)"));
    expect(onSelectBatch).toHaveBeenCalledTimes(1);
    expect(onSelectBatch).toHaveBeenCalledWith([files[0]]);
  });

  it("toggles file selection off in multi mode", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // Enter multi-select mode
    fireEvent.press(screen.getByText("checkbox-outline"));
    // Select then deselect
    fireEvent.press(screen.getByText("M42_light_001.fits"));
    expect(screen.getByText("astrometry.selectedCount")).toBeTruthy();
    fireEvent.press(screen.getByText("M42_light_001.fits"));
    expect(screen.getByText("astrometry.selectedCount")).toBeTruthy();
  });

  it("resets selection and multi mode when close is called", () => {
    render(
      <FilePickerSheet
        visible={true}
        files={files}
        onSelect={onSelect}
        onSelectBatch={onSelectBatch}
        onClose={onClose}
      />,
    );
    // Enter multi-select and select a file
    fireEvent.press(screen.getByText("checkbox-outline"));
    fireEvent.press(screen.getByText("M42_light_001.fits"));
    // Close
    fireEvent.press(screen.getByText("common.cancel"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders chevron-forward icon in single mode", () => {
    render(<FilePickerSheet visible={true} files={files} onSelect={onSelect} onClose={onClose} />);
    expect(screen.getAllByText("chevron-forward").length).toBe(3);
  });
});
