import { act, renderHook, waitFor } from "@testing-library/react-native";
import { useAlbums } from "../useAlbums";
import { useAlbumStore } from "../../stores/useAlbumStore";
import { useFitsStore } from "../../stores/useFitsStore";
import type { Album, FitsMetadata } from "../../lib/fits/types";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeFile = (id: string, overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id,
    filename: `${id}.fits`,
    filepath: `/tmp/${id}.fits`,
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

const makeAlbum = (id: string, overrides: Partial<Album> = {}): Album =>
  ({
    id,
    name: `Album ${id}`,
    createdAt: 1,
    updatedAt: 1,
    imageIds: [],
    isSmart: false,
    ...overrides,
  }) as Album;

describe("useAlbums", () => {
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

  it("synchronizes file.albumIds from album image relationships", async () => {
    useFitsStore.setState({
      files: [makeFile("img-1", { albumIds: [] }), makeFile("img-2", { albumIds: ["stale"] })],
    });
    useAlbumStore.setState({
      albums: [makeAlbum("a", { imageIds: ["img-1", "img-2"] })],
    });

    renderHook(() => useAlbums());

    await waitFor(() => {
      const files = useFitsStore.getState().files;
      expect(files.find((f) => f.id === "img-1")?.albumIds).toEqual(["a"]);
      expect(files.find((f) => f.id === "img-2")?.albumIds).toEqual(["a"]);
    });
  });

  it("reconciles invalid album image references and cover ids against existing files", async () => {
    useFitsStore.setState({
      files: [makeFile("img-1")],
    });
    useAlbumStore.setState({
      albums: [makeAlbum("a", { imageIds: ["img-1", "img-missing"], coverImageId: "img-missing" })],
    });

    renderHook(() => useAlbums());

    await waitFor(() => {
      const album = useAlbumStore.getState().albums[0];
      expect(album.imageIds).toEqual(["img-1"]);
      expect(album.coverImageId).toBeUndefined();
    });
  });

  it("updates filteredAlbums when album search query changes", async () => {
    useAlbumStore.setState({
      albums: [
        makeAlbum("a", { name: "Nebula Night", updatedAt: 100 }),
        makeAlbum("b", { description: "Moon Session", updatedAt: 200 }),
      ],
    });

    const { result } = renderHook(() => useAlbums());
    expect(result.current.filteredAlbums.map((a) => a.id)).toEqual(["b", "a"]);

    act(() => {
      useAlbumStore.getState().setAlbumSearchQuery("moon");
    });

    await waitFor(() => {
      expect(result.current.filteredAlbums.map((a) => a.id)).toEqual(["b"]);
    });
  });

  it("computes duplicates from album.imageIds even when file.albumIds are stale", () => {
    useFitsStore.setState({
      files: [makeFile("img-1", { albumIds: [] }), makeFile("img-2", { albumIds: ["ghost"] })],
    });
    useAlbumStore.setState({
      albums: [
        makeAlbum("a", { imageIds: ["img-1", "img-2"] }),
        makeAlbum("b", { imageIds: ["img-1"] }),
      ],
    });

    const { result } = renderHook(() => useAlbums());
    expect(result.current.duplicateImages).toEqual([
      {
        imageId: "img-1",
        albumIds: ["a", "b"],
        albumNames: ["Album a", "Album b"],
      },
    ]);
  });

  it("respects album sort settings for filteredAlbums", () => {
    useAlbumStore.setState({
      albums: [makeAlbum("a", { name: "Zeta" }), makeAlbum("b", { name: "Alpha" })],
      albumSortBy: "name",
      albumSortOrder: "asc",
    });

    const { result } = renderHook(() => useAlbums());
    expect(result.current.filteredAlbums.map((a) => a.name)).toEqual(["Alpha", "Zeta"]);
  });
});
