import { calculateStats } from "../pixelMath";

describe("calculateStats noise estimation", () => {
  it("returns noiseSigma and snrEstimate fields", () => {
    const pixels = new Float32Array(256);
    for (let i = 0; i < 256; i++) pixels[i] = 100 + (Math.random() - 0.5) * 10;
    const stats = calculateStats(pixels);
    expect(typeof stats.noiseSigma).toBe("number");
    expect(typeof stats.snrEstimate).toBe("number");
  });

  it("returns 0 noise for empty array", () => {
    const stats = calculateStats(new Float32Array(0));
    expect(stats.noiseSigma).toBe(0);
    expect(stats.snrEstimate).toBe(0);
  });

  it("returns 0 noise for flat image", () => {
    const pixels = new Float32Array(64).fill(42);
    const stats = calculateStats(pixels);
    expect(stats.noiseSigma).toBeCloseTo(0, 4);
  });

  it("noiseSigma is positive for noisy data", () => {
    const pixels = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      pixels[i] = 100 + (Math.random() - 0.5) * 20;
    }
    const stats = calculateStats(pixels);
    expect(stats.noiseSigma).toBeGreaterThan(0);
  });

  it("snrEstimate is positive when mean > 0 and noise > 0", () => {
    const pixels = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      pixels[i] = 100 + (Math.random() - 0.5) * 10;
    }
    const stats = calculateStats(pixels);
    expect(stats.snrEstimate).toBeGreaterThan(0);
  });

  it("higher noise produces lower snrEstimate", () => {
    const lowNoise = new Float32Array(1024);
    const highNoise = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) {
      lowNoise[i] = 100 + (Math.random() - 0.5) * 2;
      highNoise[i] = 100 + (Math.random() - 0.5) * 40;
    }
    const statsLow = calculateStats(lowNoise);
    const statsHigh = calculateStats(highNoise);
    expect(statsLow.snrEstimate).toBeGreaterThan(statsHigh.snrEstimate);
  });

  it("noiseSigma approximates true gaussian noise sigma", () => {
    // Generate Gaussian-like noise with known sigma
    const sigma = 5;
    const n = 4096;
    const pixels = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      // Box-Muller approximation
      const u1 = Math.random();
      const u2 = Math.random();
      pixels[i] = 100 + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }
    const stats = calculateStats(pixels);
    // MAD-based sigma estimate should be within 50% of true sigma for 4096 samples
    expect(stats.noiseSigma).toBeGreaterThan(sigma * 0.5);
    expect(stats.noiseSigma).toBeLessThan(sigma * 1.5);
  });

  it("all existing fields still present", () => {
    const pixels = new Float32Array([1, 2, 3, 4, 5]);
    const stats = calculateStats(pixels);
    expect(typeof stats.mean).toBe("number");
    expect(typeof stats.median).toBe("number");
    expect(typeof stats.stddev).toBe("number");
    expect(typeof stats.min).toBe("number");
    expect(typeof stats.max).toBe("number");
    expect(typeof stats.snr).toBe("number");
    expect(stats.mean).toBeCloseTo(3, 0);
    expect(stats.min).toBe(1);
    expect(stats.max).toBe(5);
  });
});
