/**
 * 天文坐标工具函数
 * RA/Dec 格式化与转换
 */

/**
 * 将十进制度数的 RA 转换为 HH:MM:SS 格式
 * RA 范围: 0-360 度 → 0-24 小时
 */
export function formatRA(raDeg: number): string {
  const totalHours = (((raDeg % 360) + 360) % 360) / 15;
  const hours = Math.floor(totalHours);
  const totalMinutes = (totalHours - hours) * 60;
  const minutes = Math.floor(totalMinutes);
  const seconds = (totalMinutes - minutes) * 60;

  return `${pad(hours)}h ${pad(minutes)}m ${pad(Math.round(seconds))}s`;
}

/**
 * 将十进制度数的 Dec 转换为 DD°MM′SS″ 格式
 * Dec 范围: -90 到 +90 度
 */
export function formatDec(decDeg: number): string {
  const sign = decDeg >= 0 ? "+" : "-";
  const abs = Math.abs(decDeg);
  const degrees = Math.floor(abs);
  const totalMinutes = (abs - degrees) * 60;
  const minutes = Math.floor(totalMinutes);
  const seconds = (totalMinutes - minutes) * 60;

  return `${sign}${pad(degrees)}° ${pad(minutes)}′ ${pad(Math.round(seconds))}″`;
}

/**
 * 将 RA (HH:MM:SS 或 HHhMMmSSs) 解析为十进制度数
 */
export function parseRA(raStr: string): number | null {
  const cleaned = raStr
    .trim()
    .replace(/[hHmMsS°′″:]/g, " ")
    .trim();
  const parts = cleaned.split(/\s+/).map(Number);

  if (parts.length >= 1 && parts.length <= 3 && parts.every((p) => !isNaN(p))) {
    const hours = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const seconds = parts[2] ?? 0;
    const deg = (hours + minutes / 60 + seconds / 3600) * 15;
    return deg >= 0 && deg < 360 ? deg : null;
  }

  const num = parseFloat(raStr);
  return !isNaN(num) && num >= 0 && num < 360 ? num : null;
}

/**
 * 将 Dec (DD:MM:SS 或 DD°MM′SS″) 解析为十进制度数
 */
export function parseDec(decStr: string): number | null {
  const cleaned = decStr.trim();
  const signMatch = cleaned.match(/^([+-]?)/);
  const sign = signMatch?.[1] === "-" ? -1 : 1;
  const rest = cleaned
    .replace(/^[+-]/, "")
    .replace(/[°′″:dmsDMS]/g, " ")
    .trim();
  const parts = rest.split(/\s+/).map(Number);

  if (parts.length >= 1 && parts.length <= 3 && parts.every((p) => !isNaN(p))) {
    const degrees = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const seconds = parts[2] ?? 0;
    const dec = sign * (degrees + minutes / 60 + seconds / 3600);
    return dec >= -90 && dec <= 90 ? dec : null;
  }

  const num = parseFloat(decStr);
  return !isNaN(num) && num >= -90 && num <= 90 ? num : null;
}

/**
 * 格式化坐标为简短的显示字符串
 */
export function formatCoordinates(ra?: number, dec?: number): string | null {
  if (ra === undefined && dec === undefined) return null;
  const raPart = ra !== undefined ? formatRA(ra) : "—";
  const decPart = dec !== undefined ? formatDec(dec) : "—";
  return `${raPart}  ${decPart}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
