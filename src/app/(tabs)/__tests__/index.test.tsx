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
  fileListGridColumns: 3,
  setFileListGridColumns: jest.fn(),
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

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscape: false,
    isLandscapeTablet: false,
    contentPaddingTop: 0,
    horizontalPadding: 0,
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

jest.mock("../../../components/files/SelectionActionsSheet", () => ({
  SelectionActionsSheet: (props: {
    visible: boolean;
    onInvertSelection: () => void;
    onBatchRename: () => void;
    onBatchTag: () => void;
  }) => {
    const React = require("react");
    const { View, Pressable, Text } = require("react-native");
    if (!props.visible) return null;
    return React.createElement(
      View,
      { testID: "selection-actions-sheet" },
      React.createElement(
        Pressable,
        { testID: "files-invert-selection-button", onPress: props.onInvertSelection },
        React.createElement(Text, null, "Invert"),
      ),
      React.createElement(
        Pressable,
        { testID: "files-open-batch-rename-button", onPress: props.onBatchRename },
        React.createElement(Text, null, "Rename"),
      ),
      React.createElement(
        Pressable,
        { testID: "files-open-batch-tag-button", onPress: props.onBatchTag },
        React.createElement(Text, null, "Tag"),
      ),
    );
  },
}));

jest.mock("../../../components/files/FilesContent", () => ({
  FilesContent: (props: {
    displayFiles: Array<{ id: string }>;
    searchQuery: string;
    activeFilterCount: number;
    ListHeader: React.ReactNode;
    onFilePress: (file: Record<string, unknown>) => void;
    isGridStyle: boolean;
  }) => {
    const React = require("react");
    const { View, Pressable, Text } = require("react-native");
    if (props.displayFiles.length === 0 && !props.searchQuery && props.activeFilterCount === 0) {
      return React.createElement(
        View,
        { testID: "files-content-empty" },
        props.ListHeader,
        React.createElement(Text, null, "No files yet"),
        React.createElement(Text, null, "Import files to get started"),
      );
    }
    if (props.isGridStyle && props.displayFiles.length > 0) {
      return React.createElement(
        View,
        { testID: "thumbnail-grid" },
        props.ListHeader,
        props.displayFiles.map((file: Record<string, unknown>) =>
          React.createElement(
            Pressable,
            { key: file.id as string, onPress: () => props.onFilePress(file) },
            React.createElement(Text, null, (file as Record<string, string>).filename),
          ),
        ),
      );
    }
    return React.createElement(
      View,
      { testID: "files-content" },
      props.ListHeader,
      props.displayFiles.map((file: Record<string, unknown>) =>
        React.createElement(
          Pressable,
          { key: file.id as string, onPress: () => props.onFilePress(file) },
          React.createElement(Text, null, (file as Record<string, string>).filename),
        ),
      ),
    );
  },
}));

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
    mockSettingsStore.confirmDestructiveActions = true;
    mockSettingsStore.fileListStyle = "list";
    mockSettingsStore.fileListGridColumns = 3;
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

  it("should pass files to FilesContent when files are present", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-thumb", filename: "thumb-test.fits" })],
      selectedIds: [],
      isSelectionMode: false,
    });

    render(<FilesScreen />);

    expect(screen.getByText("thumb-test.fits")).toBeTruthy();
  });

  it("should render quality sort and list style controls when files exist", () => {
    useFitsStore.setState({
      files: [makeFile()],
      selectedIds: [],
      isSelectionMode: false,
    });

    render(<FilesScreen />);
    expect(screen.getByText("Quality")).toBeTruthy();
    expect(screen.getByText("Grid")).toBeTruthy();
    expect(screen.getByText("List")).toBeTruthy();
    expect(screen.getByText("Compact")).toBeTruthy();
    expect(screen.getByText("Favorites Only")).toBeTruthy();
  });

  it("renders grid view in grid mode", () => {
    mockSettingsStore.fileListStyle = "grid";
    mockSettingsStore.fileListGridColumns = 4;
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: [],
      isSelectionMode: false,
    });

    render(<FilesScreen />);

    expect(screen.getByTestId("thumbnail-grid")).toBeTruthy();
  });

  it("updates file grid columns from quick chips", () => {
    mockSettingsStore.fileListStyle = "grid";
    mockSettingsStore.fileListGridColumns = 3;
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: [],
      isSelectionMode: false,
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("files-grid-columns-2"));

    expect(mockSettingsStore.setFileListGridColumns).toHaveBeenCalledWith(2);
  });

  it("keeps list/compact path without ThumbnailGrid", () => {
    mockSettingsStore.fileListStyle = "compact";
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: [],
      isSelectionMode: false,
    });

    render(<FilesScreen />);

    expect(screen.getByText("M42_Light.fits")).toBeTruthy();
    expect(screen.getByTestId("files-content")).toBeTruthy();
    expect(screen.queryByTestId("thumbnail-grid")).toBeNull();
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

  it("shows stack selected button in selection mode", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: ["file-1"],
      isSelectionMode: true,
    });

    render(<FilesScreen />);

    expect(screen.getByTestId("files-go-to-stacking-button")).toBeTruthy();
  });

  it("routes to /stacking with selected ids from selection toolbar", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" }), makeFile({ id: "file-2" })],
      selectedIds: ["file-1", "file-2"],
      isSelectionMode: true,
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("files-go-to-stacking-button"));

    expect(mockPush).toHaveBeenCalledWith("/stacking?ids=file-1%2Cfile-2");
  });

  it("routes to /stacking when no files are selected", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: [],
      isSelectionMode: true,
    });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("files-go-to-stacking-button"));

    expect(mockPush).toHaveBeenCalledWith("/stacking");
  });

  it("should select all visible files", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" }), makeFile({ id: "file-2" })],
      selectedIds: [],
      isSelectionMode: true,
    });

    render(<FilesScreen />);

    fireEvent.press(screen.getByTestId("e2e-action-tabs__index-select-all"));
    expect(useFitsStore.getState().selectedIds).toEqual(["file-1", "file-2"]);
  });

  it("should invert selection via SelectionActionsSheet", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" }), makeFile({ id: "file-2" })],
      selectedIds: ["file-1", "file-2"],
      isSelectionMode: true,
    });

    render(<FilesScreen />);

    // Open the SelectionActionsSheet via "More Actions" button
    fireEvent.press(screen.getByText("Batch Actions"));
    fireEvent.press(screen.getByTestId("files-invert-selection-button"));
    expect(useFitsStore.getState().selectedIds).toEqual([]);
  });

  it("should call rename handler when batch rename is applied via SelectionActionsSheet", () => {
    useFitsStore.setState({
      files: [makeFile({ id: "file-1" })],
      selectedIds: ["file-1"],
      isSelectionMode: true,
    });

    render(<FilesScreen />);

    // Open SelectionActionsSheet then batch rename
    fireEvent.press(screen.getByText("Batch Actions"));
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
    fireEvent.press(screen.getByTestId("e2e-action-tabs__index-open-trash"));
    fireEvent.press(screen.getByTestId("trash-sheet-empty-button"));

    expect(Alert.alert).toHaveBeenCalled();
    expect(mockFileManager.emptyTrash).toHaveBeenCalled();
  });

  it("should empty trash directly without confirmation when destructive confirmation is disabled", () => {
    mockSettingsStore.confirmDestructiveActions = false;
    mockTrashStore.items = [{ trashId: "trash-1" }];
    mockFileManager.emptyTrash.mockReturnValueOnce({ deleted: 1, failed: 0 });

    render(<FilesScreen />);
    fireEvent.press(screen.getByTestId("e2e-action-tabs__index-open-trash"));
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
