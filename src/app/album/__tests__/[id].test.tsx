import React from "react";
import { render, screen } from "@testing-library/react-native";
import Screen from "../[id]";
import type { Album, FitsMetadata } from "../../../lib/fits/types";

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReconcileSelection = jest.fn();

const mockAlbum: Album = {
  id: "album-1",
  name: "Album One",
  createdAt: Date.now() - 1000,
  updatedAt: Date.now(),
  imageIds: ["file-1"],
  isSmart: false,
};

const mockFiles: FitsMetadata[] = [
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

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscape: false,
    isLandscapeTablet: false,
    contentPaddingTop: 0,
    horizontalPadding: 0,
  }),
}));

jest.mock("../../../stores/useAlbumStore", () => ({
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

jest.mock("../../../stores/useFitsStore", () => ({
  useFitsStore: (selector: any) =>
    selector({
      files: mockFiles,
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
    reconcileSelection: mockReconcileSelection,
  }),
}));

jest.mock("../../../components/gallery/ThumbnailGrid", () => ({
  ThumbnailGrid: () => null,
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
  });

  it("renders tabs and reconciles selection to visible album files", () => {
    render(<Screen />);
    expect(screen.getByTestId("album-tab-photos")).toBeTruthy();
    expect(screen.getByTestId("album-tab-info")).toBeTruthy();
    expect(mockReconcileSelection).toHaveBeenCalled();
  });
});
