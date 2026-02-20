import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, screen } from "@testing-library/react-native";
import FilesScreen from "../index";
import { useFitsStore } from "../../../stores/useFitsStore";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockPush = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

const mockResolveThumbnailUri = jest.fn(
  (fileId: string, thumbnailUri?: string) =>
    thumbnailUri ?? `file:///cache/thumbnails/${fileId}.jpg`,
);

const mockFileManager = {
  isImporting: false,
  importProgress: { phase: "picking", percent: 0, current: 0, total: 0 },
  importError: null,
  lastImportResult: null,
  isZipImportAvailable: true,
  pickAndImportFile: jest.fn(),
  pickAndImportFromMediaLibrary: jest.fn(),
  recordAndImportVideo: jest.fn(),
  pickAndImportFolder: jest.fn(),
  pickAndImportZip: jest.fn(),
  importFromUrl: jest.fn(),
  importFromClipboard: jest.fn(),
  cancelImport: jest.fn(),
  handleDeleteFiles: jest.fn(() => ({ success: 1, failed: 0, token: "token-1" })),
  undoLastDelete: jest.fn(),
  restoreFromTrash: jest.fn(),
  emptyTrash: jest.fn(() => ({ deleted: 1, failed: 0 })),
  exportFiles: jest.fn(),
  groupFiles: jest.fn(() => ({ success: 1, failed: 0 })),
  handleRenameFiles: jest.fn(() => ({ success: 1, failed: 0 })),
};

const mockSettingsStore = {
  fileListStyle: "list",
  setFileListStyle: jest.fn(),
  defaultGridColumns: 3,
  thumbnailShowFilename: true,
  thumbnailShowObject: false,
  thumbnailShowFilter: true,
  thumbnailShowExposure: false,
  confirmDestructiveActions: true,
  frameClassificationConfig: {
    frameTypes: [
      { key: "light", label: "Light", builtin: true },
      { key: "dark", label: "Dark", builtin: true },
      { key: "flat", label: "Flat", builtin: true },
      { key: "bias", label: "Bias", builtin: true },
      { key: "darkflat", label: "Dark Flat", builtin: true },
      { key: "unknown", label: "Unknown", builtin: true },
    ],
    rules: [],
  },
};

const mockTrashStore = {
  items: [] as Array<{ trashId: string }>,
};

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
  useFileManager: () => mockFileManager,
}));

jest.mock("../../../hooks/useAlbums", () => ({
  useAlbums: () => ({
    albums: [],
    addImagesToAlbum: jest.fn(),
  }),
}));

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockSettingsStore),
}));

jest.mock("../../../stores/useTrashStore", () => ({
  useTrashStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector(mockTrashStore),
}));

jest.mock("../../../stores/useFileGroupStore", () => ({
  useFileGroupStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      groups: [],
      fileGroupMap: {},
    }),
}));

jest.mock("../../../components/gallery/AlbumPickerSheet", () => ({
  AlbumPickerSheet: () => null,
}));

jest.mock("../../../components/gallery/BatchTagSheet", () => ({
  BatchTagSheet: () => null,
}));

jest.mock("../../../components/gallery/BatchRenameSheet", () => ({
  BatchRenameSheet: (props: {
    visible: boolean;
    onApplyRenames: (ops: Array<{ fileId: string; filename: string }>) => void;
  }) => {
    const React = require("react");
    const { View } = require("react-native");
    if (!props.visible) return null;
    return React.createElement(View, {
      testID: "batch-rename-sheet-submit",
      onPress: () => props.onApplyRenames([{ fileId: "file-1", filename: "renamed.fits" }]),
    });
  },
}));

jest.mock("../../../components/gallery/TrashSheet", () => ({
  TrashSheet: (props: { visible: boolean; onDeleteForever: (trashIds?: string[]) => void }) => {
    const React = require("react");
    const { View } = require("react-native");
    if (!props.visible) return null;
    return React.createElement(View, {
      testID: "trash-sheet-empty-button",
      onPress: () => props.onDeleteForever(),
    });
  },
}));

jest.mock("../../../components/gallery/FileGroupSheet", () => ({
  FileGroupSheet: () => null,
}));

jest.mock("../../../lib/gallery/thumbnailCache", () => {
  const actual = jest.requireActual("../../../lib/gallery/thumbnailCache");
  return {
    ...actual,
    resolveThumbnailUri: (fileId: string, thumbnailUri?: string) =>
      mockResolveThumbnailUri(fileId, thumbnailUri),
  };
});

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
  let alertSpy: jest.SpyInstance;

  const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata => ({
    id: "file-1",
    filename: "M42_Light.fits",
    filepath: "file:///document/fits_files/M42_Light.fits",
    fileSize: 1024,
    importDate: 1700000000000,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    mockResolveThumbnailUri.mockImplementation(
      (fileId: string, thumbnailUri?: string) =>
        thumbnailUri ?? `file:///cache/thumbnails/${fileId}.jpg`,
    );

    mockSettingsStore.confirmDestructiveActions = true;
    mockSettingsStore.fileListStyle = "list";
    mockTrashStore.items = [];

    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
    });
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
    alertSpy.mockRestore();
  });

  it("should render the file manager title", () => {
    render(<FilesScreen />);
    expect(screen.getByText("File Manager")).toBeTruthy();
  });

  it("should render the empty state when no files", () => {
    render(<FilesScreen />);
    expect(screen.getByText("No files yet")).toBeTruthy();
    expect(screen.getByText("Import files to get started")).toBeTruthy();
  });

  it("should render the import button", () => {
    render(<FilesScreen />);
    expect(screen.getAllByText("Import Options").length).toBeGreaterThanOrEqual(1);
  });

  it("should render thumbnail from shared resolver when file thumbnailUri is missing", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-thumb", thumbnailUri: undefined })],
      selectedIds: [],
      isSelectionMode: false,
    });
    mockResolveThumbnailUri.mockImplementation(
      (fileId: string, thumbnailUri?: string) =>
        thumbnailUri ?? (fileId === "file-thumb" ? "file:///cache/thumbnails/file-thumb.jpg" : ""),
    );

    render(<FilesScreen />);

    expect(mockResolveThumbnailUri).toHaveBeenCalledWith("file-thumb", undefined);
    const thumbnail = screen.getByTestId("expo-image");
    expect(thumbnail.props.source).toEqual({ uri: "file:///cache/thumbnails/file-thumb.jpg" });
  });

  it("should render quality sort and list style controls", () => {
    render(<FilesScreen />);
    expect(screen.getByText("Quality")).toBeTruthy();
    expect(screen.getByText("Grid")).toBeTruthy();
    expect(screen.getByText("List")).toBeTruthy();
    expect(screen.getByText("Compact")).toBeTruthy();
    expect(screen.getByText("Favorites Only")).toBeTruthy();
  });

  it("should show selection toolbar with selected count", () => {
    useFitsStore.setState({
      files: [makeFile()],
      selectedIds: ["file-1"],
      isSelectionMode: true,
    });

    render(<FilesScreen />);
    expect(screen.getByText("1 selected")).toBeTruthy();
    expect(screen.getByText("Batch Convert")).toBeTruthy();
  });

  it("should select all visible files then invert selection", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" }), makeFile({ id: "file-2" })],
      selectedIds: [],
      isSelectionMode: true,
    });

    render(<FilesScreen />);

    fireEvent.press(screen.getByTestId("files-select-all-visible-button"));
    expect(useFitsStore.getState().selectedIds).toEqual(["file-1", "file-2"]);

    fireEvent.press(screen.getByTestId("files-invert-selection-button"));
    expect(useFitsStore.getState().selectedIds).toEqual([]);
  });

  it("should call rename handler when batch rename is applied", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: ["file-1"],
      isSelectionMode: true,
    });

    render(<FilesScreen />);

    fireEvent.press(screen.getByTestId("files-open-batch-rename-button"));
    fireEvent.press(screen.getByTestId("batch-rename-sheet-submit"));

    expect(mockFileManager.handleRenameFiles).toHaveBeenCalledWith([
      { fileId: "file-1", filename: "renamed.fits" },
    ]);
  });

  it("should require confirmation before batch delete when destructive confirmation is enabled", () => {
    mockFileManager.handleDeleteFiles.mockReturnValueOnce({
      success: 1,
      failed: 0,
      token: "token-1",
    });

    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: ["file-1"],
      isSelectionMode: true,
    });

    alertSpy.mockImplementation((_title, _message, buttons) => {
      const destructiveBtn = (
        buttons as Array<{
          text?: string;
          onPress?: () => void;
          style?: "default" | "cancel" | "destructive";
        }>
      )?.find((btn) => btn.style === "destructive");
      destructiveBtn?.onPress?.();
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("files-batch-delete-button"));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockFileManager.handleDeleteFiles).toHaveBeenCalledWith(["file-1"]);
  });

  it("should delete directly without confirmation when destructive confirmation is disabled", () => {
    mockSettingsStore.confirmDestructiveActions = false;
    mockFileManager.handleDeleteFiles.mockReturnValueOnce({
      success: 1,
      failed: 0,
      token: "token-2",
    });

    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: ["file-1"],
      isSelectionMode: true,
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("files-batch-delete-button"));

    expect(mockFileManager.handleDeleteFiles).toHaveBeenCalledWith(["file-1"]);
  });

  it("should require confirmation before empty trash when destructive confirmation is enabled", () => {
    mockSettingsStore.confirmDestructiveActions = true;
    mockTrashStore.items = [{ trashId: "trash-1" }];
    mockFileManager.emptyTrash.mockReturnValueOnce({ deleted: 1, failed: 0 });

    alertSpy.mockImplementation((_title, _message, buttons) => {
      const destructiveBtn = (
        buttons as Array<{
          text?: string;
          onPress?: () => void;
          style?: "default" | "cancel" | "destructive";
        }>
      )?.find((btn) => btn.style === "destructive");
      destructiveBtn?.onPress?.();
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("files-open-trash-button"));
    fireEvent.press(screen.getByTestId("trash-sheet-empty-button"));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockFileManager.emptyTrash).toHaveBeenCalled();
  });

  it("should empty trash directly without confirmation when destructive confirmation is disabled", () => {
    mockSettingsStore.confirmDestructiveActions = false;
    mockTrashStore.items = [{ trashId: "trash-1" }];
    mockFileManager.emptyTrash.mockReturnValueOnce({ deleted: 1, failed: 0 });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("files-open-trash-button"));
    fireEvent.press(screen.getByTestId("trash-sheet-empty-button"));

    expect(mockFileManager.emptyTrash).toHaveBeenCalled();
  });

  it("routes video files to video detail page", () => {
    useFitsStore.setState({
      files: [
        makeFile({
          id: "video-1",
          filename: "capture.mp4",
          sourceType: "video",
          mediaKind: "video",
          sourceFormat: "mp4",
          frameType: "unknown",
        }),
      ],
      selectedIds: [],
      isSelectionMode: false,
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByText("capture.mp4"));
    expect(mockPush).toHaveBeenCalledWith("/video/video-1");
  });

  it("routes audio files to media workspace", () => {
    useFitsStore.setState({
      files: [
        makeFile({
          id: "audio-1",
          filename: "recording.m4a",
          sourceType: "audio",
          mediaKind: "audio",
          sourceFormat: "m4a",
          frameType: "unknown",
        }),
      ],
      selectedIds: [],
      isSelectionMode: false,
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByText("recording.m4a"));
    expect(mockPush).toHaveBeenCalledWith("/video/audio-1");
  });
});
