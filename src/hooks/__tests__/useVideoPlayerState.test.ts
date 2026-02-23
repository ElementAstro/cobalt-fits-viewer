import { renderHook, act } from "@testing-library/react-native";
import { useVideoPlayerState } from "../useVideoPlayerState";

type ListenerCallback = (payload: Record<string, unknown>) => void;

function createMockPlayer() {
  const listeners = new Map<string, ListenerCallback>();
  return {
    muted: false,
    volume: 1,
    playing: false,
    loop: false,
    playbackRate: 1,
    currentTime: 0,
    availableAudioTracks: [] as unknown[],
    availableSubtitleTracks: [] as unknown[],
    audioTrack: null as unknown,
    subtitleTrack: null as unknown,
    addListener: jest.fn((event: string, cb: ListenerCallback) => {
      listeners.set(event, cb);
      return { remove: jest.fn() };
    }),
    play: jest.fn(),
    pause: jest.fn(),
    replay: jest.fn(),
    seekBy: jest.fn(),
    _fire(event: string, payload: Record<string, unknown>) {
      listeners.get(event)?.(payload);
    },
    _listeners: listeners,
  };
}

const mockHaptics = { selection: jest.fn() };

const defaultOptions = {
  abLoopA: null,
  abLoopB: null,
  errorFallbackMessage: "Playback error",
};

describe("useVideoPlayerState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes with player's current muted and volume", () => {
    const player = createMockPlayer();
    player.muted = true;
    player.volume = 0.5;

    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    expect(result.current.isMuted).toBe(true);
    expect(result.current.volume).toBe(0.5);
  });

  it("subscribes to 12 player events", () => {
    const player = createMockPlayer();
    renderHook(() => useVideoPlayerState(player as never, mockHaptics, defaultOptions));

    expect(player.addListener).toHaveBeenCalledTimes(12);
    const events = player.addListener.mock.calls.map((c: unknown[]) => c[0]);
    expect(events).toContain("playingChange");
    expect(events).toContain("playbackRateChange");
    expect(events).toContain("timeUpdate");
    expect(events).toContain("sourceLoad");
    expect(events).toContain("statusChange");
    expect(events).toContain("mutedChange");
    expect(events).toContain("volumeChange");
    expect(events).toContain("sourceChange");
    expect(events).toContain("availableAudioTracksChange");
    expect(events).toContain("availableSubtitleTracksChange");
    expect(events).toContain("audioTrackChange");
    expect(events).toContain("subtitleTrackChange");
  });

  it("updates isPlaying on playingChange event", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    expect(result.current.isPlaying).toBe(false);

    act(() => {
      player._fire("playingChange", { isPlaying: true });
    });

    expect(result.current.isPlaying).toBe(true);
  });

  it("updates duration and readiness on sourceLoad", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    expect(result.current.isPlayerReady).toBe(false);

    act(() => {
      player._fire("sourceLoad", {
        duration: 120,
        availableAudioTracks: [{ id: "a1" }],
        availableSubtitleTracks: [],
      });
    });

    expect(result.current.isPlayerReady).toBe(true);
    expect(result.current.durationSec).toBe(120);
    expect(result.current.availableAudioTracks).toEqual([{ id: "a1" }]);
  });

  it("sets playerError on statusChange error", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    act(() => {
      player._fire("statusChange", { status: "error", error: { message: "decode_error" } });
    });

    expect(result.current.playerError).toBe("decode_error");
    expect(result.current.playerStatus).toBe("error");
  });

  it("uses fallback error message when error.message is missing", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    act(() => {
      player._fire("statusChange", { status: "error", error: null });
    });

    expect(result.current.playerError).toBe("Playback error");
  });

  it("handlePlayPause calls play/pause and haptics", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    act(() => {
      result.current.handlePlayPause();
    });

    expect(mockHaptics.selection).toHaveBeenCalledTimes(1);
    expect(player.play).toHaveBeenCalled();

    player.playing = true;
    act(() => {
      result.current.handlePlayPause();
    });

    expect(player.pause).toHaveBeenCalled();
  });

  it("handleCycleRate cycles through RATE_OPTIONS [0.5, 1, 1.5, 2]", () => {
    const player = createMockPlayer();
    player.playbackRate = 1;
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    // Simulate initial rate sync
    act(() => {
      player._fire("playbackRateChange", { playbackRate: 1 });
    });

    act(() => {
      result.current.handleCycleRate();
    });

    // 1 → next is 1.5
    expect(player.playbackRate).toBe(1.5);
  });

  it("handleToggleMute toggles player.muted", () => {
    const player = createMockPlayer();
    player.muted = false;
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    act(() => {
      result.current.handleToggleMute();
    });

    expect(player.muted).toBe(true);
  });

  it("handleSeekBy delegates to player.seekBy", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    act(() => {
      result.current.handleSeekBy(-10);
    });

    expect(player.seekBy).toHaveBeenCalledWith(-10);
  });

  it("handleSeekTo clamps to [0, durationSec]", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    // Set duration first
    act(() => {
      player._fire("sourceLoad", {
        duration: 60,
        availableAudioTracks: [],
        availableSubtitleTracks: [],
      });
    });

    act(() => {
      result.current.handleSeekTo(999);
    });

    expect(player.currentTime).toBe(60);
    expect(result.current.currentTimeSec).toBe(60);

    act(() => {
      result.current.handleSeekTo(-5);
    });

    expect(player.currentTime).toBe(0);
  });

  it("resets state on sourceChange event", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    // First set some state via sourceLoad
    act(() => {
      player._fire("sourceLoad", {
        duration: 100,
        availableAudioTracks: [{ id: "a" }],
        availableSubtitleTracks: [{ id: "s" }],
      });
    });

    expect(result.current.isPlayerReady).toBe(true);

    // Then sourceChange resets
    act(() => {
      player._fire("sourceChange", {});
    });

    expect(result.current.isPlayerReady).toBe(false);
    expect(result.current.playerStatus).toBe("loading");
    expect(result.current.durationSec).toBe(0);
    expect(result.current.currentTimeSec).toBe(0);
    expect(result.current.availableAudioTracks).toEqual([]);
  });

  it("handleRetryPlayback resets error and replays", () => {
    const player = createMockPlayer();
    const { result } = renderHook(() =>
      useVideoPlayerState(player as never, mockHaptics, defaultOptions),
    );

    // Set error state
    act(() => {
      player._fire("statusChange", { status: "error", error: { message: "fail" } });
    });

    expect(result.current.playerError).toBe("fail");

    act(() => {
      result.current.handleRetryPlayback();
    });

    expect(result.current.playerError).toBeNull();
    expect(result.current.playerStatus).toBe("loading");
    expect(player.replay).toHaveBeenCalled();
  });

  it("enforces AB loop when currentTime exceeds abLoopB", () => {
    const player = createMockPlayer();
    const options = { abLoopA: 5, abLoopB: 10, errorFallbackMessage: "err" };
    renderHook(() => useVideoPlayerState(player as never, mockHaptics, options));

    act(() => {
      player._fire("timeUpdate", { currentTime: 11 });
    });

    expect(player.currentTime).toBe(5);
  });
});
