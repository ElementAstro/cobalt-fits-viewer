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
  checkDiskSpaceForTask: jest.fn().mockResolvedValue(null),
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

jest.mock("expo-keep-awake", () => ({
  useKeepAwake: jest.fn(),
}));

jest.mock("../../../hooks/useResponsiveLayout", () => ({
  useResponsiveLayout: () => ({
    isLandscape: false,
    layoutMode: "portrait",
    isLandscapePhone: false,
    isLandscapeTablet: false,
    contentPaddingTop: 56,
    horizontalPadding: 16,
    sidePanelWidth: 300,
  }),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 48, bottom: 34, left: 0, right: 0 }),
}));

const mockHaptics = {
  hapticsEnabled: true,
  selection: jest.fn(),
  impact: jest.fn(),
  notify: jest.fn(),
};
jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => mockHaptics,
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

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      const map: Record<string, string> = {
        "settings.videoBack": "Back",
        "settings.videoFileNotFound": "Media file not found.",
        "settings.videoFeaturesDisabled": "Video features are disabled by current settings.",
        "settings.videoRetry": "Retry",
        "settings.videoSeek": "Seek",
        "settings.videoVolume": "Volume",
        "settings.videoLoop": "Loop",
        "settings.videoAudio": "Audio",
        "settings.videoSave": "Save",
        "settings.videoShare": "Share",
        "settings.videoProcess": "Process",
        "settings.videoQueue": "Queue",
        "settings.videoInfoTab": "Info",
        "settings.videoTasksTab": "Tasks",
        "settings.videoNoTasks": "No tasks for this media.",
        "settings.videoEngineUnavailable": "Local FFmpeg adapter is unavailable",
        "settings.videoFullscreenError": "Fullscreen is unavailable on this device.",
        "settings.videoPipError": "Picture in Picture is not supported.",
        "settings.videoSavedToLibrary": "Saved to media library.",
        "settings.videoSaveError": "Unable to save to media library.",
        "settings.videoShareError": "Unable to share this file.",
        "settings.videoAbLoopClear": "Clear A-B",
        "settings.videoStatusLabel": "Status: {status}",
        "settings.videoVolumeLabel": "Volume: {volume}%",
        "settings.videoSizeLabel": "Size: {size}",
        "settings.videoCodecLabel": "Video codec: {codec}",
        "settings.audioCodecLabel": "Audio codec: {codec}",
        "settings.videoBitrateLabel": "Bitrate: {bitrate} kbps",
        "settings.videoCompatibilityProfileTitle": "Default Compatibility Profile",
        "settings.videoCompatibilityProfileDesc":
          "MP4 + H.264/AAC + yuv420p + faststart with hardware codec fallbacks.",
        "settings.videoOpenOutput": "Open #{index}",
        "settings.videoPlaybackError": "Unable to play this media.",
        "settings.videoAudioTrackPlaceholder": "Audio track",
        "settings.videoSubtitleTrackPlaceholder": "Subtitle track",
        "settings.videoErrorCodeLabel": "Code: {code}",
        "settings.videoPrevious": "Previous",
        "settings.videoNext": "Next",
        "settings.videoFavorite": "Favorite",
        "settings.videoUnfavorite": "Unfavorite",
        "settings.videoRewind": "Rewind 10s",
        "settings.videoForward": "Forward 10s",
        "settings.videoPlayLabel": "Play",
        "settings.videoPauseLabel": "Pause",
        "settings.videoMuteLabel": "Mute",
        "settings.videoUnmuteLabel": "Unmute",
        "settings.videoFullscreenLabel": "Fullscreen",
        "settings.videoPipLabel": "Picture in Picture",
      };
      const result = map[key];
      if (!result) return key;
      return result.replace(/\{(\w+)\}/g, (_: string, k: string) => {
        return params?.[k] != null ? String(params[k]) : `{${k}}`;
      });
    },
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

jest.spyOn(require("react-native").StatusBar, "setHidden").mockImplementation(jest.fn());

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

  it("renders volume slider and A-B loop controls", () => {
    render(<VideoDetailScreen />);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("B")).toBeTruthy();
  });

  it("renders sub-second time display format", () => {
    render(<VideoDetailScreen />);
    // Both current and total time use formatVideoDurationWithMs
    const timeElements = screen.getAllByText("00:00.0");
    expect(timeElements.length).toBeGreaterThanOrEqual(1);
  });

  it("renders favorite button and toggles favorite on press", () => {
    render(<VideoDetailScreen />);
    const favBtn = screen.getByLabelText("Favorite");
    expect(favBtn).toBeTruthy();
    fireEvent.press(favBtn);
    const file = useFitsStore.getState().getFileById("video-1");
    expect(file?.isFavorite).toBe(true);
  });

  it("updates lastViewed on mount", () => {
    render(<VideoDetailScreen />);
    const file = useFitsStore.getState().getFileById("video-1");
    expect(file?.lastViewed).toBeDefined();
    expect(typeof file?.lastViewed).toBe("number");
  });

  it("calls haptics.selection on play/pause", () => {
    mockHaptics.selection.mockClear();
    render(<VideoDetailScreen />);
    fireEvent.press(screen.getByTestId("e2e-action-video__param_id-play-pause"));
    expect(mockHaptics.selection).toHaveBeenCalled();
  });

  it("calls StatusBar.setHidden on mount", () => {
    const StatusBar = require("react-native").StatusBar;
    StatusBar.setHidden.mockClear();
    render(<VideoDetailScreen />);
    expect(StatusBar.setHidden).toHaveBeenCalledWith(false, "fade");
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
