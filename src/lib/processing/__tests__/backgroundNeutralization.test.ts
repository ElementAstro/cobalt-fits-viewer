import { backgroundNeutralizeRGBA } from "../backgroundNeutralization";

function makeRGBA(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe("backgroundNeutralizeRGBA", () => {
  it("neutralizes a red-biased background", () => {
    // Background with red bias: R=80, G=50, B=50
    const data = makeRGBA(8, 8, 80, 50, 50);
    const result = backgroundNeutralizeRGBA(data, 8, 8);
    // After neutralization, R/G/B background should be closer together
    const r0 = result[0];
    const g0 = result[1];
    const b0 = result[2];
    expect(Math.abs(r0 - g0)).toBeLessThan(Math.abs(80 - 50));
    expect(Math.abs(r0 - b0)).toBeLessThan(Math.abs(80 - 50));
  });

  it("leaves neutral background unchanged", () => {
    const data = makeRGBA(8, 8, 60, 60, 60);
    const result = backgroundNeutralizeRGBA(data, 8, 8);
    expect(result[0]).toBeCloseTo(60, 0);
    expect(result[1]).toBeCloseTo(60, 0);
    expect(result[2]).toBeCloseTo(60, 0);
  });

  it("preserves alpha channel", () => {
    const data = makeRGBA(4, 4, 80, 50, 50);
    const result = backgroundNeutralizeRGBA(data, 4, 4);
    for (let i = 0; i < 16; i++) {
      expect(result[i * 4 + 3]).toBe(255);
    }
  });

  it("returns correct dimensions", () => {
    const data = makeRGBA(10, 10, 50, 50, 50);
    const result = backgroundNeutralizeRGBA(data, 10, 10);
    expect(result.length).toBe(10 * 10 * 4);
  });
});
