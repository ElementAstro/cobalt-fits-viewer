import { formatRA, formatDec, formatFieldSize, formatDuration } from "../formatUtils";

describe("formatRA", () => {
  it("formats 0° as 0h 0m 0.0s", () => {
    expect(formatRA(0)).toBe("0h 0m 0.0s");
  });

  it("formats 180° as 12h 0m 0.0s", () => {
    expect(formatRA(180)).toBe("12h 0m 0.0s");
  });

  it("formats 83.633° correctly", () => {
    const result = formatRA(83.633);
    expect(result).toMatch(/^5h 34m/);
  });

  it("formats 360° as 24h 0m 0.0s", () => {
    expect(formatRA(360)).toBe("24h 0m 0.0s");
  });

  it("formats fractional hours", () => {
    // 15° = 1h exactly
    expect(formatRA(15)).toBe("1h 0m 0.0s");
    // 22.5° = 1h 30m
    expect(formatRA(22.5)).toBe("1h 30m 0.0s");
  });
});

describe("formatDec", () => {
  it("formats positive declination with + sign", () => {
    expect(formatDec(45)).toBe("+45° 0′ 0.0″");
  });

  it("formats negative declination with - sign", () => {
    expect(formatDec(-30)).toBe("-30° 0′ 0.0″");
  });

  it("formats zero declination as positive", () => {
    expect(formatDec(0)).toBe("+0° 0′ 0.0″");
  });

  it("formats fractional degrees", () => {
    const result = formatDec(45.5);
    expect(result).toBe("+45° 30′ 0.0″");
  });

  it("formats -5.375° correctly", () => {
    const result = formatDec(-5.375);
    expect(result).toMatch(/^-5° 22′/);
  });
});

describe("formatFieldSize", () => {
  it("formats >= 1° in degrees", () => {
    expect(formatFieldSize(2.5)).toBe("2.50°");
    expect(formatFieldSize(1.0)).toBe("1.00°");
  });

  it("formats >= 1 arcmin in arcminutes", () => {
    expect(formatFieldSize(0.5)).toBe("30.0′");
    expect(formatFieldSize(1 / 60)).toBe("1.0′");
  });

  it("formats small values in arcseconds", () => {
    expect(formatFieldSize(1 / 3600)).toBe("1″");
    expect(formatFieldSize(10 / 3600)).toBe("10″");
  });

  it("formats zero as arcseconds", () => {
    expect(formatFieldSize(0)).toBe("0″");
  });
});

describe("formatDuration", () => {
  it("formats seconds only", () => {
    expect(formatDuration(5000)).toBe("5s");
    expect(formatDuration(59000)).toBe("59s");
  });

  it("formats minutes and seconds", () => {
    expect(formatDuration(90000)).toBe("1m 30s");
    expect(formatDuration(3599000)).toBe("59m 59s");
  });

  it("formats hours and minutes", () => {
    expect(formatDuration(3600000)).toBe("1h 0m");
    expect(formatDuration(5400000)).toBe("1h 30m");
  });

  it("handles zero", () => {
    expect(formatDuration(0)).toBe("0s");
  });

  it("handles sub-second values", () => {
    expect(formatDuration(500)).toBe("0s");
  });
});
