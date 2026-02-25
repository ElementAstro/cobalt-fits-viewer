/**
 * 像素拉伸算法与色调调整
 */

import type { StretchType, ViewerCurvePreset } from "../fits/types";
import { computeZScale, computePercentile } from "../utils/pixelMath";

// ===== Helpers =====

export function getExtent(pixels: Float32Array): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [min, max];
}

// ===== 像素拉伸算法 =====

type StretchFn = (v: number) => number;

export function getStretchFn(type: StretchType): StretchFn {
  switch (type) {
    case "sqrt":
      return (v) => Math.sqrt(v);
    case "log":
      return (v) => Math.log1p(v * 1000) / Math.log1p(1000);
    case "asinh":
      return (v) => Math.asinh(v * 10) / Math.asinh(10);
    case "power":
      return (v) => Math.pow(v, 0.5);
    default:
      return (v) => v;
  }
}

export function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

export function resolveBlackWhitePoints(
  pixels: Float32Array,
  type: StretchType,
  rawMin: number,
  rawMax: number,
  blackPoint: number,
  whitePoint: number,
): { bp: number; wp: number } {
  let baseMin = rawMin;
  let baseMax = rawMax;

  if (type === "zscale") {
    const { z1, z2 } = computeZScale(pixels);
    baseMin = z1;
    baseMax = z2;
  } else if (type === "percentile") {
    const { z1, z2 } = computePercentile(pixels, 1, 99);
    baseMin = z1;
    baseMax = z2;
  }

  if (!Number.isFinite(baseMin) || !Number.isFinite(baseMax)) {
    baseMin = rawMin;
    baseMax = rawMax;
  }

  if (baseMin > baseMax) {
    const tmp = baseMin;
    baseMin = baseMax;
    baseMax = tmp;
  }

  const baseSpan = baseMax - baseMin;
  if (!Number.isFinite(baseSpan) || Math.abs(baseSpan) < 1e-12) {
    return { bp: baseMin, wp: baseMax };
  }

  const bp = baseMin + clamp01(blackPoint) * baseSpan;
  const wp = baseMin + clamp01(whitePoint) * baseSpan;
  if (!Number.isFinite(bp) || !Number.isFinite(wp) || wp - bp <= 1e-12) {
    return { bp: baseMin, wp: baseMax };
  }

  return { bp, wp };
}

/**
 * 对像素数据应用拉伸算法，输出 0-1 范围的归一化数据
 */
export function applyStretch(
  pixels: Float32Array,
  type: StretchType,
  blackPoint: number = 0,
  whitePoint: number = 1,
  gamma: number = 1,
  outputBlack: number = 0,
  outputWhite: number = 1,
  brightness: number = 0,
  contrast: number = 1,
  mtfMidtone: number = 0.5,
  curvePreset: ViewerCurvePreset = "linear",
  precomputedExtent?: [number, number],
): Float32Array {
  const [rawMin, rawMax] = precomputedExtent ?? getExtent(pixels);
  const range = rawMax - rawMin;
  if (range === 0) return new Float32Array(pixels.length).fill(0.5);

  const result = new Float32Array(pixels.length);

  const { bp, wp } = resolveBlackWhitePoints(pixels, type, rawMin, rawMax, blackPoint, whitePoint);
  const span = wp - bp;
  if (!Number.isFinite(span) || Math.abs(span) < 1e-12) {
    return new Float32Array(pixels.length).fill(0.5);
  }

  const stretchFn = getStretchFn(type);

  for (let i = 0; i < pixels.length; i++) {
    let v = (pixels[i] - bp) / span;
    v = stretchFn(Math.max(0, Math.min(1, v)));

    if (gamma !== 1 && gamma > 0) {
      v = Math.pow(v, 1 / gamma);
    }

    // Apply output levels mapping
    if (outputBlack !== 0 || outputWhite !== 1) {
      v = outputBlack + v * (outputWhite - outputBlack);
    }

    v = applyViewerTone(v, brightness, contrast, mtfMidtone, curvePreset);
    result[i] = Math.max(0, Math.min(1, v));
  }

  return result;
}

function mtfTransfer(m: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (Math.abs(x - m) < 1e-6) return 0.5;
  return ((m - 1) * x) / ((2 * m - 1) * x - m);
}

function applyCurvePreset(v: number, preset: ViewerCurvePreset): number {
  switch (preset) {
    case "sCurve":
      return clamp01(v + 0.2 * (v - v * v) * (v - 0.5 > 0 ? 1 : -1));
    case "brighten":
      return clamp01(Math.pow(v, 0.82));
    case "darken":
      return clamp01(Math.pow(v, 1.2));
    case "highContrast":
      return clamp01((v - 0.5) * 1.35 + 0.5);
    case "linear":
    default:
      return v;
  }
}

export function applyViewerTone(
  value: number,
  brightness: number,
  contrast: number,
  mtfMidtone: number,
  curvePreset: ViewerCurvePreset,
): number {
  let v = value;
  if (brightness !== 0) {
    v = clamp01(v + brightness);
  }
  if (contrast !== 1) {
    v = clamp01((v - 0.5) * contrast + 0.5);
  }
  if (Math.abs(mtfMidtone - 0.5) > 1e-6) {
    const m = clamp01(mtfMidtone);
    if (m > 0.001 && m < 0.999) {
      v = clamp01(mtfTransfer(m, v));
    }
  }
  return applyCurvePreset(v, curvePreset);
}
