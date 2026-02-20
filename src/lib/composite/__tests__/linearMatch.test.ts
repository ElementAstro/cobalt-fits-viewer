import { applyLinearMatch, estimateLinearMatch, linearMatchToReference } from "../linearMatch";

describe("composite linearMatch", () => {
  it("estimates affine match and applies it", () => {
    const src = new Float32Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const ref = new Float32Array([3, 5, 7, 9, 11, 13, 15, 17]);
    const params = estimateLinearMatch(src, ref);

    expect(params.scale).toBeCloseTo(2, 1);
    expect(params.offset).toBeCloseTo(1, 1);

    const out = applyLinearMatch(src, params);
    expect(out[0]).toBeCloseTo(3, 1);
    expect(out[7]).toBeCloseTo(17, 1);
  });

  it("returns matched buffer", () => {
    const src = new Float32Array(Array.from({ length: 256 }, (_, i) => i));
    const ref = new Float32Array(Array.from({ length: 256 }, (_, i) => i * 1.5 + 10));

    const { matched } = linearMatchToReference(src, ref, 2);
    expect(matched.length).toBe(src.length);
    expect(matched[120]).toBeGreaterThan(src[120]);
  });
});
