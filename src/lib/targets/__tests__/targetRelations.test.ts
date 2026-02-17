import type { FitsMetadata, ObservationSession, Target, TargetGroup } from "../../fits/types";
import { computeMergeRelinkPatch, computeTargetFileReconciliation } from "../targetRelations";

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

describe("targetRelations", () => {
  it("reconciles target.imageIds and file.targetId in both directions", () => {
    const targetA = makeTarget({ id: "A", name: "A", imageIds: [], updatedAt: 10 });
    const targetB = makeTarget({ id: "B", name: "B", imageIds: ["f1", "f2"], updatedAt: 20 });
    const files = [
      makeFile({ id: "f1", targetId: "A" }),
      makeFile({ id: "f2" }),
      makeFile({ id: "f3", targetId: "missing" }),
    ];

    const patch = computeTargetFileReconciliation({
      targets: [targetA, targetB],
      files,
      groups: [],
      sessions: [],
    });

    const nextA = patch.targets.find((target) => target.id === "A");
    const nextB = patch.targets.find((target) => target.id === "B");
    const f1 = patch.files.find((file) => file.id === "f1");
    const f2 = patch.files.find((file) => file.id === "f2");
    const f3 = patch.files.find((file) => file.id === "f3");

    expect(nextA?.imageIds).toEqual(["f1"]);
    expect(nextB?.imageIds).toEqual(["f2"]);
    expect(f1?.targetId).toBe("A");
    expect(f2?.targetId).toBe("B");
    expect(f3?.targetId).toBeUndefined();
    expect(patch.changed).toBe(true);
  });

  it("resolves multi-target file conflicts by newest target updatedAt", () => {
    const targetOld = makeTarget({ id: "old", name: "Old", imageIds: ["f1"], updatedAt: 100 });
    const targetNew = makeTarget({ id: "new", name: "New", imageIds: ["f1"], updatedAt: 200 });
    const files = [makeFile({ id: "f1" })];

    const patch = computeTargetFileReconciliation({
      targets: [targetOld, targetNew],
      files,
      groups: [],
      sessions: [],
    });

    const oldTarget = patch.targets.find((target) => target.id === "old");
    const newTarget = patch.targets.find((target) => target.id === "new");
    const file = patch.files.find((item) => item.id === "f1");

    expect(oldTarget?.imageIds).toEqual([]);
    expect(newTarget?.imageIds).toEqual(["f1"]);
    expect(file?.targetId).toBe("new");
  });

  it("computes merge relink patch for files, groups and sessions", () => {
    const dest = makeTarget({
      id: "dest",
      name: "M31",
      imageIds: ["f1"],
      aliases: ["Andromeda Galaxy"],
      updatedAt: 100,
    });
    const source = makeTarget({
      id: "source",
      name: "Andromeda",
      imageIds: ["f2"],
      aliases: ["NGC 224"],
      updatedAt: 200,
    });
    const files = [
      makeFile({ id: "f1", targetId: "dest" }),
      makeFile({ id: "f2", targetId: "source" }),
    ];
    const groups = [makeGroup({ id: "g1", targetIds: ["source", "dest", "source"] })];
    const sessions = [makeSession({ id: "s1", targets: ["Andromeda", "M31"] })];

    const patch = computeMergeRelinkPatch({
      destId: "dest",
      sourceId: "source",
      targets: [dest, source],
      files,
      groups,
      sessions,
    });

    expect(patch.targets.some((target) => target.id === "source")).toBe(false);
    expect(patch.targets.find((target) => target.id === "dest")?.imageIds.sort()).toEqual([
      "f1",
      "f2",
    ]);
    expect(patch.files.find((file) => file.id === "f2")?.targetId).toBe("dest");
    expect(patch.groups[0].targetIds).toEqual(["dest"]);
    expect(patch.sessions[0].targets).toEqual(["M31"]);
    expect(patch.changed).toBe(true);
  });
});
