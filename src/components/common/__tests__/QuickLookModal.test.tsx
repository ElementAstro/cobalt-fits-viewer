import React from "react";
import { render, screen } from "@testing-library/react-native";
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
});
