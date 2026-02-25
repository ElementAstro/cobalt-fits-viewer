/**
 * Session formatting utilities
 */

/**
 * Format a Date to HH:MM string (e.g. "09:05", "23:59")
 */
export function formatTimeHHMM(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/**
 * Parse a geographic coordinate string with range validation.
 * Returns undefined for empty input, null for invalid input, or the parsed number.
 */
export function parseGeoCoordinate(
  rawValue: string,
  range: { min: number; max: number },
): number | undefined | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return undefined;
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return null;
  if (value < range.min || value > range.max) return null;
  return value;
}

/**
 * Format duration in seconds to human-readable string (e.g. "2h 30m", "45m", "30s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
