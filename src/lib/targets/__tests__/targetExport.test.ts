const mockFormatCoordinates = jest.fn();
const mockFormatExposureTime = jest.fn((seconds: number) => `${seconds}s`);

jest.mock("../coordinates", () => ({
  formatCoordinates: (ra?: number, dec?: number) => mockFormatCoordinates(ra, dec),
}));
jest.mock("../exposureStats", () => ({
  formatExposureTime: (seconds: number) => mockFormatExposureTime(seconds),
}));

import { Share } from "react-native";
import type { Target } from "../../fits/types";
import {
  formatTargetAsJSON,
  formatTargetAsText,
  formatTargetsAsJSON,
  formatTargetsAsCSV,
  shareTarget,
  shareTargets,
} from "../targetExport";

const makeTarget = (overrides: Partial<Target> = {}): Target => {
  const now = Date.now();
  return {
    id: "t1",
    name: "M42",
    aliases: ["Orion"],
    type: "nebula",
    tags: [],
    isFavorite: false,
    isPinned: false,
    imageIds: [],
    status: "planned",
    plannedFilters: ["Ha"],
    plannedExposure: { Ha: 1200 },
    imageRatings: {},
    changeLog: [],
    createdAt: now,
    updatedAt: now,
    notes: "Great target",
    ...overrides,
  };
};

describe("targetExport", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFormatCoordinates.mockReturnValue("RA 10h DEC +20d");
  });

  it("formats target as shareable text with stats and plan", () => {
    const target = makeTarget();
    const text = formatTargetAsText(target, {
      frameCount: 10,
      totalExposure: 3600,
      filterBreakdown: {
        Ha: { count: 8, totalSeconds: 3000 },
      },
    });

    expect(text).toContain("🔭 M42");
    expect(text).toContain("Aliases: Orion");
    expect(text).toContain("Coordinates: RA 10h DEC +20d");
    expect(text).toContain("Frames: 10");
    expect(text).toContain("Total Exposure: 3600s");
    expect(text).toContain("Ha: 8 frames, 3000s");
    expect(text).toContain("Observation Plan");
    expect(text).toContain("📝 Notes: Great target");
  });

  it("formats target as JSON with selected fields", () => {
    const target = makeTarget({ ra: 10, dec: 20 });
    const json = formatTargetAsJSON(target);
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed.name).toBe("M42");
    expect(parsed.ra).toBe(10);
    expect(parsed.dec).toBe(20);
    expect(parsed.plannedFilters).toEqual(["Ha"]);
  });

  it("shares target text and handles share failures", async () => {
    const target = makeTarget();
    const shareSpy = jest.spyOn(Share, "share");
    shareSpy.mockResolvedValueOnce({ action: Share.sharedAction } as never);
    await expect(shareTarget(target)).resolves.toBe(true);

    shareSpy.mockResolvedValueOnce({ action: "dismissedAction" } as never);
    await expect(shareTarget(target)).resolves.toBe(false);

    shareSpy.mockRejectedValueOnce(new Error("boom"));
    await expect(shareTarget(target)).resolves.toBe(false);
  });

  describe("multi-target export", () => {
    const targets = [
      makeTarget({
        id: "a",
        name: "M42",
        type: "nebula",
        status: "planned",
        ra: 83.8,
        dec: -5.4,
        category: "Winter",
        tags: ["deep-sky"],
        aliases: ["Orion"],
      }),
      makeTarget({
        id: "b",
        name: "M31",
        type: "galaxy",
        status: "completed",
        ra: 10.7,
        dec: 41.3,
        tags: [],
      }),
    ];

    it("formatTargetsAsJSON produces valid JSON array", () => {
      const json = formatTargetsAsJSON(targets);
      const parsed = JSON.parse(json) as Array<Record<string, unknown>>;
      expect(parsed).toHaveLength(2);
      expect(parsed[0].name).toBe("M42");
      expect(parsed[0].category).toBe("Winter");
      expect(parsed[1].name).toBe("M31");
      expect(parsed[1].type).toBe("galaxy");
    });

    it("formatTargetsAsCSV produces header + data rows", () => {
      const csv = formatTargetsAsCSV(targets);
      const lines = csv.split("\n");
      expect(lines).toHaveLength(3);
      expect(lines[0]).toContain("name");
      expect(lines[0]).toContain("type");
      expect(lines[0]).toContain("ra");
      expect(lines[1]).toContain("M42");
      expect(lines[2]).toContain("M31");
    });

    it("formatTargetsAsCSV escapes commas and quotes in fields", () => {
      const t = [makeTarget({ name: 'NGC 1234, "The Blob"', notes: "line1\nline2" })];
      const csv = formatTargetsAsCSV(t);
      // Name should be quoted and internal quotes doubled
      expect(csv).toContain('"NGC 1234, ""The Blob"""');
      // Notes with newline should be quoted
      expect(csv).toContain('"line1\nline2"');
    });

    it("shareTargets calls Share.share with JSON format", async () => {
      const shareSpy = jest.spyOn(Share, "share");
      shareSpy.mockResolvedValueOnce({ action: Share.sharedAction } as never);
      const result = await shareTargets(targets, "json");
      expect(result).toBe(true);
      expect(shareSpy).toHaveBeenCalledWith(expect.objectContaining({ title: "2 Targets" }));
    });

    it("shareTargets handles csv and text formats", async () => {
      const shareSpy = jest.spyOn(Share, "share");
      shareSpy.mockResolvedValueOnce({ action: Share.sharedAction } as never);
      await shareTargets(targets, "csv");
      const csvCall = shareSpy.mock.calls[shareSpy.mock.calls.length - 1][0];
      expect(csvCall.message).toContain("name,type");

      shareSpy.mockResolvedValueOnce({ action: Share.sharedAction } as never);
      await shareTargets(targets, "text");
      const textCall = shareSpy.mock.calls[shareSpy.mock.calls.length - 1][0];
      expect(textCall.message).toContain("🔭 M42");
      expect(textCall.message).toContain("🔭 M31");
    });
  });
});
