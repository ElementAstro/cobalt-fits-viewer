import { useTargetGroupStore } from "../useTargetGroupStore";

jest.mock("../../../lib/storage", () => ({
  zustandAsyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("useTargetGroupStore", () => {
  beforeEach(() => {
    useTargetGroupStore.setState({ groups: [] });
  });

  it("adds, updates and removes groups", () => {
    const id = useTargetGroupStore.getState().addGroup({
      name: "Nebula",
      description: "nebula targets",
      color: "#3366ff",
      targetIds: [],
    });
    let groups = useTargetGroupStore.getState().groups;
    expect(groups).toHaveLength(1);
    expect(groups[0].id).toBe(id);
    expect(groups[0].targetIds).toEqual([]);

    const before = groups[0].updatedAt;
    useTargetGroupStore.getState().updateGroup(id, { name: "Nebula Updated" });
    groups = useTargetGroupStore.getState().groups;
    expect(groups[0].name).toBe("Nebula Updated");
    expect(groups[0].updatedAt).toBeGreaterThanOrEqual(before);

    useTargetGroupStore.getState().removeGroup(id);
    expect(useTargetGroupStore.getState().groups).toEqual([]);
  });

  it("handles target membership actions with dedupe", () => {
    const id = useTargetGroupStore.getState().addGroup({
      name: "Group A",
      targetIds: ["t1"],
    });
    const store = useTargetGroupStore.getState();

    store.addTargetToGroup(id, "t2");
    store.addTargetToGroup(id, "t2");
    expect(useTargetGroupStore.getState().getGroupById(id)?.targetIds).toEqual(["t1", "t2"]);

    store.removeTargetFromGroup(id, "t1");
    expect(useTargetGroupStore.getState().getGroupById(id)?.targetIds).toEqual(["t2"]);

    store.addTargetToGroup(id, "t3");
    store.removeTargetFromAllGroups("t2");
    expect(useTargetGroupStore.getState().getGroupById(id)?.targetIds).toEqual(["t3"]);
  });

  it("replaces target ids across groups and dedupes destination id", () => {
    const g1 = useTargetGroupStore.getState().addGroup({
      name: "One",
      targetIds: ["source", "x", "dest"],
    });
    const g2 = useTargetGroupStore.getState().addGroup({
      name: "Two",
      targetIds: ["source", "y"],
    });

    useTargetGroupStore.getState().replaceTargetInGroups("source", "dest");
    const s = useTargetGroupStore.getState();
    expect(s.getGroupById(g1)?.targetIds).toEqual(["dest", "x"]);
    expect(s.getGroupById(g2)?.targetIds).toEqual(["dest", "y"]);
  });

  it("getters return expected values", () => {
    const id = useTargetGroupStore.getState().addGroup({
      name: "Galaxy Team",
      description: "group",
      targetIds: ["a"],
    });

    const store = useTargetGroupStore.getState();
    expect(store.getGroupById(id)?.id).toBe(id);
    expect(store.getGroupByName("galaxy team")?.id).toBe(id);
    expect(store.getAllGroups()).toHaveLength(1);
    expect(store.getGroupById("missing")).toBeUndefined();
    expect(store.getGroupByName("missing")).toBeUndefined();
  });

  it("keeps state unchanged for no-op paths", () => {
    const id = useTargetGroupStore.getState().addGroup({ name: "Noop", targetIds: ["t1"] });
    const before = useTargetGroupStore.getState().groups;

    useTargetGroupStore.getState().addTargetToGroup("not-found", "x");
    useTargetGroupStore.getState().removeTargetFromAllGroups("not-found");
    useTargetGroupStore.getState().replaceTargetInGroups("none", "dest");

    const after = useTargetGroupStore.getState().groups;
    expect(after).toEqual(before);
    expect(useTargetGroupStore.getState().getGroupById(id)?.targetIds).toEqual(["t1"]);
  });

  it("togglePinned toggles isPinned", () => {
    const id = useTargetGroupStore.getState().addGroup({ name: "Pin Test", targetIds: [] });
    expect(useTargetGroupStore.getState().getGroupById(id)?.isPinned).toBeFalsy();

    useTargetGroupStore.getState().togglePinned(id);
    expect(useTargetGroupStore.getState().getGroupById(id)?.isPinned).toBe(true);

    useTargetGroupStore.getState().togglePinned(id);
    expect(useTargetGroupStore.getState().getGroupById(id)?.isPinned).toBe(false);
  });

  it("setCoverImage sets and clears cover image", () => {
    const id = useTargetGroupStore.getState().addGroup({ name: "Cover Test", targetIds: [] });
    expect(useTargetGroupStore.getState().getGroupById(id)?.coverImageId).toBeUndefined();

    useTargetGroupStore.getState().setCoverImage(id, "img-1");
    expect(useTargetGroupStore.getState().getGroupById(id)?.coverImageId).toBe("img-1");

    useTargetGroupStore.getState().setCoverImage(id, undefined);
    expect(useTargetGroupStore.getState().getGroupById(id)?.coverImageId).toBeUndefined();
  });

  it("reorderGroups reorders and assigns sortOrder", () => {
    const g1 = useTargetGroupStore.getState().addGroup({ name: "A", targetIds: [] });
    const g2 = useTargetGroupStore.getState().addGroup({ name: "B", targetIds: [] });
    const g3 = useTargetGroupStore.getState().addGroup({ name: "C", targetIds: [] });

    useTargetGroupStore.getState().reorderGroups([g3, g1, g2]);
    const groups = useTargetGroupStore.getState().groups;
    expect(groups[0].id).toBe(g3);
    expect(groups[0].sortOrder).toBe(0);
    expect(groups[1].id).toBe(g1);
    expect(groups[1].sortOrder).toBe(1);
    expect(groups[2].id).toBe(g2);
    expect(groups[2].sortOrder).toBe(2);
  });

  it("reorderGroups appends groups not in the ordered list", () => {
    const g1 = useTargetGroupStore.getState().addGroup({ name: "A", targetIds: [] });
    const g2 = useTargetGroupStore.getState().addGroup({ name: "B", targetIds: [] });
    const g3 = useTargetGroupStore.getState().addGroup({ name: "C", targetIds: [] });

    useTargetGroupStore.getState().reorderGroups([g2]);
    const groups = useTargetGroupStore.getState().groups;
    expect(groups).toHaveLength(3);
    expect(groups[0].id).toBe(g2);
    expect(groups[0].sortOrder).toBe(0);
    // g1 and g3 appended
    const ids = groups.map((g) => g.id);
    expect(ids).toContain(g1);
    expect(ids).toContain(g3);
  });

  it("getSortedGroups returns pinned first then by sortOrder", () => {
    const g1 = useTargetGroupStore.getState().addGroup({ name: "A", targetIds: [] });
    const g2 = useTargetGroupStore.getState().addGroup({ name: "B", targetIds: [] });
    const g3 = useTargetGroupStore.getState().addGroup({ name: "C", targetIds: [] });

    useTargetGroupStore.getState().reorderGroups([g1, g2, g3]);
    useTargetGroupStore.getState().togglePinned(g3);

    const sorted = useTargetGroupStore.getState().getSortedGroups();
    expect(sorted[0].id).toBe(g3);
    expect(sorted[1].id).toBe(g1);
    expect(sorted[2].id).toBe(g2);
  });
});
