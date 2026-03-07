import { act, renderHook } from "@testing-library/react-native";
import { useStacking } from "../useStacking";

type StackResultLike = {
  method: string;
  frameCount: number;
  calibrationWarnings: Array<{
    code: string;
    filename: string;
    messageKey: string;
  }>;
};

jest.mock("../../../lib/image/scientificImageLoader", () => ({
  loadScientificImageFromPath: jest.fn(),
}));
jest.mock("../../../lib/utils/pixelMath", () => ({
  computeAutoStretch: jest.fn(),
}));
jest.mock("../../../lib/stacking/integration", () => {
  const actual = jest.requireActual("../../../lib/stacking/integration") as Record<string, unknown>;
  return {
    ...actual,
    integrateFrames: jest.fn(
      (_frames: Float32Array[], _options: { strategy: { name: string } }) => ({
        pixels: new Float32Array([10, 10, 10, 10]),
        stats: { totalRejectedLow: 0, totalRejectedHigh: 0, pixelCount: 4 },
      }),
    ),
  };
});
jest.mock("../../../lib/stacking/normalization", () => {
  const actual = jest.requireActual("../../../lib/stacking/normalization") as Record<
    string,
    unknown
  >;
  return { ...actual };
});
jest.mock("../../../lib/converter/formatConverter", () => ({
  fitsToRGBA: jest.fn(),
}));
jest.mock("../../../lib/stacking/calibration", () => ({
  calibrateFrame: jest.fn((p: Float32Array) => p),
  createMasterDark: jest.fn((frames: Float32Array[]) => frames[0]),
  createMasterFlat: jest.fn((frames: Float32Array[]) => frames[0]),
  computeMedianExposure: jest.fn((values: Array<number | null>) => {
    const valid = values.filter((value) => typeof value === "number" && value > 0) as number[];
    if (valid.length === 0) return null;
    valid.sort((a, b) => a - b);
    return valid[Math.floor(valid.length / 2)];
  }),
  scaleFrameByExposure: jest.fn((frame: Float32Array, from: number | null, to: number | null) => {
    const validFrom = typeof from === "number" && Number.isFinite(from) && from > 0;
    const validTo = typeof to === "number" && Number.isFinite(to) && to > 0;
    if (!validFrom || !validTo) {
      return {
        pixels: new Float32Array(frame),
        scale: 1,
        usedFallbackScale: true,
      };
    }
    const scale = to / from;
    const pixels = new Float32Array(frame.length);
    for (let i = 0; i < frame.length; i++) {
      pixels[i] = frame[i] * scale;
    }
    return {
      pixels,
      scale,
      usedFallbackScale: false,
    };
  }),
}));
jest.mock("../../../lib/stacking/alignment", () => ({
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
jest.mock("../../../lib/stacking/frameQuality", () => ({
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
jest.mock("../../../lib/logger", () => {
  const actual = jest.requireActual("../../../lib/logger") as typeof import("../../../lib/logger");
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

const loaderLib = jest.requireMock("../../../lib/image/scientificImageLoader") as {
  loadScientificImageFromPath: jest.Mock;
};
const mathLib = jest.requireMock("../../../lib/utils/pixelMath") as {
  computeAutoStretch: jest.Mock;
};
const integrationLib = jest.requireMock("../../../lib/stacking/integration") as {
  integrateFrames: jest.Mock;
};
const converterLib = jest.requireMock("../../../lib/converter/formatConverter") as {
  fitsToRGBA: jest.Mock;
};
const qualityLib = jest.requireMock("../../../lib/stacking/frameQuality") as {
  evaluateFrameQualityAsync: jest.Mock;
  qualityToWeights: jest.Mock;
};
const alignLib = jest.requireMock("../../../lib/stacking/alignment") as {
  alignFrameAsync: jest.Mock;
};
const calibrationLib = jest.requireMock("../../../lib/stacking/calibration") as {
  scaleFrameByExposure: jest.Mock;
};

describe("useStacking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    loaderLib.loadScientificImageFromPath.mockResolvedValue({
      pixels: new Float32Array([1, 2, 3, 4]),
      width: 2,
      height: 2,
      exposure: 30,
      sourceType: "fits",
      sourceFormat: "fits",
    });
    integrationLib.integrateFrames.mockReturnValue({
      pixels: new Float32Array([10, 10, 10, 10]),
      stats: { totalRejectedLow: 0, totalRejectedHigh: 0, pixelCount: 4 },
    });
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
    let stackResult: StackResultLike | null = null;

    await act(async () => {
      stackResult = (await result.current.stackFiles(
        [
          { filepath: "/tmp/a.dng", filename: "a.dng" },
          { filepath: "/tmp/b.fits", filename: "b.fits" },
        ],
        "average",
      )) as StackResultLike | null;
    });

    expect(integrationLib.integrateFrames).toHaveBeenCalled();
    const callArgs = integrationLib.integrateFrames.mock.calls[0];
    expect(callArgs[1].strategy.name).toBe("average");
    expect(stackResult).toEqual(
      expect.objectContaining({
        method: "average",
        frameCount: 2,
        calibrationWarnings: [],
      }),
    );
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
    loaderLib.loadScientificImageFromPath
      .mockResolvedValueOnce({
        pixels: new Float32Array([1, 2, 3, 4]),
        width: 2,
        height: 2,
        exposure: 30,
        sourceType: "fits",
        sourceFormat: "fits",
      })
      .mockResolvedValueOnce({
        pixels: new Float32Array([5, 6, 7, 8]),
        width: 3,
        height: 3,
        exposure: 30,
        sourceType: "raster",
        sourceFormat: "dng",
      });
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

  it("generates EXPTIME warnings and keeps stacking running with scale=1 fallback", async () => {
    loaderLib.loadScientificImageFromPath
      .mockResolvedValueOnce({
        pixels: new Float32Array([1, 1, 1, 1]),
        width: 2,
        height: 2,
        exposure: null,
        sourceType: "fits",
        sourceFormat: "fits",
      })
      .mockResolvedValueOnce({
        pixels: new Float32Array([2, 2, 2, 2]),
        width: 2,
        height: 2,
        exposure: 30,
        sourceType: "fits",
        sourceFormat: "fits",
      })
      .mockResolvedValueOnce({
        pixels: new Float32Array([5, 6, 7, 8]),
        width: 2,
        height: 2,
        exposure: null,
        sourceType: "raster",
        sourceFormat: "dng",
      })
      .mockResolvedValueOnce({
        pixels: new Float32Array([9, 10, 11, 12]),
        width: 2,
        height: 2,
        exposure: 60,
        sourceType: "fits",
        sourceFormat: "fits",
      });

    const { result } = renderHook(() => useStacking());
    let stackResult: StackResultLike | null = null;

    await act(async () => {
      stackResult = (await result.current.stackFiles({
        files: [
          { filepath: "/tmp/light-a.fits", filename: "light-a.fits" },
          { filepath: "/tmp/light-b.fits", filename: "light-b.fits" },
        ],
        method: "average",
        calibration: {
          darkFilepaths: ["/tmp/dark-a.fits", "/tmp/dark-b.fits"],
        },
      })) as StackResultLike | null;
    });

    expect(stackResult).not.toBeNull();
    expect((stackResult as unknown as StackResultLike).calibrationWarnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "missing-dark-exptime",
          filename: "dark-a.fits",
          messageKey: "editor.missingDarkExposureWarning",
        }),
        expect.objectContaining({
          code: "missing-light-exptime",
          filename: "light-a.fits",
          messageKey: "editor.missingLightExposureWarning",
        }),
      ]),
    );
    expect(calibrationLib.scaleFrameByExposure).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
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
    expect(integrationLib.integrateFrames).toHaveBeenCalled();
    const intCallArgs = integrationLib.integrateFrames.mock.calls[0];
    expect(intCallArgs[1].strategy.name).toBe("weighted");

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
    loaderLib.loadScientificImageFromPath.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                pixels: new Float32Array([1, 2, 3, 4]),
                width: 2,
                height: 2,
                exposure: 30,
                sourceType: "fits",
                sourceFormat: "fits",
              }),
            30,
          );
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
    loaderLib.loadScientificImageFromPath
      .mockResolvedValueOnce({
        pixels: new Float32Array(40 * 40).fill(1),
        width: 40,
        height: 40,
        exposure: 60,
        sourceType: "fits",
        sourceFormat: "fits",
      })
      .mockResolvedValueOnce({
        pixels: new Float32Array(40 * 40).fill(1),
        width: 40,
        height: 40,
        exposure: 60,
        sourceType: "raster",
        sourceFormat: "dng",
      });
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
