import type { Album, FitsMetadata } from "../../fits/types";
import {
  calculateAlbumStatistics,
  formatExposureTime,
  formatFileSize,
  getFrameTypeLabel,
} from "../albumStatistics";

const makeAlbum = (imageIds: string[]): Album =>
  ({
    id: "album-1",
    name: "Album 1",
    createdAt: 1,
    updatedAt: 1,
    imageIds,
    isSmart: false,
  }) as Album;

const makeFile = (overrides: Partial<FitsMetadata>): FitsMetadata =>
  ({
    id: "f1",
    filename: "f1.fits",
    filepath: "/tmp/f1.fits",
    fileSize: 1000,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

describe("albumStatistics", () => {
  it("calculates statistics for files in album only", () => {
    const album = makeAlbum(["f1", "f2"]);
    const files = [
      makeFile({
        id: "f1",
        frameType: "light",
        exptime: 60,
        filter: "Ha",
        fileSize: 1024,
        dateObs: "2024-01-01T10:00:00Z",
      }),
      makeFile({
        id: "f2",
        frameType: "dark",
        exptime: 120,
        filter: undefined,
        fileSize: 2048,
        dateObs: "2024-01-02T10:00:00Z",
      }),
      makeFile({
        id: "f3",
        frameType: "flat",
        exptime: 30,
        filter: "OIII",
        fileSize: 4096,
        dateObs: "2024-01-03T10:00:00Z",
      }),
    ];

    const stats = calculateAlbumStatistics(album, files);
    expect(stats.albumId).toBe("album-1");
    expect(stats.totalExposure).toBe(180);
    expect(stats.totalFileSize).toBe(3072);
    expect(stats.frameBreakdown).toEqual({
      light: 1,
      dark: 1,
    });
    expect(stats.filterBreakdown).toEqual({
      Ha: 1,
      "No Filter": 1,
    });
    expect(stats.dateRange).toEqual(["2024-01-01T10:00:00Z", "2024-01-02T10:00:00Z"]);
  });

  it("returns null date range when album files do not contain dateObs", () => {
    const album = makeAlbum(["f1"]);
    const files = [makeFile({ id: "f1", dateObs: undefined })];
    const stats = calculateAlbumStatistics(album, files);
    expect(stats.dateRange).toBeNull();
  });

  it("formats exposure time and file sizes", () => {
    expect(formatExposureTime(59)).toBe("59s");
    expect(formatExposureTime(61)).toBe("1m");
    expect(formatExposureTime(3660)).toBe("1h 1m");
    expect(formatExposureTime(3600)).toBe("1h");

    expect(formatFileSize(1000)).toBe("1000 B");
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(1024 * 1024)).toBe("1.0 MB");
    expect(formatFileSize(1024 * 1024 * 1024)).toBe("1.00 GB");
  });

  it("returns frame type labels", () => {
    expect(getFrameTypeLabel("light")).toBe("Light");
    expect(getFrameTypeLabel("dark")).toBe("Dark");
    expect(getFrameTypeLabel("flat")).toBe("Flat");
    expect(getFrameTypeLabel("bias")).toBe("Bias");
    expect(getFrameTypeLabel("darkflat")).toBe("Dark Flat");
    expect(getFrameTypeLabel("unknown")).toBe("Unknown");
    expect(getFrameTypeLabel("custom-frame")).toBe("custom-frame");
  });
});
