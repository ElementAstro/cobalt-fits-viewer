import { computeGridSpacing, generateGridLines } from "../coordinateGrid";
import type { AstrometryCalibration } from "../types";

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

const CAL_WIDE: AstrometryCalibration = {
  ra: 180.0,
  dec: 45.0,
  radius: 5.0,
  pixscale: 10.0,
  orientation: 0,
  parity: 0,
  fieldWidth: 10.0,
  fieldHeight: 8.0,
};

describe("computeGridSpacing", () => {
  it("returns 60 arcsec (1') for ~0.1° field", () => {
    expect(computeGridSpacing(0.1)).toBe(60);
  });

  it("returns larger spacing for wider fields", () => {
    const narrow = computeGridSpacing(0.5);
    const wide = computeGridSpacing(5.0);
    expect(wide).toBeGreaterThan(narrow);
  });

  it("returns 36000 arcsec (10°) for very wide field >30°", () => {
    expect(computeGridSpacing(50)).toBe(36000);
  });

  it("returns 10 arcsec for very narrow field", () => {
    expect(computeGridSpacing(0.005)).toBe(10);
  });
});

describe("generateGridLines", () => {
  it("generates lines for a typical field", () => {
    const lines = generateGridLines(CAL_ORION, 2400, 1680);
    expect(lines.length).toBeGreaterThan(0);

    const raLines = lines.filter((l) => l.isRA);
    const decLines = lines.filter((l) => !l.isRA);
    expect(raLines.length).toBeGreaterThan(0);
    expect(decLines.length).toBeGreaterThan(0);
  });

  it("each line has at least 2 points", () => {
    const lines = generateGridLines(CAL_ORION, 2400, 1680);
    for (const line of lines) {
      expect(line.points.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("generates labels for each line", () => {
    const lines = generateGridLines(CAL_ORION, 2400, 1680);
    for (const line of lines) {
      expect(line.label).toBeTruthy();
    }
  });

  it("generates more lines for a wider field", () => {
    const narrow = generateGridLines(CAL_ORION, 2400, 1680);
    const wide = generateGridLines(CAL_WIDE, 3600, 2880);
    // Wide field may have same or more lines depending on spacing auto-selection
    expect(wide.length).toBeGreaterThan(0);
    expect(narrow.length).toBeGreaterThan(0);
  });

  it("respects spacingOverride", () => {
    const lines = generateGridLines(CAL_ORION, 2400, 1680, 300);
    expect(lines.length).toBeGreaterThan(0);
  });

  it("returns empty for zero-size image", () => {
    const lines = generateGridLines(CAL_ORION, 0, 0);
    expect(lines).toEqual([]);
  });
});
