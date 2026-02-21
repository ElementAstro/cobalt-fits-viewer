import { formatVideoDuration, formatVideoDurationWithMs, formatVideoResolution } from "../format";

describe("formatVideoDuration", () => {
  it("returns 00:00 for null/undefined/zero", () => {
    expect(formatVideoDuration(null)).toBe("00:00");
    expect(formatVideoDuration(undefined)).toBe("00:00");
    expect(formatVideoDuration(0)).toBe("00:00");
    expect(formatVideoDuration(-100)).toBe("00:00");
  });

  it("formats seconds correctly", () => {
    expect(formatVideoDuration(5000)).toBe("00:05");
    expect(formatVideoDuration(65000)).toBe("01:05");
  });

  it("includes hours when >= 1h", () => {
    expect(formatVideoDuration(3661000)).toBe("01:01:01");
  });
});

describe("formatVideoDurationWithMs", () => {
  it("returns 00:00.0 for null/undefined/zero", () => {
    expect(formatVideoDurationWithMs(null)).toBe("00:00.0");
    expect(formatVideoDurationWithMs(undefined)).toBe("00:00.0");
    expect(formatVideoDurationWithMs(0)).toBe("00:00.0");
    expect(formatVideoDurationWithMs(-50)).toBe("00:00.0");
  });

  it("formats with tenths of a second", () => {
    expect(formatVideoDurationWithMs(1500)).toBe("00:01.5");
    expect(formatVideoDurationWithMs(12300)).toBe("00:12.3");
    expect(formatVideoDurationWithMs(60000)).toBe("01:00.0");
  });

  it("includes hours when >= 1h", () => {
    expect(formatVideoDurationWithMs(3661200)).toBe("01:01:01.2");
  });

  it("truncates sub-100ms correctly", () => {
    expect(formatVideoDurationWithMs(1050)).toBe("00:01.0");
    expect(formatVideoDurationWithMs(1950)).toBe("00:01.9");
  });
});

describe("formatVideoResolution", () => {
  it("returns empty string for missing values", () => {
    expect(formatVideoResolution(null, null)).toBe("");
    expect(formatVideoResolution(1920, null)).toBe("");
    expect(formatVideoResolution(null, 1080)).toBe("");
  });

  it("formats width x height", () => {
    expect(formatVideoResolution(1920, 1080)).toBe("1920×1080");
    expect(formatVideoResolution(3840, 2160)).toBe("3840×2160");
  });
});
