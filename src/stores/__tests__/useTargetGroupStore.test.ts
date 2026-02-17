import { useTargetGroupStore } from "../useTargetGroupStore";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
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
});
