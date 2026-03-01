import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { QuickLookModal } from "../QuickLookModal";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    useVideoPlayer: () => ({
      play: jest.fn(),
      pause: jest.fn(),
      muted: true,
      loop: true,
    }),
    VideoView: (props: Record<string, unknown>) => (
      <View testID="quicklook-video-view" {...props} />
    ),
  };
});

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../lib/gallery/thumbnailCache", () => ({
  resolveThumbnailUri: () => "file:///thumb.jpg",
}));

const baseFile: FitsMetadata = {
  id: "f1",
  filename: "test.fits",
  filepath: "file:///files/test.fits",
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
  mediaKind: "image",
  sourceType: "fits",
};

describe("QuickLookModal", () => {
  it("shows edit action for image files", () => {
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    expect(screen.getByText("common.edit")).toBeTruthy();
  });

  it("renders video preview and hides image editor action for video files", () => {
    render(
      <QuickLookModal
        visible
        file={{
          ...baseFile,
          id: "v1",
          filename: "capture.mp4",
          sourceType: "video",
          mediaKind: "video",
          durationMs: 3000,
        }}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    expect(screen.getByTestId("quicklook-video-view")).toBeTruthy();
    expect(screen.queryByText("common.edit")).toBeNull();
  });

  it("renders audio quicklook card and hides image editor action for audio files", () => {
    render(
      <QuickLookModal
        visible
        file={{
          ...baseFile,
          id: "a1",
          filename: "recording.m4a",
          sourceType: "audio",
          mediaKind: "audio",
          sourceFormat: "m4a",
          durationMs: 5400,
          audioCodec: "aac",
        }}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    expect(screen.queryByTestId("quicklook-video-view")).toBeNull();
    expect(screen.getByText("Audio codec")).toBeTruthy();
    expect(screen.queryByText("common.edit")).toBeNull();
  });

  it("renders quick action buttons when callbacks are provided", () => {
    const onToggleFavorite = jest.fn();
    const onDelete = jest.fn();
    const onRename = jest.fn();
    const onAddTag = jest.fn();

    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
        onToggleFavorite={onToggleFavorite}
        onDelete={onDelete}
        onRename={onRename}
        onAddTag={onAddTag}
      />,
    );

    expect(screen.getByText("files.toggleFavorite")).toBeTruthy();
    expect(screen.getByText("common.rename")).toBeTruthy();
    expect(screen.getByText("files.batchTag")).toBeTruthy();
    expect(screen.getByText("common.delete")).toBeTruthy();
  });

  it("does not render quick actions when no callbacks are provided", () => {
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    expect(screen.queryByText("files.toggleFavorite")).toBeNull();
    expect(screen.queryByText("common.delete")).toBeNull();
  });

  it("calls onToggleFavorite with file id when favorite button is pressed", () => {
    const onToggleFavorite = jest.fn();
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
        onToggleFavorite={onToggleFavorite}
      />,
    );

    fireEvent.press(screen.getByText("files.toggleFavorite"));
    expect(onToggleFavorite).toHaveBeenCalledWith("f1");
  });

  it("calls onDelete and onClose when delete quick action is pressed", () => {
    const onDelete = jest.fn();
    const onClose = jest.fn();
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={onClose}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
        onDelete={onDelete}
      />,
    );

    fireEvent.press(screen.getByText("common.delete"));
    expect(onClose).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalledWith("f1");
  });

  it("returns null when file is null", () => {
    const { toJSON } = render(
      <QuickLookModal
        visible
        file={null}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it("calls onOpenViewer with file id when view button is pressed", () => {
    const onOpenViewer = jest.fn();
    const onClose = jest.fn();
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={onClose}
        onOpenViewer={onOpenViewer}
        onOpenEditor={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText("viewer.view"));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenViewer).toHaveBeenCalledWith("f1");
  });

  it("calls onOpenEditor with file id when edit button is pressed", () => {
    const onOpenEditor = jest.fn();
    const onClose = jest.fn();
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={onClose}
        onOpenViewer={jest.fn()}
        onOpenEditor={onOpenEditor}
      />,
    );

    fireEvent.press(screen.getByText("common.edit"));
    expect(onClose).toHaveBeenCalled();
    expect(onOpenEditor).toHaveBeenCalledWith("f1");
  });

  it("calls onRename and onClose when rename quick action is pressed", () => {
    const onRename = jest.fn();
    const onClose = jest.fn();
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={onClose}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
        onRename={onRename}
      />,
    );

    fireEvent.press(screen.getByText("common.rename"));
    expect(onClose).toHaveBeenCalled();
    expect(onRename).toHaveBeenCalledWith("f1");
  });

  it("calls onAddTag and onClose when tag quick action is pressed", () => {
    const onAddTag = jest.fn();
    const onClose = jest.fn();
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={onClose}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
        onAddTag={onAddTag}
      />,
    );

    fireEvent.press(screen.getByText("files.batchTag"));
    expect(onClose).toHaveBeenCalled();
    expect(onAddTag).toHaveBeenCalledWith("f1");
  });

  it("renders FITS metadata fields when present", () => {
    const fitsFile: FitsMetadata = {
      ...baseFile,
      object: "M42",
      filter: "Ha",
      exptime: 300,
      naxis1: 4096,
      naxis2: 4096,
    };
    render(
      <QuickLookModal
        visible
        file={fitsFile}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    expect(screen.getByText("M42")).toBeTruthy();
    expect(screen.getByText("Ha")).toBeTruthy();
    expect(screen.getByText("300s")).toBeTruthy();
    expect(screen.getByText("4096 × 4096")).toBeTruthy();
  });

  it("renders no thumbnail placeholder for file without thumbnail", () => {
    jest
      .spyOn(require("../../../lib/gallery/thumbnailCache"), "resolveThumbnailUri")
      .mockReturnValueOnce(null);

    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    expect(screen.getByText("settings.regenerateThumbnail")).toBeTruthy();
  });

  it("calls onClose when cancel button is pressed", () => {
    const onClose = jest.fn();
    render(
      <QuickLookModal
        visible
        file={baseFile}
        onClose={onClose}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText("common.cancel"));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows favorite heart icon when file is favorite", () => {
    const favoriteFile: FitsMetadata = {
      ...baseFile,
      isFavorite: true,
    };
    render(
      <QuickLookModal
        visible
        file={favoriteFile}
        onClose={jest.fn()}
        onOpenViewer={jest.fn()}
        onOpenEditor={jest.fn()}
        onToggleFavorite={jest.fn()}
      />,
    );

    expect(screen.getByText("files.toggleFavorite")).toBeTruthy();
  });
});
