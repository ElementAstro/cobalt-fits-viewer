import { detectStars, detectStarsAsync, estimateBackground } from "../starDetection";

function makeImage(width: number, height: number, background: number = 0): Float32Array {
  return new Float32Array(width * height).fill(background);
}

function putSquareStar(
  pixels: Float32Array,
  width: number,
  cx: number,
  cy: number,
  size: number,
  value: number,
) {
  const half = Math.floor(size / 2);
  for (let y = cy - half; y <= cy + half; y++) {
    for (let x = cx - half; x <= cx + half; x++) {
      if (x >= 0 && y >= 0 && x < width && y * width + x < pixels.length) {
        pixels[y * width + x] = value;
      }
    }
  }
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let v = Math.imul(t ^ (t >>> 15), 1 | t);
    v ^= v + Math.imul(v ^ (v >>> 7), 61 | v);
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
}

function addGaussianStar(
  pixels: Float32Array,
  width: number,
  height: number,
  cx: number,
  cy: number,
  sigma: number,
  amplitude: number,
) {
  const radius = Math.max(2, Math.ceil(sigma * 4));
  const s2 = 2 * sigma * sigma;
  for (
    let y = Math.max(0, Math.floor(cy - radius));
    y <= Math.min(height - 1, Math.ceil(cy + radius));
    y++
  ) {
    for (
      let x = Math.max(0, Math.floor(cx - radius));
      x <= Math.min(width - 1, Math.ceil(cx + radius));
      x++
    ) {
      const dx = x - cx;
      const dy = y - cy;
      pixels[y * width + x] += amplitude * Math.exp(-(dx * dx + dy * dy) / s2);
    }
  }
}

function addGaussianNoise(pixels: Float32Array, sigma: number, rng: () => number) {
  for (let i = 0; i < pixels.length; i += 2) {
    const u1 = Math.max(1e-12, rng());
    const u2 = rng();
    const r = Math.sqrt(-2 * Math.log(u1));
    const theta = 2 * Math.PI * u2;
    const z0 = r * Math.cos(theta);
    const z1 = r * Math.sin(theta);
    pixels[i] += z0 * sigma;
    if (i + 1 < pixels.length) pixels[i + 1] += z1 * sigma;
  }
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)));
  return sorted[idx];
}

describe("stacking starDetection", () => {
  it("estimates constant background with fallback noise", () => {
    const width = 16;
    const height = 16;
    const pixels = makeImage(width, height, 12);
    const { background, noise } = estimateBackground(pixels, width, height, 8);
    expect(background).toHaveLength(width * height);
    expect(background[0]).toBeCloseTo(12, 5);
    expect(noise).toBe(1);
  });

  it("detects stars in center and filters by border margin", () => {
    const width = 40;
    const height = 40;
    const pixels = makeImage(width, height, 0);
    putSquareStar(pixels, width, 20, 20, 3, 20);
    putSquareStar(pixels, width, 2, 2, 3, 20); // near border should be ignored

    const stars = detectStars(pixels, width, height, {
      sigmaThreshold: 3,
      minArea: 3,
      maxArea: 50,
      borderMargin: 8,
    });

    expect(stars.length).toBe(1);
    expect(stars[0].cx).toBeCloseTo(20, 1);
    expect(stars[0].cy).toBeCloseTo(20, 1);
    expect(stars[0].area).toBeGreaterThanOrEqual(3);
    expect(stars[0].flux).toBeGreaterThan(0);
  });

  it("respects maxStars and returns empty when no candidate exists", () => {
    const width = 60;
    const height = 60;
    const pixels = makeImage(width, height, 0);
    putSquareStar(pixels, width, 20, 20, 3, 25);
    putSquareStar(pixels, width, 30, 30, 3, 30);
    putSquareStar(pixels, width, 40, 20, 3, 35);

    const limited = detectStars(pixels, width, height, {
      sigmaThreshold: 3,
      maxStars: 2,
      minArea: 3,
      borderMargin: 5,
    });
    expect(limited).toHaveLength(2);

    const none = detectStars(makeImage(30, 30, 0), 30, 30, { sigmaThreshold: 10 });
    expect(none).toEqual([]);
  });

  it("keeps detectStars default behavior equivalent to explicit legacy profile", () => {
    const width = 50;
    const height = 50;
    const pixels = makeImage(width, height, 0);
    putSquareStar(pixels, width, 18, 17, 3, 24);
    putSquareStar(pixels, width, 31, 32, 3, 20);

    const fromDefault = detectStars(pixels, width, height, { sigmaThreshold: 3.5, minArea: 3 });
    const explicitLegacy = detectStars(pixels, width, height, {
      profile: "legacy",
      sigmaThreshold: 3.5,
      minArea: 3,
    });

    expect(fromDefault).toHaveLength(explicitLegacy.length);
    expect(fromDefault[0].cx).toBeCloseTo(explicitLegacy[0].cx, 4);
    expect(fromDefault[0].cy).toBeCloseTo(explicitLegacy[0].cy, 4);
  });

  it("detectStarsAsync reports monotonic progress and returns extended metrics", async () => {
    const width = 64;
    const height = 64;
    const pixels = makeImage(width, height, 2);
    putSquareStar(pixels, width, 20, 20, 3, 22);
    putSquareStar(pixels, width, 43, 39, 3, 18);

    const progress: number[] = [];
    const stars = await detectStarsAsync(
      pixels,
      width,
      height,
      {
        profile: "balanced",
        sigmaThreshold: 3,
        minArea: 3,
        maxStars: 20,
      },
      {
        onProgress: (p) => progress.push(p),
        chunkRows: 8,
      },
    );

    expect(stars.length).toBeGreaterThanOrEqual(1);
    expect(stars[0].snr).toBeGreaterThanOrEqual(0);
    expect(stars[0].ellipticity).toBeGreaterThanOrEqual(0);
    expect(progress.length).toBeGreaterThan(1);
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i]).toBeGreaterThanOrEqual(progress[i - 1] - 1e-6);
    }
    expect(progress[progress.length - 1]).toBeCloseTo(1, 6);
  });

  it("detectStarsAsync supports abort signal", async () => {
    const width = 80;
    const height = 80;
    const pixels = makeImage(width, height, 0);
    putSquareStar(pixels, width, 40, 40, 5, 30);

    const controller = new AbortController();
    controller.abort();

    await expect(
      detectStarsAsync(
        pixels,
        width,
        height,
        {
          profile: "balanced",
          sigmaThreshold: 3,
        },
        {
          signal: controller.signal,
        },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("filters elongated tracks with ellipticity constraint in modern profile", async () => {
    const width = 72;
    const height = 72;
    const pixels = makeImage(width, height, 0);

    // Round-ish star
    putSquareStar(pixels, width, 50, 48, 3, 26);
    // Elongated track/noise artifact
    for (let x = 10; x <= 24; x++) {
      pixels[18 * width + x] = 24;
    }

    const stars = await detectStarsAsync(
      pixels,
      width,
      height,
      {
        profile: "accurate",
        sigmaThreshold: 3,
        minArea: 3,
        maxArea: 300,
        maxEllipticity: 0.4,
      },
      { chunkRows: 8 },
    );

    expect(stars.length).toBe(1);
    expect(stars[0].cx).toBeCloseTo(50, 1);
    expect(stars[0].cy).toBeCloseTo(48, 1);
  });

  it("deblends close binary stars in equal and unequal brightness cases", async () => {
    const width = 96;
    const height = 96;

    const runCase = async (a1: number, a2: number) => {
      const pixels = makeImage(width, height, 5);
      addGaussianStar(pixels, width, height, 44, 48, 1.15, a1);
      addGaussianStar(pixels, width, height, 49, 48, 1.15, a2);

      const stars = await detectStarsAsync(
        pixels,
        width,
        height,
        {
          profile: "accurate",
          sigmaThreshold: 3.8,
          minArea: 3,
          maxArea: 500,
          maxStars: 20,
          deblendNLevels: 32,
          deblendMinContrast: 0.04,
          maxEllipticity: 0.95,
          borderMargin: 8,
        },
        { chunkRows: 12 },
      );

      return stars.filter((s) => Math.abs(s.cy - 48) <= 2 && s.cx >= 40 && s.cx <= 53);
    };

    const equal = await runCase(90, 85);
    const unequal = await runCase(95, 45);

    expect(equal.length).toBeGreaterThanOrEqual(2);
    expect(unequal.length).toBeGreaterThanOrEqual(2);
  });

  it("meets quantitative benchmark on synthetic star field", async () => {
    const width = 256;
    const height = 256;
    const pixels = makeImage(width, height, 100);
    const rng = mulberry32(20260218);

    const truth: Array<{ x: number; y: number; fwhm: number }> = [];
    for (let i = 0; i < 24; i++) {
      let x = 0;
      let y = 0;
      let tries = 0;
      do {
        x = 20 + rng() * (width - 40);
        y = 20 + rng() * (height - 40);
        tries++;
      } while (truth.some((s) => Math.hypot(s.x - x, s.y - y) < 11) && tries < 200);

      const sigma = 0.95 + rng() * 0.65;
      const amplitude = 65 + rng() * 75;
      addGaussianStar(pixels, width, height, x, y, sigma, amplitude);
      truth.push({ x, y, fwhm: 2.3548 * sigma });
    }

    addGaussianNoise(pixels, 2.4, rng);

    const detections = await detectStarsAsync(
      pixels,
      width,
      height,
      {
        profile: "accurate",
        sigmaThreshold: 4.2,
        maxStars: 120,
        minArea: 3,
        maxArea: 700,
        borderMargin: 12,
        meshSize: 48,
        deblendNLevels: 24,
        deblendMinContrast: 0.05,
        filterFwhm: 2.1,
        maxFwhm: 9,
        maxEllipticity: 0.8,
      },
      { chunkRows: 24 },
    );

    const usedDetections = new Set<number>();
    const centroidErrors: number[] = [];
    const fwhmRelativeErrors: number[] = [];
    let matched = 0;

    for (const gt of truth) {
      let bestIndex = -1;
      let bestDist = Infinity;
      for (let i = 0; i < detections.length; i++) {
        if (usedDetections.has(i)) continue;
        const d = Math.hypot(detections[i].cx - gt.x, detections[i].cy - gt.y);
        if (d < bestDist) {
          bestDist = d;
          bestIndex = i;
        }
      }
      if (bestIndex >= 0 && bestDist <= 2) {
        usedDetections.add(bestIndex);
        matched++;
        centroidErrors.push(bestDist);
        fwhmRelativeErrors.push(
          Math.abs(detections[bestIndex].fwhm - gt.fwhm) / Math.max(1e-6, gt.fwhm),
        );
      }
    }

    const precision = matched / Math.max(1, detections.length);
    const recall = matched / truth.length;
    const centroidP95 = percentile(centroidErrors, 0.95);
    const fwhmRelMedian = median(fwhmRelativeErrors);

    expect(precision).toBeGreaterThanOrEqual(0.9);
    expect(recall).toBeGreaterThanOrEqual(0.9);
    expect(centroidP95).toBeLessThanOrEqual(0.6);
    expect(fwhmRelMedian).toBeLessThanOrEqual(0.2);
  });
});
