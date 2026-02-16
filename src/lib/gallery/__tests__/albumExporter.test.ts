import { cleanupExport, exportAlbum, shareAlbumExport } from "../albumExporter";
import type { Album, FitsMetadata } from "../../fits/types";

const mockExistingPaths = new Set<string>();

jest.mock("expo-file-system", () => ({
  cacheDirectory: "/cache/",
  makeDirectoryAsync: jest.fn(async (path: string) => {
    mockExistingPaths.add(path);
  }),
  copyAsync: jest.fn(async ({ to }: { to: string }) => {
    mockExistingPaths.add(to);
  }),
  writeAsStringAsync: jest.fn(async (path: string) => {
    mockExistingPaths.add(path);
  }),
  getInfoAsync: jest.fn(async (path: string) => ({
    exists: mockExistingPaths.has(path),
  })),
  deleteAsync: jest.fn(async (path: string) => {
    mockExistingPaths.delete(path);
  }),
}));

const mockZip = jest.fn(async (_source: string, target: string) => {
  mockExistingPaths.add(target);
  return target;
});

jest.mock(
  "react-native-zip-archive",
  () => ({
    zip: mockZip,
  }),
  { virtual: true },
);

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

describe("albumExporter", () => {
  beforeEach(() => {
    mockExistingPaths.clear();
    mockZip.mockClear();
    jest.clearAllMocks();
  });

  it("should export album to a real zip file", async () => {
    const album: Album = {
      id: "a1",
      name: "M31 Set",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      imageIds: ["f1"],
      isSmart: false,
    };
    const files: FitsMetadata[] = [
      {
        id: "f1",
        filename: "m31.fits",
        filepath: "/mock/m31.fits",
        fileSize: 100,
        importDate: Date.now(),
        frameType: "light",
        isFavorite: false,
        tags: [],
        albumIds: [],
      },
    ];

    const statuses: string[] = [];
    const zipPath = await exportAlbum(album, files, (p) => statuses.push(p.status));

    expect(zipPath).toBeTruthy();
    expect(zipPath).toContain(".zip");
    expect(mockZip).toHaveBeenCalledTimes(1);
    expect(statuses).toContain("zipping");
    expect(statuses[statuses.length - 1]).toBe("complete");
  });

  it("should share generated zip file", async () => {
    const sharing = jest.requireMock("expo-sharing");
    const zipPath = "/cache/album.zip";
    mockExistingPaths.add(zipPath);

    const ok = await shareAlbumExport(zipPath);

    expect(ok).toBe(true);
    expect(sharing.shareAsync).toHaveBeenCalledWith(
      zipPath,
      expect.objectContaining({ mimeType: "application/zip" }),
    );
  });

  it("should cleanup exported zip file", async () => {
    const zipPath = "/cache/album.zip";
    mockExistingPaths.add(zipPath);

    await cleanupExport(zipPath);

    expect(mockExistingPaths.has(zipPath)).toBe(false);
  });
});
