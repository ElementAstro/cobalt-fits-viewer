import { renderHook } from "@testing-library/react-native";
import { useGallery } from "../useGallery";
import { useFitsStore } from "../../stores/useFitsStore";
import { useGalleryStore } from "../../stores/useGalleryStore";
import type { FitsMetadata } from "../../lib/fits/types";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

const makeFile = (overrides: Partial<FitsMetadata>): FitsMetadata =>
  ({
    id: "f1",
    filepath: "/tmp/a.fits",
    filename: "a.fits",
    fileSize: 1,
    dateObs: "2025-01-01T01:00:00.000Z",
    importDate: 1,
    object: "M31",
    filter: "L",
    frameType: "light",
    tags: [],
    isFavorite: false,
    albumIds: [],
    sourceType: "fits",
    sourceFormat: "fits",
    ...overrides,
  }) as FitsMetadata;

describe("useGallery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFitsStore.setState({
      files: [
        makeFile({ id: "f1", object: "M31", filter: "L", tags: ["wide"], targetId: "t1" }),
        makeFile({
          id: "f2",
          filename: "b.fits",
          filepath: "/tmp/b.fits",
          object: "M42",
          filter: "R",
          dateObs: "2025-01-05T01:00:00.000Z",
          isFavorite: true,
          tags: ["narrow"],
          frameType: "flat",
          targetId: "t2",
        }),
      ],
    });
    useGalleryStore.setState({
      viewMode: "grid",
      gridColumns: 3,
      filterObject: "",
      filterFilter: "",
      filterDateRange: null,
      filterFavoriteOnly: false,
      filterTag: "",
      filterFrameType: "",
      filterTargetId: "",
    });
  });

  it("applies all filters and keeps counts", () => {
    useGalleryStore.setState({
      filterObject: "M42",
      filterFilter: "R",
      filterDateRange: ["2025-01-04", "2025-01-06"],
      filterFavoriteOnly: true,
      filterTag: "narrow",
      filterFrameType: "flat",
      filterTargetId: "t2",
    });

    const { result } = renderHook(() => useGallery());

    expect(result.current.totalCount).toBe(2);
    expect(result.current.filteredCount).toBe(1);
    expect(result.current.files.map((f) => f.id)).toEqual(["f2"]);
  });

  it("exposes grouping and search based on filtered files", () => {
    useGalleryStore.setState({ filterObject: "M31" });
    const { result } = renderHook(() => useGallery());

    expect(Object.keys(result.current.groupedByDate).length).toBeGreaterThan(0);
    expect(Object.keys(result.current.groupedByObject).length).toBeGreaterThan(0);
    expect(Object.keys(result.current.groupedByLocation).length).toBeGreaterThanOrEqual(0);

    const matched = result.current.search("M31");
    expect(matched.length).toBe(1);
    expect(matched[0].id).toBe("f1");
  });
});
