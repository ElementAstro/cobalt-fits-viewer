/**
 * 天文测量工具函数
 * 提供精确的球面角距离计算和格式化
 */

const DEG2RAD = Math.PI / 180;
const RAD2ARCSEC = 648000 / Math.PI;

/**
 * Vincenty 公式计算两点间的球面角距离
 * 比简化的平面近似更精确，尤其在大角距和极区
 *
 * @param ra1 - 第一点 RA (度)
 * @param dec1 - 第一点 Dec (度)
 * @param ra2 - 第二点 RA (度)
 * @param dec2 - 第二点 Dec (度)
 * @returns 角距离 (角秒)
 */
export function angularSeparationVincenty(
  ra1: number,
  dec1: number,
  ra2: number,
  dec2: number,
): number {
  const d1 = dec1 * DEG2RAD;
  const d2 = dec2 * DEG2RAD;
  const dra = (ra2 - ra1) * DEG2RAD;

  const sinD1 = Math.sin(d1);
  const cosD1 = Math.cos(d1);
  const sinD2 = Math.sin(d2);
  const cosD2 = Math.cos(d2);
  const sinDra = Math.sin(dra);
  const cosDra = Math.cos(dra);

  const num1 = cosD2 * sinDra;
  const num2 = cosD1 * sinD2 - sinD1 * cosD2 * cosDra;
  const numerator = Math.sqrt(num1 * num1 + num2 * num2);
  const denominator = sinD1 * sinD2 + cosD1 * cosD2 * cosDra;

  const angRad = Math.atan2(numerator, denominator);
  return angRad * RAD2ARCSEC;
}

/**
 * 像素距离
 */
export function pixelDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

/**
 * 将角距离 (角秒) 格式化为合适的单位字符串
 * - >= 3600″ → 度
 * - >= 60″ → 角分
 * - < 60″ → 角秒
 */
export function formatAngularDistance(arcsec: number): string {
  if (!Number.isFinite(arcsec) || arcsec < 0) return "—";

  if (arcsec >= 3600) {
    const deg = arcsec / 3600;
    return `${deg.toFixed(2)}°`;
  }
  if (arcsec >= 60) {
    const arcmin = arcsec / 60;
    return `${arcmin.toFixed(1)}′`;
  }
  return `${arcsec.toFixed(1)}″`;
}
