import type { FitsMetadata, Target, TargetGroup } from "../../fits/types";
import {
  calculateTargetStatistics,
  calculateGroupStatistics,
  formatExposureHours,
  getMonthlyStatistics,
  getProgressOverview,
} from "../targetStatistics";

const makeTarget = (overrides: Partial<Target> = {}): Target => {
  const now = Date.now();
  return {
    id: "t1",
    name: "M42",
    aliases: [],
    type: "nebula",
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
};

const makeFile = (overrides: Partial<FitsMetadata> = {}): FitsMetadata =>
  ({
    id: "f1",
    filename: "f1.fits",
    filepath: "/tmp/f1.fits",
    fileSize: 1000,
    importDate: 1,
    frameType: "light",
    isFavorite: false,
    tags: [],
    albumIds: [],
    ...overrides,
  }) as FitsMetadata;

describe("targetStatistics", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-06-15T00:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calculates aggregate statistics and leaderboards", () => {
    const targets = [
      makeTarget({
        id: "a",
        type: "nebula",
        status: "completed",
        tags: ["deep-sky"],
        category: "Winter",
        isFavorite: true,
        ra: 10,
        dec: 20,
        imageIds: ["f1", "f2"],
        createdAt: new Date("2024-01-10T00:00:00Z").getTime(),
      }),
      makeTarget({
        id: "b",
        type: "galaxy",
        status: "planned",
        tags: ["deep-sky", "widefield"],
        category: "Autumn",
        isPinned: true,
        imageIds: ["f3"],
        createdAt: new Date("2024-02-10T00:00:00Z").getTime(),
      }),
    ];
    const files = [
      makeFile({ id: "f1", exptime: 120 }),
      makeFile({ id: "f2", exptime: 180 }),
      makeFile({ id: "f3", exptime: 60 }),
    ];

    const stats = calculateTargetStatistics(targets, files);
    expect(stats.totalTargets).toBe(2);
    expect(stats.byStatus).toEqual({ completed: 1, planned: 1 });
    expect(stats.byType).toEqual({ nebula: 1, galaxy: 1 });
    expect(stats.totalExposureSeconds).toBe(360);
    expect(stats.totalFrames).toBe(3);
    expect(stats.favoritesCount).toBe(1);
    expect(stats.pinnedCount).toBe(1);
    expect(stats.withCoordinates).toBe(1);
    expect(stats.withImages).toBe(2);
    expect(stats.categoryBreakdown).toEqual({ Winter: 1, Autumn: 1 });
    expect(stats.tagBreakdown["deep-sky"]).toBe(2);
    expect(stats.exposureLeaderboard[0].target.id).toBe("a");
    expect(stats.monthlyActivity).toEqual({ "2024-01": 1, "2024-02": 1 });
    expect(stats.averageExposurePerTarget).toBe(180);
    expect(stats.averageFramesPerTarget).toBe(1.5);
  });

  it("handles empty target list", () => {
    const stats = calculateTargetStatistics([], []);
    expect(stats.totalTargets).toBe(0);
    expect(stats.averageExposurePerTarget).toBe(0);
    expect(stats.averageFramesPerTarget).toBe(0);
    expect(stats.exposureLeaderboard).toEqual([]);
  });

  it("builds monthly statistics in chronological order", () => {
    const targets = [
      makeTarget({
        id: "a",
        imageIds: ["f1", "f2"],
        createdAt: new Date("2024-05-10T00:00:00Z").getTime(),
      }),
      makeTarget({
        id: "b",
        imageIds: ["f3"],
        createdAt: new Date("2024-04-10T00:00:00Z").getTime(),
      }),
    ];
    const files = [
      makeFile({ id: "f1", exptime: 60 }),
      makeFile({ id: "f2", exptime: 120 }),
      makeFile({ id: "f3", exptime: 30 }),
    ];

    const monthly = getMonthlyStatistics(targets, files, 3);
    expect(monthly).toHaveLength(3);
    const byMonth = Object.fromEntries(monthly.map((m) => [m.month, m]));
    expect(byMonth["2024-04"].targetsCount).toBe(1);
    expect(byMonth["2024-05"].exposureSeconds).toBe(180);
  });

  it("formats exposure hours and reports progress overview", () => {
    expect(formatExposureHours(1800)).toBe("30m");
    expect(formatExposureHours(5400)).toBe("1.5h");
    expect(formatExposureHours(36_000)).toBe("10h");

    const targets = [
      makeTarget({ status: "planned" }),
      makeTarget({ id: "b", status: "acquiring" }),
      makeTarget({ id: "c", status: "completed" }),
      makeTarget({ id: "d", status: "processed" }),
    ];
    expect(getProgressOverview(targets)).toEqual({
      planned: 1,
      acquiring: 1,
      completed: 1,
      processed: 1,
    });
  });

  describe("calculateGroupStatistics", () => {
    const makeGroup = (overrides: Partial<TargetGroup> = {}): TargetGroup => ({
      id: "g1",
      name: "Test Group",
      targetIds: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });

    it("calculates stats for group members only", () => {
      const targets = [
        makeTarget({ id: "a", status: "completed", imageIds: ["f1", "f2"] }),
        makeTarget({ id: "b", status: "planned", imageIds: ["f3"] }),
        makeTarget({ id: "c", status: "acquiring", imageIds: [] }),
      ];
      const files = [
        makeFile({ id: "f1", exptime: 120, filter: "Ha" }),
        makeFile({ id: "f2", exptime: 180, filter: "OIII" }),
        makeFile({ id: "f3", exptime: 60, filter: "Ha" }),
      ];
      const group = makeGroup({ targetIds: ["a", "b"] });

      const stats = calculateGroupStatistics(group, targets, files);
      expect(stats.targetCount).toBe(2);
      expect(stats.byStatus).toEqual({ completed: 1, planned: 1 });
      expect(stats.totalFrames).toBe(3);
      expect(stats.totalExposureSeconds).toBe(360);
      expect(stats.filterBreakdown["Ha"].count).toBe(2);
      expect(stats.filterBreakdown["Ha"].totalSeconds).toBe(180);
      expect(stats.filterBreakdown["OIII"].count).toBe(1);
    });

    it("returns zeros for empty group", () => {
      const group = makeGroup({ targetIds: [] });
      const stats = calculateGroupStatistics(group, [], []);
      expect(stats.targetCount).toBe(0);
      expect(stats.totalFrames).toBe(0);
      expect(stats.totalExposureSeconds).toBe(0);
      expect(stats.overallCompletion).toBe(0);
    });

    it("calculates completion from planned exposure", () => {
      const targets = [
        makeTarget({
          id: "a",
          imageIds: ["f1"],
          plannedFilters: ["Ha"],
          plannedExposure: { Ha: 300 },
        }),
      ];
      const files = [makeFile({ id: "f1", exptime: 150, filter: "Ha" })];
      const group = makeGroup({ targetIds: ["a"] });

      const stats = calculateGroupStatistics(group, targets, files);
      expect(stats.overallCompletion).toBe(50);
    });

    it("ignores targets not in the group", () => {
      const targets = [
        makeTarget({ id: "a", imageIds: ["f1"] }),
        makeTarget({ id: "b", imageIds: ["f2"] }),
      ];
      const files = [makeFile({ id: "f1", exptime: 100 }), makeFile({ id: "f2", exptime: 200 })];
      const group = makeGroup({ targetIds: ["a"] });

      const stats = calculateGroupStatistics(group, targets, files);
      expect(stats.targetCount).toBe(1);
      expect(stats.totalExposureSeconds).toBe(100);
    });

    it("tracks lastActivityTime from target updatedAt", () => {
      const targets = [
        makeTarget({ id: "a", updatedAt: 1000 }),
        makeTarget({ id: "b", updatedAt: 3000 }),
      ];
      const group = makeGroup({ targetIds: ["a", "b"], createdAt: 500 });

      const stats = calculateGroupStatistics(group, targets, []);
      expect(stats.lastActivityTime).toBe(3000);
    });
  });
});
