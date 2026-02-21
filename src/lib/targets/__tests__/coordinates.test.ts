import {
  formatRA,
  formatDec,
  parseRA,
  parseDec,
  formatCoordinates,
  parseCoordinatePair,
} from "../coordinates";

describe("formatRA", () => {
  it("formats 0 degrees as 00h 00m 00s", () => {
    expect(formatRA(0)).toBe("00h 00m 00s");
  });

  it("formats 180 degrees as 12h 00m 00s", () => {
    expect(formatRA(180)).toBe("12h 00m 00s");
  });

  it("formats 83.633 degrees (M1) correctly", () => {
    const result = formatRA(83.633);
    expect(result).toMatch(/^05h 34m/);
  });

  it("handles negative values by wrapping", () => {
    const result = formatRA(-15);
    expect(result).toMatch(/^23h/);
  });

  it("handles values > 360 by wrapping", () => {
    expect(formatRA(360)).toBe("00h 00m 00s");
    expect(formatRA(375)).toBe(formatRA(15));
  });
});

describe("formatDec", () => {
  it("formats 0 degrees as +00° 00′ 00″", () => {
    expect(formatDec(0)).toBe("+00° 00′ 00″");
  });

  it("formats positive declination correctly", () => {
    const result = formatDec(22.0145);
    expect(result).toMatch(/^\+22°/);
  });

  it("formats negative declination correctly", () => {
    const result = formatDec(-16.716);
    expect(result).toMatch(/^-16°/);
  });

  it("formats +90 correctly", () => {
    expect(formatDec(90)).toBe("+90° 00′ 00″");
  });

  it("formats -90 correctly", () => {
    expect(formatDec(-90)).toBe("-90° 00′ 00″");
  });
});

describe("parseRA", () => {
  it("parses single number as hours", () => {
    // parseRA treats single numbers as hours (× 15 = degrees)
    expect(parseRA("12")).toBe(180); // 12h = 180°
    expect(parseRA("0")).toBe(0);
  });

  it("parses HH MM SS format", () => {
    const result = parseRA("05 34 31");
    expect(result).toBeCloseTo(83.629, 1);
  });

  it("parses HHhMMmSSs format", () => {
    const result = parseRA("05h34m31s");
    expect(result).toBeCloseTo(83.629, 1);
  });

  it("parses HH:MM:SS format", () => {
    const result = parseRA("05:34:31");
    expect(result).toBeCloseTo(83.629, 1);
  });

  it("parses decimal degrees when value is greater than 24", () => {
    expect(parseRA("83.633")).toBeCloseTo(83.633, 3);
  });

  it("returns null for invalid input", () => {
    expect(parseRA("abc")).toBeNull();
    expect(parseRA("400")).toBeNull();
    expect(parseRA("-10")).toBeNull();
  });

  it("parses empty string as 0 hours", () => {
    // empty string splits to [""], Number("") = 0, so 0h = 0°
    expect(parseRA("")).toBe(0);
  });
});

describe("parseDec", () => {
  it("parses decimal degrees", () => {
    expect(parseDec("45")).toBe(45);
  });

  it("parses +DD MM SS format", () => {
    const result = parseDec("+22 00 52");
    expect(result).toBeCloseTo(22.0144, 2);
  });

  it("parses -DD°MM′SS″ format", () => {
    const result = parseDec("-16°42′58″");
    expect(result).toBeCloseTo(-16.716, 1);
  });

  it("returns null for out-of-range values", () => {
    expect(parseDec("91")).toBeNull();
    expect(parseDec("-91")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseDec("xyz")).toBeNull();
  });
});

describe("formatCoordinates", () => {
  it("returns null when both are undefined", () => {
    expect(formatCoordinates(undefined, undefined)).toBeNull();
  });

  it("formats both RA and Dec", () => {
    const result = formatCoordinates(83.633, 22.014);
    expect(result).toContain("h");
    expect(result).toContain("°");
  });

  it("shows — for missing RA", () => {
    const result = formatCoordinates(undefined, 22.014);
    expect(result).toContain("—");
    expect(result).toContain("°");
  });

  it("shows — for missing Dec", () => {
    const result = formatCoordinates(83.633, undefined);
    expect(result).toContain("h");
    expect(result).toContain("—");
  });
});

describe("parseCoordinatePair", () => {
  it("parses signed-dec pair with whitespace", () => {
    const result = parseCoordinatePair("05:34:31 +22:00:52");
    expect(result?.ra).toBeCloseTo(83.629, 1);
    expect(result?.dec).toBeCloseTo(22.014, 2);
  });

  it("parses comma-separated decimal pair", () => {
    const result = parseCoordinatePair("83.633, 22.014");
    expect(result?.ra).toBeCloseTo(83.633, 3);
    expect(result?.dec).toBeCloseTo(22.014, 3);
  });

  it("parses labelled pair", () => {
    const result = parseCoordinatePair("RA=05:34:31 Dec=+22:00:52");
    expect(result?.ra).toBeCloseTo(83.629, 1);
    expect(result?.dec).toBeCloseTo(22.014, 2);
  });

  it("returns null when format cannot be split into a pair", () => {
    expect(parseCoordinatePair("05 34 31 22 00 52")).toBeNull();
    expect(parseCoordinatePair("not-a-coordinate")).toBeNull();
  });
});
