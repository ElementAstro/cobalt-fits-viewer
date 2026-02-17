import { act, renderHook } from "@testing-library/react-native";
import type { FitsMetadata } from "../../lib/fits/types";
import { useThumbnail } from "../useThumbnail";

const mockHasThumbnail = jest.fn();
const mockGetThumbnailPath = jest.fn();
const mockClearThumbnailCache = jest.fn();
const mockGetThumbnailCacheSize = jest.fn();
const mockGenerateAndSaveThumbnail = jest.fn();
const mockLoadFitsFromBuffer = jest.fn();
const mockGetImageDimensions = jest.fn();
const mockGetImagePixels = jest.fn();
const mockFitsToRGBA = jest.fn();
const mockParseRasterFromBuffer = jest.fn();

type FileEntry = { exists: boolean; buffer?: ArrayBuffer };
const mockFileMap: Record<string, FileEntry> = {};

jest.mock("../../lib/gallery/thumbnailCache", () => ({
  hasThumbnail: (...args: unknown[]) => mockHasThumbnail(...args),
  getThumbnailPath: (...args: unknown[]) => mockGetThumbnailPath(...args),
  clearThumbnailCache: (...args: unknown[]) => mockClearThumbnailCache(...args),
  getThumbnailCacheSize: (...args: unknown[]) => mockGetThumbnailCacheSize(...args),
  generateAndSaveThumbnail: (...args: unknown[]) => mockGenerateAndSaveThumbnail(...args),
}));

jest.mock("../../stores/useSettingsStore", () => ({
  useSettingsStore: jest.fn(),
}));

jest.mock("../../lib/fits/parser", () => ({
  loadFitsFromBuffer: (...args: unknown[]) => mockLoadFitsFromBuffer(...args),
  getImageDimensions: (...args: unknown[]) => mockGetImageDimensions(...args),
  getImagePixels: (...args: unknown[]) => mockGetImagePixels(...args),
}));

jest.mock("../../lib/converter/formatConverter", () => ({
  fitsToRGBA: (...args: unknown[]) => mockFitsToRGBA(...args),
}));

jest.mock("../../lib/image/rasterParser", () => ({
  parseRasterFromBuffer: (...args: unknown[]) => mockParseRasterFromBuffer(...args),
}));

jest.mock("expo-file-system", () => ({
  File: class {
    private filepath: string;
    constructor(filepath: string) {
      this.filepath = filepath;
    }
    get exists() {
      return !!mockFileMap[this.filepath]?.exists;
    }
    async arrayBuffer() {
      return mockFileMap[this.filepath]?.buffer ?? new ArrayBuffer(8);
    }
  },
}));

const { useSettingsStore } = jest.requireMock("../../stores/useSettingsStore") as {
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
    Object.keys(mockFileMap).forEach((k) => delete mockFileMap[k]);
    useSettingsStore.mockImplementation((selector: (s: unknown) => unknown) =>
      selector({
        thumbnailSize: 256,
        thumbnailQuality: 80,
        defaultStretch: "asinh",
        defaultColormap: "grayscale",
        defaultBlackPoint: 0,
        defaultWhitePoint: 1,
        defaultGamma: 1,
      }),
    );
    mockGetThumbnailPath.mockReturnValue("file:///thumb/f1.jpg");
    mockGetThumbnailCacheSize.mockReturnValue(1024);
    mockGenerateAndSaveThumbnail.mockImplementation((id: string) => `file:///thumb/${id}.jpg`);
    mockGetImageDimensions.mockReturnValue({ width: 2, height: 2 });
    mockGetImagePixels.mockResolvedValue(new Float32Array([0, 1, 2, 3]));
    mockFitsToRGBA.mockReturnValue(new Uint8ClampedArray([1, 2, 3, 4]));
    mockParseRasterFromBuffer.mockReturnValue({
      width: 2,
      height: 2,
      rgba: new Uint8Array([9, 8, 7, 6]),
    });
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

  it("regenerates thumbnails with fits/raster/fallback and missing files", async () => {
    const files = [
      makeFile({ id: "fits-ok", filepath: "/tmp/fits-ok.fits", sourceType: "fits" }),
      makeFile({ id: "fits-fallback", filepath: "/tmp/fits-fallback.fits", sourceType: "fits" }),
      makeFile({ id: "ras-ok", filepath: "/tmp/ras-ok.png", sourceType: "raster" }),
      makeFile({ id: "missing", filepath: "/tmp/missing.fits", sourceType: "fits" }),
    ];
    mockFileMap["/tmp/fits-ok.fits"] = { exists: true, buffer: new ArrayBuffer(8) };
    mockFileMap["/tmp/fits-fallback.fits"] = { exists: true, buffer: new ArrayBuffer(8) };
    mockFileMap["/tmp/ras-ok.png"] = { exists: true, buffer: new ArrayBuffer(8) };
    mockFileMap["/tmp/missing.fits"] = { exists: false };

    mockLoadFitsFromBuffer.mockImplementationOnce(() => ({ fits: true }));
    mockLoadFitsFromBuffer.mockImplementationOnce(() => {
      throw new Error("fits parse fail");
    });

    const { result } = renderHook(() => useThumbnail());

    await act(async () => {
      const out = await result.current.regenerateThumbnails(files);
      expect(out.success).toBe(3);
      expect(out.skipped).toBe(1);
      expect(out.results).toHaveLength(4);
    });

    expect(mockGenerateAndSaveThumbnail).toHaveBeenCalled();
    expect(result.current.isGenerating).toBe(false);
  });
});
