import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VideoProcessingSheet } from "../VideoProcessingSheet";
import type { FitsMetadata } from "../../../lib/fits/types";

const baseVideoFile: FitsMetadata = {
  id: "video-1",
  filename: "capture.mp4",
  filepath: "file:///capture.mp4",
  fileSize: 1024,
  importDate: Date.now(),
  frameType: "unknown",
  isFavorite: false,
  tags: [],
  albumIds: [],
  mediaKind: "video",
  sourceType: "video",
  sourceFormat: "mp4",
  durationMs: 12_345,
};

describe("VideoProcessingSheet", () => {
  it("submits default trim request derived from file metadata", () => {
    const onSubmit = jest.fn();
    const onClose = jest.fn();

    render(
      <VideoProcessingSheet
        visible
        file={baseVideoFile}
        defaultProfile="balanced"
        defaultPreset="720p"
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );

    fireEvent.press(screen.getByText("Queue Task"));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceId: "video-1",
        sourceFilename: "capture.mp4",
        inputUri: "file:///capture.mp4",
        operation: "trim",
        profile: "balanced",
        trim: expect.objectContaining({
          startMs: 0,
          endMs: 12_345,
        }),
      }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("submits edited trim parameters", () => {
    const onSubmit = jest.fn();

    render(
      <VideoProcessingSheet
        visible
        file={baseVideoFile}
        defaultProfile="compatibility"
        defaultPreset="1080p"
        onSubmit={onSubmit}
        onClose={jest.fn()}
      />,
    );

    fireEvent.changeText(screen.getByPlaceholderText("Start ms"), "120");
    fireEvent.changeText(screen.getByPlaceholderText("End ms"), "980");
    fireEvent.press(screen.getByText("Queue Task"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "trim",
        trim: expect.objectContaining({
          startMs: 120,
          endMs: 980,
        }),
      }),
    );
  });
});
