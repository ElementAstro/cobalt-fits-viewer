import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { AlbumExportSheet } from "../AlbumExportSheet";
import type { Album, FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
          "album.exportZip": "Export ZIP",
          "album.images": "images",
          "album.exporting": "Exporting",
          "album.exportingZip": "Zipping",
          "album.exportSuccess": "Export complete",
          "album.exportFailed": "Export failed",
          "common.error": "Error",
          "common.done": "Done",
          "common.share": "Share",
          "share.notAvailable": "Sharing not available",
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

const mockExportAlbum = jest.fn();
const mockShareAlbumExport = jest.fn();
const mockCleanupExport = jest.fn();

jest.mock("../../../lib/gallery/albumExporter", () => ({
  exportAlbum: (...args: unknown[]) => mockExportAlbum(...args),
  shareAlbumExport: (...args: unknown[]) => mockShareAlbumExport(...args),
  cleanupExport: (...args: unknown[]) => mockCleanupExport(...args),
}));

jest.mock("../../../lib/logger", () => ({
  LOG_TAGS: { AlbumExportSheet: "AlbumExportSheet" },
  Logger: { warn: jest.fn() },
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { Pressable, Text, View } = require("react-native");

  const BottomSheet = ({ isOpen, children }: any) => (isOpen ? <View>{children}</View> : null);
  BottomSheet.Portal = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Overlay = () => null;
  BottomSheet.Content = ({ children }: any) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: any) => <Text>{children}</Text>;

  const Button = ({ onPress, children, isDisabled }: any) => (
    <Pressable onPress={isDisabled ? undefined : onPress}>{children}</Pressable>
  );
  Button.Label = ({ children }: any) => <Text>{children}</Text>;

  return {
    BottomSheet,
    Button,
    useThemeColor: () => ["#999", "#0f0", "#f00"],
  };
});

const makeAlbum = (overrides: Partial<Album> = {}): Album => ({
  id: "album-1",
  name: "Orion Nebula",
  createdAt: 1,
  updatedAt: 1,
  imageIds: ["f1", "f2"],
  isSmart: false,
  ...overrides,
});

const makeFile = (id: string): FitsMetadata => ({
  id,
  filename: `${id}.fits`,
  filepath: `file:///tmp/${id}.fits`,
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
});

describe("AlbumExportSheet", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExportAlbum.mockResolvedValue(null);
    mockShareAlbumExport.mockResolvedValue(false);
    mockCleanupExport.mockResolvedValue(undefined);
  });

  it("returns null when album is null", () => {
    const { toJSON } = render(
      <AlbumExportSheet visible album={null} files={[]} onClose={jest.fn()} />,
    );

    expect(toJSON()).toBeNull();
  });

  it("renders album name and image count", () => {
    mockExportAlbum.mockResolvedValue(null);

    render(
      <AlbumExportSheet
        visible
        album={makeAlbum()}
        files={[makeFile("f1"), makeFile("f2")]}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Orion Nebula")).toBeTruthy();
    expect(screen.getByText("2 images")).toBeTruthy();
  });

  it("starts export when visible with album", async () => {
    mockExportAlbum.mockResolvedValue("/tmp/export.zip");

    render(
      <AlbumExportSheet visible album={makeAlbum()} files={[makeFile("f1")]} onClose={jest.fn()} />,
    );

    await waitFor(() => {
      expect(mockExportAlbum).toHaveBeenCalled();
    });
  });

  it("shows done button", () => {
    render(
      <AlbumExportSheet visible album={makeAlbum()} files={[makeFile("f1")]} onClose={jest.fn()} />,
    );

    expect(screen.getByText("Done")).toBeTruthy();
  });
});
