import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import GalleryScreen from "../gallery";
import type { FitsMetadata } from "../../../lib/fits/types";

const mockPush = jest.fn();
let mockFiles: FitsMetadata[] = [];

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
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

jest.mock("../../../hooks/useSelectionMode", () => ({
  useSelectionMode: () => ({
    isSelectionMode: false,
    selectedIds: [],
    toggleSelection: jest.fn(),
    enterSelectionMode: jest.fn(),
    exitSelectionMode: jest.fn(),
    selectAll: jest.fn(),
    reconcileSelection: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("../../../hooks/useGallery", () => ({
  useGallery: () => ({
    files: mockFiles,
    totalCount: mockFiles.length,
    viewMode: "grid",
    gridColumns: 2,
    metadataIndex: { objects: [], frameTypes: [] },
    groupedByDate: {},
    search: () => mockFiles,
  }),
}));

jest.mock("../../../hooks/useAlbums", () => ({
  useAlbums: () => ({
    albums: [],
    filteredAlbums: [],
    createAlbum: jest.fn(),
    createSmartAlbum: jest.fn(),
    removeAlbum: jest.fn(),
    updateAlbum: jest.fn(),
    addImagesToAlbum: jest.fn(),
    getSuggestions: jest.fn(() => []),
    albumSearchQuery: "",
    albumSortBy: "date",
    albumSortOrder: "desc",
    setAlbumSearchQuery: jest.fn(),
    setAlbumSortBy: jest.fn(),
    setAlbumSortOrder: jest.fn(),
    toggleAlbumPin: jest.fn(),
    mergeAlbums: jest.fn(() => true),
    updateAlbumNotes: jest.fn(),
    getAlbumStatistics: jest.fn(() => null),
    duplicateImages: [],
  }),
}));

jest.mock("../../../hooks/useFileManager", () => ({
  useFileManager: () => ({
    handleDeleteFiles: jest.fn(),
    handleRenameFiles: jest.fn(() => ({ success: 0, failed: 0 })),
  }),
}));

const mockGalleryStore = {
  setViewMode: jest.fn(),
  filterObject: "",
  setFilterObject: jest.fn(),
  filterFrameType: "",
  setFilterFrameType: jest.fn(),
  filterTargetId: "",
  setFilterTargetId: jest.fn(),
  filterFavoriteOnly: false,
  setFilterFavoriteOnly: jest.fn(),
  clearFilters: jest.fn(),
};

jest.mock("../../../stores/useGalleryStore", () => ({
  useGalleryStore: (selector: (state: typeof mockGalleryStore) => unknown) =>
    selector(mockGalleryStore),
}));

const mockSettingsStore = {
  thumbnailShowFilename: true,
  thumbnailShowObject: false,
  thumbnailShowFilter: false,
  thumbnailShowExposure: false,
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

jest.mock("../../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockSettingsStore) => unknown) =>
    selector(mockSettingsStore),
}));

jest.mock("../../../components/gallery/ThumbnailGrid", () => ({
  ThumbnailGrid: (props: { files: FitsMetadata[]; onPress: (file: FitsMetadata) => void }) => {
    const { Pressable, Text, View } = require("react-native");
    return (
      <View testID="thumbnail-grid-mock">
        {props.files.map((file) => (
          <Pressable key={file.id} testID={`thumb-${file.id}`} onPress={() => props.onPress(file)}>
            <Text>{file.filename}</Text>
          </Pressable>
        ))}
      </View>
    );
  },
}));

jest.mock("../../../components/gallery/AlbumCard", () => ({
  AlbumCard: () => null,
}));
jest.mock("../../../components/gallery/CreateAlbumModal", () => ({
  CreateAlbumModal: () => null,
}));
jest.mock("../../../components/gallery/AlbumActionSheet", () => ({
  AlbumActionSheet: () => null,
}));
jest.mock("../../../components/gallery/AlbumPickerSheet", () => ({
  AlbumPickerSheet: () => null,
}));
jest.mock("../../../components/gallery/BatchTagSheet", () => ({
  BatchTagSheet: () => null,
}));
jest.mock("../../../components/gallery/BatchRenameSheet", () => ({
  BatchRenameSheet: () => null,
}));
jest.mock("../../../components/gallery/IntegrationReportSheet", () => ({
  IntegrationReportSheet: () => null,
}));
jest.mock("../../../components/gallery/SmartAlbumModal", () => ({
  SmartAlbumModal: () => null,
}));
jest.mock("../../../components/gallery/AlbumSearchBar", () => ({
  AlbumSearchBar: () => null,
}));
jest.mock("../../../components/gallery/AlbumSortControl", () => ({
  AlbumSortControl: () => null,
}));
jest.mock("../../../components/gallery/AlbumStatisticsSheet", () => ({
  AlbumStatisticsSheet: () => null,
}));
jest.mock("../../../components/gallery/AlbumMergeSheet", () => ({
  AlbumMergeSheet: () => null,
}));
jest.mock("../../../components/gallery/AlbumExportSheet", () => ({
  AlbumExportSheet: () => null,
}));
jest.mock("../../../components/gallery/DuplicateImagesSheet", () => ({
  DuplicateImagesSheet: () => null,
}));
jest.mock("../../../components/common/EmptyState", () => ({
  EmptyState: (props: { title: string }) => {
    const { Text } = require("react-native");
    return <Text>{props.title}</Text>;
  },
}));
jest.mock("../../../components/common/PromptDialog", () => ({
  PromptDialog: () => null,
}));

describe("(tabs)/gallery.tsx routing", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFiles = [
      {
        id: "image-1",
        filename: "image.fits",
        filepath: "file:///image.fits",
        fileSize: 1024,
        importDate: Date.now(),
        frameType: "light",
        isFavorite: false,
        tags: [],
        albumIds: [],
        sourceType: "fits",
        mediaKind: "image",
      },
      {
        id: "video-1",
        filename: "clip.mp4",
        filepath: "file:///clip.mp4",
        fileSize: 2048,
        importDate: Date.now(),
        frameType: "unknown",
        isFavorite: false,
        tags: [],
        albumIds: [],
        sourceType: "video",
        mediaKind: "video",
        durationMs: 3000,
      },
      {
        id: "audio-1",
        filename: "voice.m4a",
        filepath: "file:///voice.m4a",
        fileSize: 1024,
        importDate: Date.now(),
        frameType: "unknown",
        isFavorite: false,
        tags: [],
        albumIds: [],
        sourceType: "audio",
        mediaKind: "audio",
        sourceFormat: "m4a",
        durationMs: 1800,
      },
    ];
  });

  it("routes image items to /viewer/:id", () => {
    render(<GalleryScreen />);
    fireEvent.press(screen.getByTestId("thumb-image-1"));
    expect(mockPush).toHaveBeenCalledWith("/viewer/image-1");
  });

  it("routes video items to /video/:id", () => {
    render(<GalleryScreen />);
    fireEvent.press(screen.getByTestId("thumb-video-1"));
    expect(mockPush).toHaveBeenCalledWith("/video/video-1");
  });

  it("routes audio items to /video/:id", () => {
    render(<GalleryScreen />);
    fireEvent.press(screen.getByTestId("thumb-audio-1"));
    expect(mockPush).toHaveBeenCalledWith("/video/audio-1");
  });

  it("renders tabbed layout controls", () => {
    render(<GalleryScreen />);
    expect(screen.getByTestId("gallery-tab-images")).toBeTruthy();
    expect(screen.getByTestId("gallery-tab-albums")).toBeTruthy();
  });
});
