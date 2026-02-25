/**
 * Appends a hex alpha suffix to a hex color string.
 *
 * @param hex - A 7-char (#RRGGBB) or 9-char (#RRGGBBAA) hex color string.
 * @param alpha - Alpha value between 0 and 1.
 * @returns The hex color with the new alpha appended.
 */
export function hexWithAlpha(hex: string, alpha: number): string {
  const alphaHex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");
  const base = hex.length === 9 ? hex.slice(0, 7) : hex;
  return base + alphaHex;
}
