import { useGalleryStore } from "../useGalleryStore";

describe("useGalleryStore", () => {
  beforeEach(() => {
    useGalleryStore.setState({
      viewMode: "grid",
      gridColumns: 3,
      isSelectionMode: false,
      selectedIds: [],
      filterObject: "",
      filterFilter: "",
      filterDateRange: null,
      filterExptimeRange: null,
      filterInstrument: "",
      filterTelescope: "",
      filterFavoriteOnly: false,
      filterTag: "",
      filterFrameType: "",
      filterTargetId: "",
    });
  });

  it("has expected defaults", () => {
    const s = useGalleryStore.getState();
    expect(s.viewMode).toBe("grid");
    expect(s.gridColumns).toBe(3);
    expect(s.isSelectionMode).toBe(false);
    expect(s.selectedIds).toEqual([]);
  });

  it("updates view mode and grid columns", () => {
    useGalleryStore.getState().setViewMode("timeline");
    useGalleryStore.getState().setGridColumns(4);

    const s = useGalleryStore.getState();
    expect(s.viewMode).toBe("timeline");
    expect(s.gridColumns).toBe(4);
  });

  it("manages selection state", () => {
    const store = useGalleryStore.getState();

    store.setSelectionMode(true);
    expect(useGalleryStore.getState().isSelectionMode).toBe(true);
    expect(useGalleryStore.getState().selectedIds).toEqual([]);

    store.toggleSelection("a");
    store.toggleSelection("b");
    expect(useGalleryStore.getState().selectedIds).toEqual(["a", "b"]);

    store.toggleSelection("a");
    expect(useGalleryStore.getState().selectedIds).toEqual(["b"]);

    store.selectAll(["x", "y", "z"]);
    expect(useGalleryStore.getState().selectedIds).toEqual(["x", "y", "z"]);

    store.clearSelection();
    expect(useGalleryStore.getState().selectedIds).toEqual([]);
    expect(useGalleryStore.getState().isSelectionMode).toBe(false);
  });

  it("updates all filters and clearFilters resets them", () => {
    const store = useGalleryStore.getState();
    store.setFilterObject("M31");
    store.setFilterFilter("L");
    store.setFilterDateRange(["2025-01-01", "2025-01-31"]);
    store.setFilterExptimeRange([60, 600]);
    store.setFilterInstrument("ASI2600");
    store.setFilterTelescope("RC8");
    store.setFilterFavoriteOnly(true);
    store.setFilterTag("narrowband");
    store.setFilterFrameType("light");
    store.setFilterTargetId("target-1");

    let s = useGalleryStore.getState();
    expect(s.filterObject).toBe("M31");
    expect(s.filterFilter).toBe("L");
    expect(s.filterDateRange).toEqual(["2025-01-01", "2025-01-31"]);
    expect(s.filterExptimeRange).toEqual([60, 600]);
    expect(s.filterInstrument).toBe("ASI2600");
    expect(s.filterTelescope).toBe("RC8");
    expect(s.filterFavoriteOnly).toBe(true);
    expect(s.filterTag).toBe("narrowband");
    expect(s.filterFrameType).toBe("light");
    expect(s.filterTargetId).toBe("target-1");

    store.clearFilters();
    s = useGalleryStore.getState();
    expect(s.filterObject).toBe("");
    expect(s.filterFilter).toBe("");
    expect(s.filterDateRange).toBeNull();
    expect(s.filterExptimeRange).toBeNull();
    expect(s.filterInstrument).toBe("");
    expect(s.filterTelescope).toBe("");
    expect(s.filterFavoriteOnly).toBe(false);
    expect(s.filterTag).toBe("");
    expect(s.filterFrameType).toBe("");
    expect(s.filterTargetId).toBe("");
  });
});
