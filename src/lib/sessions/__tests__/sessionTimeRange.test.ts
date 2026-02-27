import { resolveManualSessionTimeRange } from "../sessionTimeRange";

describe("resolveManualSessionTimeRange", () => {
  it("resolves same-day range", () => {
    const result = resolveManualSessionTimeRange("2025-03-12", 20, 0, 22, 30);
    expect(result).not.toBeNull();
    expect(result?.crossMidnight).toBe(false);
    expect(result?.duration).toBe(2 * 3600 + 30 * 60);
  });

  it("resolves cross-midnight range to next day when end is earlier", () => {
    const result = resolveManualSessionTimeRange("2025-03-12", 23, 0, 1, 0);
    expect(result).not.toBeNull();
    expect(result?.crossMidnight).toBe(true);
    expect(result?.duration).toBe(2 * 3600);

    const startTime = result?.startTime ?? 0;
    const endTime = result?.endTime ?? 0;
    expect(endTime - startTime).toBe(2 * 3600 * 1000);
  });

  it("returns null for invalid date", () => {
    expect(resolveManualSessionTimeRange("2025-02-30", 20, 0, 21, 0)).toBeNull();
    expect(resolveManualSessionTimeRange("2025-13-01", 20, 0, 21, 0)).toBeNull();
  });
});
