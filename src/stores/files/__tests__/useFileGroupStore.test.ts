import { useFileGroupStore } from "../useFileGroupStore";

jest.mock("../../lib/storage", () => ({
  zustandAsyncStorage: {
    getItem: jest.fn().mockResolvedValue(null),
    setItem: jest.fn().mockResolvedValue(undefined),
    removeItem: jest.fn().mockResolvedValue(undefined),
  },
}));

describe("useFileGroupStore", () => {
  beforeEach(() => {
    useFileGroupStore.setState({ groups: [], fileGroupMap: {} });
  });

  it("creates and updates groups", () => {
    const groupId = useFileGroupStore.getState().createGroup("Lights");
    expect(useFileGroupStore.getState().groups).toHaveLength(1);
    expect(useFileGroupStore.getState().groups[0].name).toBe("Lights");

    useFileGroupStore.getState().updateGroup(groupId, { name: "Lights Updated" });
    expect(useFileGroupStore.getState().groups[0].name).toBe("Lights Updated");
  });

  it("assigns and removes file mappings", () => {
    const groupId = useFileGroupStore.getState().createGroup("Session A");
    useFileGroupStore.getState().assignFilesToGroup(["f1", "f2"], groupId);
    expect(useFileGroupStore.getState().getFileGroupIds("f1")).toEqual([groupId]);

    useFileGroupStore.getState().removeFilesFromGroup(["f1"], groupId);
    expect(useFileGroupStore.getState().getFileGroupIds("f1")).toEqual([]);
    expect(useFileGroupStore.getState().getFileGroupIds("f2")).toEqual([groupId]);
  });

  it("removes group and cleans mapping", () => {
    const groupId = useFileGroupStore.getState().createGroup("Temp Group");
    useFileGroupStore.getState().assignFilesToGroup(["f1"], groupId);
    useFileGroupStore.getState().removeGroup(groupId);
    expect(useFileGroupStore.getState().groups).toHaveLength(0);
    expect(useFileGroupStore.getState().getFileGroupIds("f1")).toEqual([]);
  });

  it("removeFileMappings drops mappings for specified files only", () => {
    const groupId = useFileGroupStore.getState().createGroup("Session B");
    useFileGroupStore.getState().assignFilesToGroup(["f1", "f2", "f3"], groupId);

    useFileGroupStore.getState().removeFileMappings(["f1", "f3"]);
    expect(useFileGroupStore.getState().getFileGroupIds("f1")).toEqual([]);
    expect(useFileGroupStore.getState().getFileGroupIds("f2")).toEqual([groupId]);
    expect(useFileGroupStore.getState().getFileGroupIds("f3")).toEqual([]);
  });

  it("getGroupById returns group or undefined", () => {
    const groupId = useFileGroupStore.getState().createGroup("Group C", { color: "#112233" });
    expect(useFileGroupStore.getState().getGroupById(groupId)?.name).toBe("Group C");
    expect(useFileGroupStore.getState().getGroupById("missing")).toBeUndefined();
  });

  it("handles early-return paths safely", () => {
    const groupId = useFileGroupStore.getState().createGroup("  ");
    expect(useFileGroupStore.getState().groups[0].name).toMatch(/^Group /);

    useFileGroupStore.getState().updateGroup("", { name: "ignored" });
    useFileGroupStore.getState().removeGroup("");
    useFileGroupStore.getState().assignFilesToGroup([], groupId);
    useFileGroupStore.getState().removeFilesFromGroup([], groupId);
    useFileGroupStore.getState().removeFileMappings([]);

    expect(useFileGroupStore.getState().groups).toHaveLength(1);
    expect(useFileGroupStore.getState().groups[0].id).toBe(groupId);
  });

  it("creates group with options (description, parentId, color)", () => {
    const parentId = useFileGroupStore.getState().createGroup("Parent");
    const childId = useFileGroupStore.getState().createGroup("Child", {
      color: "#ff0000",
      description: "A child folder",
      parentId,
    });
    const child = useFileGroupStore.getState().getGroupById(childId);
    expect(child?.parentId).toBe(parentId);
    expect(child?.description).toBe("A child folder");
    expect(child?.color).toBe("#ff0000");
  });

  it("getRootGroups returns only top-level groups", () => {
    const root1 = useFileGroupStore.getState().createGroup("Root1");
    const root2 = useFileGroupStore.getState().createGroup("Root2");
    useFileGroupStore.getState().createGroup("Child1", { parentId: root1 });
    const roots = useFileGroupStore.getState().getRootGroups();
    expect(roots.map((g) => g.id).sort()).toEqual([root1, root2].sort());
  });

  it("getChildGroups returns children of a given parent", () => {
    const parentId = useFileGroupStore.getState().createGroup("Parent");
    const c1 = useFileGroupStore.getState().createGroup("C1", { parentId });
    const c2 = useFileGroupStore.getState().createGroup("C2", { parentId });
    useFileGroupStore.getState().createGroup("Other");
    const children = useFileGroupStore.getState().getChildGroups(parentId);
    expect(children.map((g) => g.id).sort()).toEqual([c1, c2].sort());
  });

  it("getChildGroups with undefined returns root groups", () => {
    const r1 = useFileGroupStore.getState().createGroup("R1");
    const p = useFileGroupStore.getState().createGroup("P");
    useFileGroupStore.getState().createGroup("C", { parentId: p });
    const roots = useFileGroupStore.getState().getChildGroups(undefined);
    expect(roots.map((g) => g.id).sort()).toEqual([r1, p].sort());
  });

  it("getGroupPath returns path from root to target", () => {
    const g1 = useFileGroupStore.getState().createGroup("L1");
    const g2 = useFileGroupStore.getState().createGroup("L2", { parentId: g1 });
    const g3 = useFileGroupStore.getState().createGroup("L3", { parentId: g2 });
    const path = useFileGroupStore.getState().getGroupPath(g3);
    expect(path.map((g) => g.id)).toEqual([g1, g2, g3]);
  });

  it("getGroupPath handles root group", () => {
    const g = useFileGroupStore.getState().createGroup("Solo");
    const path = useFileGroupStore.getState().getGroupPath(g);
    expect(path).toHaveLength(1);
    expect(path[0].id).toBe(g);
  });

  it("getGroupStats computes file count and total size", () => {
    const gId = useFileGroupStore.getState().createGroup("Stats");
    useFileGroupStore.getState().assignFilesToGroup(["f1", "f2"], gId);
    const files = [
      { id: "f1", fileSize: 100 },
      { id: "f2", fileSize: 250 },
      { id: "f3", fileSize: 999 },
    ] as any[];
    const stats = useFileGroupStore.getState().getGroupStats(gId, files);
    expect(stats.fileCount).toBe(2);
    expect(stats.totalSize).toBe(350);
  });

  it("getFilesInGroup returns file ids belonging to group", () => {
    const gId = useFileGroupStore.getState().createGroup("G");
    useFileGroupStore.getState().assignFilesToGroup(["a", "b", "c"], gId);
    const ids = useFileGroupStore.getState().getFilesInGroup(gId);
    expect(ids.sort()).toEqual(["a", "b", "c"]);
  });

  it("moveGroup changes parentId", () => {
    const p1 = useFileGroupStore.getState().createGroup("P1");
    const p2 = useFileGroupStore.getState().createGroup("P2");
    const child = useFileGroupStore.getState().createGroup("Child", { parentId: p1 });
    useFileGroupStore.getState().moveGroup(child, p2);
    expect(useFileGroupStore.getState().getGroupById(child)?.parentId).toBe(p2);
  });

  it("moveGroup to undefined makes it root", () => {
    const p = useFileGroupStore.getState().createGroup("P");
    const c = useFileGroupStore.getState().createGroup("C", { parentId: p });
    useFileGroupStore.getState().moveGroup(c, undefined);
    expect(useFileGroupStore.getState().getGroupById(c)?.parentId).toBeUndefined();
  });

  it("moveFilesToGroup removes from source and adds to target", () => {
    const g1 = useFileGroupStore.getState().createGroup("G1");
    const g2 = useFileGroupStore.getState().createGroup("G2");
    useFileGroupStore.getState().assignFilesToGroup(["f1", "f2"], g1);
    useFileGroupStore.getState().moveFilesToGroup(["f1"], g1, g2);
    expect(useFileGroupStore.getState().getFileGroupIds("f1")).toEqual([g2]);
    expect(useFileGroupStore.getState().getFileGroupIds("f2")).toEqual([g1]);
  });

  it("moveFilesToGroup with undefined fromGroupId just adds", () => {
    const g = useFileGroupStore.getState().createGroup("Target");
    useFileGroupStore.getState().moveFilesToGroup(["x1"], undefined, g);
    expect(useFileGroupStore.getState().getFileGroupIds("x1")).toEqual([g]);
  });
});
