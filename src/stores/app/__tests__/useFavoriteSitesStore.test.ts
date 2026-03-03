import { useFavoriteSitesStore } from "../useFavoriteSitesStore";

jest.mock("../../lib/storage", () => ({
  zustandAsyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

beforeEach(() => {
  useFavoriteSitesStore.setState({ sites: [] });
});

describe("useFavoriteSitesStore", () => {
  it("starts with empty sites", () => {
    expect(useFavoriteSitesStore.getState().sites).toEqual([]);
  });

  it("addSite appends a new site with generated id and createdAt", () => {
    useFavoriteSitesStore.getState().addSite({
      label: "Dark Sky Park",
      latitude: 31.123,
      longitude: 121.456,
    });

    const { sites } = useFavoriteSitesStore.getState();
    expect(sites).toHaveLength(1);
    expect(sites[0].label).toBe("Dark Sky Park");
    expect(sites[0].latitude).toBe(31.123);
    expect(sites[0].longitude).toBe(121.456);
    expect(sites[0].id).toBeTruthy();
    expect(sites[0].createdAt).toBeGreaterThan(0);
  });

  it("removeSite removes by id", () => {
    useFavoriteSitesStore.getState().addSite({
      label: "Site A",
      latitude: 0,
      longitude: 0,
    });
    useFavoriteSitesStore.getState().addSite({
      label: "Site B",
      latitude: 1,
      longitude: 1,
    });

    const id = useFavoriteSitesStore.getState().sites[0].id;
    useFavoriteSitesStore.getState().removeSite(id);

    const { sites } = useFavoriteSitesStore.getState();
    expect(sites).toHaveLength(1);
    expect(sites[0].label).toBe("Site B");
  });

  it("updateSite patches an existing site", () => {
    useFavoriteSitesStore.getState().addSite({
      label: "Old Name",
      latitude: 10,
      longitude: 20,
    });

    const id = useFavoriteSitesStore.getState().sites[0].id;
    useFavoriteSitesStore.getState().updateSite(id, { label: "New Name", notes: "Great site" });

    const site = useFavoriteSitesStore.getState().sites[0];
    expect(site.label).toBe("New Name");
    expect(site.notes).toBe("Great site");
    expect(site.latitude).toBe(10);
  });

  it("isFavorite returns true for matching coordinates (rounded to 0.001)", () => {
    useFavoriteSitesStore.getState().addSite({
      label: "Test",
      latitude: 31.1231,
      longitude: 121.4561,
    });

    // 31.1231→"31.123", 31.1234→"31.123"; 121.4561→"121.456", 121.4564→"121.456"
    expect(useFavoriteSitesStore.getState().isFavorite(31.1234, 121.4564)).toBe(true);
    expect(useFavoriteSitesStore.getState().isFavorite(32.0, 121.0)).toBe(false);
  });
});
