import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import Screen from "../[id]";
import type { Album, FitsMetadata } from "../../../lib/fits/types";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReconcileSelection = jest.fn();
const mockExitSelectionMode = jest.fn();

const mockAlbum: Album = {
  id: "album-1",
  name: "Album One",
  createdAt: Date.now() - 1000,
  updatedAt: Date.now(),
  imageIds: ["file-1"],
  isSmart: false,
};

let mockFiles: FitsMetadata[] = [
  {
    id: "file-1",
    filename: "file-1.fits",
    filepath: "file:///file-1.fits",
    fileSize: 100,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: ["album-1"],
    sourceType: "fits",
    mediaKind: "image",
    thumbnailUri: "https://example.com/file-1.jpg",
  },
];

const mockSelectionState = {
  isSelectionMode: false,
  selectedIds: [] as string[],
  toggleSelection: jest.fn(),
  enterSelectionMode: jest.fn(),
  exitSelectionMode: mockExitSelectionMode,
  selectAll: jest.fn(),
  reconcileSelection: mockReconcileSelection,
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "album-1" }),
  useRouter: () => ({
    push: mockPush,
    back: mockBack,
  }),
}));

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/common/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscape: false,
    isLandscapeTablet: false,
    contentPaddingTop: 0,
    horizontalPadding: 0,
  }),
}));

jest.mock("../../../stores/gallery/useAlbumStore", () => ({
  useAlbumStore: (selector: any) =>
    selector({
      getAlbumById: (id: string) => (id === "album-1" ? mockAlbum : undefined),
      updateAlbum: jest.fn(),
      removeAlbum: jest.fn(),
      removeImageFromAlbum: jest.fn(),
      setCoverImage: jest.fn(),
      updateAlbumNotes: jest.fn(),
    }),
}));

jest.mock("../../../stores/files/useFitsStore", () => ({
  useFitsStore: (selector: any) =>
    selector({
      files: mockFiles,
    }),
}));

jest.mock("../../../hooks/common/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("../../../hooks/files/useSelectionMode", () => ({
  useSelectionMode: () => mockSelectionState,
}));

jest.mock("../../../components/gallery/ThumbnailGrid", () => ({
  ThumbnailGrid: (props: { ListHeaderComponent?: React.ReactNode }) =>
    props.ListHeaderComponent ?? null,
}));

jest.mock("../../../components/gallery/ThumbnailLoadingBanner", () => ({
  ThumbnailLoadingBanner: () => null,
}));

jest.mock("../../../components/common/PromptDialog", () => ({
  PromptDialog: () => null,
}));

jest.mock("../../../components/gallery/AlbumStatisticsSheet", () => ({
  AlbumStatisticsSheet: () => null,
}));

describe("album/[id].tsx", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAlbum.imageIds = ["file-1"];
    mockFiles = [
      {
        id: "file-1",
        filename: "file-1.fits",
        filepath: "file:///file-1.fits",
        fileSize: 100,
        importDate: Date.now(),
        frameType: "light",
        isFavorite: false,
        tags: [],
        albumIds: ["album-1"],
        sourceType: "fits",
        mediaKind: "image",
        thumbnailUri: "https://example.com/file-1.jpg",
      },
    ];
    mockSelectionState.isSelectionMode = false;
    mockSelectionState.selectedIds = [];
  });

  it("renders tabs and reconciles selection to visible album files", () => {
    render(<Screen />);
    expect(screen.getByTestId("album-tab-photos")).toBeTruthy();
    expect(screen.getByTestId("album-tab-info")).toBeTruthy();
    expect(mockReconcileSelection).toHaveBeenCalled();
  });

  it("routes selected album images to compare and exits selection mode", () => {
    mockSelectionState.isSelectionMode = true;
    mockSelectionState.selectedIds = ["file-1", "file-2"];
    mockAlbum.imageIds = ["file-1", "file-2"];
    mockFiles = [
      ...mockFiles,
      {
        id: "file-2",
        filename: "file-2.fits",
        filepath: "file:///file-2.fits",
        fileSize: 100,
        importDate: Date.now(),
        frameType: "light",
        isFavorite: false,
        tags: [],
        albumIds: ["album-1"],
        sourceType: "fits",
        mediaKind: "image",
        thumbnailUri: "https://example.com/file-2.jpg",
      },
    ];

    render(<Screen />);
    expect(screen.getByTestId("e2e-action-album__param_id-open-compare")).toBeTruthy();
    fireEvent.press(screen.getByTestId("e2e-action-album__param_id-open-compare"));
    expect(mockPush).toHaveBeenCalledWith("/compare?ids=file-1,file-2");
    expect(mockExitSelectionMode).toHaveBeenCalled();
  });
});
