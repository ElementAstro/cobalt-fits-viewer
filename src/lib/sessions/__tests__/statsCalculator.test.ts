import type { FitsMetadata, ObservationSession } from "../../fits/types";
import { calculateObservationStats, getMonthlyTrend } from "../statsCalculator";

const makeSession = (overrides: Partial<ObservationSession> = {}): ObservationSession => ({
  id: "s1",
  date: "2024-01-15",
  startTime: 1705352400000,
  endTime: 1705356000000,
  duration: 3600,
  targets: ["M42"],
  imageIds: ["f1", "f2"],
  equipment: { telescope: "RC8", camera: "ASI294MM", filters: ["Ha"] },
  createdAt: Date.now(),
  ...overrides,
});

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: "f1",
    filename: "light_001.fits",
    uri: "/path/light_001.fits",
    importDate: Date.now(),
    dateObs: "2024-01-15T22:00:00Z",
    object: "M42",
    filter: "Ha",
    exptime: 300,
    ...overrides,
  }) as FitsMetadata;

// ===== calculateObservationStats =====

describe("calculateObservationStats", () => {
  it("computes totals", () => {
    const sessions = [makeSession({ duration: 3600 }), makeSession({ id: "s2", duration: 7200 })];
    const files = [makeFile(), makeFile({ id: "f2" })];
    const stats = calculateObservationStats(sessions, files);
    expect(stats.totalObservationTime).toBe(10800);
    expect(stats.totalSessions).toBe(2);
    expect(stats.totalImages).toBe(2);
  });

  it("returns empty stats for no data", () => {
    const stats = calculateObservationStats([], []);
    expect(stats.totalObservationTime).toBe(0);
    expect(stats.totalSessions).toBe(0);
    expect(stats.totalImages).toBe(0);
    expect(stats.topTargets).toEqual([]);
  });

  it("computes top targets sorted by exposure", () => {
    const files = [
      makeFile({ id: "f1", object: "M42", exptime: 600 }),
      makeFile({ id: "f2", object: "M42", exptime: 300 }),
      makeFile({ id: "f3", object: "M31", exptime: 1200 }),
    ];
    const stats = calculateObservationStats([], files);
    expect(stats.topTargets[0].name).toBe("M31");
    expect(stats.topTargets[0].exposure).toBe(1200);
    expect(stats.topTargets[1].name).toBe("M42");
    expect(stats.topTargets[1].count).toBe(2);
    expect(stats.topTargets[1].exposure).toBe(900);
  });

  it("limits topTargets to 10", () => {
    const files = Array.from({ length: 15 }, (_, i) =>
      makeFile({ id: `f${i}`, object: `Target${i}`, exptime: (15 - i) * 100 }),
    );
    const stats = calculateObservationStats([], files);
    expect(stats.topTargets).toHaveLength(10);
  });

  it("computes byMonth counts", () => {
    const sessions = [
      makeSession({ date: "2024-01-15" }),
      makeSession({ id: "s2", date: "2024-01-20" }),
      makeSession({ id: "s3", date: "2024-02-10" }),
    ];
    const stats = calculateObservationStats(sessions, []);
    expect(stats.byMonth["2024-01"]).toBe(2);
    expect(stats.byMonth["2024-02"]).toBe(1);
  });

  it("computes byEquipment counts", () => {
    const sessions = [
      makeSession({ equipment: { telescope: "RC8", camera: "ASI294MM" } }),
      makeSession({ id: "s2", equipment: { telescope: "RC8", camera: "ASI2600MM" } }),
    ];
    const stats = calculateObservationStats(sessions, []);
    expect(stats.byEquipment["RC8"]).toBe(2);
    expect(stats.byEquipment["ASI294MM"]).toBe(1);
    expect(stats.byEquipment["ASI2600MM"]).toBe(1);
  });

  it("computes exposureByFilter", () => {
    const files = [
      makeFile({ id: "f1", filter: "Ha", exptime: 300 }),
      makeFile({ id: "f2", filter: "Ha", exptime: 300 }),
      makeFile({ id: "f3", filter: "OIII", exptime: 600 }),
    ];
    const stats = calculateObservationStats([], files);
    expect(stats.exposureByFilter["Ha"]).toBe(600);
    expect(stats.exposureByFilter["OIII"]).toBe(600);
  });

  it("defaults unknown object/filter", () => {
    const files = [makeFile({ object: undefined, filter: undefined, exptime: undefined })];
    const stats = calculateObservationStats([], files as FitsMetadata[]);
    expect(stats.topTargets[0].name).toBe("Unknown");
    expect(stats.exposureByFilter["Unknown"]).toBe(0);
  });
});

// ===== getMonthlyTrend =====

describe("getMonthlyTrend", () => {
  it("returns requested number of months", () => {
    const trend = getMonthlyTrend([], 6);
    expect(trend).toHaveLength(6);
  });

  it("defaults to 12 months", () => {
    const trend = getMonthlyTrend([]);
    expect(trend).toHaveLength(12);
  });

  it("each entry has month, hours, sessions", () => {
    const trend = getMonthlyTrend([], 1);
    expect(trend[0]).toHaveProperty("month");
    expect(trend[0]).toHaveProperty("hours");
    expect(trend[0]).toHaveProperty("sessions");
  });

  it("computes hours from session duration", () => {
    const now = new Date();
    const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sessions = [
      makeSession({ date: `${key}-10`, duration: 7200 }), // 2h
      makeSession({ id: "s2", date: `${key}-15`, duration: 3600 }), // 1h
    ];
    const trend = getMonthlyTrend(sessions, 1);
    expect(trend[0].month).toBe(key);
    expect(trend[0].hours).toBeCloseTo(3.0, 1);
    expect(trend[0].sessions).toBe(2);
  });

  it("returns zero for months without sessions", () => {
    const trend = getMonthlyTrend([], 3);
    trend.forEach((m) => {
      expect(m.hours).toBe(0);
      expect(m.sessions).toBe(0);
    });
  });

  it("months are in chronological order", () => {
    const trend = getMonthlyTrend([], 3);
    const months = trend.map((t) => t.month);
    const sorted = [...months].sort();
    expect(months).toEqual(sorted);
  });

  it("handles single-month request", () => {
    const trend = getMonthlyTrend([], 1);
    expect(trend).toHaveLength(1);
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    expect(trend[0].month).toBe(expected);
  });
});

// ===== Additional edge cases =====

describe("calculateObservationStats edge cases", () => {
  it("counts mount in byEquipment", () => {
    const sessions = [
      makeSession({ equipment: { telescope: "RC8", camera: "ASI294MM", mount: "EQ6-R" } }),
      makeSession({
        id: "s2",
        equipment: { telescope: "RC8", camera: "ASI294MM", mount: "EQ6-R" },
      }),
    ];
    const stats = calculateObservationStats(sessions, []);
    expect(stats.byEquipment["EQ6-R"]).toBe(2);
  });

  it("handles sessions with no equipment gracefully", () => {
    const sessions = [makeSession({ equipment: {} })];
    const stats = calculateObservationStats(sessions, []);
    expect(stats.totalSessions).toBe(1);
    expect(Object.keys(stats.byEquipment)).toHaveLength(0);
  });

  it("handles files with zero exptime", () => {
    const files = [makeFile({ id: "f1", object: "M42", filter: "Ha", exptime: 0 })];
    const stats = calculateObservationStats([], files);
    expect(stats.topTargets[0].exposure).toBe(0);
    expect(stats.exposureByFilter["Ha"]).toBe(0);
  });

  it("handles single session for totals", () => {
    const sessions = [makeSession({ duration: 5400 })];
    const files = [makeFile({ id: "f1" }), makeFile({ id: "f2" }), makeFile({ id: "f3" })];
    const stats = calculateObservationStats(sessions, files);
    expect(stats.totalObservationTime).toBe(5400);
    expect(stats.totalSessions).toBe(1);
    expect(stats.totalImages).toBe(3);
  });
});
