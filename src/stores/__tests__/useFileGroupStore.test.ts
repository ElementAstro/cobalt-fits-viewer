import { useFileGroupStore } from "../useFileGroupStore";

jest.mock("../../lib/storage", () => ({
  zustandMMKVStorage: {
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
    const groupId = useFileGroupStore.getState().createGroup("Group C", "#112233");
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
});
