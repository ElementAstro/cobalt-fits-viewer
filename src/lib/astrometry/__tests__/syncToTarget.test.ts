import { createTargetFromResult, isCoordinateMatch, findMatchingTarget } from "../syncToTarget";
import type { AstrometryResult } from "../types";
import type { Target } from "../../fits/types";

// Mock expo-crypto
jest.mock("expo-crypto", () => ({
  randomUUID: () => "mock-uuid-1234",
}));

// Mock logger
jest.mock("../../logger/logger", () => ({
  Logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

// ===== Fixtures =====

function makeResult(overrides: Partial<AstrometryResult> = {}): AstrometryResult {
  return {
    calibration: {
      ra: 10.684,
      dec: 41.269,
      radius: 1.5,
      pixscale: 1.08,
      orientation: 0,
      parity: 0,
      fieldWidth: 1.2,
      fieldHeight: 0.8,
    },
    annotations: [],
    tags: [],
    ...overrides,
  };
}

function makeTarget(overrides: Partial<Target> = {}): Target {
  const now = Date.now();
  return {
    id: "t-existing",
    name: "M31",
    aliases: ["Andromeda Galaxy", "NGC 224"],
    type: "galaxy",
    tags: [],
    isFavorite: false,
    isPinned: false,
    ra: 10.684,
    dec: 41.269,
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

// ===== isCoordinateMatch =====

describe("isCoordinateMatch", () => {
  it("returns true for identical coordinates", () => {
    expect(isCoordinateMatch(10.0, 41.0, 10.0, 41.0)).toBe(true);
  });

  it("returns true for coordinates within default 0.5° radius", () => {
    expect(isCoordinateMatch(10.0, 41.0, 10.2, 41.2)).toBe(true);
  });

  it("returns false for coordinates far apart", () => {
    expect(isCoordinateMatch(10.0, 41.0, 15.0, 45.0)).toBe(false);
  });

  it("respects custom radius", () => {
    // Distance ~5.7 deg
    expect(isCoordinateMatch(10.0, 41.0, 15.0, 45.0, 10.0)).toBe(true);
    expect(isCoordinateMatch(10.0, 41.0, 15.0, 45.0, 1.0)).toBe(false);
  });

  it("accounts for cos(dec) in RA distance", () => {
    // Near the pole (dec=80°), RA distances are compressed
    // cos(80°) ≈ 0.174, so dRA=2° in RA ≈ 0.35° on the sky
    expect(isCoordinateMatch(10.0, 80.0, 12.0, 80.0, 0.5)).toBe(true);
  });

  it("handles negative declination", () => {
    expect(isCoordinateMatch(83.0, -5.0, 83.1, -5.1)).toBe(true);
  });
});

// ===== createTargetFromResult =====

describe("createTargetFromResult", () => {
  it("creates target with Messier name when available", () => {
    const result = makeResult({
      annotations: [
        { type: "ngc", names: ["NGC 224"], pixelx: 100, pixely: 100 },
        { type: "messier", names: ["M31"], pixelx: 100, pixely: 100 },
      ],
      tags: ["galaxy"],
    });
    const target = createTargetFromResult(result);

    expect(target.name).toBe("M31");
    expect(target.aliases).toContain("NGC 224");
    expect(target.aliases).not.toContain("M31"); // primary name excluded from aliases
  });

  it("falls back to NGC name when no Messier", () => {
    const result = makeResult({
      annotations: [
        { type: "ngc", names: ["NGC 7000"], pixelx: 100, pixely: 100 },
        { type: "star", names: ["HD 12345"], pixelx: 200, pixely: 200 },
      ],
    });
    const target = createTargetFromResult(result);
    expect(target.name).toBe("NGC 7000");
  });

  it("falls back to IC name when no Messier/NGC", () => {
    const result = makeResult({
      annotations: [{ type: "ic", names: ["IC 1396"], pixelx: 100, pixely: 100 }],
    });
    const target = createTargetFromResult(result);
    expect(target.name).toBe("IC 1396");
  });

  it("generates coordinate-based name when no annotations", () => {
    const result = makeResult({ annotations: [] });
    const target = createTargetFromResult(result);
    expect(target.name).toMatch(/^Field RA/);
  });

  it("infers galaxy type from tags", () => {
    const result = makeResult({ tags: ["galaxy", "spiral galaxy"] });
    const target = createTargetFromResult(result);
    expect(target.type).toBe("galaxy");
  });

  it("infers nebula type from tags", () => {
    const result = makeResult({ tags: ["emission nebula", "HII region"] });
    const target = createTargetFromResult(result);
    expect(target.type).toBe("nebula");
  });

  it("infers cluster type from tags", () => {
    const result = makeResult({ tags: ["open cluster"] });
    const target = createTargetFromResult(result);
    expect(target.type).toBe("cluster");
  });

  it("defaults to 'other' for unknown tags", () => {
    const result = makeResult({ tags: ["some random tag"] });
    const target = createTargetFromResult(result);
    expect(target.type).toBe("other");
  });

  it("includes fileId in imageIds when provided", () => {
    const result = makeResult();
    const target = createTargetFromResult(result, "file-123");
    expect(target.imageIds).toEqual(["file-123"]);
  });

  it("has empty imageIds when no fileId", () => {
    const result = makeResult();
    const target = createTargetFromResult(result);
    expect(target.imageIds).toEqual([]);
  });

  it("sets RA/DEC from calibration", () => {
    const result = makeResult();
    const target = createTargetFromResult(result);
    expect(target.ra).toBe(10.684);
    expect(target.dec).toBe(41.269);
  });

  it("sets status to acquiring", () => {
    const target = createTargetFromResult(makeResult());
    expect(target.status).toBe("acquiring");
  });

  it("generates a UUID for id", () => {
    const target = createTargetFromResult(makeResult());
    expect(target.id).toBe("mock-uuid-1234");
  });
});

// ===== findMatchingTarget =====

describe("findMatchingTarget", () => {
  it("matches by direct name", () => {
    const targets = [makeTarget()];
    const result = makeResult({
      annotations: [{ type: "messier", names: ["M31"], pixelx: 0, pixely: 0 }],
    });
    const match = findMatchingTarget(targets, result);
    expect(match?.id).toBe("t-existing");
  });

  it("matches by alias on target", () => {
    const targets = [makeTarget()];
    const result = makeResult({
      annotations: [{ type: "ngc", names: ["NGC 224"], pixelx: 0, pixely: 0 }],
    });
    const match = findMatchingTarget(targets, result);
    expect(match?.id).toBe("t-existing");
  });

  it("matches case-insensitively", () => {
    const targets = [makeTarget({ name: "m31" })];
    const result = makeResult({
      annotations: [{ type: "messier", names: ["M31"], pixelx: 0, pixely: 0 }],
    });
    const match = findMatchingTarget(targets, result);
    expect(match?.id).toBe("t-existing");
  });

  it("matches by alias intersection", () => {
    const targets = [makeTarget({ name: "Andromeda", aliases: ["Andromeda Galaxy"] })];
    const result = makeResult({
      annotations: [
        { type: "messier", names: ["M31"], pixelx: 0, pixely: 0 },
        { type: "other", names: ["Andromeda Galaxy"], pixelx: 0, pixely: 0 },
      ],
    });
    const match = findMatchingTarget(targets, result);
    expect(match?.id).toBe("t-existing");
  });

  it("matches by coordinates when no name match", () => {
    const targets = [makeTarget({ name: "MyField", aliases: [], ra: 83.633, dec: -5.375 })];
    const result = makeResult({
      calibration: {
        ra: 83.633,
        dec: -5.375,
        radius: 1.5,
        pixscale: 1.08,
        orientation: 0,
        parity: 0,
        fieldWidth: 1.2,
        fieldHeight: 0.8,
      },
      annotations: [],
    });
    const match = findMatchingTarget(targets, result);
    expect(match?.id).toBe("t-existing");
  });

  it("returns undefined when nothing matches", () => {
    const targets = [makeTarget({ name: "M42", aliases: [], ra: 83.822, dec: -5.391 })];
    const result = makeResult({
      calibration: {
        ra: 200.0,
        dec: 50.0,
        radius: 1.5,
        pixscale: 1.08,
        orientation: 0,
        parity: 0,
        fieldWidth: 1.2,
        fieldHeight: 0.8,
      },
      annotations: [{ type: "messier", names: ["M31"], pixelx: 0, pixely: 0 }],
    });
    const match = findMatchingTarget(targets, result);
    expect(match).toBeUndefined();
  });

  it("returns undefined for empty target list", () => {
    const result = makeResult({
      annotations: [{ type: "messier", names: ["M31"], pixelx: 0, pixely: 0 }],
    });
    expect(findMatchingTarget([], result)).toBeUndefined();
  });

  it("prefers name match over coordinate match", () => {
    const targets = [
      makeTarget({ id: "by-coord", name: "Field1", aliases: [], ra: 10.684, dec: 41.269 }),
      makeTarget({ id: "by-name", name: "M31", aliases: [], ra: 0, dec: 0 }),
    ];
    const result = makeResult({
      annotations: [{ type: "messier", names: ["M31"], pixelx: 0, pixely: 0 }],
    });
    const match = findMatchingTarget(targets, result);
    expect(match?.id).toBe("by-name");
  });
});
