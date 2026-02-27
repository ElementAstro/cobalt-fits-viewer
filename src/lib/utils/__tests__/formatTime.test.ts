import { formatEta } from "../formatTime";

describe("formatEta", () => {
  it("formats sub-minute as seconds with ceiling", () => {
    expect(formatEta(0.5)).toBe("1s");
    expect(formatEta(1)).toBe("1s");
    expect(formatEta(30)).toBe("30s");
    expect(formatEta(59.1)).toBe("60s");
  });

  it("formats minutes and seconds", () => {
    expect(formatEta(60)).toBe("1m 0s");
    expect(formatEta(61)).toBe("1m 1s");
    expect(formatEta(90)).toBe("1m 30s");
    expect(formatEta(125.3)).toBe("2m 6s");
    expect(formatEta(3599)).toBe("59m 59s");
  });

  it("formats hours and minutes", () => {
    expect(formatEta(3600)).toBe("1h 0m");
    expect(formatEta(3661)).toBe("1h 1m");
    expect(formatEta(7200)).toBe("2h 0m");
    expect(formatEta(7380)).toBe("2h 3m");
    expect(formatEta(86400)).toBe("24h 0m");
  });

  it("handles edge case of exactly 0 seconds", () => {
    expect(formatEta(0)).toBe("0s");
  });

  it("handles fractional seconds under a minute", () => {
    expect(formatEta(0.1)).toBe("1s");
    expect(formatEta(59.9)).toBe("60s");
  });
});
