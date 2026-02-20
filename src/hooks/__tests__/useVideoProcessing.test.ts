import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useVideoProcessing } from "../useVideoProcessing";
import { useFitsStore } from "../../stores/useFitsStore";
import { useVideoTaskStore } from "../../stores/useVideoTaskStore";
import type { VideoProcessingRequest } from "../../lib/video/engine";

const mockEngine = {
  isAvailable: jest.fn(async () => true),
  getCapabilities: jest.fn(async () => ({
    available: true,
    encoderNames: ["h264_mediacodec", "mpeg4"],
    h264Encoders: ["h264_mediacodec", "mpeg4"],
    hevcEncoders: [],
    fallbackVideoEncoder: "h264_mediacodec",
  })),
  run: jest.fn(),
};

const mockSettings = {
  videoProcessingConcurrency: 1,
  videoProcessingEnabled: true,
  frameClassificationConfig: {
    frameTypes: [
      { key: "light", label: "Light", builtin: true },
      { key: "dark", label: "Dark", builtin: true },
      { key: "flat", label: "Flat", builtin: true },
      { key: "bias", label: "Bias", builtin: true },
      { key: "darkflat", label: "Dark Flat", builtin: true },
      { key: "unknown", label: "Unknown", builtin: true },
    ],
    rules: [],
  },
};

jest.mock("../../lib/video/engine", () => ({
  getVideoProcessingEngine: () => mockEngine,
}));

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: (selector: (state: typeof mockSettings) => unknown) => selector(mockSettings),
}));

let mockIdSeq = 1;
jest.mock("../../lib/utils/fileManager", () => ({
  importFile: (_uri: string, _name: string) => ({ uri: `file:///managed/out_${mockIdSeq}.mp4` }),
  generateFileId: () => `generated_${mockIdSeq++}`,
}));

jest.mock("../../lib/video/metadata", () => ({
  extractVideoMetadata: jest.fn(async () => ({
    durationMs: 4000,
    frameRate: 24,
    videoWidth: 1920,
    videoHeight: 1080,
    videoCodec: "video/mp4",
    audioCodec: "audio/aac",
    bitrateKbps: 2500,
    hasAudioTrack: true,
  })),
}));

jest.mock("../../lib/import/fileFormat", () => ({
  detectSupportedMediaFormat: () => ({ id: "mp4", sourceType: "video" }),
  toImageSourceFormat: () => "mp4",
}));

jest.mock("../../lib/gallery/thumbnailCache", () => ({
  copyThumbnailToCache: () => "file:///thumb.jpg",
  generateAndSaveThumbnail: () => "file:///thumb.jpg",
}));

jest.mock("../../lib/image/rasterParser", () => ({
  parseRasterFromBuffer: () => ({
    width: 2,
    height: 2,
    rgba: new Uint8Array([0, 1, 2, 255]),
  }),
  extractRasterMetadata: () => ({
    filename: "cover.jpg",
    filepath: "file:///managed/cover.jpg",
    fileSize: 100,
    frameType: "light",
  }),
}));

jest.mock("expo-video-thumbnails", () => ({
  getThumbnailAsync: jest.fn(async () => ({ uri: "file:///tmp/thumb.jpg" })),
}));

jest.mock("expo-file-system", () => ({
  File: class {
    uri: string;
    name: string;
    constructor(path: string) {
      this.uri = path;
      const parts = path.split("/");
      this.name = parts[parts.length - 1] || "out.mp4";
    }
    get size() {
      return 4096;
    }
    async arrayBuffer() {
      return new ArrayBuffer(8);
    }
  },
}));

const baseRequest: VideoProcessingRequest = {
  sourceId: "source-video",
  sourceFilename: "source.mp4",
  inputUri: "file:///source.mp4",
  operation: "trim",
  profile: "compatibility",
  sourceDurationMs: 10_000,
  trim: {
    startMs: 0,
    endMs: 1000,
    reencode: true,
  },
};

describe("useVideoProcessing", () => {
  const renderReadyHook = async () => {
    const rendered = renderHook(() => useVideoProcessing());
    await waitFor(() => {
      expect(rendered.result.current.isEngineAvailable).toBe(true);
    });
    return rendered;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockIdSeq = 1;
    mockSettings.videoProcessingEnabled = true;
    mockEngine.getCapabilities.mockResolvedValue({
      available: true,
      encoderNames: ["h264_mediacodec", "mpeg4"],
      h264Encoders: ["h264_mediacodec", "mpeg4"],
      hevcEncoders: [],
      fallbackVideoEncoder: "h264_mediacodec",
    });
    useVideoTaskStore.setState({ tasks: [] });
    useFitsStore.setState({
      files: [
        {
          id: "source-video",
          filename: "source.mp4",
          filepath: "file:///source.mp4",
          fileSize: 1024,
          importDate: Date.now(),
          frameType: "unknown",
          isFavorite: false,
          tags: [],
          albumIds: [],
          sourceType: "video",
          sourceFormat: "mp4",
          mediaKind: "video",
          durationMs: 10_000,
        },
      ],
    });
  });

  it("runs queued task and imports derived output", async () => {
    mockEngine.run.mockImplementationOnce(async (_request, options) => {
      options?.onProgress?.({
        ratio: 0.5,
        processedMs: 5000,
        durationMs: 10_000,
      });
      return {
        outputUri: "file:///cache/processed.mp4",
        operation: "trim",
        sourceId: "source-video",
        processingTag: "trim",
      };
    });

    const { result } = await renderReadyHook();
    let taskId: string | null = null;
    await act(async () => {
      taskId = result.current.enqueueProcessingTask(baseRequest).taskId;
    });

    await waitFor(() => {
      const task = useVideoTaskStore.getState().tasks.find((item) => item.id === taskId);
      expect(task?.status).toBe("completed");
    });

    const derived = useFitsStore
      .getState()
      .files.find((file) => file.derivedFromId === "source-video" && file.processingTag === "trim");
    expect(derived).toBeTruthy();
    expect(derived?.mediaKind).toBe("video");
  });

  it("cancels running task", async () => {
    mockEngine.run.mockImplementationOnce(
      (_request: VideoProcessingRequest, options?: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          options?.signal?.addEventListener("abort", () => reject(new Error("cancelled")), {
            once: true,
          });
          setTimeout(
            () =>
              resolve({
                outputUri: "file:///cache/late.mp4",
                operation: "trim",
                sourceId: "source-video",
                processingTag: "trim",
              }),
            1000,
          );
        }),
    );

    const { result } = await renderReadyHook();
    let taskId: string | null = null;

    await act(async () => {
      taskId = result.current.enqueueProcessingTask(baseRequest).taskId;
    });
    await waitFor(() => {
      const task = useVideoTaskStore.getState().tasks.find((item) => item.id === taskId);
      expect(task).toBeTruthy();
    });

    act(() => {
      if (taskId) result.current.cancelTask(taskId);
    });

    await waitFor(() => {
      const task = useVideoTaskStore.getState().tasks.find((item) => item.id === taskId);
      expect(task?.status).toBe("cancelled");
    });
  });

  it("retries failed tasks", async () => {
    mockSettings.videoProcessingEnabled = false;
    useVideoTaskStore.setState({
      tasks: [
        {
          id: "task-failed",
          request: baseRequest,
          status: "failed",
          progress: 0.2,
          processedMs: 2000,
          durationMs: 10_000,
          createdAt: Date.now(),
          outputUris: [],
          outputFileIds: [],
          error: "boom",
          retries: 0,
          logLines: [],
        },
      ],
    });
    const { result } = await renderReadyHook();
    act(() => {
      result.current.retryTask("task-failed");
    });

    const task = useVideoTaskStore.getState().tasks.find((item) => item.id === "task-failed");
    expect(task?.status).toBe("pending");
    expect(task?.retries).toBe(1);
  });

  it("imports extract-audio outputs as audio media and stores output file ids", async () => {
    mockEngine.run.mockResolvedValueOnce({
      outputUri: "file:///cache/processed.m4a",
      operation: "extract-audio",
      sourceId: "source-video",
      processingTag: "extract-audio",
    });

    const { result } = await renderReadyHook();
    let taskId: string | null = null;
    await act(async () => {
      taskId = result.current.enqueueProcessingTask({
        ...baseRequest,
        operation: "extract-audio",
        extractAudio: { audioCodec: "aac", bitrateKbps: 160 },
      }).taskId;
    });

    await waitFor(() => {
      const task = useVideoTaskStore.getState().tasks.find((item) => item.id === taskId);
      expect(task?.status).toBe("completed");
      expect(task?.outputFileIds?.length).toBeGreaterThan(0);
    });

    const derived = useFitsStore
      .getState()
      .files.find((file) => file.derivedFromId === "source-video");
    expect(derived?.mediaKind).toBe("audio");
    expect(derived?.sourceType).toBe("audio");
  });

  it("returns explicit error when engine is unavailable", async () => {
    mockEngine.getCapabilities.mockResolvedValueOnce({
      available: false,
      encoderNames: [],
      h264Encoders: [],
      hevcEncoders: [],
      fallbackVideoEncoder: "h264_mediacodec",
    });
    const { result } = renderHook(() => useVideoProcessing());

    await waitFor(() => {
      expect(result.current.isEngineAvailable).toBe(false);
    });

    const enqueueResult = result.current.enqueueProcessingTask(baseRequest);
    expect(enqueueResult.taskId).toBeNull();
    expect(enqueueResult.errorCode).toBe("ffmpeg_executor_unavailable");
  });
});
