import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import VideoDetailScreen from "../[id]";
import { useFitsStore } from "../../../stores/useFitsStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockPlayer = {
  addListener: jest.fn(() => ({ remove: jest.fn() })),
  play: jest.fn(),
  pause: jest.fn(),
  seekBy: jest.fn(),
  replay: jest.fn(),
  playing: false,
  muted: false,
  volume: 1,
  loop: false,
  playbackRate: 1,
  currentTime: 0,
  status: "readyToPlay",
  timeUpdateEventInterval: 0.2,
  availableAudioTracks: [] as unknown[],
  availableSubtitleTracks: [] as unknown[],
  audioTrack: null as unknown,
  subtitleTrack: null as unknown,
};
const mockVideoProcessing = {
  tasks: [] as unknown[],
  isEngineAvailable: true,
  engineCapabilities: null as { unavailableReason?: string } | null,
  enqueueProcessingTask: jest.fn(() => ({ taskId: "task-1" })),
  retryTask: jest.fn(),
  removeTask: jest.fn(),
  clearFinished: jest.fn(),
  cancelTask: jest.fn(),
};

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "video-1" }),
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
    replace: mockReplace,
  }),
}));

jest.mock("expo-video", () => {
  const { View } = require("react-native");
  return {
    VideoView: (props: Record<string, unknown>) => <View testID="video-view" {...props} />,
    isPictureInPictureSupported: () => true,
    useVideoPlayer: (_source: unknown, setup?: (instance: typeof mockPlayer) => void) => {
      setup?.(mockPlayer);
      return mockPlayer;
    },
  };
});

jest.mock("../../../hooks/useMediaLibrary", () => ({
  useMediaLibrary: () => ({
    saveToDevice: jest.fn(),
    isSaving: false,
  }),
}));

jest.mock("../../../hooks/useVideoProcessing", () => ({
  useVideoProcessing: () => mockVideoProcessing,
}));

describe("/video/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPlayer.muted = false;
    mockPlayer.loop = false;
    mockPlayer.volume = 1;
    mockPlayer.playbackRate = 1;
    mockPlayer.currentTime = 0;
    mockPlayer.playing = false;
    mockPlayer.status = "readyToPlay";
    mockPlayer.availableAudioTracks = [];
    mockPlayer.availableSubtitleTracks = [];
    mockPlayer.audioTrack = null;
    mockPlayer.subtitleTrack = null;
    mockVideoProcessing.isEngineAvailable = true;
    mockVideoProcessing.engineCapabilities = null;
    useSettingsStore.setState({
      videoCoreEnabled: true,
      videoProcessingEnabled: true,
    });
    useFitsStore.setState({
      files: [
        {
          id: "video-1",
          filename: "capture.mp4",
          filepath: "file:///capture.mp4",
          fileSize: 2048,
          importDate: Date.now(),
          frameType: "unknown",
          isFavorite: false,
          tags: [],
          albumIds: [],
          mediaKind: "video",
          sourceType: "video",
          sourceFormat: "mp4",
          durationMs: 12000,
          videoWidth: 1920,
          videoHeight: 1080,
        },
      ],
    });
  });

  it("renders player and primary controls", () => {
    render(<VideoDetailScreen />);
    expect(screen.getByTestId("video-view")).toBeTruthy();
    expect(screen.getByText("Process")).toBeTruthy();
    expect(screen.getByText("Queue")).toBeTruthy();
  });

  it("shows disabled state when video core feature flag is off", () => {
    useSettingsStore.setState({
      videoCoreEnabled: false,
    });

    render(<VideoDetailScreen />);
    expect(screen.getByText("Video features are disabled by current settings.")).toBeTruthy();
    fireEvent.press(screen.getByText("Back"));
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it("keeps audio files in media workspace route", async () => {
    useFitsStore.setState({
      files: [
        {
          id: "video-1",
          filename: "recording.m4a",
          filepath: "file:///recording.m4a",
          fileSize: 2048,
          importDate: Date.now(),
          frameType: "unknown",
          isFavorite: false,
          tags: [],
          albumIds: [],
          mediaKind: "audio",
          sourceType: "audio",
          sourceFormat: "m4a",
          durationMs: 6000,
        },
      ],
    });

    render(<VideoDetailScreen />);
    await waitFor(() => {
      expect(mockReplace).not.toHaveBeenCalledWith("/viewer/video-1");
    });
    expect(screen.getByText("Process")).toBeTruthy();
  });

  it("shows engine unavailable message in tasks tab", () => {
    mockVideoProcessing.isEngineAvailable = false;
    mockVideoProcessing.engineCapabilities = { unavailableReason: "ffmpeg_executor_unavailable" };

    render(<VideoDetailScreen />);
    fireEvent.press(screen.getByText("Tasks"));
    expect(screen.getByText(/ffmpeg_executor_unavailable/)).toBeTruthy();
  });

  it("redirects to image viewer when current file is not video", async () => {
    useFitsStore.setState({
      files: [
        {
          id: "video-1",
          filename: "image.fits",
          filepath: "file:///image.fits",
          fileSize: 2048,
          importDate: Date.now(),
          frameType: "light",
          isFavorite: false,
          tags: [],
          albumIds: [],
          mediaKind: "image",
          sourceType: "fits",
          sourceFormat: "fits",
        },
      ],
    });

    render(<VideoDetailScreen />);
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/viewer/video-1");
    });
  });
});
