import {
  calculateExposureStats,
  calculateCompletionRate,
  formatExposureTime,
} from "../exposureStats";
import type { FitsMetadata, Target } from "../../fits/types";

// Helper to create mock targets with all required fields
function createMockTarget(overrides: Partial<Target> = {}): Target {
  const now = Date.now();
  return {
    id: "t1",
    name: "Test",
    aliases: [],
    type: "other",
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

describe("calculateExposureStats", () => {
  it("calculates total exposure and frame count", () => {
    const files: FitsMetadata[] = [
      { id: "f1", filter: "L", exptime: 300, dateObs: "2024-01-01T20:00:00" } as FitsMetadata,
      { id: "f2", filter: "L", exptime: 300, dateObs: "2024-01-01T20:05:00" } as FitsMetadata,
      { id: "f3", filter: "R", exptime: 120, dateObs: "2024-01-02T20:00:00" } as FitsMetadata,
    ];
    const stats = calculateExposureStats(files);
    expect(stats.totalExposure).toBe(720);
    expect(stats.frameCount).toBe(3);
  });

  it("groups exposure by filter", () => {
    const files: FitsMetadata[] = [
      { id: "f1", filter: "L", exptime: 300 } as FitsMetadata,
      { id: "f2", filter: "R", exptime: 120 } as FitsMetadata,
      { id: "f3", filter: "L", exptime: 300 } as FitsMetadata,
    ];
    const stats = calculateExposureStats(files);
    expect(stats.byFilter.L).toBe(600);
    expect(stats.byFilter.R).toBe(120);
    expect(stats.byFilterCount.L).toBe(2);
    expect(stats.byFilterCount.R).toBe(1);
  });

  it("tracks date range", () => {
    const files: FitsMetadata[] = [
      { id: "f1", dateObs: "2024-03-15T20:00:00" } as FitsMetadata,
      { id: "f2", dateObs: "2024-01-10T20:00:00" } as FitsMetadata,
      { id: "f3", dateObs: "2024-06-20T20:00:00" } as FitsMetadata,
    ];
    const stats = calculateExposureStats(files);
    expect(stats.dateRange[0]).toBe("2024-01-10T20:00:00");
    expect(stats.dateRange[1]).toBe("2024-06-20T20:00:00");
  });

  it("handles files with no filter as Unknown", () => {
    const files: FitsMetadata[] = [{ id: "f1", exptime: 60 } as FitsMetadata];
    const stats = calculateExposureStats(files);
    expect(stats.byFilter.Unknown).toBe(60);
  });

  it("returns zeros for empty input", () => {
    const stats = calculateExposureStats([]);
    expect(stats.totalExposure).toBe(0);
    expect(stats.frameCount).toBe(0);
    expect(stats.dateRange).toEqual(["", ""]);
  });
});

describe("calculateCompletionRate", () => {
  it("calculates overall completion percentage", () => {
    const target = createMockTarget({
      id: "t1",
      name: "M31",
      type: "galaxy",
      imageIds: ["f1", "f2"],
      status: "acquiring",
      plannedFilters: ["L"],
      plannedExposure: { L: 600 },
    });
    const files: FitsMetadata[] = [
      { id: "f1", filter: "L", exptime: 300 } as FitsMetadata,
      { id: "f2", filter: "L", exptime: 300 } as FitsMetadata,
    ];
    const result = calculateCompletionRate(target, files);
    expect(result.overall).toBe(100);
    expect(result.byFilter.L.percent).toBe(100);
  });

  it("caps at 100%", () => {
    const target = createMockTarget({
      id: "t1",
      name: "M31",
      type: "galaxy",
      imageIds: ["f1", "f2"],
      status: "acquiring",
      plannedFilters: ["L"],
      plannedExposure: { L: 300 },
    });
    const files: FitsMetadata[] = [
      { id: "f1", filter: "L", exptime: 300 } as FitsMetadata,
      { id: "f2", filter: "L", exptime: 300 } as FitsMetadata,
    ];
    const result = calculateCompletionRate(target, files);
    expect(result.overall).toBe(100);
  });

  it("handles partial completion", () => {
    const target = createMockTarget({
      id: "t1",
      name: "Test",
      type: "other",
      imageIds: ["f1"],
      status: "acquiring",
      plannedFilters: ["L"],
      plannedExposure: { L: 600 },
    });
    const files: FitsMetadata[] = [{ id: "f1", filter: "L", exptime: 300 } as FitsMetadata];
    const result = calculateCompletionRate(target, files);
    expect(result.overall).toBe(50);
    expect(result.byFilter.L.percent).toBe(50);
  });

  it("includes unplanned filters as 100%", () => {
    const target = createMockTarget({
      id: "t1",
      name: "Test",
      type: "other",
      imageIds: ["f1"],
      status: "acquiring",
      plannedFilters: [],
      plannedExposure: {},
    });
    const files: FitsMetadata[] = [{ id: "f1", filter: "Ha", exptime: 300 } as FitsMetadata];
    const result = calculateCompletionRate(target, files);
    expect(result.byFilter.Ha.percent).toBe(100);
  });

  it("returns 0 for target with no images and no plan", () => {
    const target = createMockTarget({
      id: "t1",
      name: "Test",
      type: "other",
      imageIds: [],
      status: "planned",
      plannedFilters: [],
      plannedExposure: {},
    });
    const result = calculateCompletionRate(target, []);
    expect(result.overall).toBe(0);
  });
});

describe("formatExposureTime", () => {
  it("formats seconds", () => {
    expect(formatExposureTime(30)).toBe("30s");
    expect(formatExposureTime(59)).toBe("59s");
  });

  it("formats minutes", () => {
    expect(formatExposureTime(60)).toBe("1m");
    expect(formatExposureTime(300)).toBe("5m");
    expect(formatExposureTime(3599)).toBe("60m");
  });

  it("formats hours and minutes", () => {
    expect(formatExposureTime(3600)).toBe("1h");
    expect(formatExposureTime(5400)).toBe("1h 30m");
    expect(formatExposureTime(7200)).toBe("2h");
  });

  it("rounds appropriately", () => {
    expect(formatExposureTime(0)).toBe("0s");
    expect(formatExposureTime(0.5)).toBe("1s");
  });
});
