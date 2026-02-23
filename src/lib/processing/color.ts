import type { ProcessingParamValue } from "../fits/types";
import type { ProcessingRGBAState } from "./types";
import { asNumber, asString } from "./paramHelpers";

export function clampByte(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 255) return 255;
  return Math.round(value);
}

export type SCNRMethod = "averageNeutral" | "maximumNeutral";

export function applySCNRRGBA(
  rgbaData: Uint8ClampedArray,
  method: SCNRMethod = "averageNeutral",
  amount: number = 1,
): Uint8ClampedArray {
  const strength = Math.max(0, Math.min(1, amount));
  const result = new Uint8ClampedArray(rgbaData);
  const n = Math.floor(rgbaData.length / 4);
  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const r = rgbaData[off];
    const g = rgbaData[off + 1];
    const b = rgbaData[off + 2];
    const neutral = method === "maximumNeutral" ? Math.max(r, b) : (r + b) * 0.5;
    const reduced = Math.min(g, neutral);
    result[off + 1] = clampByte(g * (1 - strength) + reduced * strength);
  }
  return result;
}

function percentile(values: number[], ratio: number): number {
  if (values.length === 0) return 0;
  const idx = Math.max(0, Math.min(values.length - 1, Math.floor((values.length - 1) * ratio)));
  return values[idx];
}

export function applyColorCalibrationRGBA(
  rgbaData: Uint8ClampedArray,
  whiteReferencePercentile: number = 0.92,
): Uint8ClampedArray {
  const p = Math.max(0.5, Math.min(0.99, whiteReferencePercentile));
  const rs: number[] = [];
  const gs: number[] = [];
  const bs: number[] = [];
  for (let i = 0; i < rgbaData.length; i += 4) {
    rs.push(rgbaData[i]);
    gs.push(rgbaData[i + 1]);
    bs.push(rgbaData[i + 2]);
  }
  rs.sort((a, b) => a - b);
  gs.sort((a, b) => a - b);
  bs.sort((a, b) => a - b);

  const rRef = Math.max(1, percentile(rs, p));
  const gRef = Math.max(1, percentile(gs, p));
  const bRef = Math.max(1, percentile(bs, p));
  const target = (rRef + gRef + bRef) / 3;

  const rGain = target / rRef;
  const gGain = target / gRef;
  const bGain = target / bRef;

  return applyColorBalanceRGBA(rgbaData, rGain, gGain, bGain);
}

export function applySaturationRGBA(
  rgbaData: Uint8ClampedArray,
  amount: number,
): Uint8ClampedArray {
  const factor = 1 + amount;
  const result = new Uint8ClampedArray(rgbaData);
  for (let i = 0; i < rgbaData.length; i += 4) {
    const r = rgbaData[i];
    const g = rgbaData[i + 1];
    const b = rgbaData[i + 2];
    const gray = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    result[i] = clampByte(gray + (r - gray) * factor);
    result[i + 1] = clampByte(gray + (g - gray) * factor);
    result[i + 2] = clampByte(gray + (b - gray) * factor);
  }
  return result;
}

export function applyColorBalanceRGBA(
  rgbaData: Uint8ClampedArray,
  redGain: number,
  greenGain: number,
  blueGain: number,
): Uint8ClampedArray {
  const rGain = Math.max(0, Math.min(4, redGain));
  const gGain = Math.max(0, Math.min(4, greenGain));
  const bGain = Math.max(0, Math.min(4, blueGain));
  const result = new Uint8ClampedArray(rgbaData);
  for (let i = 0; i < rgbaData.length; i += 4) {
    result[i] = clampByte(rgbaData[i] * rGain);
    result[i + 1] = clampByte(rgbaData[i + 1] * gGain);
    result[i + 2] = clampByte(rgbaData[i + 2] * bGain);
  }
  return result;
}

// ===== Per-Hue Saturation =====

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  h /= 360;
  if (s === 0) {
    const v = clampByte(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    clampByte(hue2rgb(p, q, h + 1 / 3) * 255),
    clampByte(hue2rgb(p, q, h) * 255),
    clampByte(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

export function applyPerHueSaturationRGBA(
  rgbaData: Uint8ClampedArray,
  hueCurve: Array<{ hue: number; factor: number }>,
  globalAmount: number = 1,
): Uint8ClampedArray {
  if (hueCurve.length === 0) return new Uint8ClampedArray(rgbaData);
  const amount = Math.max(0, Math.min(3, globalAmount));
  const sorted = [...hueCurve].sort((a, b) => a.hue - b.hue);
  const result = new Uint8ClampedArray(rgbaData);
  const n = Math.floor(rgbaData.length / 4);

  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const [h, s, l] = rgbToHsl(rgbaData[off], rgbaData[off + 1], rgbaData[off + 2]);
    // Interpolate factor from hueCurve
    let factor = 1;
    if (sorted.length === 1) {
      factor = sorted[0].factor;
    } else {
      // Find surrounding control points
      let lo = sorted[sorted.length - 1];
      let hi = sorted[0];
      for (let j = 0; j < sorted.length - 1; j++) {
        if (h >= sorted[j].hue && h < sorted[j + 1].hue) {
          lo = sorted[j];
          hi = sorted[j + 1];
          break;
        }
      }
      const range = (hi.hue - lo.hue + 360) % 360 || 360;
      const t = ((h - lo.hue + 360) % 360) / range;
      factor = lo.factor * (1 - t) + hi.factor * t;
    }
    const newS = Math.max(0, Math.min(1, s * factor * amount));
    const [nr, ng, nb] = hslToRgb(h, newS, l);
    result[off] = nr;
    result[off + 1] = ng;
    result[off + 2] = nb;
  }
  return result;
}

// ===== Selective Color Correction =====

export function applySelectiveColorRGBA(
  rgbaData: Uint8ClampedArray,
  targetHue: number,
  hueRange: number = 60,
  hueShift: number = 0,
  satShift: number = 0,
  lumShift: number = 0,
  feather: number = 0.3,
): Uint8ClampedArray {
  const result = new Uint8ClampedArray(rgbaData);
  const n = Math.floor(rgbaData.length / 4);
  const halfRange = Math.max(5, hueRange) / 2;
  const featherZone = Math.max(0.01, feather) * halfRange;

  for (let i = 0; i < n; i++) {
    const off = i * 4;
    const [h, s, l] = rgbToHsl(rgbaData[off], rgbaData[off + 1], rgbaData[off + 2]);

    // Calculate hue distance (circular)
    let hueDist = Math.abs(h - targetHue);
    if (hueDist > 180) hueDist = 360 - hueDist;

    if (hueDist > halfRange + featherZone) continue;

    // Calculate blend weight with feathering
    let weight = 1;
    if (hueDist > halfRange) {
      weight = 1 - (hueDist - halfRange) / featherZone;
    }
    weight = Math.max(0, Math.min(1, weight));
    if (weight === 0) continue;

    const newH = h + hueShift * weight;
    const newS = Math.max(0, Math.min(1, s + satShift * weight));
    const newL = Math.max(0, Math.min(1, l + lumShift * weight));

    const [nr, ng, nb] = hslToRgb(newH, newS, newL);
    result[off] = nr;
    result[off + 1] = ng;
    result[off + 2] = nb;
  }
  return result;
}

export type ColorImageOperationId =
  | "scnr"
  | "colorCalibration"
  | "saturation"
  | "colorBalance"
  | "backgroundNeutralize"
  | "photometricCC"
  | "perHueSaturation"
  | "selectiveColor";

export function applyColorOperation(
  input: ProcessingRGBAState,
  operationId: ColorImageOperationId,
  params: Record<string, ProcessingParamValue>,
): ProcessingRGBAState {
  switch (operationId) {
    case "scnr":
      return {
        ...input,
        rgbaData: applySCNRRGBA(
          input.rgbaData,
          asString(params, "method", "averageNeutral") === "maximumNeutral"
            ? "maximumNeutral"
            : "averageNeutral",
          asNumber(params, "amount", 1),
        ),
      };
    case "colorCalibration":
      return {
        ...input,
        rgbaData: applyColorCalibrationRGBA(input.rgbaData, asNumber(params, "percentile", 0.92)),
      };
    case "saturation":
      return {
        ...input,
        rgbaData: applySaturationRGBA(input.rgbaData, asNumber(params, "amount", 0)),
      };
    case "colorBalance":
      return {
        ...input,
        rgbaData: applyColorBalanceRGBA(
          input.rgbaData,
          asNumber(params, "redGain", 1),
          asNumber(params, "greenGain", 1),
          asNumber(params, "blueGain", 1),
        ),
      };
    case "backgroundNeutralize": {
      const { backgroundNeutralizeRGBA } = require("./backgroundNeutralization");
      return {
        ...input,
        rgbaData: backgroundNeutralizeRGBA(input.rgbaData, input.width, input.height, {
          upperLimit: asNumber(params, "upperLimit", 0.2),
          shadowsClip: asNumber(params, "shadowsClip", 0.01),
        }),
      };
    }
    case "photometricCC": {
      const { photometricColorCalibrate } = require("./photometricCC");
      return {
        ...input,
        rgbaData: photometricColorCalibrate(
          input.rgbaData,
          input.width,
          input.height,
          new Float32Array(0),
          {
            minStars: asNumber(params, "minStars", 20),
            percentileLow: asNumber(params, "percentileLow", 0.25),
            percentileHigh: asNumber(params, "percentileHigh", 0.75),
          },
        ),
      };
    }
    case "perHueSaturation":
      return {
        ...input,
        rgbaData: applyPerHueSaturationRGBA(
          input.rgbaData,
          (params.hueCurve as unknown as Array<{ hue: number; factor: number }>) ?? [],
          asNumber(params, "amount", 1),
        ),
      };
    case "selectiveColor":
      return {
        ...input,
        rgbaData: applySelectiveColorRGBA(
          input.rgbaData,
          asNumber(params, "targetHue", 120),
          asNumber(params, "hueRange", 60),
          asNumber(params, "hueShift", 0),
          asNumber(params, "satShift", 0),
          asNumber(params, "lumShift", 0),
          asNumber(params, "feather", 0.3),
        ),
      };
  }
}
