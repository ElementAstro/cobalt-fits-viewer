import {
  applyFlat,
  calibrateFrame,
  createMasterDark,
  createMasterFlat,
  normalizeFlat,
  subtractBias,
  subtractDark,
} from "../calibration";

const toArray = (arr: Float32Array) => Array.from(arr);

describe("stacking calibration", () => {
  it("subtracts dark and bias frames", () => {
    expect(toArray(subtractDark(new Float32Array([10, 20]), new Float32Array([1, 2])))).toEqual([
      9, 18,
    ]);
    expect(toArray(subtractBias(new Float32Array([10, 20]), new Float32Array([3, 4])))).toEqual([
      7, 16,
    ]);
  });

  it("normalizes flat frame and ignores invalid values when computing mean", () => {
    const flat = new Float32Array([2, 4, NaN, Infinity, -1]);
    const normalized = normalizeFlat(flat);
    expect(normalized[0]).toBeCloseTo(2 / 3, 5);
    expect(normalized[1]).toBeCloseTo(4 / 3, 5);
  });

  it("applies flat correction with small-value guard", () => {
    const light = new Float32Array([10, 20, 30]);
    const nFlat = new Float32Array([1, 0.001, 2]);
    const corrected = applyFlat(light, nFlat);
    expect(toArray(corrected)).toEqual([10, 20, 15]);
  });

  it("runs full calibration pipeline for different input combinations", () => {
    const light = new Float32Array([100, 120, 140]);
    const dark = new Float32Array([10, 10, 10]);
    const flat = new Float32Array([2, 4, 6]);
    const bias = new Float32Array([1, 1, 1]);

    const withAll = calibrateFrame(light, dark, flat, bias);
    expect(withAll.length).toBe(3);
    expect(withAll[0]).toBeGreaterThan(0);

    const flatOnly = calibrateFrame(light, null, flat, null);
    expect(flatOnly.length).toBe(3);

    const biasOnly = calibrateFrame(light, null, null, bias);
    expect(toArray(biasOnly)).toEqual([99, 119, 139]);
  });

  it("creates master dark and flat with edge cases", () => {
    expect(createMasterDark([])).toEqual(new Float32Array(0));
    const singleDark = new Float32Array([1, 2, 3]);
    expect(createMasterDark([singleDark])).toEqual(new Float32Array([1, 2, 3]));

    const masterDark = createMasterDark([
      new Float32Array([1, 3, 9]),
      new Float32Array([2, 4, 7]),
      new Float32Array([5, 0, 8]),
    ]);
    expect(toArray(masterDark)).toEqual([2, 3, 8]);

    expect(createMasterFlat([])).toEqual(new Float32Array(0));
    const singleFlat = createMasterFlat([new Float32Array([2, 2])]);
    expect(singleFlat[0]).toBeCloseTo(1, 5);
    expect(singleFlat[1]).toBeCloseTo(1, 5);
  });
});
