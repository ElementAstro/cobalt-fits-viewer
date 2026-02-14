/**
 * Session formatting utilities
 */

/**
 * Format duration in seconds to human-readable string (e.g. "2h 30m", "45m", "30s")
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
