import {
  computeCDMatrix,
  invertCDMatrix,
  pixelToRaDec,
  raDecToPixel,
  isInsideImage,
  formatRaFromDeg,
  formatDecFromDeg,
} from "../wcsProjection";
import { formatRA, formatDec } from "../formatUtils";
import type { AstrometryCalibration } from "../types";

/** Typical calibration: Orion area, ~1°×0.7° field, 1.5"/px, parity=0 */
const CAL_ORION: AstrometryCalibration = {
  ra: 83.63,
  dec: -5.39,
  radius: 0.6,
  pixscale: 1.5,
  orientation: 10,
  parity: 0,
  fieldWidth: 1.0,
  fieldHeight: 0.7,
};

/** Calibration with parity=1 (mirror) */
const CAL_MIRROR: AstrometryCalibration = {
  ...CAL_ORION,
  parity: 1,
};

/** Wide field calibration: ~10° field */
const CAL_WIDE: AstrometryCalibration = {
  ra: 180.0,
  dec: 45.0,
  radius: 7.0,
  pixscale: 10.0,
  orientation: 0,
  parity: 0,
  fieldWidth: 10.0,
  fieldHeight: 8.0,
};

describe("computeCDMatrix", () => {
  it("returns correct matrix elements for parity=0", () => {
    const cd = computeCDMatrix(CAL_ORION);
    expect(cd.crval1).toBe(CAL_ORION.ra);
    expect(cd.crval2).toBe(CAL_ORION.dec);
    expect(cd.crpix1).toBeGreaterThan(0);
    expect(cd.crpix2).toBeGreaterThan(0);
    expect(cd.cd1_1).not.toBe(0);
    expect(cd.cd2_2).not.toBe(0);
  });

  it("flips sign for parity=1", () => {
    const cd0 = computeCDMatrix(CAL_ORION);
    const cd1 = computeCDMatrix(CAL_MIRROR);
    expect(cd0.cd1_1).not.toBe(cd1.cd1_1);
    expect(cd0.cd1_2).not.toBe(cd1.cd1_2);
    // cd2_1 and cd2_2 are unaffected by parity
    expect(cd0.cd2_1).toBe(cd1.cd2_1);
    expect(cd0.cd2_2).toBe(cd1.cd2_2);
  });
});

describe("invertCDMatrix", () => {
  it("inverse * original ≈ identity", () => {
    const cd = computeCDMatrix(CAL_ORION);
    const inv = invertCDMatrix(cd);
    // CD * CDI should be identity
    const i11 = cd.cd1_1 * inv.cdi1_1 + cd.cd1_2 * inv.cdi2_1;
    const i12 = cd.cd1_1 * inv.cdi1_2 + cd.cd1_2 * inv.cdi2_2;
    const i21 = cd.cd2_1 * inv.cdi1_1 + cd.cd2_2 * inv.cdi2_1;
    const i22 = cd.cd2_1 * inv.cdi1_2 + cd.cd2_2 * inv.cdi2_2;
    expect(i11).toBeCloseTo(1, 10);
    expect(i12).toBeCloseTo(0, 10);
    expect(i21).toBeCloseTo(0, 10);
    expect(i22).toBeCloseTo(1, 10);
  });
});

describe("pixelToRaDec", () => {
  it("returns reference RA/Dec at the center pixel", () => {
    const cd = computeCDMatrix(CAL_ORION);
    // Center pixel (0-indexed) = crpix - 1
    const result = pixelToRaDec(cd.crpix1 - 1, cd.crpix2 - 1, CAL_ORION);
    expect(result).not.toBeNull();
    expect(result!.ra).toBeCloseTo(CAL_ORION.ra, 4);
    expect(result!.dec).toBeCloseTo(CAL_ORION.dec, 4);
  });

  it("returns non-null for corners of the image", () => {
    const cd = computeCDMatrix(CAL_ORION);
    const w = cd.crpix1 * 2;
    const h = cd.crpix2 * 2;
    const corners = [
      [0, 0],
      [w - 1, 0],
      [0, h - 1],
      [w - 1, h - 1],
    ];
    for (const [x, y] of corners) {
      const result = pixelToRaDec(x, y, CAL_ORION);
      expect(result).not.toBeNull();
      expect(result!.ra).toBeGreaterThanOrEqual(0);
      expect(result!.ra).toBeLessThan(360);
      expect(result!.dec).toBeGreaterThanOrEqual(-90);
      expect(result!.dec).toBeLessThanOrEqual(90);
    }
  });
});

describe("raDecToPixel", () => {
  it("returns center pixel for reference RA/Dec", () => {
    const cd = computeCDMatrix(CAL_ORION);
    const result = raDecToPixel(CAL_ORION.ra, CAL_ORION.dec, CAL_ORION);
    expect(result).not.toBeNull();
    expect(result!.x).toBeCloseTo(cd.crpix1 - 1, 2);
    expect(result!.y).toBeCloseTo(cd.crpix2 - 1, 2);
  });

  it("returns null for antipodal point", () => {
    const result = raDecToPixel((CAL_ORION.ra + 180) % 360, -CAL_ORION.dec, CAL_ORION);
    expect(result).toBeNull();
  });
});

describe("round-trip: pixel → RaDec → pixel", () => {
  it("recovers original pixel coordinates (parity=0)", () => {
    const cd = computeCDMatrix(CAL_ORION);
    const testPoints = [
      { x: cd.crpix1 - 1, y: cd.crpix2 - 1 },
      { x: cd.crpix1 - 1 + 100, y: cd.crpix2 - 1 + 50 },
      { x: cd.crpix1 - 1 - 200, y: cd.crpix2 - 1 - 100 },
      { x: 0, y: 0 },
    ];
    for (const pt of testPoints) {
      const radec = pixelToRaDec(pt.x, pt.y, CAL_ORION);
      expect(radec).not.toBeNull();
      const back = raDecToPixel(radec!.ra, radec!.dec, CAL_ORION);
      expect(back).not.toBeNull();
      expect(back!.x).toBeCloseTo(pt.x, 3);
      expect(back!.y).toBeCloseTo(pt.y, 3);
    }
  });

  it("recovers original pixel coordinates (parity=1)", () => {
    const cd = computeCDMatrix(CAL_MIRROR);
    const pt = { x: cd.crpix1 - 1 + 50, y: cd.crpix2 - 1 + 30 };
    const radec = pixelToRaDec(pt.x, pt.y, CAL_MIRROR);
    expect(radec).not.toBeNull();
    const back = raDecToPixel(radec!.ra, radec!.dec, CAL_MIRROR);
    expect(back).not.toBeNull();
    expect(back!.x).toBeCloseTo(pt.x, 3);
    expect(back!.y).toBeCloseTo(pt.y, 3);
  });

  it("recovers original pixel coordinates (wide field)", () => {
    const cd = computeCDMatrix(CAL_WIDE);
    const pt = { x: cd.crpix1 - 1 + 500, y: cd.crpix2 - 1 - 300 };
    const radec = pixelToRaDec(pt.x, pt.y, CAL_WIDE);
    expect(radec).not.toBeNull();
    const back = raDecToPixel(radec!.ra, radec!.dec, CAL_WIDE);
    expect(back).not.toBeNull();
    expect(back!.x).toBeCloseTo(pt.x, 1);
    expect(back!.y).toBeCloseTo(pt.y, 1);
  });
});

describe("isInsideImage", () => {
  it("returns true for valid coordinates", () => {
    expect(isInsideImage(0, 0, 100, 100)).toBe(true);
    expect(isInsideImage(50, 50, 100, 100)).toBe(true);
    expect(isInsideImage(99, 99, 100, 100)).toBe(true);
  });

  it("returns false for out-of-bounds coordinates", () => {
    expect(isInsideImage(-1, 0, 100, 100)).toBe(false);
    expect(isInsideImage(0, -1, 100, 100)).toBe(false);
    expect(isInsideImage(100, 0, 100, 100)).toBe(false);
    expect(isInsideImage(0, 100, 100, 100)).toBe(false);
  });

  it("respects margin parameter", () => {
    expect(isInsideImage(-5, -5, 100, 100, 10)).toBe(true);
    expect(isInsideImage(105, 0, 100, 100, 10)).toBe(true);
    expect(isInsideImage(-11, 0, 100, 100, 10)).toBe(false);
  });
});

describe("formatRaFromDeg / formatDecFromDeg re-exports", () => {
  it("re-exports are identical to formatUtils originals", () => {
    expect(formatRaFromDeg).toBe(formatRA);
    expect(formatDecFromDeg).toBe(formatDec);
  });

  it("formatRaFromDeg produces correct output", () => {
    expect(formatRaFromDeg(0)).toBe("0h 0m 0.0s");
    expect(formatRaFromDeg(180)).toContain("12h");
  });

  it("formatDecFromDeg produces correct output", () => {
    expect(formatDecFromDeg(0)).toContain("+0°");
    expect(formatDecFromDeg(-45)).toContain("-45°");
  });
});
