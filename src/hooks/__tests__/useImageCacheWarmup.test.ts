import { act, renderHook } from "@testing-library/react-native";
import { useImageCacheWarmup } from "../useImageCacheWarmup";

const mockWarmImageCachesFromFile = jest.fn();

jest.mock("../../lib/cache/imageLoadWorkflow", () => ({
  warmImageCachesFromFile: (...args: unknown[]) => mockWarmImageCachesFromFile(...args),
}));

jest.mock("../../lib/import/imageParsePipeline", () => ({
  isProcessableImageMedia: jest.fn(() => true),
}));

describe("useImageCacheWarmup", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockWarmImageCachesFromFile.mockResolvedValue("cache-key");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("skips repeated warm-up calls within the recent warm-up window", async () => {
    const current = {
      id: "current",
      filepath: "/tmp/current.fits",
      fileSize: 10,
      filename: "current.fits",
      mediaKind: "image",
      sourceType: "fits",
    } as any;
    const next = {
      id: "next",
      filepath: "/tmp/next.fits",
      fileSize: 12,
      filename: "next.fits",
      mediaKind: "image",
      sourceType: "fits",
    } as any;

    const { rerender } = renderHook(
      (props: { startWhen: boolean }) =>
        useImageCacheWarmup({
          enabled: true,
          currentFile: current,
          allFiles: [current, next],
          radius: 1,
          startWhen: props.startWhen,
        }),
      {
        initialProps: { startWhen: true },
      },
    );

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWarmImageCachesFromFile).toHaveBeenCalledTimes(1);

    rerender({ startWhen: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWarmImageCachesFromFile).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(15_001);
    });
    rerender({ startWhen: true });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockWarmImageCachesFromFile).toHaveBeenCalledTimes(2);
  });
});
