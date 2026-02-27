import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VideoControls } from "../VideoControls";

describe("VideoControls", () => {
  const defaultProps = {
    isLoop: false,
    isMuted: false,
    isVideo: true,
    isSaving: false,
    videoProcessingEnabled: true,
    isEngineAvailable: true,
    availableAudioTracks: [] as { id: string; label?: string; language?: string }[],
    availableSubtitleTracks: [] as { id: string; label?: string; language?: string }[],
    activeAudioTrackId: null as string | null,
    activeSubtitleTrackId: null as string | null,
    onToggleLoop: jest.fn(),
    onToggleMute: jest.fn(),
    onSelectAudioTrack: jest.fn(),
    onSelectSubtitleTrack: jest.fn(),
    onSaveToLibrary: jest.fn(),
    onShare: jest.fn(),
    onOpenProcessing: jest.fn(),
    onOpenQueue: jest.fn(),
    onSetThumbnail: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders loop and audio switches", () => {
    render(<VideoControls {...defaultProps} />);
    expect(screen.getByText("Loop")).toBeTruthy();
    expect(screen.getByText("Audio")).toBeTruthy();
  });

  it("renders action buttons", () => {
    render(<VideoControls {...defaultProps} />);
    expect(screen.getByText("Save")).toBeTruthy();
    expect(screen.getByText("Share")).toBeTruthy();
    expect(screen.getByText("Process")).toBeTruthy();
    expect(screen.getByText("Queue")).toBeTruthy();
  });

  it("calls onSaveToLibrary when save button is pressed", () => {
    render(<VideoControls {...defaultProps} />);
    fireEvent.press(screen.getByText("Save"));
    expect(defaultProps.onSaveToLibrary).toHaveBeenCalledTimes(1);
  });

  it("calls onShare when share button is pressed", () => {
    render(<VideoControls {...defaultProps} />);
    fireEvent.press(screen.getByText("Share"));
    expect(defaultProps.onShare).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenProcessing when process button is pressed", () => {
    render(<VideoControls {...defaultProps} />);
    fireEvent.press(screen.getByText("Process"));
    expect(defaultProps.onOpenProcessing).toHaveBeenCalledTimes(1);
  });

  it("calls onOpenQueue when queue button is pressed", () => {
    render(<VideoControls {...defaultProps} />);
    fireEvent.press(screen.getByText("Queue"));
    expect(defaultProps.onOpenQueue).toHaveBeenCalledTimes(1);
  });

  it("renders Set Thumbnail button for video files and calls handler", () => {
    render(<VideoControls {...defaultProps} isVideo={true} />);
    expect(screen.getByText("Set Thumbnail")).toBeTruthy();
    fireEvent.press(screen.getByText("Set Thumbnail"));
    expect(defaultProps.onSetThumbnail).toHaveBeenCalledTimes(1);
  });

  it("does not render Set Thumbnail button for non-video files", () => {
    render(<VideoControls {...defaultProps} isVideo={false} />);
    expect(screen.queryByText("Set Thumbnail")).toBeNull();
  });

  it("does not render Set Thumbnail button when handler is undefined", () => {
    render(<VideoControls {...defaultProps} onSetThumbnail={undefined} />);
    expect(screen.queryByText("Set Thumbnail")).toBeNull();
  });

  it("renders audio track selector when available", () => {
    render(
      <VideoControls
        {...defaultProps}
        availableAudioTracks={[{ id: "audio-1", label: "English" }]}
      />,
    );
    expect(screen.getByText("Audio track")).toBeTruthy();
  });

  it("renders subtitle track selector for video with subtitles", () => {
    render(
      <VideoControls
        {...defaultProps}
        isVideo={true}
        availableSubtitleTracks={[{ id: "sub-1", label: "English CC" }]}
      />,
    );
    expect(screen.getByText("Subtitle track")).toBeTruthy();
  });

  it("does not render subtitle selector for non-video", () => {
    render(
      <VideoControls
        {...defaultProps}
        isVideo={false}
        availableSubtitleTracks={[{ id: "sub-1", label: "English CC" }]}
      />,
    );
    expect(screen.queryByText("Subtitle track")).toBeNull();
  });
});
