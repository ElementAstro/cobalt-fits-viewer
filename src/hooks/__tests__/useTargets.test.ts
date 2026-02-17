import { act, renderHook } from "@testing-library/react-native";
import { useTargets } from "../useTargets";
import { useTargetStore } from "../../stores/useTargetStore";
import { useFitsStore } from "../../stores/useFitsStore";
import { useTargetGroupStore } from "../../stores/useTargetGroupStore";
import { useSessionStore } from "../../stores/useSessionStore";
import type { FitsMetadata, ObservationSession, Target, TargetGroup } from "../../lib/fits/types";

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
    id: "target-1",
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

function makeFile(overrides: Partial<FitsMetadata> = {}): FitsMetadata {
  return {
    id: "file-1",
    filename: "f1.fits",
    filepath: "/tmp/f1.fits",
    fileSize: 1,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  };
}

function makeGroup(overrides: Partial<TargetGroup> = {}): TargetGroup {
  return {
    id: "group-1",
    name: "Group 1",
    targetIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeSession(overrides: Partial<ObservationSession> = {}): ObservationSession {
  return {
    id: "session-1",
    date: "2026-01-01",
    startTime: 1,
    endTime: 2,
    duration: 1,
    targets: [],
    imageIds: [],
    equipment: {},
    createdAt: 1,
    ...overrides,
  };
}

describe("useTargets cascade actions", () => {
  beforeEach(() => {
    useTargetStore.setState({ targets: [] });
    useFitsStore.setState({ files: [] });
    useTargetGroupStore.setState({ groups: [] });
    useSessionStore.setState({ sessions: [], logEntries: [], plans: [], activeSession: null });
  });

  it("removeTargetCascade clears files/groups/sessions references", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1", name: "M31", imageIds: ["f1"] })],
    });
    useFitsStore.setState({ files: [makeFile({ id: "f1", targetId: "t1" })] });
    useTargetGroupStore.setState({ groups: [makeGroup({ id: "g1", targetIds: ["t1"] })] });
    useSessionStore.setState({ sessions: [makeSession({ id: "s1", targets: ["M31"] })] });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.removeTargetCascade("t1");
    });

    expect(useTargetStore.getState().targets).toHaveLength(0);
    expect(
      useFitsStore.getState().files.find((file) => file.id === "f1")?.targetId,
    ).toBeUndefined();
    expect(useTargetGroupStore.getState().groups[0].targetIds).toEqual([]);
    expect(useSessionStore.getState().sessions[0].targets).toEqual([]);
  });

  it("upsertAndLinkFileTarget keeps file.targetId and target.imageIds in sync", () => {
    useFitsStore.setState({ files: [makeFile({ id: "f1", object: "M31" })] });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.upsertAndLinkFileTarget("f1", { object: "M31" }, "import");
    });
    act(() => {
      result.current.upsertAndLinkFileTarget("f1", { object: "M31" }, "import");
    });

    const targets = useTargetStore.getState().targets;
    const file = useFitsStore.getState().files.find((item) => item.id === "f1");

    expect(targets).toHaveLength(1);
    expect(file?.targetId).toBe(targets[0].id);
    expect(targets[0].imageIds).toEqual(["f1"]);
  });

  it("mergeTargetsCascade relinks files, groups and sessions", () => {
    useTargetStore.setState({
      targets: [
        makeTarget({ id: "dest", name: "M31", imageIds: ["f1"], updatedAt: 100 }),
        makeTarget({ id: "source", name: "Andromeda", imageIds: ["f2"], updatedAt: 200 }),
      ],
    });
    useFitsStore.setState({
      files: [makeFile({ id: "f1", targetId: "dest" }), makeFile({ id: "f2", targetId: "source" })],
    });
    useTargetGroupStore.setState({
      groups: [makeGroup({ id: "g1", targetIds: ["source"] })],
    });
    useSessionStore.setState({
      sessions: [makeSession({ id: "s1", targets: ["Andromeda"] })],
    });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.mergeTargetsCascade("dest", "source");
    });

    const targets = useTargetStore.getState().targets;
    expect(targets.some((target) => target.id === "source")).toBe(false);
    expect(targets.find((target) => target.id === "dest")?.imageIds.sort()).toEqual(["f1", "f2"]);
    expect(useFitsStore.getState().files.find((file) => file.id === "f2")?.targetId).toBe("dest");
    expect(useTargetGroupStore.getState().groups[0].targetIds).toEqual(["dest"]);
    expect(useSessionStore.getState().sessions[0].targets).toEqual(["M31"]);
  });

  it("renameTargetCascade updates session target names", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1", name: "Old Name" })],
    });
    useSessionStore.setState({
      sessions: [makeSession({ id: "s1", targets: ["Old Name"] })],
    });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.renameTargetCascade("t1", "New Name");
    });

    expect(useTargetStore.getState().targets[0].name).toBe("New Name");
    expect(useSessionStore.getState().sessions[0].targets).toEqual(["New Name"]);
  });

  it("removeTargetCascade is a no-op for unknown target id", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1", name: "M31", imageIds: ["f1"] })],
    });
    useFitsStore.setState({ files: [makeFile({ id: "f1", targetId: "t1" })] });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.removeTargetCascade("missing-id");
    });

    expect(useTargetStore.getState().targets).toHaveLength(1);
    expect(useFitsStore.getState().files.find((file) => file.id === "f1")?.targetId).toBe("t1");
  });
});
