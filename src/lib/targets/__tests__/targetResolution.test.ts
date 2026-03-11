import type { FitsMetadata, Target } from "../../fits/types";
import {
  buildTargetCreationPlan,
  buildTargetIdentityBundle,
  buildTargetMergePlan,
  isCoordinateMatch,
  resolveTargetResolution,
} from "../targetResolution";

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
    filename: "file.fits",
    filepath: "/tmp/file.fits",
    fileSize: 1,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  };
}

describe("targetResolution", () => {
  it("normalizes catalog variants and expands known aliases", () => {
    const identity = buildTargetIdentityBundle("NGC224", ["Andromeda Galaxy"]);

    expect(identity.canonicalObjectName).toBe("NGC 224");
    expect(identity.normalizedLookup.has("m 31")).toBe(true);
    expect(identity.expandedAliases).toEqual(expect.arrayContaining(["Andromeda Galaxy", "M 31"]));
  });

  it("matches by canonicalized name and coordinate", () => {
    const decision = resolveTargetResolution({
      file: makeFile({ object: "M 31", ra: 10.684, dec: 41.269 }),
      targets: [makeTarget({ id: "t1", name: "M31", ra: 10.6842, dec: 41.2692 })],
    });

    expect(decision.outcome).toBe("linked-existing");
    if (decision.outcome === "linked-existing") {
      expect(decision.candidate.targetId).toBe("t1");
      expect(decision.reasonCode).toBe("name-coordinate-match");
    }
  });

  it("returns ambiguous when top candidates tie", () => {
    const decision = resolveTargetResolution({
      file: makeFile({ object: "M31", ra: 10.684, dec: 41.269 }),
      targets: [
        makeTarget({ id: "t1", name: "M31", ra: 10.684, dec: 41.269 }),
        makeTarget({ id: "t2", name: "M 31", ra: 10.684, dec: 41.269 }),
      ],
    });

    expect(decision.outcome).toBe("ambiguous");
    if (decision.outcome === "ambiguous") {
      expect(decision.candidates).toHaveLength(2);
      expect(decision.reasonCode).toBe("ambiguous-candidates");
    }
  });

  it("returns skipped when metadata is insufficient", () => {
    const decision = resolveTargetResolution({
      file: makeFile(),
      targets: [],
      metadata: {},
    });

    expect(decision.outcome).toBe("skipped");
    if (decision.outcome === "skipped") {
      expect(decision.reasonCode).toBe("insufficient-metadata");
    }
  });

  it("returns created-new when object is resolvable and no candidate exists", () => {
    const decision = resolveTargetResolution({
      file: makeFile({ object: "NGC7000" }),
      targets: [],
    });

    expect(decision.outcome).toBe("created-new");
    if (decision.outcome === "created-new") {
      const plan = buildTargetCreationPlan(
        {},
        decision.identity,
        decision.resolvedRa,
        decision.resolvedDec,
      );
      expect(plan?.name).toBe("NGC 7000");
      expect(plan?.type).toBe("nebula");
    }
  });

  it("builds non-destructive merge updates", () => {
    const target = makeTarget({
      id: "t1",
      name: "M31",
      type: "galaxy",
      aliases: [],
      imageIds: ["f-old"],
      status: "planned",
      category: "existing-category",
    });

    const merge = buildTargetMergePlan({
      target,
      fileId: "f-new",
      metadata: {
        object: "Andromeda Galaxy",
        type: "nebula",
        category: "incoming-category",
        tags: ["luminance"],
        notes: "new note",
      },
      canonicalObjectName: "Andromeda Galaxy",
      expandedAliases: ["M31"],
      resolvedRa: 10.684,
      resolvedDec: 41.269,
    });

    expect(merge.updates.type).toBeUndefined();
    expect(merge.updates.category).toBeUndefined();
    expect(merge.updates.ra).toBe(10.684);
    expect(merge.updates.dec).toBe(41.269);
    expect(merge.updates.aliases).toEqual(expect.arrayContaining(["Andromeda Galaxy", "M31"]));
    expect(merge.updates.imageIds).toEqual(expect.arrayContaining(["f-old", "f-new"]));
    expect(merge.metadataChanged).toBe(true);
  });

  it("matches coordinates within radius", () => {
    expect(isCoordinateMatch(10, 20, 10.2, 20.2, 0.5)).toBe(true);
    expect(isCoordinateMatch(10, 20, 20, 40, 0.5)).toBe(false);
  });
});
