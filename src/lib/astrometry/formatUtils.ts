/**
 * Astrometry 坐标格式化工具函数
 */

/**
 * 将 RA (度) 格式化为时角字符串 e.g. "5h 34m 12.3s"
 */
export function formatRA(deg: number): string {
  const h = deg / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${hh}h ${mm}m ${ss.toFixed(1)}s`;
}

/**
 * 将 DEC (度) 格式化为度分秒字符串 e.g. "+45° 12′ 30.0″"
 */
export function formatDec(deg: number): string {
  const sign = deg >= 0 ? "+" : "-";
  const abs = Math.abs(deg);
  const dd = Math.floor(abs);
  const mm = Math.floor((abs - dd) * 60);
  const ss = ((abs - dd) * 60 - mm) * 60;
  return `${sign}${dd}° ${mm}′ ${ss.toFixed(1)}″`;
}

/**
 * 将视场大小 (度) 格式化为合适的单位
 */
export function formatFieldSize(deg: number): string {
  if (deg >= 1) return `${deg.toFixed(2)}°`;
  const arcmin = deg * 60;
  if (arcmin >= 1) return `${arcmin.toFixed(1)}′`;
  return `${(deg * 3600).toFixed(0)}″`;
}

/**
 * 格式化持续时间 (毫秒) 为可读字符串
 */
export function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  if (min < 60) return `${min}m ${remSec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}
