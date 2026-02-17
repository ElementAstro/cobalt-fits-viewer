import { findDuplicateImages } from "../albumDuplicateDetector";
import type { Album, FitsMetadata } from "../../fits/types";

const makeFile = (id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id,
    filename: `${id}.fits`,
    filepath: `/tmp/${id}.fits`,
    fileSize: 1024,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

const makeAlbum = (id: string, imageIds: string[]): Album =>
  ({
    id,
    name: `Album ${id}`,
    createdAt: 1,
    updatedAt: 1,
    imageIds,
    isSmart: false,
  }) as Album;

describe("albumDuplicateDetector.findDuplicateImages", () => {
  it("detects duplicates based on album.imageIds even when file.albumIds is stale", () => {
    const files = [makeFile("img-1", { albumIds: [] }), makeFile("img-2", { albumIds: ["old"] })];
    const albums = [
      makeAlbum("a", ["img-1", "img-2"]),
      makeAlbum("b", ["img-1"]),
      makeAlbum("c", ["img-2", "img-2"]),
    ];

    const duplicates = findDuplicateImages(files, albums);

    expect(duplicates).toHaveLength(2);
    expect(duplicates.find((d) => d.imageId === "img-1")).toEqual({
      imageId: "img-1",
      albumIds: ["a", "b"],
      albumNames: ["Album a", "Album b"],
    });
    expect(duplicates.find((d) => d.imageId === "img-2")).toEqual({
      imageId: "img-2",
      albumIds: ["a", "c"],
      albumNames: ["Album a", "Album c"],
    });
  });

  it("ignores album references to files that do not exist", () => {
    const files = [makeFile("img-1")];
    const albums = [makeAlbum("a", ["img-1", "img-missing"]), makeAlbum("b", ["img-missing"])];

    const duplicates = findDuplicateImages(files, albums);
    expect(duplicates).toEqual([]);
  });
});
