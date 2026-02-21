import type { ProcessingParamValue } from "../fits/types";

export function asNumber(
  params: Record<string, ProcessingParamValue>,
  key: string,
  fallback: number,
) {
  const value = params[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function asBoolean(
  params: Record<string, ProcessingParamValue>,
  key: string,
  fallback: boolean,
) {
  const value = params[key];
  return typeof value === "boolean" ? value : fallback;
}

export function asString(
  params: Record<string, ProcessingParamValue>,
  key: string,
  fallback: string,
) {
  const value = params[key];
  return typeof value === "string" ? value : fallback;
}

export function asPointList(
  params: Record<string, ProcessingParamValue>,
  key: string,
  fallback: Array<{ x: number; y: number }>,
) {
  const value = params[key];
  if (!Array.isArray(value)) return fallback;
  const points = value.filter(
    (item): item is { x: number; y: number } =>
      typeof item === "object" &&
      item !== null &&
      "x" in item &&
      "y" in item &&
      typeof item.x === "number" &&
      typeof item.y === "number",
  );
  return points.length >= 2 ? points : fallback;
}
