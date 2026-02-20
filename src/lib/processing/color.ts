import type { ProcessingParamValue } from "../fits/types";
import type { ProcessingRGBAState } from "./types";

function clampByte(value: number) {
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

function asNumber(params: Record<string, ProcessingParamValue>, key: string, fallback: number) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asString(params: Record<string, ProcessingParamValue>, key: string, fallback: string) {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

export type ColorImageOperationId = "scnr" | "colorCalibration" | "saturation" | "colorBalance";

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
  }
}
