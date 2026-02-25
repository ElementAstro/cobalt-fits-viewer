import { formatDuration, formatTimeHHMM, parseGeoCoordinate } from "../format";

describe("formatDuration", () => {
  it("formats seconds under a minute", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(59)).toBe("59s");
  });

  it("rounds fractional seconds", () => {
    expect(formatDuration(29.6)).toBe("30s");
    expect(formatDuration(0.4)).toBe("0s");
  });

  it("formats minutes only", () => {
    expect(formatDuration(60)).toBe("1m");
    expect(formatDuration(120)).toBe("2m");
    expect(formatDuration(3540)).toBe("59m");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
    expect(formatDuration(3660)).toBe("1h 1m");
    expect(formatDuration(9000)).toBe("2h 30m");
  });

  it("floors partial minutes in hour display", () => {
    expect(formatDuration(3601)).toBe("1h 0m");
    expect(formatDuration(3659)).toBe("1h 0m");
  });

  it("handles large durations (multi-day)", () => {
    // 25 hours
    expect(formatDuration(90000)).toBe("25h 0m");
    // 100 hours
    expect(formatDuration(360000)).toBe("100h 0m");
  });

  it("handles exact boundary at 60 seconds", () => {
    expect(formatDuration(60)).toBe("1m");
  });

  it("handles exact boundary at 3600 seconds", () => {
    expect(formatDuration(3600)).toBe("1h 0m");
  });

  it("handles negative or zero input", () => {
    expect(formatDuration(0)).toBe("0s");
    expect(formatDuration(-1)).toBe("-1s");
  });
});

describe("formatTimeHHMM", () => {
  it("formats time as HH:MM with zero-padding", () => {
    expect(formatTimeHHMM(new Date(2025, 0, 1, 9, 5))).toBe("09:05");
    expect(formatTimeHHMM(new Date(2025, 0, 1, 23, 59))).toBe("23:59");
    expect(formatTimeHHMM(new Date(2025, 0, 1, 0, 0))).toBe("00:00");
  });

  it("handles noon and midnight", () => {
    expect(formatTimeHHMM(new Date(2025, 5, 15, 12, 0))).toBe("12:00");
    expect(formatTimeHHMM(new Date(2025, 5, 15, 0, 0))).toBe("00:00");
  });
});

describe("parseGeoCoordinate", () => {
  it("returns undefined for empty string", () => {
    expect(parseGeoCoordinate("", { min: -90, max: 90 })).toBeUndefined();
    expect(parseGeoCoordinate("  ", { min: -90, max: 90 })).toBeUndefined();
  });

  it("returns null for non-numeric input", () => {
    expect(parseGeoCoordinate("abc", { min: -90, max: 90 })).toBeNull();
    expect(parseGeoCoordinate("NaN", { min: -90, max: 90 })).toBeNull();
    expect(parseGeoCoordinate("Infinity", { min: -90, max: 90 })).toBeNull();
  });

  it("returns null for out-of-range values", () => {
    expect(parseGeoCoordinate("91", { min: -90, max: 90 })).toBeNull();
    expect(parseGeoCoordinate("-91", { min: -90, max: 90 })).toBeNull();
    expect(parseGeoCoordinate("181", { min: -180, max: 180 })).toBeNull();
  });

  it("parses valid coordinates", () => {
    expect(parseGeoCoordinate("39.9042", { min: -90, max: 90 })).toBeCloseTo(39.9042);
    expect(parseGeoCoordinate("-33.8688", { min: -90, max: 90 })).toBeCloseTo(-33.8688);
    expect(parseGeoCoordinate("116.4074", { min: -180, max: 180 })).toBeCloseTo(116.4074);
  });

  it("handles boundary values", () => {
    expect(parseGeoCoordinate("90", { min: -90, max: 90 })).toBe(90);
    expect(parseGeoCoordinate("-90", { min: -90, max: 90 })).toBe(-90);
    expect(parseGeoCoordinate("0", { min: -90, max: 90 })).toBe(0);
  });

  it("trims whitespace", () => {
    expect(parseGeoCoordinate("  39.9  ", { min: -90, max: 90 })).toBeCloseTo(39.9);
  });
});
