import {
  buildImageToAlbumMap,
  computeAlbumFileConsistencyPatches,
  computeFileAlbumIdPatches,
  reconcileAlbumsWithValidFiles,
} from "../albumSync";
import type { Album, FitsMetadata } from "../../fits/types";

const makeAlbum = (id: string, imageIds: string[], overrides: Partial<Album> = {}): Album =>
  ({
    id,
    name: `Album ${id}`,
    createdAt: 1,
    updatedAt: 1,
    imageIds,
    isSmart: false,
    ...overrides,
  }) as Album;

const makeFile = (id: string, albumIds: string[] = []): FitsMetadata =>
  ({
    id,
    filename: `${id}.fits`,
    filepath: `/tmp/${id}.fits`,
    fileSize: 100,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds,
  }) as FitsMetadata;

describe("albumSync", () => {
  it("buildImageToAlbumMap aggregates album relationships with stable order", () => {
    const albums = [makeAlbum("a", ["img-1", "img-2", "img-2"]), makeAlbum("b", ["img-2"])];
    const map = buildImageToAlbumMap(albums);

    expect(map.get("img-1")).toEqual(["a"]);
    expect(map.get("img-2")).toEqual(["a", "b"]);
  });

  it("computeFileAlbumIdPatches only returns files with changed albumIds", () => {
    const files = [makeFile("img-1", ["a"]), makeFile("img-2", ["x"]), makeFile("img-3", ["z"])];
    const imageToAlbumMap = new Map<string, string[]>([
      ["img-1", ["a"]],
      ["img-2", ["a", "b"]],
    ]);

    const patches = computeFileAlbumIdPatches(files, imageToAlbumMap);

    expect(patches).toEqual([
      { fileId: "img-2", albumIds: ["a", "b"] },
      { fileId: "img-3", albumIds: [] },
    ]);
  });

  it("computeAlbumFileConsistencyPatches uses albums as source of truth", () => {
    const files = [makeFile("img-1", []), makeFile("img-2", ["legacy"]), makeFile("img-3", ["z"])];
    const albums = [makeAlbum("a", ["img-1", "img-2"]), makeAlbum("b", ["img-1"])];

    const patches = computeAlbumFileConsistencyPatches(files, albums);
    expect(patches).toEqual([
      { fileId: "img-1", albumIds: ["a", "b"] },
      { fileId: "img-2", albumIds: ["a"] },
      { fileId: "img-3", albumIds: [] },
    ]);
  });

  it("reconcileAlbumsWithValidFiles prunes invalid refs and clears invalid cover", () => {
    const albums = [
      makeAlbum("a", ["img-1", "img-2", "img-2", "ghost"], { coverImageId: "ghost" }),
      makeAlbum("b", ["img-3"], { coverImageId: "img-3" }),
    ];

    const result = reconcileAlbumsWithValidFiles(albums, new Set(["img-1", "img-2"]));

    expect(result.prunedRefs).toBe(2);
    expect(result.coverFixes).toBe(2);
    expect(result.albums[0].imageIds).toEqual(["img-1", "img-2"]);
    expect(result.albums[0].coverImageId).toBeUndefined();
    expect(result.albums[1].imageIds).toEqual([]);
    expect(result.albums[1].coverImageId).toBeUndefined();
  });
});
