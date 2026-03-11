import { act, renderHook } from "@testing-library/react-native";
import { useTargets } from "../useTargets";
import { useTargetStore } from "../../../stores/observation/useTargetStore";
import { useFitsStore } from "../../../stores/files/useFitsStore";
import { useTargetGroupStore } from "../../../stores/observation/useTargetGroupStore";
import { useSessionStore } from "../../../stores/observation/useSessionStore";
import type {
  FitsMetadata,
  ObservationSession,
  Target,
  TargetGroup,
} from "../../../lib/fits/types";

jest.mock("../../../lib/storage", () => ({
  zustandAsyncStorage: {
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
    targetRefs: [],
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
    useSessionStore.setState({
      sessions: [makeSession({ id: "s1", targetRefs: [{ name: "M31", targetId: "t1" }] })],
    });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.removeTargetCascade("t1");
    });

    expect(useTargetStore.getState().targets).toHaveLength(0);
    expect(
      useFitsStore.getState().files.find((file) => file.id === "f1")?.targetId,
    ).toBeUndefined();
    expect(useTargetGroupStore.getState().groups[0].targetIds).toEqual([]);
    expect(useSessionStore.getState().sessions[0].targetRefs).toEqual([]);
  });

  it("upsertAndLinkFileTarget keeps file.targetId and target.imageIds in sync", () => {
    useFitsStore.setState({ files: [makeFile({ id: "f1", object: "M31" })] });

    const { result } = renderHook(() => useTargets());
    let firstOutcome: string | undefined;
    let secondOutcome: string | undefined;
    act(() => {
      firstOutcome = result.current.upsertAndLinkFileTarget(
        "f1",
        { object: "M31" },
        "import",
      ).outcome;
    });
    act(() => {
      secondOutcome = result.current.upsertAndLinkFileTarget(
        "f1",
        { object: "M31" },
        "import",
      ).outcome;
    });

    const targets = useTargetStore.getState().targets;
    const file = useFitsStore.getState().files.find((item) => item.id === "f1");

    expect(firstOutcome).toBe("created-new");
    expect(secondOutcome).toBe("linked-existing");
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
      sessions: [
        makeSession({ id: "s1", targetRefs: [{ name: "Andromeda", targetId: "source" }] }),
      ],
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
    expect(useSessionStore.getState().sessions[0].targetRefs).toEqual([
      { targetId: "dest", name: "M31" },
    ]);
  });

  it("renameTargetCascade updates session target names", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1", name: "Old Name" })],
    });
    useSessionStore.setState({
      sessions: [makeSession({ id: "s1", targetRefs: [{ name: "Old Name", targetId: "t1" }] })],
    });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.renameTargetCascade("t1", "New Name");
    });

    expect(useTargetStore.getState().targets[0].name).toBe("New Name");
    expect(useSessionStore.getState().sessions[0].targetRefs).toEqual([
      { targetId: "t1", name: "New Name" },
    ]);
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

  it("scanAndAutoDetect returns full summary fields", () => {
    useFitsStore.setState({
      files: [
        makeFile({ id: "f1", object: "M31" }),
        makeFile({ id: "f2", targetId: "existing-target", object: "M42" }),
        makeFile({ id: "f4", object: "M31", ra: 11, dec: 22 }),
        makeFile({ id: "f5", ra: 11, dec: 22 }),
        makeFile({ id: "f3" }),
      ],
    });

    useTargetStore.setState({
      targets: [
        makeTarget({ id: "existing-target", name: "M31", ra: 11, dec: 22 }),
        makeTarget({ id: "other-target", name: "Andromeda", aliases: ["M31"], ra: 11, dec: 22 }),
      ],
    });

    const { result } = renderHook(() => useTargets());
    let summary:
      | {
          newCount: number;
          updatedCount: number;
          ambiguousCount: number;
          scannedCount: number;
          skippedCount: number;
        }
      | undefined;
    act(() => {
      summary = result.current.scanAndAutoDetect();
    });

    expect(summary).toEqual({
      newCount: 0,
      updatedCount: 2,
      ambiguousCount: 1,
      scannedCount: 4,
      skippedCount: 1,
    });
  });

  it("preserves existing identity fields while enriching missing metadata", () => {
    useTargetStore.setState({
      targets: [
        makeTarget({
          id: "t1",
          name: "M31",
          type: "galaxy",
          aliases: [],
          status: "planned",
        }),
      ],
    });
    useFitsStore.setState({
      files: [makeFile({ id: "f1", object: "Andromeda Galaxy", targetId: undefined })],
    });

    const { result } = renderHook(() => useTargets());
    act(() => {
      result.current.upsertAndLinkFileTarget(
        "f1",
        {
          object: "Andromeda Galaxy",
          type: "nebula",
          ra: 10.684,
          dec: 41.269,
          category: "Autumn",
          notes: "metadata note",
          tags: ["widefield"],
        },
        "import",
      );
    });

    const target = useTargetStore.getState().targets.find((item) => item.id === "t1");
    expect(target).toBeDefined();
    expect(target?.name).toBe("M31");
    expect(target?.type).toBe("galaxy");
    expect(target?.ra).toBe(10.684);
    expect(target?.dec).toBe(41.269);
    expect(target?.aliases).toContain("Andromeda Galaxy");
    expect(target?.tags).toContain("widefield");
  });

  it("returns consistent outcomes for import/scan/astrometry sources", () => {
    const input = { object: "M31", ra: 10.684, dec: 41.269 };

    useTargetStore.setState({ targets: [] });
    useFitsStore.setState({ files: [makeFile({ id: "f-import", ...input })] });
    const importHook = renderHook(() => useTargets());
    let importOutcome: string | undefined;
    let importReason: string | undefined;
    act(() => {
      const res = importHook.result.current.upsertAndLinkFileTarget("f-import", input, "import");
      importOutcome = res.outcome;
      importReason = res.reasonCode;
    });
    importHook.unmount();

    useTargetStore.setState({ targets: [] });
    useFitsStore.setState({ files: [makeFile({ id: "f-scan", ...input })] });
    const scanHook = renderHook(() => useTargets());
    let scanOutcome: string | undefined;
    let scanReason: string | undefined;
    act(() => {
      const res = scanHook.result.current.upsertAndLinkFileTarget("f-scan", input, "scan");
      scanOutcome = res.outcome;
      scanReason = res.reasonCode;
    });
    scanHook.unmount();

    useTargetStore.setState({ targets: [] });
    useFitsStore.setState({ files: [makeFile({ id: "f-astro", ...input })] });
    const astrometryHook = renderHook(() => useTargets());
    let astrometryOutcome: string | undefined;
    let astrometryReason: string | undefined;
    act(() => {
      const res = astrometryHook.result.current.upsertAndLinkFileTarget(
        "f-astro",
        input,
        "astrometry",
      );
      astrometryOutcome = res.outcome;
      astrometryReason = res.reasonCode;
    });
    astrometryHook.unmount();

    expect(importOutcome).toBe("created-new");
    expect(scanOutcome).toBe("created-new");
    expect(astrometryOutcome).toBe("created-new");
    expect(importReason).toBe(scanReason);
    expect(scanReason).toBe(astrometryReason);
  });

  it("sets and toggles target group membership idempotently", () => {
    useTargetStore.setState({
      targets: [makeTarget({ id: "t1", name: "M31" })],
    });
    useTargetGroupStore.setState({
      groups: [makeGroup({ id: "g1", targetIds: ["t1"] }), makeGroup({ id: "g2", targetIds: [] })],
    });

    const { result } = renderHook(() => useTargets());

    act(() => {
      result.current.setTargetGroupMembership("t1", ["g2"]);
    });
    expect(result.current.getTargetGroupIds("t1").sort()).toEqual(["g2"]);
    expect(
      useTargetGroupStore.getState().groups.find((group) => group.id === "g1")?.targetIds,
    ).toEqual([]);
    expect(
      useTargetGroupStore.getState().groups.find((group) => group.id === "g2")?.targetIds,
    ).toEqual(["t1"]);

    act(() => {
      result.current.toggleTargetGroupMembership("t1", "g2");
    });
    expect(result.current.getTargetGroupIds("t1")).toEqual([]);

    act(() => {
      result.current.toggleTargetGroupMembership("t1", "g1");
      result.current.toggleTargetGroupMembership("t1", "g1");
    });
    expect(result.current.getTargetGroupIds("t1")).toEqual([]);
  });
});
