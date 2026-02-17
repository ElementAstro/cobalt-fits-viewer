import { useTargetStore } from "../useTargetStore";
import type { Target } from "../../lib/fits/types";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
    getItem: jest.fn().mockReturnValue(null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

function makeTarget(overrides: Partial<Target> = {}): Target {
  const now = Date.now();
  return {
    id: `target-${Math.random().toString(36).slice(2, 8)}`,
    name: "M31",
    aliases: [],
    type: "galaxy",
    tags: [],
    isFavorite: false,
    isPinned: false,
    imageIds: [],
    status: "planned",
    plannedFilters: [],
    plannedExposure: {},
    imageRatings: {},
    changeLog: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function getTarget(id: string) {
  return useTargetStore.getState().targets.find((t) => t.id === id);
}

describe("useTargetStore", () => {
  beforeEach(() => {
    useTargetStore.setState({ targets: [] });
    jest.clearAllMocks();
  });

  it("addTarget creates target defaults/changelog and skips duplicate id", () => {
    const target = makeTarget({ id: "same-id", name: "M31", changeLog: [] });
    useTargetStore.getState().addTarget(target);

    const created = getTarget("same-id");
    expect(created).toBeDefined();
    expect(created?.changeLog).toHaveLength(1);
    expect(created?.changeLog[0].action).toBe("created");

    useTargetStore.getState().addTarget(makeTarget({ id: "same-id", name: "Dup" }));
    expect(useTargetStore.getState().targets).toHaveLength(1);
    expect(getTarget("same-id")?.name).toBe("M31");
  });

  it("removeTarget deletes a target", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1" }), makeTarget({ id: "t2" })],
    });
    useTargetStore.getState().removeTarget("t1");
    expect(useTargetStore.getState().targets.map((t) => t.id)).toEqual(["t2"]);
  });

  it("updateTarget appends changelog only when values actually change", () => {
    useTargetStore.setState({ targets: [makeTarget({ id: "t1", name: "M31", changeLog: [] })] });

    useTargetStore.getState().updateTarget("t1", { name: "M31" });
    expect(getTarget("t1")?.changeLog).toHaveLength(0);

    useTargetStore.getState().updateTarget("t1", { name: "M42", category: "nebula" });
    const updated = getTarget("t1");
    expect(updated?.name).toBe("M42");
    expect(updated?.category).toBe("nebula");
    expect(updated?.changeLog.at(-1)?.action).toBe("updated");
  });

  it("adds/removes images with dedupe and proper no-op behavior", () => {
    useTargetStore.setState({ targets: [makeTarget({ id: "t1", imageIds: [], changeLog: [] })] });
    const store = useTargetStore.getState();

    store.addImageToTarget("t1", "img-1");
    store.addImageToTarget("t1", "img-1");
    expect(getTarget("t1")?.imageIds).toEqual(["img-1"]);
    expect(getTarget("t1")?.changeLog.at(-1)?.action).toBe("image_added");

    store.removeImageFromTarget("t1", "img-2");
    expect(getTarget("t1")?.imageIds).toEqual(["img-1"]);

    store.removeImageFromTarget("t1", "img-1");
    expect(getTarget("t1")?.imageIds).toEqual([]);
    expect(getTarget("t1")?.changeLog.at(-1)?.action).toBe("image_removed");
  });

  it("handles alias actions", () => {
    useTargetStore.setState({ targets: [makeTarget({ id: "t1", aliases: [] })] });
    const store = useTargetStore.getState();

    store.addAlias("t1", "Andromeda");
    store.addAlias("t1", "Andromeda");
    expect(getTarget("t1")?.aliases).toEqual(["Andromeda"]);

    store.removeAlias("t1", "Andromeda");
    expect(getTarget("t1")?.aliases).toEqual([]);
  });

  it("handles status and planned exposure updates", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1", status: "planned", changeLog: [] })],
    });
    const store = useTargetStore.getState();

    store.setStatus("t1", "planned");
    expect(getTarget("t1")?.changeLog).toHaveLength(0);

    store.setStatus("t1", "acquiring");
    expect(getTarget("t1")?.status).toBe("acquiring");
    expect(getTarget("t1")?.changeLog.at(-1)?.action).toBe("status_changed");

    store.setPlannedExposure("t1", "Ha", 1800);
    expect(getTarget("t1")?.plannedExposure.Ha).toBe(1800);
  });

  it("mergeIntoTarget is no-op for invalid cases and merges valid source", () => {
    const dest = makeTarget({
      id: "dest",
      name: "M31",
      aliases: ["Andromeda"],
      tags: ["galaxy"],
      imageIds: ["img-1"],
    });
    const source = makeTarget({
      id: "source",
      name: "M31A",
      aliases: ["M31A"],
      tags: ["widefield"],
      imageIds: ["img-2"],
    });
    useTargetStore.setState({ targets: [dest, source] });
    const before = useTargetStore.getState().targets;

    useTargetStore.getState().mergeIntoTarget("dest", "dest");
    useTargetStore.getState().mergeIntoTarget("missing", "source");
    useTargetStore.getState().mergeIntoTarget("dest", "missing");
    expect(useTargetStore.getState().targets).toEqual(before);

    useTargetStore.getState().mergeIntoTarget("dest", "source");
    const state = useTargetStore.getState();
    expect(state.targets).toHaveLength(1);
    expect(state.targets[0].id).toBe("dest");
    expect(state.targets[0].imageIds).toEqual(expect.arrayContaining(["img-1", "img-2"]));
  });

  it("toggles favorite/pinned and maintains changelog actions", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1", isFavorite: false, isPinned: false, changeLog: [] })],
    });
    const store = useTargetStore.getState();

    store.toggleFavorite("t1");
    expect(getTarget("t1")?.isFavorite).toBe(true);
    expect(getTarget("t1")?.changeLog.at(-1)?.action).toBe("favorited");
    store.toggleFavorite("t1");
    expect(getTarget("t1")?.changeLog.at(-1)?.action).toBe("unfavorited");

    store.togglePinned("t1");
    expect(getTarget("t1")?.isPinned).toBe(true);
    expect(getTarget("t1")?.changeLog.at(-1)?.action).toBe("pinned");
    store.togglePinned("t1");
    expect(getTarget("t1")?.changeLog.at(-1)?.action).toBe("unpinned");
  });

  it("handles tag actions and setTags replacement", () => {
    useTargetStore.setState({ targets: [makeTarget({ id: "t1", tags: [] })] });
    const store = useTargetStore.getState();

    store.addTag("t1", "narrowband");
    store.addTag("t1", "narrowband");
    expect(getTarget("t1")?.tags).toEqual(["narrowband"]);

    store.removeTag("t1", "narrowband");
    expect(getTarget("t1")?.tags).toEqual([]);

    store.setTags("t1", ["galaxy", "favorite"]);
    expect(getTarget("t1")?.tags).toEqual(["galaxy", "favorite"]);
  });

  it("updates category/group/equipment/bestImage and image ratings", () => {
    useTargetStore.setState({ targets: [makeTarget({ id: "t1" })] });
    const store = useTargetStore.getState();

    store.setCategory("t1", "spring");
    store.setGroup("t1", "group-1");
    store.setRecommendedEquipment("t1", {
      telescope: "RC8",
      camera: "ASI2600",
      filters: ["L", "Ha"],
      notes: "best seeing",
    });
    store.setBestImage("t1", "img-best");
    store.setImageRating("t1", "img-best", 5);
    store.removeImageRating("t1", "img-best");

    const t = getTarget("t1");
    expect(t?.category).toBe("spring");
    expect(t?.groupId).toBe("group-1");
    expect(t?.recommendedEquipment?.camera).toBe("ASI2600");
    expect(t?.bestImageId).toBe("img-best");
    expect(t?.imageRatings["img-best"]).toBeUndefined();
  });

  it("getter methods return filtered targets correctly", () => {
    useTargetStore.setState({
      targets: [
        makeTarget({
          id: "g1",
          name: "M31",
          aliases: ["Andromeda"],
          type: "galaxy",
          status: "planned",
          tags: ["widefield"],
          category: "spring",
          isFavorite: true,
        }),
        makeTarget({
          id: "n1",
          name: "Rosette",
          type: "nebula",
          status: "acquiring",
          tags: ["narrowband"],
          category: "winter",
          isPinned: true,
        }),
      ],
    });

    const store = useTargetStore.getState();
    expect(store.getTargetById("g1")?.name).toBe("M31");
    expect(store.getTargetById("missing")).toBeUndefined();
    expect(store.getTargetByName("andromeda")?.id).toBe("g1");
    expect(store.getTargetByName("m31")?.id).toBe("g1");
    expect(store.getTargetByName("missing")).toBeUndefined();
    expect(store.getTargetsByType("galaxy").map((t) => t.id)).toEqual(["g1"]);
    expect(store.getTargetsByStatus("acquiring").map((t) => t.id)).toEqual(["n1"]);
    expect(store.getFavoriteTargets().map((t) => t.id)).toEqual(["g1"]);
    expect(store.getPinnedTargets().map((t) => t.id)).toEqual(["n1"]);
    expect(store.getTargetsByTag("narrowband").map((t) => t.id)).toEqual(["n1"]);
    expect(store.getTargetsByCategory("spring").map((t) => t.id)).toEqual(["g1"]);
  });
});
