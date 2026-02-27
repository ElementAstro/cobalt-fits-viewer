import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { VideoPlayerCard } from "../VideoPlayerCard";

jest.mock("../../common/SimpleSlider", () => {
  const React = require("react");
  const { View } = require("react-native");
  return {
    SimpleSlider: (props: Record<string, unknown>) =>
      React.createElement(View, { testID: `slider-${props.label}`, ...props }),
  };
});

const mockPlayer = {
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  play: jest.fn(),
  pause: jest.fn(),
  seekBy: jest.fn(),
  replay: jest.fn(),
  playing: false,
  muted: false,
  loop: false,
  playbackRate: 1,
  currentTime: 0,
  status: "readyToPlay",
  timeUpdateEventInterval: 0.2,
};

describe("VideoPlayerCard", () => {
  const defaultProps = {
    player: mockPlayer as never,
    isPlayerReady: true,
    playerStatus: "readyToPlay",
    playerError: null as string | null,
    durationSec: 12,
    currentTimeSec: 3.5,
    isPlaying: false,
    playbackRate: 1,
    isMuted: false,
    volume: 0.8,
    isVideo: true,
    isAudio: false,
    isLandscape: false,
    fileDurationMs: 12000,
    pipSupported: true,
    abLoopA: null as number | null,
    abLoopB: null as number | null,
    onPlayPause: jest.fn(),
    onSeekBy: jest.fn(),
    onSeekTo: jest.fn(),
    onCycleRate: jest.fn(),
    onToggleMute: jest.fn(),
    onVolumeChange: jest.fn(),
    onFullscreen: jest.fn(),
    onPip: jest.fn(),
    onRetryPlayback: jest.fn(),
    onSetAbLoopA: jest.fn(),
    onSetAbLoopB: jest.fn(),
    onClearAbLoop: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders video view", () => {
    render(<VideoPlayerCard {...defaultProps} />);
    expect(screen.getByTestId("expo-video-view")).toBeTruthy();
  });

  it("renders play/pause button and dispatches onPlayPause", () => {
    render(<VideoPlayerCard {...defaultProps} />);
    const btn = screen.getByTestId("e2e-action-video__param_id-play-pause");
    fireEvent.press(btn);
    expect(defaultProps.onPlayPause).toHaveBeenCalledTimes(1);
  });

  it("renders playback rate button and dispatches onCycleRate", () => {
    render(<VideoPlayerCard {...defaultProps} playbackRate={1.5} />);
    const rateBtn = screen.getByText("1.5x");
    fireEvent.press(rateBtn);
    expect(defaultProps.onCycleRate).toHaveBeenCalledTimes(1);
  });

  it("calls onSeekBy(-10) on rewind button press", () => {
    render(<VideoPlayerCard {...defaultProps} />);
    fireEvent.press(screen.getByLabelText("Rewind 10s"));
    expect(defaultProps.onSeekBy).toHaveBeenCalledWith(-10);
  });

  it("calls onSeekBy(10) on forward button press", () => {
    render(<VideoPlayerCard {...defaultProps} />);
    fireEvent.press(screen.getByLabelText("Forward 10s"));
    expect(defaultProps.onSeekBy).toHaveBeenCalledWith(10);
  });

  it("renders mute/unmute button", () => {
    render(<VideoPlayerCard {...defaultProps} isMuted={false} />);
    expect(screen.getByLabelText("Mute")).toBeTruthy();
  });

  it("shows unmute label when muted", () => {
    render(<VideoPlayerCard {...defaultProps} isMuted={true} />);
    expect(screen.getByLabelText("Unmute")).toBeTruthy();
  });

  it("renders fullscreen button for video", () => {
    render(<VideoPlayerCard {...defaultProps} isVideo={true} />);
    expect(screen.getByLabelText("Fullscreen")).toBeTruthy();
  });

  it("does not render fullscreen button for audio", () => {
    render(<VideoPlayerCard {...defaultProps} isVideo={false} isAudio={true} />);
    expect(screen.queryByLabelText("Fullscreen")).toBeNull();
  });

  it("renders PiP button when supported and is video", () => {
    render(<VideoPlayerCard {...defaultProps} isVideo={true} pipSupported={true} />);
    expect(screen.getByLabelText("Picture in Picture")).toBeTruthy();
  });

  it("does not render PiP button when not supported", () => {
    render(<VideoPlayerCard {...defaultProps} pipSupported={false} />);
    expect(screen.queryByLabelText("Picture in Picture")).toBeNull();
  });

  it("renders volume and status text", () => {
    render(<VideoPlayerCard {...defaultProps} volume={0.8} playerStatus="readyToPlay" />);
    expect(screen.getByText("Volume: 80%")).toBeTruthy();
    expect(screen.getByText("Status: readyToPlay")).toBeTruthy();
  });

  it("shows loading spinner when not ready", () => {
    render(<VideoPlayerCard {...defaultProps} isPlayerReady={false} playerStatus="loading" />);
    expect(screen.getByTestId("spinner")).toBeTruthy();
  });

  it("shows error overlay with retry button on error status", () => {
    render(
      <VideoPlayerCard {...defaultProps} playerStatus="error" playerError="Codec not supported" />,
    );
    expect(screen.getByText("Codec not supported")).toBeTruthy();
    fireEvent.press(screen.getByText("Retry"));
    expect(defaultProps.onRetryPlayback).toHaveBeenCalledTimes(1);
  });

  it("shows audio overlay for audio files", () => {
    render(<VideoPlayerCard {...defaultProps} isVideo={false} isAudio={true} />);
    expect(screen.getByText("musical-notes-outline")).toBeTruthy();
    expect(screen.getByText("00:12")).toBeTruthy();
  });

  it("renders A-B loop buttons", () => {
    render(<VideoPlayerCard {...defaultProps} />);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });

  it("calls onSetAbLoopA when A button is pressed", () => {
    render(<VideoPlayerCard {...defaultProps} />);
    fireEvent.press(screen.getByText("A"));
    expect(defaultProps.onSetAbLoopA).toHaveBeenCalledTimes(1);
  });

  it("renders Clear A-B button when loop points are set", () => {
    render(<VideoPlayerCard {...defaultProps} abLoopA={2} abLoopB={5} />);
    expect(screen.getByText("Clear A-B")).toBeTruthy();
    fireEvent.press(screen.getByText("Clear A-B"));
    expect(defaultProps.onClearAbLoop).toHaveBeenCalledTimes(1);
  });

  it("renders seek and volume sliders", () => {
    render(<VideoPlayerCard {...defaultProps} />);
    expect(screen.getByTestId("slider-Seek")).toBeTruthy();
    expect(screen.getByTestId("slider-Volume")).toBeTruthy();
  });

  it("formats current and total time display", () => {
    render(<VideoPlayerCard {...defaultProps} currentTimeSec={3.5} durationSec={12} />);
    expect(screen.getByText("00:03.5")).toBeTruthy();
    expect(screen.getByText("00:12.0")).toBeTruthy();
  });

  it("renders audio overlay icon with theme muted color", () => {
    render(<VideoPlayerCard {...defaultProps} isVideo={false} isAudio={true} />);
    expect(screen.getByText("musical-notes-outline")).toBeTruthy();
  });

  it("renders error overlay icon with theme warning color", () => {
    render(<VideoPlayerCard {...defaultProps} playerStatus="error" playerError="Decode error" />);
    expect(screen.getByText("alert-circle-outline")).toBeTruthy();
    expect(screen.getByText("Decode error")).toBeTruthy();
  });
});
