import { waveletSharpen } from "../waveletSharpen";

describe("waveletSharpen", () => {
  it("returns same-length output", () => {
    const pixels = new Float32Array(64).fill(0.5);
    const result = waveletSharpen(pixels, 8, 8);
    expect(result.length).toBe(64);
  });

  it("amount=1 keeps image close to original", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = Math.sin(i * 0.1) * 0.3 + 0.5;
    const result = waveletSharpen(pixels, 16, 16, [{ amount: 1 }]);
    let maxDiff = 0;
    for (let i = 0; i < 256; i++) {
      maxDiff = Math.max(maxDiff, Math.abs(result[i] - pixels[i]));
    }
    // With amount=1, detail is preserved as-is, so should be very close
    expect(maxDiff).toBeLessThan(0.01);
  });

  it("amount>1 increases contrast", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = Math.sin(i * 0.3) * 0.2 + 0.5;
    const original = new Float32Array(pixels);
    const result = waveletSharpen(pixels, 16, 16, [{ amount: 2.5 }]);
    // Sharpened image should have higher variance
    let origVar = 0;
    let resultVar = 0;
    for (let i = 0; i < 256; i++) {
      origVar += (original[i] - 0.5) ** 2;
      resultVar += (result[i] - 0.5) ** 2;
    }
    expect(resultVar).toBeGreaterThan(origVar);
  });
});
