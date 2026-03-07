import { act, renderHook } from "@testing-library/react-native";
import type { FitsMetadata } from "../../../lib/fits/types";
import { useThumbnail } from "../useThumbnail";

const mockHasThumbnail = jest.fn();
const mockGetThumbnailPath = jest.fn();
const mockClearThumbnailCache = jest.fn();
const mockGetThumbnailCacheSize = jest.fn();
const mockSaveThumbnailFromRGBA = jest.fn();
const mockSaveThumbnailFromVideo = jest.fn();
const mockRegenerateFileThumbnail = jest.fn();

jest.mock("../../../lib/gallery/thumbnailCache", () => ({
  hasThumbnail: (...args: unknown[]) => mockHasThumbnail(...args),
  getThumbnailPath: (...args: unknown[]) => mockGetThumbnailPath(...args),
  clearThumbnailCache: (...args: unknown[]) => mockClearThumbnailCache(...args),
  getThumbnailCacheSize: (...args: unknown[]) => mockGetThumbnailCacheSize(...args),
}));

jest.mock("../../../lib/gallery/thumbnailWorkflow", () => ({
  saveThumbnailFromRGBA: (...args: unknown[]) => mockSaveThumbnailFromRGBA(...args),
  saveThumbnailFromVideo: (...args: unknown[]) => mockSaveThumbnailFromVideo(...args),
}));

jest.mock("../../../lib/gallery/thumbnailGenerator", () => ({
  regenerateFileThumbnail: (...args: unknown[]) => mockRegenerateFileThumbnail(...args),
}));

jest.mock("../../../stores/app/useSettingsStore", () => ({
  useSettingsStore: jest.fn(),
}));

const { useSettingsStore } = jest.requireMock("../../../stores/app/useSettingsStore") as {
  useSettingsStore: jest.Mock;
};

const makeFile = (overrides: Partial<FitsMetadata>): FitsMetadata =>
  ({
    id: "f1",
    filepath: "/tmp/a.fits",
    filename: "a.fits",
    fileSize: 1,
    importDate: 1,
    tags: [],
    isFavorite: false,
    albumIds: [],
    sourceType: "fits",
    sourceFormat: "fits",
    ...overrides,
  }) as FitsMetadata;

describe("useThumbnail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useSettingsStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        thumbnailSize: 256,
        thumbnailQuality: 80,
        thumbnailCacheMaxSizeMB: 200,
        videoThumbnailTimeMs: 1000,
      }),
    );
    mockGetThumbnailPath.mockReturnValue("file:///thumb/f1.jpg");
    mockGetThumbnailCacheSize.mockReturnValue(1024);
    mockSaveThumbnailFromRGBA.mockImplementation((id: string) => `file:///thumb/${id}.jpg`);
    mockSaveThumbnailFromVideo.mockImplementation((id: string) => `file:///thumb/${id}.jpg`);
    mockRegenerateFileThumbnail.mockImplementation((file: FitsMetadata) =>
      Promise.resolve({ fileId: file.id, uri: `file:///thumb/${file.id}.jpg` }),
    );
  });

  it("handles cache hit/miss and sync operations", () => {
    const { result } = renderHook(() => useThumbnail());
    mockHasThumbnail.mockReturnValueOnce(true).mockReturnValueOnce(false);

    expect(result.current.getThumbnailUri("f1")).toBe("file:///thumb/f1.jpg");
    expect(result.current.getThumbnailUri("f2")).toBeNull();

    act(() => {
      const uri = result.current.generateThumbnail("f1", new Uint8ClampedArray([1, 2, 3, 4]), 1, 1);
      expect(uri).toBe("file:///thumb/f1.jpg");
      result.current.clearCache();
    });
    expect(mockClearThumbnailCache).toHaveBeenCalled();
    expect(result.current.getCacheSize()).toBe(1024);
  });

  it("regenerates thumbnails via regenerateFileThumbnail and tracks progress", async () => {
    const files = [
      makeFile({ id: "f-ok", filepath: "/tmp/f-ok.fits", sourceType: "fits" }),
      makeFile({ id: "f-skip", filepath: "/tmp/f-skip.fits", sourceType: "fits" }),
    ];
    mockRegenerateFileThumbnail
      .mockResolvedValueOnce({ fileId: "f-ok", uri: "file:///thumb/f-ok.jpg" })
      .mockResolvedValueOnce({ fileId: "f-skip", uri: null });

    const { result } = renderHook(() => useThumbnail());
    expect(result.current.regenerateProgress).toBeNull();

    await act(async () => {
      const out = await result.current.regenerateThumbnails(files);
      expect(out.success).toBe(1);
      expect(out.skipped).toBe(1);
      expect(out.results).toHaveLength(2);
    });

    expect(mockRegenerateFileThumbnail).toHaveBeenCalledTimes(2);
    expect(result.current.regenerateProgress).toBeNull();
    expect(result.current.isGenerating).toBe(false);
  });

  it("regenerateOneThumbnail delegates to regenerateFileThumbnail", async () => {
    const file = makeFile({ id: "single", filepath: "/tmp/single.fits" });

    const { result } = renderHook(() => useThumbnail());

    let output: { fileId: string; uri: string | null } | undefined;
    await act(async () => {
      output = await result.current.regenerateOneThumbnail(file);
    });

    expect(mockRegenerateFileThumbnail).toHaveBeenCalledWith(file);
    expect(output?.fileId).toBe("single");
    expect(output?.uri).toBe("file:///thumb/single.jpg");
  });
});
