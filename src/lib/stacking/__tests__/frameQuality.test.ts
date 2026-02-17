const mockDetectStars = jest.fn();
const mockEstimateBackground = jest.fn();

jest.mock("../starDetection", () => ({
  detectStars: (...args: unknown[]) => mockDetectStars(...args),
  estimateBackground: (...args: unknown[]) => mockEstimateBackground(...args),
}));

import { evaluateFrameQuality, evaluateFramesBatch, qualityToWeights } from "../frameQuality";

describe("stacking frameQuality", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("evaluates frame with star metrics and composite score", () => {
    mockEstimateBackground.mockReturnValue({
      background: new Float32Array([10, 10, 10, 10]),
      noise: 2,
    });
    mockDetectStars.mockReturnValue([
      { cx: 1, cy: 1, flux: 30, peak: 30, area: 3, fwhm: 2 },
      { cx: 2, cy: 2, flux: 40, peak: 40, area: 3, fwhm: 2.5 },
      { cx: 3, cy: 2, flux: 50, peak: 50, area: 3, fwhm: 3 },
      { cx: 3, cy: 3, flux: 35, peak: 35, area: 3, fwhm: 3.2 },
      { cx: 4, cy: 3, flux: 45, peak: 45, area: 3, fwhm: 2.8 },
    ]);

    const metrics = evaluateFrameQuality(new Float32Array([1, 2, 3, 4]), 2, 2);
    expect(metrics.backgroundMedian).toBe(10);
    expect(metrics.backgroundNoise).toBe(2);
    expect(metrics.starCount).toBe(5);
    expect(metrics.medianFwhm).toBe(2.8);
    expect(metrics.snr).toBe(20);
    expect(metrics.roundness).toBeGreaterThan(0);
    expect(metrics.roundness).toBeLessThanOrEqual(1);
    expect(metrics.score).toBeGreaterThan(0);
  });

  it("handles no-stars and zero-noise branches", () => {
    mockEstimateBackground.mockReturnValue({
      background: new Float32Array([1, 1, 1, 1]),
      noise: 0,
    });
    mockDetectStars.mockReturnValue([]);

    const metrics = evaluateFrameQuality(new Float32Array([1, 1, 1, 1]), 2, 2);
    expect(metrics.starCount).toBe(0);
    expect(metrics.medianFwhm).toBe(0);
    expect(metrics.snr).toBe(0);
    expect(metrics.roundness).toBe(1);
  });

  it("evaluates batch and reports progress", () => {
    mockEstimateBackground.mockReturnValue({
      background: new Float32Array([0, 0, 0, 0]),
      noise: 1,
    });
    mockDetectStars.mockReturnValue([]);
    const onProgress = jest.fn();
    const results = evaluateFramesBatch(
      [
        { pixels: new Float32Array([1, 2, 3, 4]), width: 2, height: 2 },
        { pixels: new Float32Array([5, 6, 7, 8]), width: 2, height: 2 },
      ],
      onProgress,
    );
    expect(results).toHaveLength(2);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
  });

  it("converts quality metrics to normalized weights", () => {
    expect(qualityToWeights([])).toEqual([]);
    expect(qualityToWeights([{ score: 0 } as never, { score: 0 } as never])).toEqual([1, 1]);
    expect(qualityToWeights([{ score: 50 } as never, { score: 100 } as never])).toEqual([0.5, 1]);
  });
});
