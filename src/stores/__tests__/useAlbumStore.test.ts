import { useAlbumStore } from "../useAlbumStore";
import type { Album } from "../../lib/fits/types";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeAlbum = (id: string, overrides: Partial<Album> = {}): Album => ({
  id,
  name: `Album ${id}`,
  createdAt: 1,
  updatedAt: 1,
  imageIds: [],
  isSmart: false,
  ...overrides,
});

describe("useAlbumStore", () => {
  beforeEach(() => {
    useAlbumStore.setState({
      albums: [],
      albumSearchQuery: "",
      albumSortBy: "date",
      albumSortOrder: "desc",
    });
  });

  describe("getFilteredAlbums", () => {
    it("sorts by date correctly and does not mutate original album state order", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("a", { updatedAt: 200 }),
          makeAlbum("b", { updatedAt: 100 }),
          makeAlbum("c", { updatedAt: 300 }),
        ],
        albumSortBy: "date",
        albumSortOrder: "desc",
      });

      const filtered = useAlbumStore.getState().getFilteredAlbums();
      expect(filtered.map((a) => a.id)).toEqual(["c", "a", "b"]);
      expect(useAlbumStore.getState().albums.map((a) => a.id)).toEqual(["a", "b", "c"]);
    });

    it("supports ascending date sort", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("a", { updatedAt: 200 }),
          makeAlbum("b", { updatedAt: 100 }),
          makeAlbum("c", { updatedAt: 300 }),
        ],
        albumSortBy: "date",
        albumSortOrder: "asc",
      });

      const filtered = useAlbumStore.getState().getFilteredAlbums();
      expect(filtered.map((a) => a.id)).toEqual(["b", "a", "c"]);
    });

    it("sorts by imageCount descending correctly", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("a", { imageIds: ["1"] }),
          makeAlbum("b", { imageIds: ["1", "2", "3"] }),
          makeAlbum("c", { imageIds: ["1", "2"] }),
        ],
        albumSortBy: "imageCount",
        albumSortOrder: "desc",
      });

      const filtered = useAlbumStore.getState().getFilteredAlbums();
      expect(filtered.map((a) => a.id)).toEqual(["b", "c", "a"]);
    });

    it("filters by name, description and notes", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("a", { name: "Nebula Night" }),
          makeAlbum("b", { description: "Moon session" }),
          makeAlbum("c", { notes: "favorite target list" }),
        ],
      });

      useAlbumStore.getState().setAlbumSearchQuery("target");
      const filtered = useAlbumStore.getState().getFilteredAlbums();
      expect(filtered.map((a) => a.id)).toEqual(["c"]);
    });

    it("always keeps pinned albums before unpinned albums", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("unpinned-z", { name: "Zulu", updatedAt: 999 }),
          makeAlbum("pinned-a", { name: "Alpha", isPinned: true, updatedAt: 1 }),
          makeAlbum("unpinned-a", { name: "Alpha", updatedAt: 100 }),
        ],
        albumSortBy: "name",
        albumSortOrder: "asc",
      });

      const filtered = useAlbumStore.getState().getFilteredAlbums();
      expect(filtered.map((a) => a.id)).toEqual(["pinned-a", "unpinned-a", "unpinned-z"]);
    });
  });

  describe("mergeAlbums", () => {
    it("merges source into target with deduped images and removes source album", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("source", { imageIds: ["img-1", "img-2"], coverImageId: "img-2" }),
          makeAlbum("target", { imageIds: ["img-2", "img-3"] }),
        ],
      });

      const merged = useAlbumStore.getState().mergeAlbums("source", "target");
      const albums = useAlbumStore.getState().albums;

      expect(merged).toBe(true);
      expect(albums).toHaveLength(1);
      expect(albums[0].id).toBe("target");
      expect(albums[0].imageIds).toEqual(["img-2", "img-3", "img-1"]);
      expect(albums[0].coverImageId).toBe("img-2");
    });

    it("keeps target cover image when target already has one", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("source", { imageIds: ["img-1"], coverImageId: "img-1" }),
          makeAlbum("target", { imageIds: ["img-2"], coverImageId: "img-2" }),
        ],
      });

      const merged = useAlbumStore.getState().mergeAlbums("source", "target");
      expect(merged).toBe(true);
      expect(useAlbumStore.getState().albums[0].coverImageId).toBe("img-2");
    });

    it("does nothing for smart albums or same source/target album", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("smart", { isSmart: true, imageIds: ["img-1"] }),
          makeAlbum("normal", { imageIds: ["img-2"] }),
        ],
      });

      const mergeSmart = useAlbumStore.getState().mergeAlbums("smart", "normal");
      expect(mergeSmart).toBe(false);
      expect(useAlbumStore.getState().albums.map((a) => a.id)).toEqual(["smart", "normal"]);

      const mergeSame = useAlbumStore.getState().mergeAlbums("normal", "normal");
      expect(mergeSame).toBe(false);
      expect(useAlbumStore.getState().albums.map((a) => a.id)).toEqual(["smart", "normal"]);
    });

    it("returns false when source or target album is missing", () => {
      useAlbumStore.setState({
        albums: [makeAlbum("a"), makeAlbum("b")],
      });

      expect(useAlbumStore.getState().mergeAlbums("missing", "b")).toBe(false);
      expect(useAlbumStore.getState().mergeAlbums("a", "missing")).toBe(false);
      expect(useAlbumStore.getState().albums.map((a) => a.id)).toEqual(["a", "b"]);
    });
  });
});
