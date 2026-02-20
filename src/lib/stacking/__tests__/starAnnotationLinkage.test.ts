import type { DetectedStar } from "../starDetection";
import {
  buildManualTransform,
  createManualStarAnnotationPoint,
  evaluateStarAnnotationUsability,
  mergeDetectedWithManual,
  pickAnchorPoints,
  resolveRegistrationMode,
  sanitizeStarAnnotations,
  toDetectedStars,
} from "../starAnnotationLinkage";

const detected = (cx: number, cy: number, flux: number): DetectedStar => ({
  cx,
  cy,
  flux,
  peak: flux,
  area: 3,
  fwhm: 2.5,
});

describe("starAnnotationLinkage", () => {
  it("mergeDetectedWithManual keeps manual points and detected state", () => {
    const manual = createManualStarAnnotationPoint(30, 30, 1);
    const prev = [
      manual,
      {
        id: "d1",
        x: 10,
        y: 10,
        enabled: false,
        source: "detected" as const,
        anchorIndex: 2 as const,
      },
    ];

    const merged = mergeDetectedWithManual(
      prev,
      [detected(10.5, 9.8, 200), detected(50, 50, 150)],
      {
        matchRadiusPx: 2,
      },
    );

    expect(merged.some((point) => point.id === manual.id && point.source === "manual")).toBe(true);
    const disabledDetected = merged.find(
      (point) => point.source === "detected" && Math.hypot(point.x - 10.5, point.y - 9.8) < 2,
    );
    expect(disabledDetected?.enabled).toBe(false);
    expect(disabledDetected?.anchorIndex).toBe(2);
  });

  it("resolves one/two/three star modes and computes transforms", () => {
    const refOne = pickAnchorPoints([createManualStarAnnotationPoint(10, 20, 1)]);
    const tarOne = pickAnchorPoints([createManualStarAnnotationPoint(15, 17, 1)]);
    expect(resolveRegistrationMode(refOne, tarOne)).toBe("oneStar");
    const one = buildManualTransform(refOne, tarOne, "oneStar");
    expect(one).toEqual([1, 0, 5, 0, 1, -3]);

    const refTwo = pickAnchorPoints([
      createManualStarAnnotationPoint(0, 0, 1),
      createManualStarAnnotationPoint(1, 0, 2),
    ]);
    const tarTwo = pickAnchorPoints([
      createManualStarAnnotationPoint(2, 3, 1),
      createManualStarAnnotationPoint(4, 3, 2),
    ]);
    expect(resolveRegistrationMode(refTwo, tarTwo)).toBe("twoStar");
    const two = buildManualTransform(refTwo, tarTwo, "twoStar");
    expect(two?.[0]).toBeCloseTo(2, 6);
    expect(two?.[1]).toBeCloseTo(0, 6);
    expect(two?.[2]).toBeCloseTo(2, 6);
    expect(two?.[5]).toBeCloseTo(3, 6);

    const refThree = pickAnchorPoints([
      createManualStarAnnotationPoint(0, 0, 1),
      createManualStarAnnotationPoint(1, 0, 2),
      createManualStarAnnotationPoint(0, 1, 3),
    ]);
    const tarThree = pickAnchorPoints([
      createManualStarAnnotationPoint(1, 2, 1),
      createManualStarAnnotationPoint(3, 1, 2),
      createManualStarAnnotationPoint(2, 5, 3),
    ]);
    expect(resolveRegistrationMode(refThree, tarThree)).toBe("threeStar");
    const three = buildManualTransform(refThree, tarThree, "threeStar");
    expect(three).not.toBeNull();
    expect(three?.[0]).toBeCloseTo(2, 6);
    expect(three?.[1]).toBeCloseTo(1, 6);
    expect(three?.[2]).toBeCloseTo(1, 6);
    expect(three?.[3]).toBeCloseTo(-1, 6);
    expect(three?.[4]).toBeCloseTo(3, 6);
    expect(three?.[5]).toBeCloseTo(2, 6);
  });

  it("toDetectedStars keeps enabled stars and respects max count", () => {
    const points = [
      { id: "a", x: 1, y: 1, enabled: true, source: "manual" as const, metrics: { flux: 10 } },
      { id: "b", x: 2, y: 2, enabled: false, source: "manual" as const, metrics: { flux: 99 } },
      {
        id: "c",
        x: 3,
        y: 3,
        enabled: true,
        source: "detected" as const,
        metrics: { flux: 20, theta: 0.25, flags: 3 },
      },
    ];

    const stars = toDetectedStars(points, undefined, { maxCount: 1 });
    expect(stars).toHaveLength(1);
    expect(stars[0].flux).toBe(20);
    expect(stars[0].cx).toBe(3);
    expect(stars[0].theta).toBe(0.25);
    expect(stars[0].flags).toBe(3);
  });

  it("upgrades v1 payload to v2 with full detection snapshot and geometry", () => {
    const sanitized = sanitizeStarAnnotations(
      {
        version: 1,
        updatedAt: 123,
        detectionSnapshot: { profile: "balanced" },
        points: [{ id: "a", x: 12, y: 14, source: "manual", enabled: true, anchorIndex: 1 }],
      },
      { width: 120, height: 80 },
    );

    expect(sanitized.version).toBe(2);
    expect(sanitized.imageGeometry).toEqual({ width: 120, height: 80 });
    expect(sanitized.detectionSnapshot).toEqual(
      expect.objectContaining({
        profile: "balanced",
        sigmaThreshold: expect.any(Number),
        maxStars: expect.any(Number),
        sigmaClipIters: expect.any(Number),
        applyMatchedFilter: expect.any(Boolean),
        connectivity: expect.any(Number),
        minFwhm: expect.any(Number),
        minSharpness: expect.any(Number),
        maxSharpness: expect.any(Number),
        snrMin: expect.any(Number),
      }),
    );
  });

  it("keeps v2 metrics fidelity including theta/flags and stale reason", () => {
    const sanitized = sanitizeStarAnnotations(
      {
        version: 2,
        updatedAt: 42,
        stale: true,
        staleReason: "unsupported-transform",
        imageGeometry: { width: 64, height: 48 },
        detectionSnapshot: {
          profile: "accurate",
          sigmaThreshold: 4.2,
          maxStars: 200,
          minArea: 3,
          maxArea: 800,
          borderMargin: 8,
          sigmaClipIters: 3,
          applyMatchedFilter: true,
          connectivity: 8,
          meshSize: 48,
          deblendNLevels: 24,
          deblendMinContrast: 0.05,
          filterFwhm: 2,
          minFwhm: 0.5,
          maxFwhm: 9,
          maxEllipticity: 0.6,
          minSharpness: 0.2,
          maxSharpness: 18,
          peakMax: 5000,
          snrMin: 2,
        },
        points: [
          {
            id: "p1",
            x: 20,
            y: 15,
            source: "detected",
            enabled: true,
            metrics: {
              flux: 1000,
              peak: 400,
              area: 7,
              fwhm: 2.1,
              theta: 1.2,
              flags: 5,
            },
          },
        ],
      },
      { width: 64, height: 48 },
    );

    expect(sanitized.version).toBe(2);
    expect(sanitized.stale).toBe(true);
    expect(sanitized.staleReason).toBe("unsupported-transform");
    expect(sanitized.points[0].metrics?.theta).toBe(1.2);
    expect(sanitized.points[0].metrics?.flags).toBe(5);
    expect(sanitized.imageGeometry).toEqual({ width: 64, height: 48 });
  });

  it("evaluateStarAnnotationUsability flags dimension mismatch for v2 geometry", () => {
    const usage = evaluateStarAnnotationUsability(
      {
        version: 2,
        updatedAt: Date.now(),
        stale: false,
        imageGeometry: { width: 100, height: 100 },
        detectionSnapshot: { profile: "balanced" },
        points: [
          { id: "p1", x: 10, y: 10, source: "manual", enabled: true },
          { id: "p2", x: 20, y: 20, source: "manual", enabled: true },
          { id: "p3", x: 30, y: 30, source: "manual", enabled: true },
        ],
      },
      { width: 120, height: 120 },
    );

    expect(usage.usable).toBe(false);
    expect(usage.reason).toBe("dimension-mismatch");
  });
});
