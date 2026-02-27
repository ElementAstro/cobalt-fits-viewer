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
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [min, max];
}

// ===== 像素拉伸算法 =====

type StretchFn = (v: number) => number;

export function getStretchFn(type: StretchType, asinhSoftening: number = 10): StretchFn {
  switch (type) {
    case "sqrt":
      return (v) => Math.sqrt(v);
    case "log":
      return (v) => Math.log1p(v * 1000) / Math.log1p(1000);
    case "asinh": {
      const s = Math.max(1, Math.min(100, asinhSoftening));
      const norm = Math.asinh(s);
      return (v) => Math.asinh(v * s) / norm;
    }
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

/**
 * AdaptiveStretch - PixInsight-style adaptive nonlinear stretch
 *
 * Preserves relative brightness differences between adjacent pixels in sorted order.
 * Noise-level differences are compressed while significant structure differences are preserved.
 *
 * @param pixels - Input pixel data
 * @param noiseThreshold - Differences below this (in normalized units) are treated as noise. Default 0.001
 * @param contrastProtection - Limits maximum local contrast boost [0,1]. Default 0
 * @param maxCurveSlope - Maximum slope of the transfer curve. Default 5
 */
export function adaptiveStretch(
  pixels: Float32Array,
  noiseThreshold: number = 0.001,
  contrastProtection: number = 0,
  maxCurveSlope: number = 5,
): Float32Array {
  const n = pixels.length;
  if (n === 0) return new Float32Array(0);

  // Find extent
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range <= 0) return new Float32Array(pixels);

  const nt = Math.max(0, Math.min(0.5, noiseThreshold));
  const cp = Math.max(0, Math.min(1, contrastProtection));
  const mcs = Math.max(1, Math.min(20, maxCurveSlope));

  // Step 1: Create sorted index array (subsample for performance on large images)
  const maxSamples = Math.min(n, 500000);
  const step = Math.max(1, Math.floor(n / maxSamples));
  const sampleCount = Math.ceil(n / step);
  const samples = new Float32Array(sampleCount);
  for (let i = 0, j = 0; i < n && j < sampleCount; i += step, j++) {
    samples[j] = (pixels[i] - min) / range;
  }
  samples.sort();

  // Step 2: Compute adjacent differences and build adaptive transfer curve
  const LUT_SIZE = 4096;
  const lut = new Float32Array(LUT_SIZE);
  const lutMax = LUT_SIZE - 1;

  // Build cumulative weight function from sorted samples
  const diffs = new Float32Array(sampleCount);
  for (let i = 1; i < sampleCount; i++) {
    diffs[i] = samples[i] - samples[i - 1];
  }

  // Compute adaptive weights: suppress noise-level diffs, preserve structure diffs
  const weights = new Float32Array(sampleCount);
  for (let i = 1; i < sampleCount; i++) {
    const d = diffs[i];
    if (d < nt) {
      // Noise zone: compress (reduce weight)
      weights[i] = d * (d / Math.max(nt, 1e-10));
    } else {
      // Structure zone: preserve, with optional contrast protection
      const excess = d - nt;
      const maxAllowed = nt * mcs;
      if (cp > 0 && excess > maxAllowed) {
        weights[i] = nt + maxAllowed + (excess - maxAllowed) * (1 - cp);
      } else {
        weights[i] = d;
      }
    }
  }

  // Cumulative sum → transfer function at sample positions
  const cumWeights = new Float32Array(sampleCount);
  for (let i = 1; i < sampleCount; i++) {
    cumWeights[i] = cumWeights[i - 1] + weights[i];
  }
  const totalWeight = cumWeights[sampleCount - 1];
  if (totalWeight <= 0) {
    for (let i = 0; i < LUT_SIZE; i++) lut[i] = i / lutMax;
  } else {
    // Interpolate cumulative weights into uniform LUT
    let sIdx = 0;
    for (let i = 0; i < LUT_SIZE; i++) {
      const x = i / lutMax;
      // Find bracketing samples
      while (sIdx < sampleCount - 1 && samples[sIdx + 1] < x) sIdx++;
      if (sIdx >= sampleCount - 1) {
        lut[i] = 1;
        continue;
      }
      const x0 = samples[sIdx];
      const x1 = samples[sIdx + 1];
      const spanX = x1 - x0;
      const t = spanX > 1e-12 ? (x - x0) / spanX : 0;
      const y0 = cumWeights[sIdx] / totalWeight;
      const y1 = cumWeights[sIdx + 1] / totalWeight;
      lut[i] = Math.max(0, Math.min(1, y0 + t * (y1 - y0)));
    }
  }

  // Apply LUT
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const normalized = (pixels[i] - min) / range;
    const clamped = Math.max(0, Math.min(1, normalized));
    const idx = Math.round(clamped * lutMax);
    result[i] = min + lut[idx] * range;
  }

  return result;
}

/**
 * Generalized Hyperbolic Stretch (GHS)
 * PixInsight-style flexible nonlinear stretch using generalized hyperbolic functions.
 *
 * @param pixels - Input pixel data (any range, will be normalized internally)
 * @param D - Stretch factor (0=no stretch, higher=stronger). Default 1
 * @param b - Symmetry point [0,1] where the stretch is centered. Default 0.25
 * @param SP - Shape parameter (-5 to 5). Controls curve shape. Default 0
 * @param HP - Highlight protection [0,1]. Reduces stretch in highlights. Default 0
 * @param LP - Shadow protection [0,1]. Reduces stretch in shadows (low-end protection). Default 0
 */
export function generalizedHyperbolicStretch(
  pixels: Float32Array,
  D: number = 1,
  b: number = 0.25,
  SP: number = 0,
  HP: number = 0,
  LP: number = 0,
): Float32Array {
  const n = pixels.length;

  // Normalize to [0,1]
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = pixels[i];
    if (Number.isFinite(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  const range = max - min;
  if (range <= 0) return new Float32Array(pixels);

  // Clamp parameters
  const dVal = Math.max(0, Math.min(15, D));
  const bVal = Math.max(0, Math.min(1, b));
  const spVal = Math.max(-5, Math.min(5, SP));
  const hpVal = Math.max(0, Math.min(1, HP));
  const lpVal = Math.max(0, Math.min(1, LP));

  if (dVal < 1e-6) {
    // No stretch — return normalized copy
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = min + ((pixels[i] - min) / range) * range;
    return out;
  }

  // Compute the shape coefficient from SP
  // a = exp(SP) maps SP ∈ [-5,5] to a ∈ [~0.007, ~148]
  const a = Math.exp(spVal);

  // GHS transfer function:
  // T(x) = asinh(a * D * (x - b)) / asinh(a * D * (1 - b))  for x >= b
  // T(x) = asinh(a * D * (x - b)) / asinh(a * D * (-b))       for x < b (negative domain, normalized)
  // We normalize so T(0)=0, T(1)=1

  const aD = a * dVal;
  const asinhRef1 = Math.asinh(aD * (1 - bVal));
  const asinhRef0 = Math.asinh(aD * -bVal);
  const totalRange = asinhRef1 - asinhRef0;

  if (Math.abs(totalRange) < 1e-12) return new Float32Array(pixels);

  // Build LUT for performance
  const LUT_SIZE = 4096;
  const lut = new Float32Array(LUT_SIZE);
  const lutMax = LUT_SIZE - 1;

  for (let i = 0; i < LUT_SIZE; i++) {
    const x = i / lutMax;

    // Apply shadow/highlight protection (reduce effective D in protected zones)
    let effectiveD = dVal;
    if (lpVal > 0 && x < bVal) {
      const t = 1 - x / Math.max(bVal, 1e-6);
      effectiveD *= 1 - lpVal * t * t;
    }
    if (hpVal > 0 && x > bVal) {
      const t = (x - bVal) / Math.max(1 - bVal, 1e-6);
      effectiveD *= 1 - hpVal * t * t;
    }
    effectiveD = Math.max(0, effectiveD);

    const aDe = a * effectiveD;
    const asinhVal = Math.asinh(aDe * (x - bVal));
    const asinhE0 = Math.asinh(aDe * -bVal);
    const asinhE1 = Math.asinh(aDe * (1 - bVal));
    const eRange = asinhE1 - asinhE0;

    if (Math.abs(eRange) < 1e-12) {
      lut[i] = x;
    } else {
      lut[i] = Math.max(0, Math.min(1, (asinhVal - asinhE0) / eRange));
    }
  }

  // Apply LUT
  const result = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const normalized = (pixels[i] - min) / range;
    const clamped = Math.max(0, Math.min(1, normalized));
    const idx = Math.round(clamped * lutMax);
    result[i] = min + lut[idx] * range;
  }

  return result;
}
