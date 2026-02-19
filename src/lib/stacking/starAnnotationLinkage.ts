import type {
  StarAnnotationBundle,
  StarAnnotationDetectionSnapshot,
  StarAnnotationPoint,
} from "../fits/types";
import type { DetectedStar } from "./starDetection";

export type ManualRegistrationMode = "oneStar" | "twoStar" | "threeStar";

export interface AnchorPoint {
  id: string;
  x: number;
  y: number;
  anchorIndex: 1 | 2 | 3;
}

export interface AnchorPair {
  anchorIndex: 1 | 2 | 3;
  ref: AnchorPoint;
  target: AnchorPoint;
}

export interface MergeDetectedPolicy {
  maxDetectedPoints?: number;
  matchRadiusPx?: number;
  preserveDetectedDisabled?: boolean;
}

export interface ToDetectedStarsOptions {
  maxCount?: number;
  defaultFwhm?: number;
  defaultArea?: number;
}

export interface SanitizeStarAnnotationOptions {
  width?: number;
  height?: number;
  dedupeRadius?: number;
  maxPoints?: number;
}

type StarAnnotationBundleInput = Omit<
  Partial<StarAnnotationBundle>,
  "detectionSnapshot" | "points"
> & {
  detectionSnapshot?: Partial<StarAnnotationDetectionSnapshot> | null;
  points?: StarAnnotationPoint[] | null;
};

const DEFAULT_DETECTION_SNAPSHOT: StarAnnotationDetectionSnapshot = {
  profile: "balanced",
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

const EPS = 1e-8;

function isFinitePoint(point: { x: number; y: number }) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function distance2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function findNearestIndex(
  point: { x: number; y: number },
  candidates: Array<{ x: number; y: number }>,
  used: Set<number>,
  maxRadius: number,
) {
  const maxDist2 = maxRadius * maxRadius;
  let bestIndex = -1;
  let bestDist2 = Infinity;
  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    const d2 = distance2(point, candidates[i]);
    if (d2 <= maxDist2 && d2 < bestDist2) {
      bestDist2 = d2;
      bestIndex = i;
    }
  }
  return bestIndex;
}

function normalizeDetectionSnapshot(
  input?: Partial<StarAnnotationDetectionSnapshot> | null,
): StarAnnotationDetectionSnapshot {
  if (!input) return { ...DEFAULT_DETECTION_SNAPSHOT };
  return {
    ...DEFAULT_DETECTION_SNAPSHOT,
    ...input,
    profile:
      input.profile === "fast" || input.profile === "accurate" || input.profile === "balanced"
        ? input.profile
        : DEFAULT_DETECTION_SNAPSHOT.profile,
  };
}

function ensureUniqueAnchors(points: StarAnnotationPoint[]): StarAnnotationPoint[] {
  const anchorOwner = new Map<1 | 2 | 3, string>();
  return points.map((point) => {
    if (!point.anchorIndex) return point;
    const owner = anchorOwner.get(point.anchorIndex);
    if (!owner) {
      anchorOwner.set(point.anchorIndex, point.id);
      return point;
    }
    if (owner === point.id) return point;
    return { ...point, anchorIndex: undefined };
  });
}

function createPointId(prefix: "d" | "m", x: number, y: number) {
  return `${prefix}_${Math.round(x * 100)}_${Math.round(y * 100)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createManualStarAnnotationPoint(
  x: number,
  y: number,
  anchorIndex?: 1 | 2 | 3,
): StarAnnotationPoint {
  return {
    id: createPointId("m", x, y),
    x,
    y,
    enabled: true,
    source: "manual",
    anchorIndex,
  };
}

export function pickAnchorPoints(points: StarAnnotationPoint[]): AnchorPoint[] {
  return points
    .filter((point): point is StarAnnotationPoint & { anchorIndex: 1 | 2 | 3 } => {
      return !!point.anchorIndex && point.enabled !== false && isFinitePoint(point);
    })
    .sort((a, b) => a.anchorIndex! - b.anchorIndex!)
    .map((point) => ({
      id: point.id,
      x: point.x,
      y: point.y,
      anchorIndex: point.anchorIndex!,
    }));
}

export function buildAnchorPairs(
  refAnchors: AnchorPoint[],
  targetAnchors: AnchorPoint[],
): AnchorPair[] {
  const refMap = new Map<1 | 2 | 3, AnchorPoint>();
  for (const anchor of refAnchors) {
    refMap.set(anchor.anchorIndex, anchor);
  }
  const pairs: AnchorPair[] = [];
  for (const target of targetAnchors) {
    const ref = refMap.get(target.anchorIndex);
    if (!ref) continue;
    pairs.push({ anchorIndex: target.anchorIndex, ref, target });
  }
  return pairs.sort((a, b) => a.anchorIndex - b.anchorIndex);
}

export function resolveRegistrationMode(
  refAnchors: AnchorPoint[],
  targetAnchors: AnchorPoint[],
): ManualRegistrationMode | null {
  const pairs = buildAnchorPairs(refAnchors, targetAnchors);
  if (pairs.length >= 3) return "threeStar";
  if (pairs.length === 2) return "twoStar";
  if (pairs.length === 1) return "oneStar";
  return null;
}

function solveLinear3x3(a: number[][], b: number[]) {
  const m = [
    [a[0][0], a[0][1], a[0][2], b[0]],
    [a[1][0], a[1][1], a[1][2], b[1]],
    [a[2][0], a[2][1], a[2][2], b[2]],
  ];

  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < EPS) return null;
    if (pivot !== col) {
      const tmp = m[pivot];
      m[pivot] = m[col];
      m[col] = tmp;
    }
    const div = m[col][col];
    for (let k = col; k < 4; k++) m[col][k] /= div;
    for (let row = 0; row < 3; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let k = col; k < 4; k++) m[row][k] -= factor * m[col][k];
    }
  }
  return [m[0][3], m[1][3], m[2][3]];
}

function solveAffineFromPairs(pairs: AnchorPair[]) {
  if (pairs.length < 3) return null;
  const points = pairs.slice(0, 3);
  const basis = points.map((pair) => [pair.ref.x, pair.ref.y, 1]);
  const bx = points.map((pair) => pair.target.x);
  const by = points.map((pair) => pair.target.y);

  const coeffX = solveLinear3x3(basis, bx);
  const coeffY = solveLinear3x3(basis, by);
  if (!coeffX || !coeffY) return null;
  const [a, b, tx] = coeffX;
  const [c, d, ty] = coeffY;
  return [a, b, tx, c, d, ty] as [number, number, number, number, number, number];
}

export function buildManualTransform(
  refAnchors: AnchorPoint[],
  targetAnchors: AnchorPoint[],
  mode: ManualRegistrationMode,
): [number, number, number, number, number, number] | null {
  const pairs = buildAnchorPairs(refAnchors, targetAnchors);
  if (mode === "oneStar") {
    if (pairs.length < 1) return null;
    const pair = pairs[0];
    const tx = pair.target.x - pair.ref.x;
    const ty = pair.target.y - pair.ref.y;
    return [1, 0, tx, 0, 1, ty];
  }

  if (mode === "twoStar") {
    if (pairs.length < 2) return null;
    const p1 = pairs[0];
    const p2 = pairs[1];
    const rvx = p2.ref.x - p1.ref.x;
    const rvy = p2.ref.y - p1.ref.y;
    const tvx = p2.target.x - p1.target.x;
    const tvy = p2.target.y - p1.target.y;

    const rNorm = Math.hypot(rvx, rvy);
    const tNorm = Math.hypot(tvx, tvy);
    if (rNorm < EPS || tNorm < EPS) return null;

    const scale = tNorm / rNorm;
    const theta = Math.atan2(tvy, tvx) - Math.atan2(rvy, rvx);
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const a = scale * cosT;
    const b = -scale * sinT;
    const c = scale * sinT;
    const d = scale * cosT;
    const tx = p1.target.x - (a * p1.ref.x + b * p1.ref.y);
    const ty = p1.target.y - (c * p1.ref.x + d * p1.ref.y);
    return [a, b, tx, c, d, ty];
  }

  return solveAffineFromPairs(pairs);
}

export function mergeDetectedWithManual(
  prevPoints: StarAnnotationPoint[],
  detectedStars: DetectedStar[],
  policy: MergeDetectedPolicy = {},
): StarAnnotationPoint[] {
  const maxDetected = Math.max(1, Math.min(2000, policy.maxDetectedPoints ?? 50));
  const matchRadius = Math.max(0.5, policy.matchRadiusPx ?? 4);
  const preserveDetectedDisabled = policy.preserveDetectedDisabled ?? true;
  const manualPoints = prevPoints
    .filter((point) => point.source === "manual")
    .map((point) => ({ ...point }));

  const prevDetected = prevPoints.filter((point) => point.source === "detected");
  const prevDetectedDisabled = preserveDetectedDisabled
    ? prevDetected.filter((point) => point.enabled === false)
    : [];
  const prevDetectedAnchored = prevDetected.filter((point) => !!point.anchorIndex);

  const candidates = detectedStars
    .slice()
    .sort((a, b) => (b.flux ?? 0) - (a.flux ?? 0))
    .slice(0, maxDetected);

  const usedDisabled = new Set<number>();
  const detectedPoints: StarAnnotationPoint[] = candidates.map((star) => {
    const point: StarAnnotationPoint = {
      id: createPointId("d", star.cx, star.cy),
      x: star.cx,
      y: star.cy,
      enabled: true,
      source: "detected",
      metrics: {
        flux: star.flux,
        peak: star.peak,
        area: star.area,
        fwhm: star.fwhm,
        snr: star.snr,
        roundness: star.roundness,
        ellipticity: star.ellipticity,
        sharpness: star.sharpness,
      },
    };

    if (prevDetectedDisabled.length > 0) {
      const idx = findNearestIndex(point, prevDetectedDisabled, usedDisabled, matchRadius);
      if (idx >= 0) {
        point.enabled = false;
        usedDisabled.add(idx);
      }
    }
    return point;
  });

  const usedDetected = new Set<number>();
  const manualAnchorIndices = new Set(
    manualPoints.filter((point) => !!point.anchorIndex).map((point) => point.anchorIndex!),
  );
  for (const anchored of prevDetectedAnchored) {
    if (!anchored.anchorIndex || manualAnchorIndices.has(anchored.anchorIndex)) continue;
    const idx = findNearestIndex(anchored, detectedPoints, usedDetected, matchRadius * 1.5);
    if (idx >= 0) {
      detectedPoints[idx] = { ...detectedPoints[idx], anchorIndex: anchored.anchorIndex };
      usedDetected.add(idx);
      manualAnchorIndices.add(anchored.anchorIndex);
    }
  }

  return ensureUniqueAnchors([...manualPoints, ...detectedPoints]);
}

export function toDetectedStars(
  points: StarAnnotationPoint[],
  pixelSampler?: (x: number, y: number) => number | null | undefined,
  options: ToDetectedStarsOptions = {},
): DetectedStar[] {
  const maxCount = Math.max(1, Math.min(2000, options.maxCount ?? 50));
  const defaultFwhm = options.defaultFwhm ?? 2.5;
  const defaultArea = options.defaultArea ?? 3;

  const stars: DetectedStar[] = [];
  for (const point of points) {
    if (!point.enabled || !isFinitePoint(point)) continue;
    const sampledPeak = pixelSampler?.(point.x, point.y);
    const peak = point.metrics?.peak ?? sampledPeak ?? 0;
    const area = Math.max(1, point.metrics?.area ?? defaultArea);
    const flux = point.metrics?.flux ?? Math.max(peak * area, peak, 1);
    stars.push({
      cx: point.x,
      cy: point.y,
      flux,
      peak,
      area,
      fwhm: point.metrics?.fwhm ?? defaultFwhm,
      snr: point.metrics?.snr,
      roundness: point.metrics?.roundness,
      ellipticity: point.metrics?.ellipticity,
      sharpness: point.metrics?.sharpness,
    });
  }

  stars.sort((a, b) => (b.flux ?? 0) - (a.flux ?? 0));
  return stars.slice(0, maxCount);
}

export function sanitizeStarAnnotations(
  input: StarAnnotationBundleInput | null | undefined,
  options: SanitizeStarAnnotationOptions = {},
): StarAnnotationBundle {
  const dedupeRadius = Math.max(0, options.dedupeRadius ?? 0.5);
  const maxPoints = Math.max(1, Math.min(10000, options.maxPoints ?? 3000));
  const width = options.width;
  const height = options.height;
  const seen: Array<{ x: number; y: number; source: StarAnnotationPoint["source"] }> = [];

  const points = (input?.points ?? [])
    .filter((point): point is StarAnnotationPoint => {
      return !!point && typeof point.id === "string" && isFinitePoint(point);
    })
    .map((point, index) => {
      const x = width != null ? Math.max(0, Math.min(width - 1, point.x)) : point.x;
      const y = height != null ? Math.max(0, Math.min(height - 1, point.y)) : point.y;
      const id = point.id || createPointId(point.source === "manual" ? "m" : "d", x, y);
      return {
        ...point,
        id: id || `${point.source}_${index}`,
        x,
        y,
        enabled: point.enabled !== false,
      };
    })
    .filter((point) => {
      const idx = seen.findIndex(
        (item) =>
          item.source === point.source && distance2(item, point) <= dedupeRadius * dedupeRadius,
      );
      if (idx >= 0) return false;
      seen.push({ x: point.x, y: point.y, source: point.source });
      return true;
    })
    .slice(0, maxPoints);

  return {
    version: 1,
    updatedAt: Math.max(0, Math.trunc(input?.updatedAt ?? Date.now())),
    detectionSnapshot: normalizeDetectionSnapshot(input?.detectionSnapshot),
    points: ensureUniqueAnchors(points),
    stale: !!input?.stale,
  };
}
