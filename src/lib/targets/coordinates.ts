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
  const raw = raStr.trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[hHmMsS°′″:]/g, " ").trim();
  const parts = cleaned.length > 0 ? cleaned.split(/\s+/).map(Number) : [];
  const hasHourMarkers = /[hHmMsS:]/.test(raw);
  const hasDegreeMarkers = /[°dD]/.test(raw);

  if (parts.length >= 1 && parts.length <= 3 && parts.every((p) => Number.isFinite(p))) {
    const first = parts[0] ?? 0;
    const minutes = parts[1] ?? 0;
    const seconds = parts[2] ?? 0;

    const shouldTreatAsHourAngle =
      hasHourMarkers || parts.length > 1 || (!hasDegreeMarkers && first >= 0 && first <= 24);

    if (shouldTreatAsHourAngle) {
      if (minutes < 0 || minutes >= 60 || seconds < 0 || seconds >= 60 || first < 0) {
        return null;
      }
      const deg = (first + minutes / 60 + seconds / 3600) * 15;
      if (deg >= 0 && deg < 360) return deg;
      if (parts.length === 1 && !hasHourMarkers && first >= 0 && first < 360) return first;
      return null;
    }

    if (parts.length === 1) {
      return first >= 0 && first < 360 ? first : null;
    }
  }

  const num = parseFloat(raw);
  return Number.isFinite(num) && num >= 0 && num < 360 ? num : null;
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

function buildCoordinatePair(raRaw: string, decRaw: string): { ra: number; dec: number } | null {
  const ra = parseRA(raRaw.trim());
  const dec = parseDec(decRaw.trim());
  if (ra === null || dec === null) return null;
  return { ra, dec };
}

/**
 * 解析“RA + Dec”组合输入
 * 例如:
 * - "05:34:31 +22:00:52"
 * - "05h34m31s, +22°00′52″"
 * - "83.633, 22.014"
 * - "RA=05:34:31 Dec=+22:00:52"
 */
export function parseCoordinatePair(input: string): { ra: number; dec: number } | null {
  const raw = input.trim();
  if (!raw) return null;

  const labelled = raw.match(/ra\s*[:=]?\s*(.+?)\s+dec\s*[:=]?\s*(.+)$/i);
  if (labelled) {
    return buildCoordinatePair(labelled[1], labelled[2]);
  }

  const byDelimiter = raw.split(/\s*[,;/|]\s*/).filter(Boolean);
  if (byDelimiter.length === 2) {
    return buildCoordinatePair(byDelimiter[0], byDelimiter[1]);
  }

  const normalized = raw.replace(/\s+/g, " ").trim();
  const bySignedDec = normalized.match(/^(.+?)\s+([+-].+)$/);
  if (bySignedDec) {
    return buildCoordinatePair(bySignedDec[1], bySignedDec[2]);
  }

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 2) {
    return buildCoordinatePair(tokens[0], tokens[1]);
  }

  return null;
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
