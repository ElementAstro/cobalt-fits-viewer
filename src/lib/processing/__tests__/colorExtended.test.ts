import { applyPerHueSaturationRGBA, applySelectiveColorRGBA } from "../color";

function makeRGBA(r: number, g: number, b: number, count: number = 1): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

describe("applyPerHueSaturationRGBA", () => {
  it("returns same-length output", () => {
    const data = makeRGBA(200, 100, 100, 16);
    const result = applyPerHueSaturationRGBA(data, [{ hue: 0, factor: 1.5 }], 1);
    expect(result.length).toBe(data.length);
  });

  it("empty hueCurve returns copy", () => {
    const data = makeRGBA(200, 100, 100, 4);
    const result = applyPerHueSaturationRGBA(data, [], 1);
    for (let i = 0; i < data.length; i++) {
      expect(result[i]).toBe(data[i]);
    }
  });

  it("factor > 1 increases saturation", () => {
    // Red pixel
    const data = makeRGBA(200, 100, 100, 1);
    const result = applyPerHueSaturationRGBA(data, [{ hue: 0, factor: 2 }], 1);
    // G and B should decrease (more saturated red)
    const grayOrig = 0.2126 * 200 + 0.7152 * 100 + 0.0722 * 100;
    const grayResult = 0.2126 * result[0] + 0.7152 * result[1] + 0.0722 * result[2];
    // Hue should be preserved, luminance roughly similar
    expect(Math.abs(grayResult - grayOrig)).toBeLessThan(50);
  });

  it("preserves alpha", () => {
    const data = makeRGBA(200, 100, 100, 4);
    const result = applyPerHueSaturationRGBA(data, [{ hue: 0, factor: 1.5 }], 1);
    for (let i = 0; i < 4; i++) {
      expect(result[i * 4 + 3]).toBe(255);
    }
  });
});

describe("applySelectiveColorRGBA", () => {
  it("returns same-length output", () => {
    const data = makeRGBA(100, 200, 100, 16);
    const result = applySelectiveColorRGBA(data, 120, 60, 0, 0, 0, 0.3);
    expect(result.length).toBe(data.length);
  });

  it("does not affect pixels outside hue range", () => {
    // Blue pixel (hue ~240)
    const data = makeRGBA(50, 50, 200, 4);
    // Target hue = 0 (red), should not affect blue
    const result = applySelectiveColorRGBA(data, 0, 60, 30, 0.5, 0, 0.3);
    expect(result[0]).toBe(data[0]);
    expect(result[1]).toBe(data[1]);
    expect(result[2]).toBe(data[2]);
  });

  it("shifts hue of targeted pixels", () => {
    // Green pixel (hue ~120)
    const data = makeRGBA(50, 200, 50, 1);
    // Target hue=120 (green), shift by +30
    const result = applySelectiveColorRGBA(data, 120, 60, 30, 0, 0, 0.3);
    // Result should differ from original
    expect(result[0] !== data[0] || result[1] !== data[1] || result[2] !== data[2]).toBe(true);
  });

  it("preserves alpha", () => {
    const data = makeRGBA(100, 200, 100, 4);
    const result = applySelectiveColorRGBA(data, 120, 60, 0, 0.5, 0, 0.3);
    for (let i = 0; i < 4; i++) {
      expect(result[i * 4 + 3]).toBe(255);
    }
  });
});
