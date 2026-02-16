import { getMergeAddedImageCount, getMergeTargetAlbums, getMergedImageCount } from "../albumMerge";
import type { Album } from "../../fits/types";

const makeAlbum = (id: string, overrides: Partial<Album> = {}): Album => ({
  id,
  name: `Album ${id}`,
  createdAt: 1,
  updatedAt: 1,
  imageIds: [],
  isSmart: false,
  ...overrides,
});

describe("albumMerge", () => {
  describe("getMergedImageCount", () => {
    it("returns deduplicated merged image count", () => {
      const source = makeAlbum("source", { imageIds: ["a", "b", "c"] });
      const target = makeAlbum("target", { imageIds: ["b", "c", "d"] });

      expect(getMergedImageCount(source, target)).toBe(4);
    });
  });

  describe("getMergeAddedImageCount", () => {
    it("returns count of source images that are not already in target", () => {
      const source = makeAlbum("source", { imageIds: ["a", "b", "c"] });
      const target = makeAlbum("target", { imageIds: ["b", "c", "d"] });

      expect(getMergeAddedImageCount(source, target)).toBe(1);
    });

    it("returns 0 when target already contains all source images", () => {
      const source = makeAlbum("source", { imageIds: ["a", "b"] });
      const target = makeAlbum("target", { imageIds: ["a", "b", "c"] });

      expect(getMergeAddedImageCount(source, target)).toBe(0);
    });
  });

  describe("getMergeTargetAlbums", () => {
    it("excludes source and smart albums, sorted by pinned then updatedAt desc", () => {
      const source = makeAlbum("source", { updatedAt: 100 });
      const albums = [
        source,
        makeAlbum("a", { updatedAt: 200 }),
        makeAlbum("pinned-old", { isPinned: true, updatedAt: 150 }),
        makeAlbum("pinned-new", { isPinned: true, updatedAt: 300 }),
        makeAlbum("smart", { isSmart: true, updatedAt: 999 }),
      ];

      const targets = getMergeTargetAlbums(albums, source, "");
      expect(targets.map((a) => a.id)).toEqual(["pinned-new", "pinned-old", "a"]);
    });

    it("supports query match on name, description and notes", () => {
      const source = makeAlbum("source");
      const albums = [
        source,
        makeAlbum("name", { name: "Nebula Nights" }),
        makeAlbum("desc", { description: "Moon session" }),
        makeAlbum("notes", { notes: "favorite target list" }),
      ];

      expect(getMergeTargetAlbums(albums, source, "nebula").map((a) => a.id)).toEqual(["name"]);
      expect(getMergeTargetAlbums(albums, source, "moon").map((a) => a.id)).toEqual(["desc"]);
      expect(getMergeTargetAlbums(albums, source, "target").map((a) => a.id)).toEqual(["notes"]);
    });

    it("trims query whitespace and still matches", () => {
      const source = makeAlbum("source");
      const albums = [source, makeAlbum("target", { name: "Andromeda Session" })];

      expect(getMergeTargetAlbums(albums, source, "  andromeda  ").map((a) => a.id)).toEqual([
        "target",
      ]);
    });
  });
});
