import { computeStarStats } from "../starStats";
import type { DetectedStar } from "../starDetection";

function makeStar(overrides: Partial<DetectedStar> = {}): DetectedStar {
  return {
    cx: 100,
    cy: 100,
    flux: 1000,
    peak: 500,
    area: 10,
    fwhm: 3.0,
    roundness: 0.9,
    ellipticity: 0.1,
    theta: 0,
    snr: 20,
    sharpness: 5,
    flags: 0,
    ...overrides,
  };
}

describe("computeStarStats", () => {
  it("returns null for empty array", () => {
    expect(computeStarStats([])).toBeNull();
  });

  it("returns null when all stars have fwhm=0", () => {
    const stars = [makeStar({ fwhm: 0 }), makeStar({ fwhm: 0 })];
    expect(computeStarStats(stars)).toBeNull();
  });

  it("computes correct stats for a single star", () => {
    const stats = computeStarStats([makeStar({ fwhm: 3.5, snr: 25, ellipticity: 0.05 })]);
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(1);
    expect(stats!.medianFwhm).toBe(3.5);
    expect(stats!.meanFwhm).toBe(3.5);
    expect(stats!.stdFwhm).toBe(0);
    expect(stats!.bestFwhm).toBe(3.5);
    expect(stats!.worstFwhm).toBe(3.5);
  });

  it("computes correct stats for multiple stars", () => {
    const stars = [
      makeStar({ fwhm: 2.0 }),
      makeStar({ fwhm: 3.0 }),
      makeStar({ fwhm: 4.0 }),
      makeStar({ fwhm: 5.0 }),
      makeStar({ fwhm: 6.0 }),
    ];
    const stats = computeStarStats(stars);
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(5);
    expect(stats!.medianFwhm).toBe(4.0);
    expect(stats!.meanFwhm).toBe(4.0);
    expect(stats!.bestFwhm).toBe(2.0);
    expect(stats!.worstFwhm).toBe(6.0);
    expect(stats!.stdFwhm).toBeGreaterThan(0);
  });

  it("filters out stars with fwhm=0 or NaN", () => {
    const stars = [
      makeStar({ fwhm: 3.0 }),
      makeStar({ fwhm: 0 }),
      makeStar({ fwhm: NaN }),
      makeStar({ fwhm: 5.0 }),
    ];
    const stats = computeStarStats(stars);
    expect(stats).not.toBeNull();
    expect(stats!.count).toBe(2);
    expect(stats!.medianFwhm).toBe(4.0);
  });

  it("computes median SNR and ellipticity", () => {
    const stars = [
      makeStar({ snr: 10, ellipticity: 0.1 }),
      makeStar({ snr: 20, ellipticity: 0.2 }),
      makeStar({ snr: 30, ellipticity: 0.3 }),
    ];
    const stats = computeStarStats(stars);
    expect(stats).not.toBeNull();
    expect(stats!.medianSnr).toBe(20);
    expect(stats!.medianEllipticity).toBe(0.2);
  });

  it("handles even number of stars for median", () => {
    const stars = [makeStar({ fwhm: 2.0 }), makeStar({ fwhm: 4.0 })];
    const stats = computeStarStats(stars);
    expect(stats).not.toBeNull();
    expect(stats!.medianFwhm).toBe(3.0);
  });
});
