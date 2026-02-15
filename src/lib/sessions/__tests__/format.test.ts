import { formatDuration } from "../format";

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
