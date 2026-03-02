import type { StarAnnotationPoint, StarAnnotationStaleReason } from "../fits/types";
import type { ImageEditOperation } from "../utils/imageOperations";
import { isFinitePoint, ensureUniqueAnchors, clampToImage } from "./starAnnotationUtils";

interface GeometryState {
  width: number;
  height: number;
}

export interface TransformStarAnnotationPointsResult {
  points: StarAnnotationPoint[];
  width: number;
  height: number;
  transformed: boolean;
  staleReason?: StarAnnotationStaleReason;
}

function mapPoints(
  points: StarAnnotationPoint[],
  mapper: (point: StarAnnotationPoint) => { x: number; y: number },
  next: GeometryState,
) {
  const mapped = points
    .map((point) => {
      const coords = mapper(point);
      if (!isFinitePoint(coords)) return null;
      return { ...point, x: coords.x, y: coords.y };
    })
    .filter((point): point is StarAnnotationPoint => !!point);
  return ensureUniqueAnchors(clampToImage(mapped, next.width, next.height));
}

function rotate90CW(points: StarAnnotationPoint[], state: GeometryState) {
  const next = { width: state.height, height: state.width };
  return {
    points: mapPoints(points, (point) => ({ x: state.height - 1 - point.y, y: point.x }), next),
    ...next,
  };
}

function rotate90CCW(points: StarAnnotationPoint[], state: GeometryState) {
  const next = { width: state.height, height: state.width };
  return {
    points: mapPoints(points, (point) => ({ x: point.y, y: state.width - 1 - point.x }), next),
    ...next,
  };
}

function rotate180(points: StarAnnotationPoint[], state: GeometryState) {
  return {
    points: mapPoints(
      points,
      (point) => ({ x: state.width - 1 - point.x, y: state.height - 1 - point.y }),
      state,
    ),
    ...state,
  };
}

function flipH(points: StarAnnotationPoint[], state: GeometryState) {
  return {
    points: mapPoints(points, (point) => ({ x: state.width - 1 - point.x, y: point.y }), state),
    ...state,
  };
}

function flipV(points: StarAnnotationPoint[], state: GeometryState) {
  return {
    points: mapPoints(points, (point) => ({ x: point.x, y: state.height - 1 - point.y }), state),
    ...state,
  };
}

function crop(
  points: StarAnnotationPoint[],
  state: GeometryState,
  op: Extract<ImageEditOperation, { type: "crop" }>,
) {
  const next = {
    width: Math.max(1, Math.trunc(op.width)),
    height: Math.max(1, Math.trunc(op.height)),
  };
  return {
    points: mapPoints(points, (point) => ({ x: point.x - op.x, y: point.y - op.y }), next),
    ...next,
  };
}

function rotateArbitrary(
  points: StarAnnotationPoint[],
  state: GeometryState,
  op: Extract<ImageEditOperation, { type: "rotateArbitrary" }>,
) {
  const rad = (op.angle * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const next = {
    width: Math.ceil(Math.abs(state.width * cos) + Math.abs(state.height * sin)),
    height: Math.ceil(Math.abs(state.width * sin) + Math.abs(state.height * cos)),
  };
  const cx = state.width / 2;
  const cy = state.height / 2;
  const ncx = next.width / 2;
  const ncy = next.height / 2;
  return {
    points: mapPoints(
      points,
      (point) => {
        const sx = point.x - cx;
        const sy = point.y - cy;
        return {
          x: cos * sx - sin * sy + ncx,
          y: sin * sx + cos * sy + ncy,
        };
      },
      next,
    ),
    ...next,
  };
}

function normalizeState(width: number, height: number): GeometryState {
  return {
    width: Math.max(1, Math.trunc(width)),
    height: Math.max(1, Math.trunc(height)),
  };
}

export function transformStarAnnotationPoints(
  points: StarAnnotationPoint[],
  width: number,
  height: number,
  op: ImageEditOperation,
): TransformStarAnnotationPointsResult {
  const state = normalizeState(width, height);
  switch (op.type) {
    case "rotate90cw": {
      const next = rotate90CW(points, state);
      return { ...next, transformed: true };
    }
    case "rotate90ccw": {
      const next = rotate90CCW(points, state);
      return { ...next, transformed: true };
    }
    case "rotate180": {
      const next = rotate180(points, state);
      return { ...next, transformed: true };
    }
    case "flipH": {
      const next = flipH(points, state);
      return { ...next, transformed: true };
    }
    case "flipV": {
      const next = flipV(points, state);
      return { ...next, transformed: true };
    }
    case "crop": {
      const next = crop(points, state, op);
      return { ...next, transformed: true };
    }
    case "rotateArbitrary": {
      const next = rotateArbitrary(points, state, op);
      return { ...next, transformed: true };
    }
    default:
      return {
        points,
        ...state,
        transformed: false,
        staleReason: "unsupported-transform",
      };
  }
}
