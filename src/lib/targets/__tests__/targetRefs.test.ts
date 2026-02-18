import type { Target, TargetRef } from "../../fits/types";
import {
  dedupeTargetRefs,
  normalizeSessionTargetRefs,
  resolveTargetId,
  resolveTargetName,
  toTargetRef,
} from "../targetRefs";

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

describe("targetRefs", () => {
  it("toTargetRef resolves id and canonical name from string", () => {
    const targets = [makeTarget()];
    const ref = toTargetRef("Andromeda", targets);
    expect(ref).toEqual({ targetId: "t1", name: "M31" });
  });

  it("resolveTargetName prefers target id mapping", () => {
    const targets = [makeTarget({ id: "t1", name: "M31" })];
    const name = resolveTargetName({ targetId: "t1", name: "Andromeda" }, targets);
    expect(name).toBe("M31");
  });

  it("resolveTargetId falls back by alias matching", () => {
    const targets = [makeTarget({ id: "target-42" })];
    const id = resolveTargetId({ name: "andromeda" }, targets);
    expect(id).toBe("target-42");
  });

  it("dedupeTargetRefs prefers targetId and removes duplicate names", () => {
    const refs: TargetRef[] = [
      { targetId: "a", name: "M31" },
      { targetId: "a", name: "Andromeda" },
      { name: "M42" },
      { name: " M42 " },
    ];
    expect(dedupeTargetRefs(refs)).toEqual([{ targetId: "a", name: "M31" }, { name: "M42" }]);
  });

  it("normalizeSessionTargetRefs migrates legacy targets array", () => {
    const targets = [makeTarget({ id: "t1", name: "M31" })];
    const refs = normalizeSessionTargetRefs({ targets: ["M31", "Andromeda"] }, targets);
    expect(refs).toEqual([{ targetId: "t1", name: "M31" }]);
  });
});
