const mockDetectStars = jest.fn();
const mockDetectStarsAsync = jest.fn();

jest.mock("../starDetection", () => ({
  detectStars: (...args: unknown[]) => mockDetectStars(...args),
  detectStarsAsync: (...args: unknown[]) => mockDetectStarsAsync(...args),
}));

import {
  alignFrame,
  alignFrameAsync,
  applyTransform,
  computeFullAlignment,
  computeTranslation,
  type AlignmentTransform,
} from "../alignment";
import type { DetectedStar } from "../starDetection";

const star = (cx: number, cy: number, flux: number = 100): DetectedStar => ({
  cx,
  cy,
  flux,
  peak: flux,
  area: 5,
  fwhm: 2.5,
});

describe("stacking alignment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDetectStarsAsync.mockReset();
  });

  it("computes translation and handles insufficient stars", () => {
    const insufficient = computeTranslation([star(1, 1)], [star(2, 2)]);
    expect(insufficient.matrix).toEqual([1, 0, 0, 0, 1, 0]);
    expect(insufficient.matchedStars).toBe(0);
    expect(insufficient.rmsError).toBe(Infinity);

    const ref = [star(10, 10), star(20, 10), star(15, 20), star(30, 30)];
    const target = [star(13, 8), star(23, 8), star(18, 18), star(33, 28)];
    const t = computeTranslation(ref, target, 10);
    expect(t.matrix[2]).toBeCloseTo(3, 1);
    expect(t.matrix[5]).toBeCloseTo(-2, 1);
    expect(t.matchedStars).toBeGreaterThanOrEqual(3);
  });

  it("computes full alignment for matching star patterns", () => {
    const ref = [star(10, 10), star(20, 10), star(15, 20), star(30, 30), star(40, 12)];
    const target = [star(13, 8), star(23, 8), star(18, 18), star(33, 28), star(43, 10)];

    const result = computeFullAlignment(ref, target, 0.05);
    expect(result.matchedStars).toBeGreaterThanOrEqual(3);
    expect(Number.isFinite(result.rmsError)).toBe(true);
  });

  it("returns identity full alignment when stars are insufficient", () => {
    const result = computeFullAlignment([star(1, 1)], [star(2, 2)]);
    expect(result.matrix).toEqual([1, 0, 0, 0, 1, 0]);
    expect(result.rmsError).toBe(Infinity);
  });

  it("applies transform and falls back for singular matrix", () => {
    const pixels = new Float32Array([
      1,
      2,
      3, //
      4,
      5,
      6, //
      7,
      8,
      9,
    ]);
    const singular: AlignmentTransform = {
      matrix: [1, 2, 0, 2, 4, 0], // determinant 0
      matchedStars: 0,
      rmsError: Infinity,
    };
    const unchanged = applyTransform(pixels, 3, 3, singular);
    expect(Array.from(unchanged)).toEqual(Array.from(pixels));

    const translated = applyTransform(pixels, 3, 3, {
      matrix: [1, 0, 1, 0, 1, 0],
      matchedStars: 4,
      rmsError: 0.5,
    });
    expect(translated).toHaveLength(pixels.length);
  });

  it("aligns frame by mode and handles failed matching", () => {
    const refPixels = new Float32Array(100).fill(1);
    const targetPixels = new Float32Array(100).fill(2);

    const none = alignFrame(refPixels, targetPixels, 10, 10, "none");
    expect(none.aligned).toBe(targetPixels);
    expect(none.transform.rmsError).toBe(0);

    // translation failure path
    mockDetectStars.mockReturnValueOnce([star(1, 1)]).mockReturnValueOnce([star(2, 2)]);
    const failed = alignFrame(refPixels, targetPixels, 10, 10, "translation");
    expect(failed.aligned).toBe(targetPixels);
    expect(failed.transform.matchedStars).toBe(0);
    expect(failed.transform.rmsError).toBe(Infinity);

    // full alignment success path
    mockDetectStars
      .mockReturnValueOnce([
        star(20, 20),
        star(60, 20),
        star(40, 70),
        star(100, 120),
        star(150, 80),
      ])
      .mockReturnValueOnce([
        star(23, 18),
        star(63, 18),
        star(43, 68),
        star(103, 118),
        star(153, 78),
      ]);
    const success = alignFrame(refPixels, targetPixels, 200, 200, "full");
    expect(success.transform.matchedStars).toBeGreaterThanOrEqual(3);
    expect(success.aligned).toHaveLength(200 * 200);
  });

  it("alignFrameAsync supports full->translation fallback with diagnostics", async () => {
    const refPixels = new Float32Array(200 * 200).fill(1);
    const targetPixels = new Float32Array(200 * 200).fill(2);
    const ref = [star(20, 20), star(60, 20), star(40, 70), star(100, 120), star(150, 80)];
    const target = [star(23, 18), star(63, 18), star(43, 68), star(103, 118), star(153, 78)];

    mockDetectStarsAsync.mockResolvedValueOnce(ref).mockResolvedValueOnce(target);

    const { aligned, transform } = await alignFrameAsync(
      refPixels,
      targetPixels,
      200,
      200,
      "full",
      {
        maxRansacIterations: 0,
        fallbackToTranslation: true,
        searchRadius: 12,
      },
    );

    expect(aligned).toHaveLength(targetPixels.length);
    expect(transform.matchedStars).toBeGreaterThanOrEqual(3);
    expect(transform.fallbackUsed).toBe("translation");
    expect(transform.detectionCounts).toEqual({ ref: ref.length, target: target.length });
  });

  it("alignFrameAsync returns identity when alignment cannot be solved", async () => {
    const refPixels = new Float32Array(30 * 30).fill(1);
    const targetPixels = new Float32Array(30 * 30).fill(2);

    mockDetectStarsAsync
      .mockResolvedValueOnce([star(3, 3), star(8, 8)])
      .mockResolvedValueOnce([star(5, 5)]);

    const { aligned, transform } = await alignFrameAsync(refPixels, targetPixels, 30, 30, "full", {
      fallbackToTranslation: false,
    });

    expect(aligned).toBe(targetPixels);
    expect(transform.matrix).toEqual([1, 0, 0, 0, 1, 0]);
    expect(transform.fallbackUsed).toBe("none");
    expect(transform.matchedStars).toBe(0);
    expect(transform.detectionCounts).toEqual({ ref: 2, target: 1 });
  });

  it("alignFrame uses star overrides without calling detector", () => {
    const refPixels = new Float32Array(100).fill(1);
    const targetPixels = new Float32Array(100).fill(2);
    const refStars = [star(10, 10), star(20, 10), star(15, 20), star(30, 30)];
    const targetStars = [star(13, 8), star(23, 8), star(18, 18), star(33, 28)];

    const result = alignFrame(refPixels, targetPixels, 100, 100, "full", {
      refStarsOverride: refStars,
      targetStarsOverride: targetStars,
    });

    expect(result.transform.matchedStars).toBeGreaterThanOrEqual(3);
    expect(result.transform.fallbackUsed).toBe("annotated-stars");
    expect(result.transform.overrideUsage).toBe("both");
    expect(mockDetectStars).not.toHaveBeenCalled();
  });

  it("alignFrame detects only target side when only ref override is provided", () => {
    const refPixels = new Float32Array(100).fill(1);
    const targetPixels = new Float32Array(100).fill(2);
    const refStars = [star(10, 10), star(20, 10), star(15, 20), star(30, 30)];
    const targetDetected = [star(13, 8), star(23, 8), star(18, 18), star(33, 28)];

    mockDetectStars.mockReturnValueOnce(targetDetected);
    const result = alignFrame(refPixels, targetPixels, 100, 100, "full", {
      refStarsOverride: refStars,
    });

    expect(result.transform.matchedStars).toBeGreaterThanOrEqual(3);
    expect(result.transform.overrideUsage).toBe("ref");
    expect(result.transform.detectionCounts).toEqual({ ref: 4, target: 4 });
    expect(result.transform.fallbackUsed).toBe("annotated-stars");
    expect(mockDetectStars).toHaveBeenCalledTimes(1);
  });

  it("alignFrame detects only ref side when only target override is provided", () => {
    const refPixels = new Float32Array(100).fill(1);
    const targetPixels = new Float32Array(100).fill(2);
    const targetStars = [star(13, 8), star(23, 8), star(18, 18), star(33, 28)];
    const refDetected = [star(10, 10), star(20, 10), star(15, 20), star(30, 30)];

    mockDetectStars.mockReturnValueOnce(refDetected);
    const result = alignFrame(refPixels, targetPixels, 100, 100, "full", {
      targetStarsOverride: targetStars,
    });

    expect(result.transform.matchedStars).toBeGreaterThanOrEqual(3);
    expect(result.transform.overrideUsage).toBe("target");
    expect(result.transform.detectionCounts).toEqual({ ref: 4, target: 4 });
    expect(result.transform.fallbackUsed).toBe("annotated-stars");
    expect(mockDetectStars).toHaveBeenCalledTimes(1);
  });

  it("alignFrameAsync computes overrideUsage per side for partial overrides", async () => {
    const refPixels = new Float32Array(100).fill(1);
    const targetPixels = new Float32Array(100).fill(2);
    const refStars = [star(10, 10), star(20, 10), star(15, 20), star(30, 30)];
    const targetDetected = [star(13, 8), star(23, 8), star(18, 18), star(33, 28)];

    mockDetectStarsAsync.mockResolvedValueOnce(targetDetected);
    const result = await alignFrameAsync(refPixels, targetPixels, 100, 100, "full", {
      refStarsOverride: refStars,
    });

    expect(result.transform.overrideUsage).toBe("ref");
    expect(result.transform.fallbackUsed).toBe("annotated-stars");
    expect(result.transform.detectionCounts).toEqual({ ref: 4, target: 4 });
    expect(mockDetectStarsAsync).toHaveBeenCalledTimes(1);
  });

  it("alignFrame supports one/two/three-star manual control points", () => {
    const refPixels = new Float32Array(64).fill(1);
    const targetPixels = new Float32Array(64).fill(2);

    const one = alignFrame(refPixels, targetPixels, 8, 8, "full", {
      manualControlPoints: {
        mode: "oneStar",
        ref: [{ x: 2, y: 2 }],
        target: [{ x: 4, y: 1 }],
      },
    });
    expect(one.transform.fallbackUsed).toBe("manual-1star");
    expect(one.transform.matrix).toEqual([1, 0, 2, 0, 1, -1]);

    const two = alignFrame(refPixels, targetPixels, 8, 8, "full", {
      manualControlPoints: {
        mode: "twoStar",
        ref: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        target: [
          { x: 2, y: 3 },
          { x: 4, y: 3 },
        ],
      },
    });
    expect(two.transform.fallbackUsed).toBe("manual-2star");
    expect(two.transform.matrix[0]).toBeCloseTo(2, 6);
    expect(two.transform.matrix[2]).toBeCloseTo(2, 6);
    expect(two.transform.matrix[5]).toBeCloseTo(3, 6);

    const three = alignFrame(refPixels, targetPixels, 8, 8, "full", {
      manualControlPoints: {
        mode: "threeStar",
        ref: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 1 },
        ],
        target: [
          { x: 1, y: 2 },
          { x: 3, y: 1 },
          { x: 2, y: 5 },
        ],
      },
    });
    expect(three.transform.fallbackUsed).toBe("manual-3star");
    expect(three.transform.matrix[0]).toBeCloseTo(2, 6);
    expect(three.transform.matrix[1]).toBeCloseTo(1, 6);
    expect(three.transform.matrix[2]).toBeCloseTo(1, 6);
  });
});
