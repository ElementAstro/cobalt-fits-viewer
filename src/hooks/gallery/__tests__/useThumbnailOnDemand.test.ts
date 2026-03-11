import { renderHook, act } from "@testing-library/react-native";
import type { FitsMetadata } from "../../../lib/fits/types";
import { useThumbnailOnDemand } from "../useThumbnailOnDemand";

const mockUpdateFile = jest.fn();
const mockResolveThumbnailUri = jest.fn();
const mockEnqueueThumbnailRegeneration = jest.fn();
const mockClearThumbnailSchedulerFailures = jest.fn();
const mockGetThumbnailSchedulerMetrics = jest.fn(() => ({
  activeCount: 0,
  inFlightCount: 0,
  queuedCount: 0,
  queuedVisible: 0,
  queuedNearby: 0,
  queuedBackground: 0,
  dedupeHitCount: 0,
  enqueueCount: 0,
  startCount: 0,
  completeCount: 0,
  failureCount: 0,
  cooldownSkipCount: 0,
}));

jest.mock("../../../stores/files/useFitsStore", () => ({
  useFitsStore: (selector: (state: { updateFile: typeof mockUpdateFile }) => unknown) =>
    selector({ updateFile: mockUpdateFile }),
}));

jest.mock("../../../lib/gallery/thumbnailCache", () => ({
  resolveThumbnailUri: (fileId: string, thumbnailUri?: string) =>
    mockResolveThumbnailUri(fileId, thumbnailUri),
}));

jest.mock("../../../lib/gallery/thumbnailScheduler", () => ({
  enqueueThumbnailRegeneration: (
    file: FitsMetadata,
    options?: { priority?: string; reason?: string },
  ) => mockEnqueueThumbnailRegeneration(file, options),
  clearThumbnailSchedulerFailures: () => mockClearThumbnailSchedulerFailures(),
  getThumbnailSchedulerMetrics: () => mockGetThumbnailSchedulerMetrics(),
}));

function makeFile(overrides: Partial<FitsMetadata> = {}): FitsMetadata {
  return {
    id: "f1",
    filename: "f1.fits",
    filepath: "file:///f1.fits",
    fileSize: 1,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    sourceType: "fits",
    ...overrides,
  };
}

describe("useThumbnailOnDemand", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveThumbnailUri.mockReturnValue(null);
    mockEnqueueThumbnailRegeneration.mockResolvedValue({
      fileId: "f1",
      uri: "file:///generated/f1.jpg",
    });
  });

  it("returns existing thumbnail URI without enqueueing", async () => {
    mockResolveThumbnailUri.mockReturnValue("file:///cached/f1.jpg");
    const { result } = renderHook(() => useThumbnailOnDemand());

    let output: { fileId: string; uri: string | null } | undefined;
    await act(async () => {
      output = await result.current.requestThumbnail(makeFile(), "visible");
    });

    expect(output).toEqual({ fileId: "f1", uri: "file:///cached/f1.jpg" });
    expect(mockEnqueueThumbnailRegeneration).not.toHaveBeenCalled();
    expect(mockUpdateFile).not.toHaveBeenCalled();
  });

  it("enqueues by priority and writes generated thumbnail URI", async () => {
    const file = makeFile();
    const { result } = renderHook(() => useThumbnailOnDemand());

    await act(async () => {
      await result.current.requestThumbnail(file, "nearby");
    });

    expect(mockEnqueueThumbnailRegeneration).toHaveBeenCalledWith(file, {
      priority: "nearby",
      reason: "gallery-on-demand",
    });
    expect(mockUpdateFile).toHaveBeenCalledWith("f1", { thumbnailUri: "file:///generated/f1.jpg" });
  });

  it("skips audio files", async () => {
    const { result } = renderHook(() => useThumbnailOnDemand());
    const audio = makeFile({
      id: "a1",
      sourceType: "audio",
      filepath: "file:///a1.m4a",
      filename: "a1.m4a",
    });

    let output: { fileId: string; uri: string | null } | undefined;
    await act(async () => {
      output = await result.current.requestThumbnail(audio, "visible");
    });

    expect(output).toEqual({ fileId: "a1", uri: null });
    expect(mockEnqueueThumbnailRegeneration).not.toHaveBeenCalled();
  });

  it("exposes scheduler metrics and reset hook", () => {
    const { result } = renderHook(() => useThumbnailOnDemand());

    const metrics = result.current.getMetrics();
    expect(metrics).toEqual(
      expect.objectContaining({
        activeCount: 0,
        queuedCount: 0,
      }),
    );

    act(() => {
      result.current.resetFailed();
    });
    expect(mockClearThumbnailSchedulerFailures).toHaveBeenCalled();
  });
});
