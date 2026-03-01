/**
 * Shared formatting utilities for FITS viewer components.
 */

/**
 * Format edge label based on data range for optimal readability.
 */
export function formatEdgeLabel(value: number | undefined, range: number): string {
  if (value == null || !isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (range > 100) return value.toFixed(0);
  if (range > 1) return value.toFixed(1);
  if (range > 0.01) return value.toFixed(3);
  if (abs > 0 && abs < 0.001) return value.toExponential(2);
  return value.toFixed(4);
}

/**
 * Format a numeric stat value for display, handling null/non-finite gracefully.
 */
export function formatStatValue(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-3)) return value.toExponential(2);
  if (abs >= 100) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(3);
  return value.toFixed(5);
}

/**
 * Format a clip percentage value for display.
 */
export function formatClipPercent(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.00%";
  return `${value.toFixed(value >= 10 ? 1 : 2)}%`;
}
