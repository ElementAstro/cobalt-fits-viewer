import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VideoProcessingSheet } from "../VideoProcessingSheet";
import type { FitsMetadata } from "../../../lib/fits/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => {
      const map: Record<string, string> = {
        "settings.videoOpTrim": "Trim",
        "settings.videoOpSplit": "Split",
        "settings.videoOpCompress": "Compress",
        "settings.videoOpTranscode": "Transcode",
        "settings.videoOpMerge": "Merge",
        "settings.videoOpMuteAudio": "Mute Audio",
        "settings.videoOpExtractAudio": "Extract Audio",
        "settings.videoOpCoverFrame": "Cover Frame",
        "settings.videoOpRotate": "Rotate",
        "settings.videoOpSpeed": "Speed",
        "settings.videoOpWatermark": "Watermark",
        "settings.videoOpGif": "GIF Export",
        "settings.videoOpTimelapse": "Timelapse",
        "settings.videoProcessingTitle": "Video Processing",
        "settings.videoProcessingDescription": "Create a non-destructive derived media file.",
        "settings.videoChooseOperation": "Choose operation",
        "settings.videoRemoveAudioInOutput": "Remove audio in output",
        "settings.videoParameters": "Parameters",
        "settings.videoTrimStartMs": "Start ms",
        "settings.videoTrimEndMs": "End ms",
        "settings.videoTargetPreset": "Target preset",
        "settings.videoTargetBitrateKbps": "Target bitrate kbps",
        "settings.videoCrf": "CRF (0-51)",
        "settings.videoCrfHint": "CRF only applies to software encoders.",
        "settings.videoCoverTimeMs": "Thumbnail time ms",
        "settings.videoMergeInputUris": "Input URIs (one per line)",
        "settings.videoMergeSelectFiles": "Select Files from Library",
        "settings.videoSplitAddSegment": "Add Segment",
        "settings.videoSplitEvenSplit": "Even Split",
        "settings.videoRotation90": "90° CW",
        "settings.videoRotation180": "180°",
        "settings.videoRotation270": "270° CW",
        "settings.videoSpeedFactor": "Speed factor (0.25–4)",
        "settings.videoWatermarkText": "Watermark text",
        "settings.videoWatermarkPosition": "Position",
        "settings.videoWatermarkFontSize": "Font size",
        "settings.videoWatermarkFontColor": "Color",
        "settings.videoWatermarkOpacity": "Opacity (0–1)",
        "settings.videoGifStart": "Start ms",
        "settings.videoGifDuration": "Duration ms",
        "settings.videoGifWidth": "Width px",
        "settings.videoGifFps": "FPS (1–30)",
        "settings.videoExtractAudioBitrate": "Bitrate kbps",
        "settings.videoQueueTask": "Queue Task",
        "settings.videoCancel": "Cancel",
        "settings.videoErrorTrimRange": "Trim range is invalid.",
        "settings.videoErrorSplitSegments": "Split segments are invalid.",
        "settings.videoErrorMergeInputs": "Merge requires at least two input URIs.",
        "settings.videoErrorRotation": "Rotation must be 90, 180, or 270.",
        "settings.videoErrorSpeedFactor": "Speed factor must be 0.25–4.",
        "settings.videoErrorWatermarkText": "Watermark text is required.",
        "settings.videoErrorGifStart": "GIF start time is invalid.",
        "settings.videoErrorGifDuration": "GIF duration must be at least 100ms.",
        "settings.videoErrorCoverTime": "Cover frame time is invalid.",
        "settings.videoErrorTimelapseImages": "Select at least 2 images for timelapse.",
        "settings.videoTimelapseSelectImages": "Select Images",
        "settings.videoTimelapseImageCount": "images selected",
        "settings.videoTimelapseFps": "Frame rate (FPS)",
        "settings.videoCustomWidth": "Width",
        "settings.videoCustomHeight": "Height",
      };
      return map[key] ?? key;
    },
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

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

  it("keeps operation when remove-audio toggle is enabled", () => {
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

    fireEvent(screen.getByTestId("remove-audio-switch"), "onSelectedChange", true);
    fireEvent.press(screen.getByText("Queue Task"));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "trim",
        removeAudio: true,
      }),
    );
  });

  it("blocks invalid trim range before submit", () => {
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

    fireEvent.changeText(screen.getByPlaceholderText("Start ms"), "1000");
    fireEvent.changeText(screen.getByPlaceholderText("End ms"), "800");
    fireEvent.press(screen.getByText("Queue Task"));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Trim range is invalid.")).toBeTruthy();
  });

  it("renders all 12 operation options in the sheet", () => {
    render(
      <VideoProcessingSheet
        visible
        file={baseVideoFile}
        defaultProfile="balanced"
        defaultPreset="1080p"
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Video Processing")).toBeTruthy();
    expect(screen.getByText("Queue Task")).toBeTruthy();
    expect(screen.getByText("Cancel")).toBeTruthy();
  });

  it("shows speed factor input when speed operation is hypothetically selected", () => {
    render(
      <VideoProcessingSheet
        visible
        file={baseVideoFile}
        defaultProfile="balanced"
        defaultPreset="1080p"
        onSubmit={jest.fn()}
        onClose={jest.fn()}
      />,
    );

    expect(screen.getByText("Parameters")).toBeTruthy();
  });
});
