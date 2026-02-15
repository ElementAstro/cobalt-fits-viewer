import React from "react";
import { render, screen } from "@testing-library/react-native";
import FilesScreen from "../index";

// Mock useScreenOrientation hook
jest.mock("../../../hooks/useScreenOrientation", () => ({
  useScreenOrientation: () => ({
    isLandscape: false,
    isPortrait: true,
    orientation: 1,
    screenWidth: 390,
    screenHeight: 844,
    lockOrientation: jest.fn(),
    unlockOrientation: jest.fn(),
  }),
}));

// Mock useFileManager hook
jest.mock("../../../hooks/useFileManager", () => ({
  useFileManager: () => ({
    isImporting: false,
    importProgress: { phase: "picking", percent: 0, current: 0, total: 0 },
    importError: null,
    lastImportResult: null,
    pickAndImportFile: jest.fn(),
    pickAndImportFolder: jest.fn(),
    pickAndImportZip: jest.fn(),
    importFromUrl: jest.fn(),
    cancelImport: jest.fn(),
    handleDeleteFiles: jest.fn(),
  }),
}));

// Mock expo-image
jest.mock("expo-image", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    Image: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: "expo-image", ...props }),
  };
});

// Mock react-native-gesture-handler Swipeable (already in jest.setup but FileListItem uses Swipeable directly)
jest.mock("react-native-gesture-handler", () => {
  const { View } = require("react-native");
  const React = require("react");
  return {
    Swipeable: React.forwardRef((props: Record<string, unknown>, _ref: unknown) =>
      React.createElement(View, props as object, props.children as React.ReactNode),
    ),
    GestureHandlerRootView: (props: Record<string, unknown>) =>
      React.createElement(View, props as object, props.children as React.ReactNode),
  };
});

describe("FilesScreen", () => {
  it("should render the file manager title", () => {
    render(<FilesScreen />);
    expect(screen.getByText("File Manager")).toBeTruthy();
  });

  it("should render the empty state when no files", () => {
    render(<FilesScreen />);
    expect(screen.getByText("No FITS files yet")).toBeTruthy();
    expect(screen.getByText("Import files to get started")).toBeTruthy();
  });

  it("should render the import button", () => {
    render(<FilesScreen />);
    expect(screen.getAllByText("Import Options").length).toBeGreaterThanOrEqual(1);
  });
});
