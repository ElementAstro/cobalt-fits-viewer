import type { CompositeBlendMode } from "./types";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function multiply(cb: number, cs: number) {
  return cb * cs;
}

function screen(cb: number, cs: number) {
  return cb + cs - cb * cs;
}

function hardLight(cb: number, cs: number) {
  if (cs <= 0.5) return multiply(cb, 2 * cs);
  return screen(cb, 2 * cs - 1);
}

function colorDodge(cb: number, cs: number) {
  if (cb === 0) return 0;
  if (cs >= 1) return 1;
  return Math.min(1, cb / (1 - cs));
}

function colorBurn(cb: number, cs: number) {
  if (cb >= 1) return 1;
  if (cs === 0) return 0;
  return 1 - Math.min(1, (1 - cb) / cs);
}

function softLightD(cb: number) {
  if (cb <= 0.25) {
    return ((16 * cb - 12) * cb + 4) * cb;
  }
  return Math.sqrt(cb);
}

function softLight(cb: number, cs: number) {
  if (cs <= 0.5) {
    return cb - (1 - 2 * cs) * cb * (1 - cb);
  }
  return cb + (2 * cs - 1) * (softLightD(cb) - cb);
}

function lum(c: [number, number, number]) {
  return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
}

function sat(c: [number, number, number]) {
  return Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2]);
}

function clipColor(c: [number, number, number]): [number, number, number] {
  let out: [number, number, number] = [c[0], c[1], c[2]];
  const l = lum(out);
  const n = Math.min(out[0], out[1], out[2]);
  const x = Math.max(out[0], out[1], out[2]);

  if (n < 0 && l !== n) {
    out = [
      l + ((out[0] - l) * l) / (l - n),
      l + ((out[1] - l) * l) / (l - n),
      l + ((out[2] - l) * l) / (l - n),
    ];
  }

  if (x > 1 && x !== l) {
    out = [
      l + ((out[0] - l) * (1 - l)) / (x - l),
      l + ((out[1] - l) * (1 - l)) / (x - l),
      l + ((out[2] - l) * (1 - l)) / (x - l),
    ];
  }

  return [clamp01(out[0]), clamp01(out[1]), clamp01(out[2])];
}

function setLum(c: [number, number, number], l: number): [number, number, number] {
  const d = l - lum(c);
  return clipColor([c[0] + d, c[1] + d, c[2] + d]);
}

function setSat(c: [number, number, number], s: number): [number, number, number] {
  const indexed = [
    { idx: 0 as const, val: c[0] },
    { idx: 1 as const, val: c[1] },
    { idx: 2 as const, val: c[2] },
  ].sort((a, b) => a.val - b.val);

  const min = indexed[0];
  const mid = indexed[1];
  const max = indexed[2];

  const out: [number, number, number] = [0, 0, 0];

  if (max.val > min.val) {
    out[mid.idx] = ((mid.val - min.val) * s) / (max.val - min.val);
    out[max.idx] = s;
  } else {
    out[mid.idx] = 0;
    out[max.idx] = 0;
  }

  out[min.idx] = 0;
  return [clamp01(out[0]), clamp01(out[1]), clamp01(out[2])];
}

function blendSingle(cb: number, cs: number, mode: CompositeBlendMode) {
  switch (mode) {
    case "normal":
      return cs;
    case "multiply":
      return multiply(cb, cs);
    case "screen":
      return screen(cb, cs);
    case "overlay":
      return hardLight(cs, cb);
    case "darken":
      return Math.min(cb, cs);
    case "lighten":
      return Math.max(cb, cs);
    case "color-dodge":
      return colorDodge(cb, cs);
    case "color-burn":
      return colorBurn(cb, cs);
    case "hard-light":
      return hardLight(cb, cs);
    case "soft-light":
      return softLight(cb, cs);
    case "difference":
      return Math.abs(cb - cs);
    case "exclusion":
      return cb + cs - 2 * cb * cs;
    default:
      return cs;
  }
}

function blendNonSeparable(
  backdrop: [number, number, number],
  source: [number, number, number],
  mode: CompositeBlendMode,
): [number, number, number] {
  switch (mode) {
    case "hue":
      return setLum(setSat(source, sat(backdrop)), lum(backdrop));
    case "saturation":
      return setLum(setSat(backdrop, sat(source)), lum(backdrop));
    case "color":
      return setLum(source, lum(backdrop));
    case "luminosity":
      return setLum(backdrop, lum(source));
    default:
      return source;
  }
}

export function blendRgb(
  backdrop: [number, number, number],
  source: [number, number, number],
  mode: CompositeBlendMode,
): [number, number, number] {
  if (mode === "hue" || mode === "saturation" || mode === "color" || mode === "luminosity") {
    return blendNonSeparable(backdrop, source, mode);
  }

  return [
    clamp01(blendSingle(backdrop[0], source[0], mode)),
    clamp01(blendSingle(backdrop[1], source[1], mode)),
    clamp01(blendSingle(backdrop[2], source[2], mode)),
  ];
}

export function compositeLayer(
  backdrop: [number, number, number],
  source: [number, number, number],
  mode: CompositeBlendMode,
  opacity: number,
): [number, number, number] {
  const safeOpacity = clamp01(opacity);
  const blended = blendRgb(backdrop, source, mode);
  return [
    clamp01(backdrop[0] * (1 - safeOpacity) + blended[0] * safeOpacity),
    clamp01(backdrop[1] * (1 - safeOpacity) + blended[1] * safeOpacity),
    clamp01(backdrop[2] * (1 - safeOpacity) + blended[2] * safeOpacity),
  ];
}

export function blendScanline(
  outR: Float32Array,
  outG: Float32Array,
  outB: Float32Array,
  srcR: Float32Array,
  srcG: Float32Array,
  srcB: Float32Array,
  mode: CompositeBlendMode,
  opacity: number,
) {
  for (let i = 0; i < outR.length; i++) {
    const result = compositeLayer(
      [outR[i], outG[i], outB[i]],
      [srcR[i], srcG[i], srcB[i]],
      mode,
      opacity,
    );
    outR[i] = result[0];
    outG[i] = result[1];
    outB[i] = result[2];
  }
}
