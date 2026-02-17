import { useTrashStore } from "../useTrashStore";
import type { FitsMetadata, TrashedFitsRecord } from "../../lib/fits/types";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeFile = (id: string): FitsMetadata => ({
  id,
  filename: `${id}.fits`,
  filepath: `file:///document/fits_files/${id}.fits`,
  fileSize: 100,
  importDate: 1,
  frameType: "light",
  isFavorite: false,
  tags: [],
  albumIds: [],
});

const makeTrash = (id: string, expireAt: number): TrashedFitsRecord => ({
  trashId: `trash-${id}`,
  file: makeFile(id),
  originalFilepath: `file:///document/fits_files/${id}.fits`,
  trashedFilepath: `file:///document/fits_trash/${id}.fits`,
  deletedAt: 1,
  expireAt,
  groupIds: [],
});

describe("useTrashStore", () => {
  beforeEach(() => {
    useTrashStore.setState({ items: [] });
  });

  it("adds and removes records by trash id", () => {
    useTrashStore.getState().addItems([makeTrash("a", 100), makeTrash("b", 100)]);
    expect(useTrashStore.getState().items).toHaveLength(2);

    useTrashStore.getState().removeByTrashIds(["trash-a"]);
    expect(useTrashStore.getState().items.map((item) => item.trashId)).toEqual(["trash-b"]);
  });

  it("returns records by trash ids", () => {
    useTrashStore.getState().addItems([makeTrash("a", 100), makeTrash("b", 100)]);
    const items = useTrashStore.getState().getByTrashIds(["trash-b"]);
    expect(items.map((item) => item.trashId)).toEqual(["trash-b"]);
  });

  it("clears expired records and returns removed items", () => {
    useTrashStore.getState().addItems([makeTrash("a", 10), makeTrash("b", 200)]);
    const removed = useTrashStore.getState().clearExpired(100);
    expect(removed.map((item) => item.trashId)).toEqual(["trash-a"]);
    expect(useTrashStore.getState().items.map((item) => item.trashId)).toEqual(["trash-b"]);
  });

  it("clearAll removes all trash items", () => {
    useTrashStore.getState().addItems([makeTrash("a", 10), makeTrash("b", 200)]);
    expect(useTrashStore.getState().items).toHaveLength(2);
    useTrashStore.getState().clearAll();
    expect(useTrashStore.getState().items).toEqual([]);
  });

  it("empty input paths are no-op", () => {
    useTrashStore.getState().addItems([makeTrash("a", 10)]);
    const before = useTrashStore.getState().items;

    useTrashStore.getState().addItems([]);
    useTrashStore.getState().removeByTrashIds([]);
    const found = useTrashStore.getState().getByTrashIds([]);
    const removed = useTrashStore.getState().clearExpired(1);

    expect(useTrashStore.getState().items).toEqual(before);
    expect(found).toEqual([]);
    expect(removed).toEqual([]);
  });
});
