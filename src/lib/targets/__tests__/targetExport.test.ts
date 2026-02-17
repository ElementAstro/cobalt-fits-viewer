const mockFormatCoordinates = jest.fn();
const mockFormatExposureTime = jest.fn((seconds: number) => `${seconds}s`);

jest.mock("../coordinates", () => ({
  formatCoordinates: (...args: unknown[]) => mockFormatCoordinates(...args),
}));
jest.mock("../exposureStats", () => ({
  formatExposureTime: (...args: unknown[]) => mockFormatExposureTime(...args),
}));

import { Share } from "react-native";
import type { Target } from "../../fits/types";
import { formatTargetAsJSON, formatTargetAsText, shareTarget } from "../targetExport";

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
});
