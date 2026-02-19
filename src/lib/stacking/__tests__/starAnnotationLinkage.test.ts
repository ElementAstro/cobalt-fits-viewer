import type { DetectedStar } from "../starDetection";
import {
  buildManualTransform,
  createManualStarAnnotationPoint,
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
      { id: "c", x: 3, y: 3, enabled: true, source: "detected" as const, metrics: { flux: 20 } },
    ];

    const stars = toDetectedStars(points, undefined, { maxCount: 1 });
    expect(stars).toHaveLength(1);
    expect(stars[0].flux).toBe(20);
    expect(stars[0].cx).toBe(3);
  });

  it("sanitizeStarAnnotations deduplicates and normalizes anchors", () => {
    const sanitized = sanitizeStarAnnotations(
      {
        updatedAt: 0,
        detectionSnapshot: { profile: "balanced" },
        points: [
          { id: "a", x: 10, y: 10, source: "manual", enabled: true, anchorIndex: 1 },
          { id: "b", x: 10.1, y: 10.1, source: "manual", enabled: true, anchorIndex: 1 },
          { id: "c", x: -5, y: 500, source: "detected", enabled: true, anchorIndex: 2 },
        ],
      },
      { width: 100, height: 100, dedupeRadius: 0.5 },
    );

    expect(sanitized.version).toBe(1);
    expect(sanitized.points.length).toBe(2);
    const anchor1Count = sanitized.points.filter((point) => point.anchorIndex === 1).length;
    expect(anchor1Count).toBe(1);
    const clamped = sanitized.points.find((point) => point.id === "c");
    expect(clamped?.x).toBe(0);
    expect(clamped?.y).toBe(99);
  });
});
