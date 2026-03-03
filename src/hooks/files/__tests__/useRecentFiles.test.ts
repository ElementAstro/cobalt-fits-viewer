import { renderHook } from "@testing-library/react-native";
import { useRecentFiles } from "../useRecentFiles";
import { useFitsStore } from "../../stores/useFitsStore";
import type { FitsMetadata } from "../../lib/fits/types";

jest.mock("../../lib/storage", () => ({
  zustandAsyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: `f-${Math.random().toString(36).slice(2, 6)}`,
    filename: "test.fits",
    filepath: "/tmp/test.fits",
    fileSize: 1024,
    importDate: Date.now(),
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

describe("useRecentFiles", () => {
  beforeEach(() => {
    useFitsStore.setState({ files: [] });
  });

  it("returns empty when no files", () => {
    const { result } = renderHook(() => useRecentFiles());
    expect(result.current.recentFiles).toHaveLength(0);
    expect(result.current.recentByPeriod).toHaveLength(0);
    expect(result.current.hasRecent).toBe(false);
  });

  it("returns files sorted by lastViewed descending", () => {
    const now = Date.now();
    useFitsStore.setState({
      files: [
        makeFile({ id: "old", importDate: now - 100000, lastViewed: now - 50000 }),
        makeFile({ id: "new", importDate: now - 200000, lastViewed: now - 1000 }),
        makeFile({ id: "mid", importDate: now - 150000, lastViewed: now - 20000 }),
      ],
    });
    const { result } = renderHook(() => useRecentFiles());
    expect(result.current.recentFiles.map((f) => f.id)).toEqual(["new", "mid", "old"]);
    expect(result.current.hasRecent).toBe(true);
  });

  it("falls back to importDate when lastViewed is undefined", () => {
    const now = Date.now();
    useFitsStore.setState({
      files: [
        makeFile({ id: "a", importDate: now - 5000 }),
        makeFile({ id: "b", importDate: now - 1000 }),
      ],
    });
    const { result } = renderHook(() => useRecentFiles());
    expect(result.current.recentFiles[0].id).toBe("b");
    expect(result.current.recentFiles[1].id).toBe("a");
  });

  it("limits to 20 files", () => {
    const now = Date.now();
    const files = Array.from({ length: 30 }, (_, i) =>
      makeFile({ id: `f${i}`, importDate: now - i * 1000 }),
    );
    useFitsStore.setState({ files });
    const { result } = renderHook(() => useRecentFiles());
    expect(result.current.recentFiles).toHaveLength(20);
  });

  it("groups files by period", () => {
    const todayStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate(),
    ).getTime();

    useFitsStore.setState({
      files: [
        makeFile({ id: "today", lastViewed: todayStart + 1000 }),
        makeFile({ id: "yesterday", lastViewed: todayStart - 3600000 }),
        makeFile({ id: "week", lastViewed: todayStart - 3 * 86400000 }),
        makeFile({ id: "old", lastViewed: todayStart - 30 * 86400000 }),
      ],
    });
    const { result } = renderHook(() => useRecentFiles());
    const periods = result.current.recentByPeriod;
    expect(periods.length).toBeGreaterThanOrEqual(1);
    const todayPeriod = periods.find((p) => p.key === "today");
    expect(todayPeriod?.files.map((f) => f.id)).toEqual(["today"]);
  });
});
