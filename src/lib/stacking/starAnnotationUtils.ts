import type { StarAnnotationPoint } from "../fits/types";

export const STAR_ANNOTATION_EPS = 1e-8;

export function isFinitePoint(point: { x: number; y: number }) {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

export function distance2(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function findNearestIndex(
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

export function ensureUniqueAnchors(points: StarAnnotationPoint[]): StarAnnotationPoint[] {
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

export function clampToImage(points: StarAnnotationPoint[], width: number, height: number) {
  return points.filter((point) => {
    if (!isFinitePoint(point)) return false;
    return point.x >= 0 && point.y >= 0 && point.x < width && point.y < height;
  });
}

export function createPointId(prefix: "d" | "m", x: number, y: number) {
  return `${prefix}_${Math.round(x * 100)}_${Math.round(y * 100)}_${Math.random().toString(36).slice(2, 8)}`;
}
