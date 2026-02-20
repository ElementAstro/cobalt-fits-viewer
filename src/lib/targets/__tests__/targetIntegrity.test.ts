import type {
  FitsMetadata,
  ObservationPlan,
  ObservationSession,
  Target,
  TargetGroup,
} from "../../fits/types";
import { reconcileAll, validateTargetIntegrity } from "../targetIntegrity";

function makeTarget(overrides: Partial<Target> = {}): Target {
  const now = Date.now();
  return {
    id: "t1",
    name: "M31",
    aliases: ["Andromeda"],
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
    id: "f1",
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

function makeSession(overrides: Partial<ObservationSession> = {}): ObservationSession {
  return {
    id: "s1",
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

function makeGroup(overrides: Partial<TargetGroup> = {}): TargetGroup {
  return {
    id: "g1",
    name: "Group",
    targetIds: [],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makePlan(overrides: Partial<ObservationPlan> = {}): ObservationPlan {
  return {
    id: "p1",
    title: "Plan",
    targetName: "M31",
    startDate: "2026-01-01T20:00:00.000Z",
    endDate: "2026-01-01T22:00:00.000Z",
    reminderMinutes: 30,
    createdAt: 1,
    ...overrides,
  };
}

describe("targetIntegrity", () => {
  it("reconciles bidirectional file-target links and cleans image ratings", () => {
    const target = makeTarget({
      id: "t1",
      imageIds: ["f1", "ghost"],
      bestImageId: "ghost",
      imageRatings: { f1: 5, ghost: 3 },
    });
    const file = makeFile({ id: "f1", targetId: undefined });

    const patch = reconcileAll({
      targets: [target],
      files: [file],
    });

    expect(patch.targets[0].imageIds).toEqual(["f1"]);
    expect(patch.targets[0].bestImageId).toBeUndefined();
    expect(patch.targets[0].imageRatings).toEqual({ f1: 5 });
    expect(patch.files[0].targetId).toBe("t1");
  });

  it("normalizes groups, sessions, and plans", () => {
    const target = makeTarget({ id: "t1", name: "M31", aliases: ["Andromeda"] });
    const patch = reconcileAll({
      targets: [target],
      files: [makeFile({ id: "f1", targetId: "t1" })],
      groups: [makeGroup({ targetIds: ["t1", "missing", "t1"] })],
      sessions: [
        makeSession({
          targetRefs: [{ name: "Andromeda" }, { targetId: "t1", name: "M31" }],
          imageIds: ["f1", "missing"],
        }),
      ],
      plans: [makePlan({ targetName: "Andromeda" })],
    });

    expect(patch.groups[0].targetIds).toEqual(["t1"]);
    expect(patch.sessions[0].targetRefs).toEqual([{ targetId: "t1", name: "M31" }]);
    expect(patch.sessions[0].imageIds).toEqual(["f1"]);
    expect(patch.plans[0].targetId).toBe("t1");
    expect(patch.plans[0].targetName).toBe("M31");
    expect(patch.valid).toBe(true);
  });

  it("uses file.sessionId as source of truth and rewrites session imageIds", () => {
    const patch = reconcileAll({
      targets: [makeTarget({ id: "t1", imageIds: ["f1"] })],
      files: [makeFile({ id: "f1", targetId: "t1", sessionId: "s2" })],
      sessions: [
        makeSession({ id: "s1", imageIds: ["f1"], startTime: 10, endTime: 20 }),
        makeSession({ id: "s2", imageIds: [], startTime: 30, endTime: 40 }),
      ],
    });

    expect(patch.files[0].sessionId).toBe("s2");
    expect(patch.sessions.find((session) => session.id === "s1")?.imageIds).toEqual([]);
    expect(patch.sessions.find((session) => session.id === "s2")?.imageIds).toEqual(["f1"]);
    expect(patch.report.fixedSessionLinks).toBeGreaterThan(0);
  });

  it("backfills file.sessionId from session imageIds and resolves conflicts by latest startTime", () => {
    const patch = reconcileAll({
      targets: [makeTarget({ id: "t1", imageIds: ["f1", "f2"] })],
      files: [
        makeFile({ id: "f1", targetId: "t1", sessionId: undefined }),
        makeFile({ id: "f2", targetId: "t1", sessionId: undefined }),
      ],
      sessions: [
        makeSession({ id: "s-old", imageIds: ["f1", "f2"], startTime: 100, endTime: 200 }),
        makeSession({ id: "s-new", imageIds: ["f2"], startTime: 300, endTime: 400 }),
      ],
    });

    expect(patch.files.find((file) => file.id === "f1")?.sessionId).toBe("s-old");
    expect(patch.files.find((file) => file.id === "f2")?.sessionId).toBe("s-new");
    expect(patch.sessions.find((session) => session.id === "s-old")?.imageIds).toEqual(["f1"]);
    expect(patch.sessions.find((session) => session.id === "s-new")?.imageIds).toEqual(["f2"]);
  });

  it("relinks log entries to file sessionId when available", () => {
    const patch = reconcileAll({
      targets: [makeTarget({ id: "t1", imageIds: ["f1"] })],
      files: [makeFile({ id: "f1", targetId: "t1", sessionId: "s2" })],
      sessions: [
        makeSession({ id: "s1", imageIds: [], startTime: 100, endTime: 200 }),
        makeSession({ id: "s2", imageIds: ["f1"], startTime: 300, endTime: 400 }),
      ],
      logEntries: [
        {
          id: "log-1",
          sessionId: "s1",
          imageId: "f1",
          dateTime: "2026-01-01T01:00:00.000Z",
          object: "M31",
          filter: "L",
          exptime: 300,
        },
      ],
    });

    expect(patch.logEntries).toHaveLength(1);
    expect(patch.logEntries[0].sessionId).toBe("s2");
  });

  it("validateTargetIntegrity reports graph mismatches", () => {
    const invalid = validateTargetIntegrity({
      targets: [makeTarget({ id: "t1", imageIds: ["f1"] })],
      files: [makeFile({ id: "f1", targetId: "other", sessionId: "s2" })],
      sessions: [makeSession({ id: "s1", imageIds: ["f1"] })],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });
});
