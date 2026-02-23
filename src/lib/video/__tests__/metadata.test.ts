const mockAddListener = jest.fn();
const mockPause = jest.fn();
const mockRelease = jest.fn();

const mockPlayer = {
  status: "idle" as string,
  duration: 0,
  availableVideoTracks: [] as unknown[],
  availableSubtitleTracks: [] as unknown[],
  availableAudioTracks: [] as unknown[],
  addListener: mockAddListener,
  pause: mockPause,
  release: mockRelease,
};

jest.mock("expo-video", () => ({
  createVideoPlayer: jest.fn(() => mockPlayer),
}));

import { extractVideoMetadata } from "../metadata";

beforeEach(() => {
  jest.clearAllMocks();
  mockPlayer.status = "idle";
  mockPlayer.duration = 0;
  mockPlayer.availableVideoTracks = [];
  mockPlayer.availableSubtitleTracks = [];
  mockPlayer.availableAudioTracks = [];
});

describe("extractVideoMetadata", () => {
  it("resolves with metadata when sourceLoad fires", async () => {
    mockAddListener.mockImplementation((event: string, cb: (payload: unknown) => void) => {
      if (event === "sourceLoad") {
        setTimeout(() => {
          cb({
            videoSource: { uri: "file:///test.mp4" },
            duration: 12.5,
            availableVideoTracks: [
              {
                isSupported: true,
                frameRate: 30,
                size: { width: 1920, height: 1080 },
                mimeType: "video/avc",
                bitrate: 4_500_000,
              },
            ],
            availableAudioTracks: [{ id: "a0" }],
            availableSubtitleTracks: [],
          });
        }, 10);
      }
      return { remove: jest.fn() };
    });

    const result = await extractVideoMetadata("file:///test.mp4", 3000);

    expect(result.durationMs).toBe(12500);
    expect(result.frameRate).toBe(30);
    expect(result.videoWidth).toBe(1920);
    expect(result.videoHeight).toBe(1080);
    expect(result.videoCodec).toBe("video/avc");
    expect(result.bitrateKbps).toBe(4500);
    expect(result.hasAudioTrack).toBe(true);
  });

  it("uses readyToPlay fast path when player is already ready", async () => {
    mockPlayer.status = "readyToPlay";
    mockPlayer.duration = 8.0;
    mockPlayer.availableVideoTracks = [
      {
        isSupported: true,
        frameRate: 24,
        size: { width: 1280, height: 720 },
        mimeType: "video/hevc",
      },
    ];
    mockPlayer.availableAudioTracks = [];

    const result = await extractVideoMetadata("file:///ready.mp4");

    expect(result.durationMs).toBe(8000);
    expect(result.frameRate).toBe(24);
    expect(result.videoWidth).toBe(1280);
    expect(result.videoHeight).toBe(720);
    expect(result.hasAudioTrack).toBe(false);
    expect(mockAddListener).not.toHaveBeenCalled();
  });

  it("rejects on statusChange error", async () => {
    mockAddListener.mockImplementation((event: string, cb: (payload: unknown) => void) => {
      if (event === "statusChange") {
        setTimeout(() => {
          cb({ status: "error", error: { message: "decode_failed" } });
        }, 10);
      }
      return { remove: jest.fn() };
    });

    await expect(extractVideoMetadata("file:///bad.mp4", 3000)).rejects.toThrow("decode_failed");
  });

  it("rejects on timeout when no events fire", async () => {
    mockAddListener.mockImplementation(() => ({ remove: jest.fn() }));

    await expect(extractVideoMetadata("file:///slow.mp4", 100)).rejects.toThrow(
      "video_metadata_timeout",
    );
  });

  it("calls pause and release in cleanup", async () => {
    mockPlayer.status = "readyToPlay";
    mockPlayer.duration = 1.0;
    mockPlayer.availableVideoTracks = [];
    mockPlayer.availableAudioTracks = [];

    await extractVideoMetadata("file:///cleanup.mp4");

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("handles missing video track gracefully", async () => {
    mockPlayer.status = "readyToPlay";
    mockPlayer.duration = 5.0;
    mockPlayer.availableVideoTracks = [];
    mockPlayer.availableAudioTracks = [{ id: "a0" }];

    const result = await extractVideoMetadata("file:///audio-only.mp4");

    expect(result.durationMs).toBe(5000);
    expect(result.frameRate).toBeUndefined();
    expect(result.videoWidth).toBeUndefined();
    expect(result.videoHeight).toBeUndefined();
    expect(result.videoCodec).toBeUndefined();
    expect(result.bitrateKbps).toBeUndefined();
    expect(result.hasAudioTrack).toBe(true);
  });
});
