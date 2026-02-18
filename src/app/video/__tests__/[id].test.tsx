import React from "react";
import { render, screen } from "@testing-library/react-native";
import VideoDetailScreen from "../[id]";
import { useFitsStore } from "../../../stores/useFitsStore";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ id: "video-1" }),
  useRouter: () => ({
    back: jest.fn(),
    push: jest.fn(),
    replace: jest.fn(),
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
});
