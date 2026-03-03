import { parseWCSFromHeaders, hasSIPSuffix } from "../wcsParser";
import type { HeaderKeyword } from "../../fits/types";

function kw(key: string, value: number | string): HeaderKeyword {
  return { key, value, comment: undefined };
}

/** Typical CD-matrix WCS from Astrometry.net / ASTAP */
const CD_MATRIX_HEADERS: HeaderKeyword[] = [
  kw("CTYPE1", "RA---TAN"),
  kw("CTYPE2", "DEC--TAN"),
  kw("CRVAL1", 83.63),
  kw("CRVAL2", -5.39),
  kw("CRPIX1", 1024),
  kw("CRPIX2", 768),
  kw("CD1_1", -4.166667e-4),
  kw("CD1_2", 0),
  kw("CD2_1", 0),
  kw("CD2_2", 4.166667e-4),
  kw("NAXIS1", 2048),
  kw("NAXIS2", 1536),
];

/** CDELT + CROTA2 style (older convention) */
const CDELT_CROTA_HEADERS: HeaderKeyword[] = [
  kw("CTYPE1", "RA---TAN"),
  kw("CTYPE2", "DEC--TAN"),
  kw("CRVAL1", 180.0),
  kw("CRVAL2", 45.0),
  kw("CRPIX1", 512),
  kw("CRPIX2", 512),
  kw("CDELT1", -0.001),
  kw("CDELT2", 0.001),
  kw("CROTA2", 10.0),
  kw("NAXIS1", 1024),
  kw("NAXIS2", 1024),
];

/** PC matrix + CDELT style */
const PC_MATRIX_HEADERS: HeaderKeyword[] = [
  kw("CTYPE1", "RA---TAN"),
  kw("CTYPE2", "DEC--TAN"),
  kw("CRVAL1", 120.5),
  kw("CRVAL2", 30.0),
  kw("CRPIX1", 500),
  kw("CRPIX2", 500),
  kw("CDELT1", -0.0005),
  kw("CDELT2", 0.0005),
  kw("PC1_1", 0.9848),
  kw("PC1_2", -0.1736),
  kw("PC2_1", 0.1736),
  kw("PC2_2", 0.9848),
  kw("NAXIS1", 1000),
  kw("NAXIS2", 1000),
];

describe("parseWCSFromHeaders", () => {
  it("parses CD matrix WCS correctly", () => {
    const cal = parseWCSFromHeaders(CD_MATRIX_HEADERS);
    expect(cal).not.toBeNull();
    expect(cal!.ra).toBe(83.63);
    expect(cal!.dec).toBe(-5.39);
    expect(cal!.pixscale).toBeCloseTo(1.5, 0);
    expect(cal!.fieldWidth).toBeGreaterThan(0);
    expect(cal!.fieldHeight).toBeGreaterThan(0);
    expect(cal!.radius).toBeGreaterThan(0);
  });

  it("parses CDELT+CROTA2 WCS correctly", () => {
    const cal = parseWCSFromHeaders(CDELT_CROTA_HEADERS);
    expect(cal).not.toBeNull();
    expect(cal!.ra).toBe(180.0);
    expect(cal!.dec).toBe(45.0);
    expect(cal!.pixscale).toBeGreaterThan(0);
    expect(cal!.orientation).toBeCloseTo(10, -1);
  });

  it("parses PC matrix + CDELT WCS correctly", () => {
    const cal = parseWCSFromHeaders(PC_MATRIX_HEADERS);
    expect(cal).not.toBeNull();
    expect(cal!.ra).toBe(120.5);
    expect(cal!.dec).toBe(30.0);
    expect(cal!.pixscale).toBeGreaterThan(0);
    expect(cal!.fieldWidth).toBeGreaterThan(0);
  });

  it("returns null when CRVAL is missing", () => {
    const headers = CD_MATRIX_HEADERS.filter((h) => h.key !== "CRVAL1" && h.key !== "CRVAL2");
    expect(parseWCSFromHeaders(headers)).toBeNull();
  });

  it("returns null when CRPIX is missing", () => {
    const headers = CD_MATRIX_HEADERS.filter((h) => h.key !== "CRPIX1" && h.key !== "CRPIX2");
    expect(parseWCSFromHeaders(headers)).toBeNull();
  });

  it("returns null when no CD/CDELT/PC data present", () => {
    const headers = [
      kw("CTYPE1", "RA---TAN"),
      kw("CTYPE2", "DEC--TAN"),
      kw("CRVAL1", 83.0),
      kw("CRVAL2", -5.0),
      kw("CRPIX1", 512),
      kw("CRPIX2", 512),
    ];
    expect(parseWCSFromHeaders(headers)).toBeNull();
  });

  it("returns null for unsupported projection (e.g. SIN)", () => {
    const headers = [
      kw("CTYPE1", "RA---SIN"),
      kw("CTYPE2", "DEC--SIN"),
      kw("CRVAL1", 83.0),
      kw("CRVAL2", -5.0),
      kw("CRPIX1", 512),
      kw("CRPIX2", 512),
      kw("CD1_1", -0.001),
      kw("CD2_2", 0.001),
    ];
    expect(parseWCSFromHeaders(headers)).toBeNull();
  });

  it("returns null for empty keywords array", () => {
    expect(parseWCSFromHeaders([])).toBeNull();
  });

  it("accepts CTYPE with -SIP suffix", () => {
    const headers = [
      kw("CTYPE1", "RA---TAN-SIP"),
      kw("CTYPE2", "DEC--TAN-SIP"),
      kw("CRVAL1", 83.0),
      kw("CRVAL2", -5.0),
      kw("CRPIX1", 512),
      kw("CRPIX2", 512),
      kw("CD1_1", -0.001),
      kw("CD1_2", 0),
      kw("CD2_1", 0),
      kw("CD2_2", 0.001),
      kw("NAXIS1", 1024),
      kw("NAXIS2", 1024),
    ];
    const cal = parseWCSFromHeaders(headers);
    expect(cal).not.toBeNull();
    expect(cal!.ra).toBe(83.0);
  });

  it("works without CTYPE (some tools omit it)", () => {
    const headers = [
      kw("CRVAL1", 83.0),
      kw("CRVAL2", -5.0),
      kw("CRPIX1", 512),
      kw("CRPIX2", 512),
      kw("CD1_1", -0.001),
      kw("CD1_2", 0),
      kw("CD2_1", 0),
      kw("CD2_2", 0.001),
    ];
    const cal = parseWCSFromHeaders(headers);
    expect(cal).not.toBeNull();
  });

  it("computes correct parity for normal (det < 0) images", () => {
    const cal = parseWCSFromHeaders(CD_MATRIX_HEADERS);
    expect(cal).not.toBeNull();
    // CD1_1 < 0, CD2_2 > 0, off-diag = 0 → det = CD1_1*CD2_2 < 0 → parity 0
    expect(cal!.parity).toBe(0);
  });

  it("computes correct parity for flipped (det > 0) images", () => {
    const headers = [
      ...CD_MATRIX_HEADERS.filter((h) => h.key !== "CD1_1"),
      kw("CD1_1", 4.166667e-4), // positive → det > 0 → parity 1
    ];
    const cal = parseWCSFromHeaders(headers);
    expect(cal).not.toBeNull();
    expect(cal!.parity).toBe(1);
  });
});

describe("hasSIPSuffix", () => {
  it("detects -SIP suffix", () => {
    expect(hasSIPSuffix("RA---TAN-SIP")).toBe(true);
    expect(hasSIPSuffix("DEC--TAN-SIP")).toBe(true);
  });

  it("returns false for plain TAN", () => {
    expect(hasSIPSuffix("RA---TAN")).toBe(false);
    expect(hasSIPSuffix("DEC--TAN")).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(hasSIPSuffix(undefined)).toBe(false);
  });
});
