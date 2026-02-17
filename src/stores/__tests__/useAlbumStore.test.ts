import { useAlbumStore } from "../useAlbumStore";
import { useFitsStore } from "../useFitsStore";
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
    useFitsStore.setState({
      files: [],
      selectedIds: [],
      isSelectionMode: false,
      sortBy: "date",
      sortOrder: "desc",
      searchQuery: "",
      filterTags: [],
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

  describe("cover behavior", () => {
    it("clears cover when covered image is removed from album", () => {
      useAlbumStore.setState({
        albums: [makeAlbum("a", { imageIds: ["img-1", "img-2"], coverImageId: "img-1" })],
      });

      useAlbumStore.getState().removeImageFromAlbum("a", "img-1");
      const album = useAlbumStore.getState().albums[0];
      expect(album.imageIds).toEqual(["img-2"]);
      expect(album.coverImageId).toBeUndefined();
    });

    it("only sets cover when image exists in album", () => {
      useAlbumStore.setState({
        albums: [makeAlbum("a", { imageIds: ["img-1"] })],
      });

      useAlbumStore.getState().setCoverImage("a", "img-missing");
      expect(useAlbumStore.getState().albums[0].coverImageId).toBeUndefined();

      useAlbumStore.getState().setCoverImage("a", "img-1");
      expect(useAlbumStore.getState().albums[0].coverImageId).toBe("img-1");
    });
  });

  describe("reconcileWithFiles", () => {
    it("prunes invalid image references and fixes invalid cover", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("a", {
            imageIds: ["img-1", "img-2", "img-2", "img-ghost"],
            coverImageId: "img-ghost",
          }),
          makeAlbum("b", { imageIds: ["img-3"], coverImageId: "img-3" }),
        ],
      });

      const result = useAlbumStore.getState().reconcileWithFiles(["img-1", "img-2"]);
      const [albumA, albumB] = useAlbumStore.getState().albums;

      expect(result.prunedRefs).toBe(2);
      expect(result.coverFixes).toBe(2);
      expect(albumA.imageIds).toEqual(["img-1", "img-2"]);
      expect(albumA.coverImageId).toBeUndefined();
      expect(albumB.imageIds).toEqual([]);
      expect(albumB.coverImageId).toBeUndefined();
    });

    it("returns zero counts when no reconciliation is needed", () => {
      useAlbumStore.setState({
        albums: [makeAlbum("a", { imageIds: ["img-1"], coverImageId: "img-1" })],
      });

      const before = useAlbumStore.getState().albums;
      const result = useAlbumStore.getState().reconcileWithFiles(["img-1"]);
      const after = useAlbumStore.getState().albums;

      expect(result).toEqual({ prunedRefs: 0, coverFixes: 0 });
      expect(after).toEqual(before);
    });

    it("synchronizes file albumIds even when no album pruning is needed", () => {
      useFitsStore.setState({
        files: [
          {
            id: "img-1",
            filename: "img-1.fits",
            filepath: "/tmp/img-1.fits",
            fileSize: 100,
            importDate: 1,
            frameType: "light",
            isFavorite: false,
            tags: [],
            albumIds: ["stale"],
          },
        ],
      });
      useAlbumStore.setState({
        albums: [makeAlbum("a", { imageIds: ["img-1"], coverImageId: "img-1" })],
      });

      const result = useAlbumStore.getState().reconcileWithFiles(["img-1"]);
      expect(result).toEqual({ prunedRefs: 0, coverFixes: 0 });
      expect(useFitsStore.getState().files[0].albumIds).toEqual(["a"]);
    });
  });

  describe("file albumIds synchronization", () => {
    it("syncs file albumIds when images are added/removed from album directly via store", () => {
      useFitsStore.setState({
        files: [
          {
            id: "img-1",
            filename: "img-1.fits",
            filepath: "/tmp/img-1.fits",
            fileSize: 100,
            importDate: 1,
            frameType: "light",
            isFavorite: false,
            tags: [],
            albumIds: [],
          },
          {
            id: "img-2",
            filename: "img-2.fits",
            filepath: "/tmp/img-2.fits",
            fileSize: 100,
            importDate: 1,
            frameType: "light",
            isFavorite: false,
            tags: [],
            albumIds: [],
          },
        ],
      });

      useAlbumStore.setState({
        albums: [makeAlbum("a", { imageIds: [] })],
      });

      useAlbumStore.getState().addImagesToAlbum("a", ["img-1", "img-2"]);
      expect(useFitsStore.getState().files.find((f) => f.id === "img-1")?.albumIds).toEqual(["a"]);
      expect(useFitsStore.getState().files.find((f) => f.id === "img-2")?.albumIds).toEqual(["a"]);

      useAlbumStore.getState().removeImageFromAlbum("a", "img-1");
      expect(useFitsStore.getState().files.find((f) => f.id === "img-1")?.albumIds).toEqual([]);
      expect(useFitsStore.getState().files.find((f) => f.id === "img-2")?.albumIds).toEqual(["a"]);
    });

    it("syncs file albumIds when album is removed", () => {
      useFitsStore.setState({
        files: [
          {
            id: "img-1",
            filename: "img-1.fits",
            filepath: "/tmp/img-1.fits",
            fileSize: 100,
            importDate: 1,
            frameType: "light",
            isFavorite: false,
            tags: [],
            albumIds: ["a"],
          },
        ],
      });
      useAlbumStore.setState({
        albums: [makeAlbum("a", { imageIds: ["img-1"] })],
      });

      useAlbumStore.getState().removeAlbum("a");
      expect(useFitsStore.getState().files[0].albumIds).toEqual([]);
    });
  });

  describe("additional action coverage", () => {
    it("addAlbum and updateAlbum manage album records", () => {
      useAlbumStore.getState().addAlbum(makeAlbum("a", { imageIds: ["img-1"] }));
      expect(useAlbumStore.getState().albums).toHaveLength(1);

      const before = useAlbumStore.getState().albums[0].updatedAt;
      useAlbumStore.getState().updateAlbum("a", { description: "updated", name: "Renamed" });
      const album = useAlbumStore.getState().albums[0];
      expect(album.description).toBe("updated");
      expect(album.name).toBe("Renamed");
      expect(album.updatedAt).toBeGreaterThanOrEqual(before);
    });

    it("addImageToAlbum dedupes and syncs file albumIds", () => {
      useFitsStore.setState({
        files: [
          {
            id: "img-1",
            filename: "img-1.fits",
            filepath: "/tmp/img-1.fits",
            fileSize: 100,
            importDate: 1,
            frameType: "light",
            isFavorite: false,
            tags: [],
            albumIds: [],
          },
        ],
      });
      useAlbumStore.setState({ albums: [makeAlbum("a", { imageIds: [] })] });

      useAlbumStore.getState().addImageToAlbum("a", "img-1");
      useAlbumStore.getState().addImageToAlbum("a", "img-1");

      expect(useAlbumStore.getState().albums[0].imageIds).toEqual(["img-1"]);
      expect(useFitsStore.getState().files[0].albumIds).toEqual(["a"]);
    });

    it("updates smart rules, notes and pin state", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("a", {
            smartRules: [{ field: "object", operator: "contains", value: "M31" }],
          }),
        ],
      });

      useAlbumStore
        .getState()
        .updateSmartRules("a", [{ field: "filter", operator: "equals", value: "Ha" }]);
      useAlbumStore.getState().toggleAlbumPin("a");
      useAlbumStore.getState().updateAlbumNotes("a", "nightly plan");

      const album = useAlbumStore.getState().albums[0];
      expect(album.smartRules).toEqual([{ field: "filter", operator: "equals", value: "Ha" }]);
      expect(album.isPinned).toBe(true);
      expect(album.notes).toBe("nightly plan");
    });

    it("reorderAlbums, getters and sort setters work together", () => {
      useAlbumStore.setState({
        albums: [
          makeAlbum("a", { updatedAt: 100 }),
          makeAlbum("b", { updatedAt: 200 }),
          makeAlbum("c", { updatedAt: 300 }),
        ],
      });

      useAlbumStore.getState().reorderAlbums(["c", "a", "b"]);
      const sortedByOrder = useAlbumStore.getState().getSortedAlbums();
      expect(sortedByOrder.map((a) => a.id)).toEqual(["c", "a", "b"]);

      expect(useAlbumStore.getState().getAlbumById("a")?.id).toBe("a");
      expect(useAlbumStore.getState().getAlbumById("missing")).toBeUndefined();

      useAlbumStore.setState({
        albums: [
          makeAlbum("a", { imageIds: ["img-1"] }),
          makeAlbum("b", { imageIds: ["img-1", "img-2"] }),
        ],
      });
      expect(
        useAlbumStore
          .getState()
          .getAlbumsForImage("img-1")
          .map((a) => a.id)
          .sort(),
      ).toEqual(["a", "b"]);

      useAlbumStore.getState().setAlbumSortBy("imageCount");
      useAlbumStore.getState().setAlbumSortOrder("asc");
      expect(useAlbumStore.getState().albumSortBy).toBe("imageCount");
      expect(useAlbumStore.getState().albumSortOrder).toBe("asc");
    });
  });
});
