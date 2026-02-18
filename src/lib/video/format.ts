export function formatVideoDuration(durationMs: number | null | undefined): string {
  if (!durationMs || durationMs <= 0) return "00:00";
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatVideoResolution(
  width: number | null | undefined,
  height: number | null | undefined,
): string {
  if (!width || !height) return "";
  return `${Math.round(width)}×${Math.round(height)}`;
}
