import { act, renderHook } from "@testing-library/react-native";
import { useStacking } from "../useStacking";

jest.mock("../../lib/utils/fileManager", () => ({
  readFileAsArrayBuffer: jest.fn(),
}));
jest.mock("../../lib/fits/parser", () => ({
  loadScientificFitsFromBuffer: jest.fn(),
  getImagePixels: jest.fn(),
  getImageDimensions: jest.fn(),
}));
jest.mock("../../lib/utils/pixelMath", () => ({
  stackAverage: jest.fn(),
  stackMedian: jest.fn(),
  stackSigmaClip: jest.fn(),
  stackMin: jest.fn(),
  stackMax: jest.fn(),
  stackWinsorizedSigmaClip: jest.fn(),
  stackWeightedAverage: jest.fn(),
  computeAutoStretch: jest.fn(),
}));
jest.mock("../../lib/converter/formatConverter", () => ({
  fitsToRGBA: jest.fn(),
}));
jest.mock("../../lib/stacking/calibration", () => ({
  calibrateFrame: jest.fn((p: Float32Array) => p),
  createMasterDark: jest.fn((frames: Float32Array[]) => frames[0]),
  createMasterFlat: jest.fn((frames: Float32Array[]) => frames[0]),
}));
jest.mock("../../lib/stacking/alignment", () => ({
  alignFrameAsync: jest.fn(async (ref: Float32Array, cur: Float32Array) => ({
    aligned: cur,
    transform: {
      matchedStars: 10,
      rmsError: 0.8,
      detectionCounts: { ref: 12, target: 11 },
      fallbackUsed: "none",
    },
  })),
}));
jest.mock("../../lib/stacking/frameQuality", () => ({
  evaluateFrameQualityAsync: jest.fn(async () => ({
    backgroundMedian: 0,
    backgroundNoise: 1,
    snr: 10,
    starCount: 20,
    medianFwhm: 2.3,
    roundness: 0.9,
    score: 90,
    stars: [],
  })),
  qualityToWeights: jest.fn(() => [0.7, 0.3]),
}));
jest.mock("../../lib/logger", () => {
  const actual = jest.requireActual("../../lib/logger") as typeof import("../../lib/logger");
  return {
    ...actual,
    Logger: {
      ...actual.Logger,
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  };
});

const fileLib = jest.requireMock("../../lib/utils/fileManager") as {
  readFileAsArrayBuffer: jest.Mock;
};
const parserLib = jest.requireMock("../../lib/fits/parser") as {
  loadScientificFitsFromBuffer: jest.Mock;
  getImagePixels: jest.Mock;
  getImageDimensions: jest.Mock;
};
const mathLib = jest.requireMock("../../lib/utils/pixelMath") as {
  stackAverage: jest.Mock;
  stackWeightedAverage: jest.Mock;
  computeAutoStretch: jest.Mock;
  evaluateFrameQuality?: jest.Mock;
};
const converterLib = jest.requireMock("../../lib/converter/formatConverter") as {
  fitsToRGBA: jest.Mock;
};
const qualityLib = jest.requireMock("../../lib/stacking/frameQuality") as {
  evaluateFrameQualityAsync: jest.Mock;
  qualityToWeights: jest.Mock;
};
const alignLib = jest.requireMock("../../lib/stacking/alignment") as {
  alignFrameAsync: jest.Mock;
};

describe("useStacking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fileLib.readFileAsArrayBuffer.mockResolvedValue(new ArrayBuffer(8));
    parserLib.loadScientificFitsFromBuffer.mockResolvedValue({ fits: true });
    parserLib.getImageDimensions.mockReturnValue({ width: 2, height: 2 });
    parserLib.getImagePixels
      .mockResolvedValueOnce(new Float32Array([1, 2, 3, 4]))
      .mockResolvedValueOnce(new Float32Array([5, 6, 7, 8]))
      .mockResolvedValue(new Float32Array([1, 1, 1, 1]));
    mathLib.stackAverage.mockReturnValue(new Float32Array([10, 10, 10, 10]));
    mathLib.stackWeightedAverage.mockReturnValue(new Float32Array([11, 11, 11, 11]));
    mathLib.computeAutoStretch.mockReturnValue({ blackPoint: 0.1, whitePoint: 0.9 });
    converterLib.fitsToRGBA.mockReturnValue(new Uint8ClampedArray([255, 255, 255, 255]));
  });

  it("guards against insufficient frames", async () => {
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles([{ filepath: "/tmp/a.fits", filename: "a.fits" }], "average");
    });

    expect(result.current.error).toBe("At least 2 frames are required for stacking");
  });

  it("stacks average successfully and sets result/progress", async () => {
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles(
        [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        "average",
      );
    });

    expect(mathLib.stackAverage).toHaveBeenCalled();
    expect(result.current.result).toEqual(
      expect.objectContaining({
        method: "average",
        frameCount: 2,
        width: 2,
        height: 2,
      }),
    );
    expect(result.current.progress).toEqual(
      expect.objectContaining({
        stage: "done",
      }),
    );
  });

  it("handles dimension mismatch as error", async () => {
    parserLib.getImageDimensions
      .mockReturnValueOnce({ width: 2, height: 2 })
      .mockReturnValueOnce({ width: 3, height: 3 });
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles(
        [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        "average",
      );
    });

    expect(result.current.error).toContain("Dimension mismatch");
  });

  it("runs weighted/quality/alignment branches and supports cancel/reset", async () => {
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles({
        files: [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        method: "weighted",
        sigma: 2.5,
        alignmentMode: "full",
        enableQualityEval: true,
      });
    });

    expect(qualityLib.evaluateFrameQualityAsync).toHaveBeenCalled();
    expect(qualityLib.qualityToWeights).toHaveBeenCalled();
    expect(alignLib.alignFrameAsync).toHaveBeenCalled();
    expect(mathLib.stackWeightedAverage).toHaveBeenCalledWith(expect.any(Array), [0.7, 0.3]);

    act(() => {
      result.current.cancel();
    });
    expect(result.current.isStacking).toBe(false);
    expect(result.current.progress).toBeNull();

    act(() => {
      result.current.reset();
    });
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("cancels in-flight request without publishing result", async () => {
    parserLib.getImagePixels.mockImplementation(
      () =>
        new Promise<Float32Array>((resolve) => {
          setTimeout(() => resolve(new Float32Array([1, 2, 3, 4])), 30);
        }),
    );

    const { result } = renderHook(() => useStacking());
    const runPromise = act(async () => {
      await result.current.stackFiles(
        [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        "average",
      );
    });

    act(() => {
      result.current.cancel();
    });

    await runPromise;

    expect(result.current.isStacking).toBe(false);
    expect(result.current.progress).toBeNull();
    expect(result.current.result).toBeNull();
  });

  it("passes advanced detection/alignment options through async pipeline", async () => {
    const { result } = renderHook(() => useStacking());

    await act(async () => {
      await result.current.stackFiles({
        files: [
          { filepath: "/tmp/a.fits", filename: "a.fits" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        method: "weighted",
        alignmentMode: "full",
        enableQualityEval: true,
        advanced: {
          detection: {
            profile: "accurate",
            sigmaThreshold: 4.4,
            maxStars: 333,
            minArea: 4,
            maxArea: 888,
            borderMargin: 9,
            sigmaClipIters: 3,
            applyMatchedFilter: true,
            connectivity: 8,
            meshSize: 48,
            deblendNLevels: 20,
            deblendMinContrast: 0.06,
            filterFwhm: 2.1,
            minFwhm: 0.7,
            maxFwhm: 9.5,
            maxEllipticity: 0.6,
            minSharpness: 0.2,
            maxSharpness: 12,
            peakMax: 9000,
            snrMin: 2.2,
          },
          alignment: {
            inlierThreshold: 2.5,
            maxRansacIterations: 180,
            fallbackToTranslation: true,
          },
        },
      });
    });

    const qualityOpts = qualityLib.evaluateFrameQualityAsync.mock.calls[0]?.[3];
    expect(qualityOpts?.detectionOptions).toEqual(
      expect.objectContaining({
        profile: "accurate",
        sigmaThreshold: 4.4,
        maxStars: 333,
        minArea: 4,
        maxArea: 888,
        borderMargin: 9,
        sigmaClipIters: 3,
        applyMatchedFilter: true,
        connectivity: 8,
        meshSize: 48,
        deblendNLevels: 20,
        deblendMinContrast: 0.06,
        filterFwhm: 2.1,
        minFwhm: 0.7,
        maxFwhm: 9.5,
        maxEllipticity: 0.6,
        minSharpness: 0.2,
        maxSharpness: 12,
        peakMax: 9000,
        snrMin: 2.2,
      }),
    );

    const alignOpts = alignLib.alignFrameAsync.mock.calls[0]?.[5];
    expect(alignOpts).toEqual(
      expect.objectContaining({
        inlierThreshold: 2.5,
        maxRansacIterations: 180,
        fallbackToTranslation: true,
      }),
    );
    expect(alignOpts?.detectionOptions).toEqual(
      expect.objectContaining({
        profile: "accurate",
        sigmaThreshold: 4.4,
        maxStars: 333,
        sigmaClipIters: 3,
        applyMatchedFilter: true,
        connectivity: 8,
        minFwhm: 0.7,
        minSharpness: 0.2,
        maxSharpness: 12,
        peakMax: 9000,
        snrMin: 2.2,
      }),
    );
  });

  it("does not use annotations when useAnnotatedForAlignment is false", async () => {
    const { result } = renderHook(() => useStacking());

    const annotation = {
      version: 2 as const,
      updatedAt: Date.now(),
      stale: false,
      imageGeometry: { width: 2, height: 2 },
      detectionSnapshot: { profile: "balanced" as const },
      points: [
        { id: "a1", x: 0, y: 0, enabled: true, source: "manual" as const, anchorIndex: 1 as const },
        { id: "a2", x: 1, y: 0, enabled: true, source: "manual" as const, anchorIndex: 2 as const },
        { id: "a3", x: 0, y: 1, enabled: true, source: "manual" as const, anchorIndex: 3 as const },
      ],
    } as any;

    await act(async () => {
      await result.current.stackFiles({
        files: [
          { filepath: "/tmp/a.fits", filename: "a.fits", starAnnotations: annotation },
          { filepath: "/tmp/b.fits", filename: "b.fits", starAnnotations: annotation },
        ],
        method: "weighted",
        alignmentMode: "full",
        enableQualityEval: true,
        advanced: {
          annotation: { useAnnotatedForAlignment: false, stalePolicy: "auto-fallback-detect" },
        },
      });
    });

    const alignOpts = alignLib.alignFrameAsync.mock.calls[0]?.[5];
    expect(alignOpts?.refStarsOverride).toBeUndefined();
    expect(alignOpts?.targetStarsOverride).toBeUndefined();
    expect(alignOpts?.manualControlPoints).toBeUndefined();

    const qualityOpts = qualityLib.evaluateFrameQualityAsync.mock.calls[0]?.[3];
    expect(qualityOpts?.starsOverride).toBeUndefined();
    expect(
      result.current.result?.annotationDiagnostics?.every((item) => !item.usedForAlignment),
    ).toBe(true);
  });

  it("falls back to detection when annotations are stale", async () => {
    const { result } = renderHook(() => useStacking());
    const staleAnnotation = {
      version: 2 as const,
      updatedAt: Date.now(),
      stale: true,
      staleReason: "geometry-changed" as const,
      imageGeometry: { width: 2, height: 2 },
      detectionSnapshot: { profile: "balanced" as const },
      points: [
        { id: "a1", x: 0, y: 0, enabled: true, source: "manual" as const, anchorIndex: 1 as const },
        { id: "a2", x: 1, y: 0, enabled: true, source: "manual" as const, anchorIndex: 2 as const },
        { id: "a3", x: 0, y: 1, enabled: true, source: "manual" as const, anchorIndex: 3 as const },
      ],
    } as any;

    await act(async () => {
      await result.current.stackFiles({
        files: [
          { filepath: "/tmp/a.fits", filename: "a.fits", starAnnotations: staleAnnotation },
          { filepath: "/tmp/b.fits", filename: "b.fits", starAnnotations: staleAnnotation },
        ],
        method: "weighted",
        alignmentMode: "full",
        enableQualityEval: true,
      });
    });

    expect(result.current.result?.annotationDiagnostics?.[0]).toEqual(
      expect.objectContaining({
        usable: false,
        reason: "stale",
        warning: "annotation-stale-fallback-detect",
      }),
    );
    const alignOpts = alignLib.alignFrameAsync.mock.calls[0]?.[5];
    expect(alignOpts?.refStarsOverride).toBeUndefined();
    const qualityOpts = qualityLib.evaluateFrameQualityAsync.mock.calls[0]?.[3];
    expect(qualityOpts?.starsOverride).toBeUndefined();
  });

  it("falls back to detection when annotation points are insufficient", async () => {
    const { result } = renderHook(() => useStacking());
    const weakAnnotation = {
      version: 2 as const,
      updatedAt: Date.now(),
      stale: false,
      imageGeometry: { width: 2, height: 2 },
      detectionSnapshot: { profile: "balanced" as const },
      points: [
        { id: "a1", x: 0, y: 0, enabled: true, source: "manual" as const },
        { id: "a2", x: 1, y: 1, enabled: true, source: "manual" as const },
      ],
    } as any;

    await act(async () => {
      await result.current.stackFiles({
        files: [
          { filepath: "/tmp/a.fits", filename: "a.fits", starAnnotations: weakAnnotation },
          { filepath: "/tmp/b.fits", filename: "b.fits", starAnnotations: weakAnnotation },
        ],
        method: "weighted",
        alignmentMode: "full",
        enableQualityEval: true,
      });
    });

    expect(result.current.result?.annotationDiagnostics?.[0]).toEqual(
      expect.objectContaining({
        usable: false,
        reason: "insufficient-points",
        warning: "annotation-insufficient-points-fallback-detect",
      }),
    );
    const alignOpts = alignLib.alignFrameAsync.mock.calls[0]?.[5];
    expect(alignOpts?.refStarsOverride).toBeUndefined();
    const qualityOpts = qualityLib.evaluateFrameQualityAsync.mock.calls[0]?.[3];
    expect(qualityOpts?.starsOverride).toBeUndefined();
  });

  it("prioritizes manual anchors and annotation stars in stacking pipeline", async () => {
    const { result } = renderHook(() => useStacking());
    parserLib.getImageDimensions
      .mockReturnValueOnce({ width: 40, height: 40 })
      .mockReturnValueOnce({ width: 40, height: 40 });
    parserLib.getImagePixels
      .mockResolvedValueOnce(new Float32Array(40 * 40).fill(1))
      .mockResolvedValueOnce(new Float32Array(40 * 40).fill(1));
    const snapshot = {
      profile: "balanced" as const,
      sigmaThreshold: 5,
      maxStars: 220,
      minArea: 3,
      maxArea: 600,
      borderMargin: 10,
      meshSize: 64,
      deblendNLevels: 16,
      deblendMinContrast: 0.08,
      filterFwhm: 2.2,
      maxFwhm: 11,
      maxEllipticity: 0.65,
    };

    await act(async () => {
      await result.current.stackFiles({
        files: [
          {
            filepath: "/tmp/a.fits",
            filename: "a.fits",
            starAnnotations: {
              version: 1,
              updatedAt: Date.now(),
              detectionSnapshot: snapshot,
              points: [
                { id: "r1", x: 0, y: 0, enabled: true, source: "manual", anchorIndex: 1 },
                { id: "r2", x: 20, y: 0, enabled: true, source: "manual", anchorIndex: 2 },
                { id: "r3", x: 0, y: 20, enabled: true, source: "manual", anchorIndex: 3 },
                { id: "rd", x: 10, y: 10, enabled: true, source: "detected" },
              ],
            },
          },
          {
            filepath: "/tmp/b.fits",
            filename: "b.fits",
            starAnnotations: {
              version: 1,
              updatedAt: Date.now(),
              detectionSnapshot: snapshot,
              points: [
                { id: "t1", x: 2, y: 3, enabled: true, source: "manual", anchorIndex: 1 },
                { id: "t2", x: 22, y: 3, enabled: true, source: "manual", anchorIndex: 2 },
                { id: "t3", x: 2, y: 23, enabled: true, source: "manual", anchorIndex: 3 },
                { id: "td", x: 12, y: 13, enabled: true, source: "detected" },
              ],
            },
          },
        ],
        method: "weighted",
        alignmentMode: "full",
        enableQualityEval: true,
      });
    });

    const qualityOpts = qualityLib.evaluateFrameQualityAsync.mock.calls[0]?.[3];
    expect(qualityOpts?.starsOverride?.length).toBeGreaterThanOrEqual(3);

    const alignOpts = alignLib.alignFrameAsync.mock.calls[0]?.[5];
    expect(alignOpts?.manualControlPoints).toEqual(
      expect.objectContaining({
        mode: "threeStar",
      }),
    );
    expect(alignOpts?.refStarsOverride?.length).toBeGreaterThanOrEqual(3);
    expect(alignOpts?.targetStarsOverride?.length).toBeGreaterThanOrEqual(3);
  });
});
