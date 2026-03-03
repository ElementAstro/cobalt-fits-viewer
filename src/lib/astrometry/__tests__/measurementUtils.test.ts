import {
  angularSeparationVincenty,
  pixelDistance,
  formatAngularDistance,
} from "../measurementUtils";

describe("angularSeparationVincenty", () => {
  it("returns 0 for identical points", () => {
    expect(angularSeparationVincenty(83.63, -5.39, 83.63, -5.39)).toBeCloseTo(0, 5);
  });

  it("computes correct distance for known star pair (Betelgeuse to Rigel ~18.5°)", () => {
    // Betelgeuse: RA=88.79°, Dec=7.41°
    // Rigel: RA=78.63°, Dec=-8.20°
    const arcsec = angularSeparationVincenty(88.79, 7.41, 78.63, -8.2);
    const degrees = arcsec / 3600;
    expect(degrees).toBeCloseTo(18.2, 0);
  });

  it("handles pole-to-pole distance (~180°)", () => {
    const arcsec = angularSeparationVincenty(0, 90, 0, -90);
    const degrees = arcsec / 3600;
    expect(degrees).toBeCloseTo(180, 1);
  });

  it("handles small separations accurately", () => {
    // Two points 1 arcsecond apart in Dec at equator
    const arcsec = angularSeparationVincenty(0, 0, 0, 1 / 3600);
    expect(arcsec).toBeCloseTo(1, 1);
  });

  it("is symmetric", () => {
    const d1 = angularSeparationVincenty(10, 20, 30, 40);
    const d2 = angularSeparationVincenty(30, 40, 10, 20);
    expect(d1).toBeCloseTo(d2, 6);
  });

  it("handles RA wrap-around (359° to 1°)", () => {
    const arcsec = angularSeparationVincenty(359, 0, 1, 0);
    const degrees = arcsec / 3600;
    expect(degrees).toBeCloseTo(2, 1);
  });
});

describe("pixelDistance", () => {
  it("returns 0 for same point", () => {
    expect(pixelDistance(5, 5, 5, 5)).toBe(0);
  });

  it("computes correct Euclidean distance", () => {
    expect(pixelDistance(0, 0, 3, 4)).toBe(5);
  });

  it("handles negative coordinates", () => {
    expect(pixelDistance(-1, -1, 2, 3)).toBe(5);
  });
});

describe("formatAngularDistance", () => {
  it("formats as degrees for large distances", () => {
    expect(formatAngularDistance(7200)).toBe("2.00°");
    expect(formatAngularDistance(36000)).toBe("10.00°");
  });

  it("formats as arcminutes for medium distances", () => {
    expect(formatAngularDistance(120)).toBe("2.0′");
    expect(formatAngularDistance(300)).toBe("5.0′");
  });

  it("formats as arcseconds for small distances", () => {
    expect(formatAngularDistance(30)).toBe("30.0″");
    expect(formatAngularDistance(1.5)).toBe("1.5″");
  });

  it("handles zero", () => {
    expect(formatAngularDistance(0)).toBe("0.0″");
  });

  it("handles NaN and negative", () => {
    expect(formatAngularDistance(NaN)).toBe("—");
    expect(formatAngularDistance(-1)).toBe("—");
  });
});
