import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useStorageStats } from "../useStorageStats";

const mockGetStorageStats = jest.fn();
const mockGetFreeDiskBytes = jest.fn();
const mockGetThumbnailCacheSize = jest.fn();
const mockGetExportCacheSize = jest.fn();
const mockCleanExpiredExports = jest.fn();
const mockGetVideoProcessingCacheSize = jest.fn();
const mockClearVideoProcessingCache = jest.fn();
const mockGetPixelCacheStats = jest.fn();
const mockClearRuntimeCaches = jest.fn();

let mockFiles = [{ id: "f1", fileSize: 100 }];
let mockTrashItems = [{ file: { fileSize: 20 } }];

jest.mock("../../lib/utils/fileManager", () => ({
  getStorageStats: () => mockGetStorageStats(),
}));

jest.mock("../../lib/utils/diskSpace", () => ({
  getFreeDiskBytes: () => mockGetFreeDiskBytes(),
}));

jest.mock("../../lib/gallery/thumbnailCache", () => ({
  getThumbnailCacheSize: () => mockGetThumbnailCacheSize(),
}));

jest.mock("../../lib/utils/imageExport", () => ({
  getExportCacheSize: () => mockGetExportCacheSize(),
  cleanExpiredExports: () => mockCleanExpiredExports(),
}));

jest.mock("../../lib/video/engine/ffmpegAdapter", () => ({
  getVideoProcessingCacheSize: () => mockGetVideoProcessingCacheSize(),
  clearVideoProcessingCache: () => mockClearVideoProcessingCache(),
}));

jest.mock("../../lib/cache/pixelCache", () => ({
  getPixelCacheStats: () => mockGetPixelCacheStats(),
}));

jest.mock("../../lib/cache/runtimeCaches", () => ({
  clearRuntimeCaches: () => mockClearRuntimeCaches(),
}));

jest.mock("../../stores/useFitsStore", () => ({
  useFitsStore: (selector: (s: { files: typeof mockFiles }) => unknown) =>
    selector({ files: mockFiles }),
}));

jest.mock("../../stores/useTrashStore", () => ({
  useTrashStore: (selector: (s: { items: typeof mockTrashItems }) => unknown) =>
    selector({ items: mockTrashItems }),
}));

describe("useStorageStats", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFiles = [{ id: "f1", fileSize: 100 }];
    mockTrashItems = [{ file: { fileSize: 20 } }];
    mockGetStorageStats.mockReturnValue({ fitsCount: 1, fitsSize: 100 });
    mockGetFreeDiskBytes.mockResolvedValue(1024);
    mockGetThumbnailCacheSize.mockReturnValue(10);
    mockGetExportCacheSize.mockReturnValue({ totalBytes: 20, fileCount: 1 });
    mockGetVideoProcessingCacheSize.mockResolvedValue(30);
    mockGetPixelCacheStats.mockReturnValue({ entries: 1, totalBytes: 40 });
  });

  it("refreshes when files and trash items change", async () => {
    const { rerender } = renderHook(() => useStorageStats());

    await waitFor(() => {
      expect(mockGetStorageStats).toHaveBeenCalledTimes(1);
    });

    mockFiles = [...mockFiles, { id: "f2", fileSize: 200 }];
    mockGetStorageStats.mockReturnValue({ fitsCount: 2, fitsSize: 300 });
    rerender(undefined);

    await waitFor(() => {
      expect(mockGetStorageStats).toHaveBeenCalledTimes(2);
    });

    mockTrashItems = [...mockTrashItems, { file: { fileSize: 30 } }];
    rerender(undefined);

    await waitFor(() => {
      expect(mockGetStorageStats).toHaveBeenCalledTimes(3);
    });
  });

  it("clearPixelCache delegates to runtime cache clear and refreshes", async () => {
    const { result } = renderHook(() => useStorageStats());
    await waitFor(() => {
      expect(mockGetStorageStats).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      result.current.clearPixelCache();
    });

    expect(mockClearRuntimeCaches).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(mockGetStorageStats).toHaveBeenCalledTimes(2);
    });
  });
});
