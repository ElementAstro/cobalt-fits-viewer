const mockApplyStretch = jest.fn(
  (pixels: Float32Array) =>
    new Float32Array(Array.from(pixels, (v) => Math.max(0, Math.min(1, v)))),
);

jest.mock("../../converter/formatConverter", () => ({
  applyStretch: (...args: unknown[]) => mockApplyStretch(...args),
}));

import {
  CHANNEL_PRESETS,
  adjustColorBalance,
  adjustSaturation,
  autoAssignChannels,
  composeRGB,
} from "../rgbCompose";

describe("utils rgbCompose", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("composes RGB in unlinked mode using per-channel stretch", () => {
    const rgba = composeRGB({
      red: { pixels: new Float32Array([0.2, 0.8]), weight: 1 },
      green: { pixels: new Float32Array([0.4, 0.6]), weight: 1 },
      blue: { pixels: new Float32Array([0.1, 0.9]), weight: 1 },
      width: 2,
      height: 1,
      linkedStretch: false,
    });

    expect(mockApplyStretch).toHaveBeenCalledTimes(3);
    expect(Array.from(rgba)).toEqual([
      Math.round(0.2 * 255),
      Math.round(0.4 * 255),
      Math.round(0.1 * 255),
      255,
      Math.round(0.8 * 255),
      Math.round(0.6 * 255),
      229,
      255,
    ]);
  });

  it("composes RGB in linked mode and applies weights with clamping", () => {
    const rgba = composeRGB({
      red: { pixels: new Float32Array([0, 10]), weight: 2 },
      green: { pixels: new Float32Array([5, 15]), weight: 1 },
      blue: { pixels: new Float32Array([15, 0]), weight: 1 },
      width: 2,
      height: 1,
      linkedStretch: true,
    });

    // linked mode does not call applyStretch
    expect(mockApplyStretch).not.toHaveBeenCalled();
    expect(rgba[0]).toBe(0);
    expect(rgba[1]).toBeCloseTo((5 / 15) * 255, 0);
    expect(rgba[2]).toBe(255);
    expect(rgba[4]).toBe(255); // weighted clamp from 10/15 * 2
  });

  it("supports luminance replacement for both chroma and grayscale branches", () => {
    const withChroma = composeRGB({
      red: { pixels: new Float32Array([0.2]), weight: 1 },
      green: { pixels: new Float32Array([0.4]), weight: 1 },
      blue: { pixels: new Float32Array([0.6]), weight: 1 },
      luminance: { pixels: new Float32Array([0.8]), weight: 1 },
      width: 1,
      height: 1,
      linkedStretch: false,
    });
    expect(withChroma[0]).toBeGreaterThan(0);
    expect(withChroma[0]).toBeLessThanOrEqual(255);

    const grayscaleFallback = composeRGB({
      red: { pixels: new Float32Array([0]), weight: 1 },
      green: { pixels: new Float32Array([0]), weight: 1 },
      blue: { pixels: new Float32Array([0]), weight: 1 },
      luminance: { pixels: new Float32Array([0.5]), weight: 1 },
      width: 1,
      height: 1,
      linkedStretch: false,
    });
    expect(grayscaleFallback[0]).toBe(grayscaleFallback[1]);
    expect(grayscaleFallback[1]).toBe(grayscaleFallback[2]);
  });

  it("adjusts saturation and color balance", () => {
    const rgba = new Uint8ClampedArray([100, 150, 200, 255]);
    const desaturated = adjustSaturation(rgba, 0);
    expect(desaturated[0]).toBe(desaturated[1]);
    expect(desaturated[1]).toBe(desaturated[2]);
    expect(desaturated[3]).toBe(255);

    const balanced = adjustColorBalance(rgba, 2, 0.5, 1);
    expect(balanced[0]).toBe(200);
    expect(balanced[1]).toBe(75);
    expect(balanced[2]).toBe(200);
    expect(balanced[3]).toBe(255);
  });

  it("contains channel presets and auto-assigns channels", () => {
    expect(CHANNEL_PRESETS.SHO.label).toContain("SHO");
    const files = [
      { id: "1", filter: "Ha" },
      { id: "2", filter: "OIII" },
      { id: "3", filter: "SII" },
      { id: "4", filter: "R" },
      { id: "5", filter: "G" },
      { id: "6", filter: "B" },
    ];

    expect(autoAssignChannels(files, "SHO")).toEqual({ red: "3", green: "1", blue: "2" });
    expect(autoAssignChannels(files, "RGB")).toEqual({ red: "4", green: "5", blue: "6" });
    expect(autoAssignChannels(files, "UNKNOWN")).toEqual({});
  });
});
