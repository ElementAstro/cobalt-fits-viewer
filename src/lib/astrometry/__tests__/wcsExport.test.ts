import { generateWCSKeywords, formatWCSAsText } from "../wcsExport";
import type { AstrometryCalibration } from "../types";

const MOCK_CALIBRATION: AstrometryCalibration = {
  ra: 83.633,
  dec: -5.375,
  radius: 1.5,
  pixscale: 1.08,
  orientation: 45.0,
  parity: 0,
  fieldWidth: 1.2,
  fieldHeight: 0.8,
};

describe("generateWCSKeywords", () => {
  it("returns all required WCS keywords", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    const keys = keywords.map((k) => k.key);

    expect(keys).toContain("WCSAXES");
    expect(keys).toContain("CTYPE1");
    expect(keys).toContain("CTYPE2");
    expect(keys).toContain("CRVAL1");
    expect(keys).toContain("CRVAL2");
    expect(keys).toContain("CRPIX1");
    expect(keys).toContain("CRPIX2");
    expect(keys).toContain("CD1_1");
    expect(keys).toContain("CD1_2");
    expect(keys).toContain("CD2_1");
    expect(keys).toContain("CD2_2");
    expect(keys).toContain("CDELT1");
    expect(keys).toContain("CDELT2");
    expect(keys).toContain("CROTA2");
    expect(keys).toContain("EQUINOX");
    expect(keys).toContain("ASTRSOLV");
    expect(keys).toContain("ASTPSCAL");
  });

  it("includes ASTRAD when radius is present", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    const radKey = keywords.find((k) => k.key === "ASTRAD");
    expect(radKey).toBeDefined();
    expect(radKey!.value).toBeCloseTo(1.5, 4);
  });

  it("omits ASTRAD when radius is null", () => {
    const cal = { ...MOCK_CALIBRATION, radius: null as unknown as number };
    const keywords = generateWCSKeywords(cal);
    const radKey = keywords.find((k) => k.key === "ASTRAD");
    expect(radKey).toBeUndefined();
  });

  it("sets correct CRVAL1/2 from RA/DEC", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    const crval1 = keywords.find((k) => k.key === "CRVAL1");
    const crval2 = keywords.find((k) => k.key === "CRVAL2");

    expect(crval1!.value).toBeCloseTo(83.633, 3);
    expect(crval2!.value).toBeCloseTo(-5.375, 3);
  });

  it("sets CTYPE to TAN projection", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    const ctype1 = keywords.find((k) => k.key === "CTYPE1");
    const ctype2 = keywords.find((k) => k.key === "CTYPE2");

    expect(ctype1!.value).toBe("RA---TAN");
    expect(ctype2!.value).toBe("DEC--TAN");
  });

  it("sets EQUINOX to 2000.0", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    const eq = keywords.find((k) => k.key === "EQUINOX");
    expect(eq!.value).toBe(2000.0);
  });

  it("computes CROTA2 from orientation", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    const crota = keywords.find((k) => k.key === "CROTA2");
    expect(crota!.value).toBeCloseTo(45.0, 4);
  });

  it("records pixel scale in ASTPSCAL", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    const ps = keywords.find((k) => k.key === "ASTPSCAL");
    expect(ps!.value).toBeCloseTo(1.08, 2);
  });

  it("includes comment on every keyword", () => {
    const keywords = generateWCSKeywords(MOCK_CALIBRATION);
    for (const kw of keywords) {
      expect(kw.comment).toBeTruthy();
    }
  });

  it("flips CD matrix sign for parity=1", () => {
    const calFlipped = { ...MOCK_CALIBRATION, parity: 1 };
    const kwNormal = generateWCSKeywords(MOCK_CALIBRATION);
    const kwFlipped = generateWCSKeywords(calFlipped);

    const cd11Normal = kwNormal.find((k) => k.key === "CD1_1")!.value as number;
    const cd11Flipped = kwFlipped.find((k) => k.key === "CD1_1")!.value as number;

    // Parity flip should reverse the sign of CD1_1
    expect(Math.sign(cd11Normal)).not.toBe(Math.sign(cd11Flipped));
  });

  it("handles zero orientation", () => {
    const cal = { ...MOCK_CALIBRATION, orientation: 0 };
    const keywords = generateWCSKeywords(cal);
    const crota = keywords.find((k) => k.key === "CROTA2");
    expect(crota!.value).toBe(0);
  });
});

describe("formatWCSAsText", () => {
  it("formats keywords as FITS header text", () => {
    const keywords = [
      { key: "CRVAL1", value: 83.633, comment: "RA at reference pixel" },
      { key: "CTYPE1", value: "RA---TAN", comment: "Gnomonic projection" },
    ];
    const text = formatWCSAsText(keywords);
    const lines = text.split("\n");

    expect(lines).toHaveLength(2);
  });

  it("pads key to 8 chars", () => {
    const text = formatWCSAsText([{ key: "RA", value: 1.0, comment: "test" }]);
    // "RA      = " -> key is 8 chars + "= "
    expect(text).toMatch(/^RA\s{6}=/);
  });

  it("right-aligns numeric values in 20-char field", () => {
    const text = formatWCSAsText([{ key: "CRVAL1", value: 83.633, comment: "c" }]);
    // Between "= " and " / c"
    const match = text.match(/= (.{20}) \//);
    expect(match).toBeTruthy();
    expect(match![1].trimStart()).toBe("83.633");
  });

  it("wraps string values in single quotes", () => {
    const text = formatWCSAsText([{ key: "CTYPE1", value: "RA---TAN", comment: "c" }]);
    expect(text).toContain("'RA---TAN'");
  });

  it("includes comment after /", () => {
    const text = formatWCSAsText([{ key: "A", value: 1, comment: "my comment" }]);
    expect(text).toContain("/ my comment");
  });
});
