import { drizzleIntegrate, type DrizzleFrame } from "../drizzle";

describe("drizzleIntegrate", () => {
  it("upscales with identity transform", () => {
    const pixels = new Float32Array([1, 2, 3, 4]);
    const frame: DrizzleFrame = {
      pixels,
      width: 2,
      height: 2,
      transform: [1, 0, 0, 0, 1, 0],
    };
    const result = drizzleIntegrate([frame], 2, 2, { scale: 2, dropSize: 1, kernel: "square" });
    expect(result.width).toBe(4);
    expect(result.height).toBe(4);
    expect(result.pixels.length).toBe(16);
  });

  it("single frame with identity produces non-zero output", () => {
    const pixels = new Float32Array(16).fill(100);
    const frame: DrizzleFrame = {
      pixels,
      width: 4,
      height: 4,
      transform: [1, 0, 0, 0, 1, 0],
    };
    const result = drizzleIntegrate([frame], 4, 4, { scale: 2, dropSize: 0.7, kernel: "square" });
    let nonZero = 0;
    for (let i = 0; i < result.pixels.length; i++) {
      if (result.pixels[i] > 0) nonZero++;
    }
    expect(nonZero).toBeGreaterThan(0);
  });

  it("multiple frames with shifted transforms combine", () => {
    const w = 4;
    const h = 4;
    const p1 = new Float32Array(w * h).fill(80);
    const p2 = new Float32Array(w * h).fill(120);
    const f1: DrizzleFrame = { pixels: p1, width: w, height: h, transform: [1, 0, 0, 0, 1, 0] };
    const f2: DrizzleFrame = { pixels: p2, width: w, height: h, transform: [1, 0, 0.5, 0, 1, 0.5] };
    const result = drizzleIntegrate([f1, f2], w, h, { scale: 2, dropSize: 0.7, kernel: "square" });
    expect(result.width).toBe(8);
    expect(result.height).toBe(8);
    // Center pixels should have contribution from both frames
    const centerIdx = 4 * 8 + 4;
    expect(result.weights[centerIdx]).toBeGreaterThan(0);
  });

  it("gaussian kernel produces output", () => {
    const pixels = new Float32Array(16).fill(50);
    const frame: DrizzleFrame = {
      pixels,
      width: 4,
      height: 4,
      transform: [1, 0, 0, 0, 1, 0],
    };
    const result = drizzleIntegrate([frame], 4, 4, { scale: 2, dropSize: 0.7, kernel: "gaussian" });
    expect(result.pixels.length).toBe(64);
  });
});
