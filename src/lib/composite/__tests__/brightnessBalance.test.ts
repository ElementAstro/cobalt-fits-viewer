import { balanceLayerBrightness, estimateBrightnessGain } from "../brightnessBalance";

describe("composite brightnessBalance", () => {
  it("estimates gain against reference median", () => {
    const layer = new Float32Array([
      1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
      1, 1, 1, 1, 1,
    ]);
    const ref = new Float32Array(layer.length).fill(2);
    const result = estimateBrightnessGain(layer, ref);
    expect(result.gain).toBeCloseTo(2, 4);
  });

  it("balances multiple layers", () => {
    const ref = new Float32Array(64).fill(4);
    const layerA = new Float32Array(64).fill(2);
    const layerB = new Float32Array(64).fill(1);

    const { balanced, gains } = balanceLayerBrightness([ref, layerA, layerB]);
    expect(gains[0]).toBeCloseTo(1, 4);
    expect(gains[1]).toBeGreaterThan(1);
    expect(gains[2]).toBeGreaterThan(gains[1]);
    expect(balanced[1][0]).toBeCloseTo(4, 2);
    expect(balanced[2][0]).toBeCloseTo(4, 2);
  });
});
