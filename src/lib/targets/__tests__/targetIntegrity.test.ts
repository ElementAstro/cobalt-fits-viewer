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

  it("validateTargetIntegrity reports graph mismatches", () => {
    const invalid = validateTargetIntegrity({
      targets: [makeTarget({ id: "t1", imageIds: ["f1"] })],
      files: [makeFile({ id: "f1", targetId: "other" })],
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });
});
