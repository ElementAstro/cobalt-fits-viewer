import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import VideoDetailScreen from "../[id]";
import { useFitsStore } from "../../../stores/useFitsStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";

const mockBack = jest.fn();
const mockPush = jest.fn();
const mockReplace = jest.fn();

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
    useVideoPlayer: () => ({
      addListener: () => ({ remove: jest.fn() }),
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
    }),
  };
});

jest.mock("../../../hooks/useMediaLibrary", () => ({
  useMediaLibrary: () => ({
    saveToDevice: jest.fn(),
    isSaving: false,
  }),
}));

jest.mock("../../../hooks/useVideoProcessing", () => ({
  useVideoProcessing: () => ({
    tasks: [],
    isEngineAvailable: true,
    enqueueProcessingTask: jest.fn(() => "task-1"),
    retryTask: jest.fn(),
    removeTask: jest.fn(),
    clearFinished: jest.fn(),
    cancelTask: jest.fn(),
  }),
}));

describe("/video/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
