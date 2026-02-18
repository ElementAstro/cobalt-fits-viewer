import type { FitsMetadata } from "../../fits/types";
import {
  detectSessions,
  generateLogEntries,
  getDatesWithObservations,
  isSessionDuplicate,
} from "../sessionDetector";
import type { ObservationSession } from "../../fits/types";

const makeFile = (
  id: string,
  dateObs: string,
  overrides: Partial<FitsMetadata> = {},
): FitsMetadata =>
  ({
    id,
    filename: `${id}.fits`,
    uri: `/path/${id}.fits`,
    importDate: Date.now(),
    dateObs,
    object: "M42",
    filter: "Ha",
    exptime: 300,
    telescope: "RC8",
    instrument: "ASI294MM",
    ...overrides,
  }) as FitsMetadata;

// ===== detectSessions =====

describe("detectSessions", () => {
  it("returns empty for empty input", () => {
    expect(detectSessions([])).toEqual([]);
  });

  it("returns empty when no files have dateObs", () => {
    const files = [makeFile("f1", "", { dateObs: undefined })];
    expect(detectSessions(files as FitsMetadata[])).toEqual([]);
  });

  it("groups files within gap into one session", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z"),
      makeFile("f2", "2024-01-15T22:30:00Z"),
      makeFile("f3", "2024-01-15T23:00:00Z"),
    ];
    const sessions = detectSessions(files, 120);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].imageIds).toEqual(["f1", "f2", "f3"]);
  });

  it("splits files into separate sessions when gap exceeds threshold", () => {
    const files = [
      makeFile("f1", "2024-01-15T20:00:00Z"),
      makeFile("f2", "2024-01-15T20:30:00Z"),
      makeFile("f3", "2024-01-16T22:00:00Z"),
      makeFile("f4", "2024-01-16T22:30:00Z"),
    ];
    const sessions = detectSessions(files, 120);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].imageIds).toEqual(["f1", "f2"]);
    expect(sessions[1].imageIds).toEqual(["f3", "f4"]);
  });

  it("computes session duration correctly", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z", { exptime: 300 }),
      makeFile("f2", "2024-01-15T23:00:00Z", { exptime: 600 }),
    ];
    const sessions = detectSessions(files);
    // duration = (23:00 - 22:00) in seconds + last exptime
    expect(sessions[0].duration).toBe(3600 + 600);
  });

  it("extracts unique targets", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z", { object: "M42" }),
      makeFile("f2", "2024-01-15T22:30:00Z", { object: "M42" }),
      makeFile("f3", "2024-01-15T23:00:00Z", { object: "M43" }),
    ];
    const sessions = detectSessions(files);
    expect(sessions[0].targetRefs).toEqual([{ name: "M42" }, { name: "M43" }]);
  });

  it("extracts equipment from files", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z", { telescope: "EdgeHD", instrument: "ASI2600MM" }),
    ];
    const sessions = detectSessions(files);
    expect(sessions[0].equipment.telescope).toBe("EdgeHD");
    expect(sessions[0].equipment.camera).toBe("ASI2600MM");
  });

  it("extracts filter list from equipment", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z", { filter: "Ha" }),
      makeFile("f2", "2024-01-15T22:30:00Z", { filter: "OIII" }),
      makeFile("f3", "2024-01-15T23:00:00Z", { filter: "Ha" }),
    ];
    const sessions = detectSessions(files);
    expect(sessions[0].equipment.filters).toEqual(["Ha", "OIII"]);
  });

  it("sorts files by date before grouping", () => {
    const files = [
      makeFile("f3", "2024-01-15T23:00:00Z"),
      makeFile("f1", "2024-01-15T22:00:00Z"),
      makeFile("f2", "2024-01-15T22:30:00Z"),
    ];
    const sessions = detectSessions(files);
    expect(sessions[0].imageIds).toEqual(["f1", "f2", "f3"]);
  });

  it("uses custom gap threshold", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z"),
      makeFile("f2", "2024-01-15T22:40:00Z"), // 40 min gap
    ];
    // 30-minute gap should split them
    const sessions30 = detectSessions(files, 30);
    expect(sessions30).toHaveLength(2);
    // 60-minute gap should keep them together
    const sessions60 = detectSessions(files, 60);
    expect(sessions60).toHaveLength(1);
  });
});

// ===== generateLogEntries =====

describe("generateLogEntries", () => {
  it("generates entries sorted by date", () => {
    const files = [makeFile("f2", "2024-01-15T23:00:00Z"), makeFile("f1", "2024-01-15T22:00:00Z")];
    const entries = generateLogEntries(files, "s1");
    expect(entries).toHaveLength(2);
    expect(entries[0].imageId).toBe("f1");
    expect(entries[1].imageId).toBe("f2");
  });

  it("filters out files without dateObs", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z"),
      makeFile("f2", "", { dateObs: undefined }),
    ];
    const entries = generateLogEntries(files as FitsMetadata[], "s1");
    expect(entries).toHaveLength(1);
  });

  it("defaults object/filter to Unknown", () => {
    const files = [
      makeFile("f1", "2024-01-15T22:00:00Z", { object: undefined, filter: undefined }),
    ];
    const entries = generateLogEntries(files as FitsMetadata[], "s1");
    expect(entries[0].object).toBe("Unknown");
    expect(entries[0].filter).toBe("Unknown");
  });

  it("returns empty for empty input", () => {
    expect(generateLogEntries([], "s1")).toEqual([]);
  });
});

// ===== getDatesWithObservations =====

describe("getDatesWithObservations", () => {
  it("returns dates in the target month", () => {
    const files = [
      makeFile("f1", "2024-01-05T12:00:00Z"),
      makeFile("f2", "2024-01-15T12:00:00Z"),
      makeFile("f3", "2024-01-15T13:00:00Z"), // dup date
      makeFile("f4", "2024-02-10T12:00:00Z"), // different month
    ];
    const dates = getDatesWithObservations(files, 2024, 0); // Jan = month 0
    expect(dates).toEqual([5, 15]);
  });

  it("returns empty when no files match", () => {
    const files = [makeFile("f1", "2024-03-10T22:00:00Z")];
    expect(getDatesWithObservations(files, 2024, 0)).toEqual([]);
  });

  it("skips files without dateObs", () => {
    const files = [makeFile("f1", "", { dateObs: undefined })];
    expect(getDatesWithObservations(files as FitsMetadata[], 2024, 0)).toEqual([]);
  });

  it("returns sorted dates", () => {
    const files = [
      makeFile("f1", "2024-01-20T12:00:00Z"),
      makeFile("f2", "2024-01-05T12:00:00Z"),
      makeFile("f3", "2024-01-10T12:00:00Z"),
    ];
    const dates = getDatesWithObservations(files, 2024, 0);
    expect(dates).toEqual([5, 10, 20]);
  });
});

// ===== isSessionDuplicate =====

const makeSession = (overrides: Partial<ObservationSession> = {}): ObservationSession => ({
  id: "s1",
  date: "2024-01-15",
  startTime: 1705356000000,
  endTime: 1705363200000,
  duration: 7200,
  targetRefs: [{ name: "M42" }],
  imageIds: ["img-1", "img-2", "img-3", "img-4"],
  equipment: {},
  createdAt: Date.now(),
  ...overrides,
});

describe("isSessionDuplicate", () => {
  it("returns false when no existing sessions", () => {
    expect(isSessionDuplicate(makeSession(), [])).toBe(false);
  });

  it("detects duplicate by exact date + startTime match", () => {
    const existing = [makeSession({ id: "existing" })];
    const candidate = makeSession({ id: "candidate", imageIds: ["other-1", "other-2"] });
    expect(isSessionDuplicate(candidate, existing)).toBe(true);
  });

  it("detects duplicate by >50% image overlap", () => {
    const existing = [
      makeSession({
        id: "existing",
        date: "2024-01-14",
        startTime: 1000,
        imageIds: ["img-1", "img-2", "img-3", "img-5"],
      }),
    ];
    // candidate shares 3 of 4 images (75%)
    const candidate = makeSession({
      id: "candidate",
      date: "2024-01-15",
      startTime: 2000,
      imageIds: ["img-1", "img-2", "img-3", "img-4"],
    });
    expect(isSessionDuplicate(candidate, existing)).toBe(true);
  });

  it("returns false when image overlap is exactly 50%", () => {
    const existing = [
      makeSession({
        id: "existing",
        date: "2024-01-14",
        startTime: 1000,
        imageIds: ["img-1", "img-2", "img-5", "img-6"],
      }),
    ];
    // candidate shares 2 of 4 images (50%) - not > 50%
    const candidate = makeSession({
      id: "candidate",
      date: "2024-01-15",
      startTime: 2000,
      imageIds: ["img-1", "img-2", "img-3", "img-4"],
    });
    expect(isSessionDuplicate(candidate, existing)).toBe(false);
  });

  it("returns false when no date/time match and low overlap", () => {
    const existing = [
      makeSession({
        id: "existing",
        date: "2024-01-14",
        startTime: 1000,
        imageIds: ["img-10", "img-11"],
      }),
    ];
    const candidate = makeSession({
      id: "candidate",
      date: "2024-01-15",
      startTime: 2000,
      imageIds: ["img-1", "img-2"],
    });
    expect(isSessionDuplicate(candidate, existing)).toBe(false);
  });

  it("handles candidate with empty imageIds", () => {
    const existing = [makeSession({ id: "existing", date: "2024-01-14", startTime: 1000 })];
    const candidate = makeSession({
      id: "candidate",
      date: "2024-01-15",
      startTime: 2000,
      imageIds: [],
    });
    expect(isSessionDuplicate(candidate, existing)).toBe(false);
  });

  it("checks against multiple existing sessions", () => {
    const existing = [
      makeSession({ id: "e1", date: "2024-01-10", startTime: 100, imageIds: ["a", "b"] }),
      makeSession({
        id: "e2",
        date: "2024-01-12",
        startTime: 200,
        imageIds: ["img-1", "img-2", "img-3"],
      }),
    ];
    // overlaps 3/4 with e2
    const candidate = makeSession({
      id: "c",
      date: "2024-01-15",
      startTime: 999,
      imageIds: ["img-1", "img-2", "img-3", "img-4"],
    });
    expect(isSessionDuplicate(candidate, existing)).toBe(true);
  });
});

// ===== Detected sessions new field defaults =====

describe("detectSessions new field defaults", () => {
  it("detected sessions have undefined rating/bortle/tags by default", () => {
    const files = [makeFile("f1", "2024-01-15T22:00:00Z"), makeFile("f2", "2024-01-15T22:30:00Z")];
    const sessions = detectSessions(files);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].rating).toBeUndefined();
    expect(sessions[0].bortle).toBeUndefined();
    expect(sessions[0].tags).toBeUndefined();
  });

  it("detected sessions have a valid createdAt timestamp", () => {
    const before = Date.now();
    const files = [makeFile("f1", "2024-01-15T22:00:00Z")];
    const sessions = detectSessions(files);
    const after = Date.now();
    expect(sessions[0].createdAt).toBeGreaterThanOrEqual(before);
    expect(sessions[0].createdAt).toBeLessThanOrEqual(after);
  });

  it("detected sessions have unique IDs", () => {
    const files = [makeFile("f1", "2024-01-15T22:00:00Z"), makeFile("f2", "2024-01-16T22:00:00Z")];
    const sessions = detectSessions(files, 60);
    expect(sessions).toHaveLength(2);
    expect(sessions[0].id).not.toBe(sessions[1].id);
  });
});
