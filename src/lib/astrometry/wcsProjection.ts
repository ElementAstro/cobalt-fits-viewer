/**
 * WCS TAN (gnomonic) 投影工具
 * 提供像素坐标 ↔ 天球坐标 (RA/Dec) 的精确互转
 */

import type { AstrometryCalibration } from "./types";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

/** CD 矩阵及参考像素 */
export interface CDMatrix {
  cd1_1: number;
  cd1_2: number;
  cd2_1: number;
  cd2_2: number;
  crpix1: number;
  crpix2: number;
  crval1: number;
  crval2: number;
}

/** CD 矩阵的逆矩阵 */
export interface CDMatrixInverse {
  cdi1_1: number;
  cdi1_2: number;
  cdi2_1: number;
  cdi2_2: number;
}

/** 天球坐标 */
export interface RaDec {
  ra: number;
  dec: number;
}

/**
 * 从 AstrometryCalibration 计算 CD 矩阵和参考像素
 */
export function computeCDMatrix(calibration: AstrometryCalibration): CDMatrix {
  const pixscaleDeg = calibration.pixscale / 3600;
  const orientationRad = calibration.orientation * DEG2RAD;
  const cosTheta = Math.cos(orientationRad);
  const sinTheta = Math.sin(orientationRad);

  const paritySign = calibration.parity === 1 ? -1 : 1;

  const cd1_1 = -pixscaleDeg * cosTheta * paritySign;
  const cd1_2 = pixscaleDeg * sinTheta * paritySign;
  const cd2_1 = -pixscaleDeg * sinTheta;
  const cd2_2 = -pixscaleDeg * cosTheta;

  const crpix1 =
    calibration.fieldWidth > 0 ? Math.round(calibration.fieldWidth / pixscaleDeg / 2) : 0;
  const crpix2 =
    calibration.fieldHeight > 0 ? Math.round(calibration.fieldHeight / pixscaleDeg / 2) : 0;

  return {
    cd1_1,
    cd1_2,
    cd2_1,
    cd2_2,
    crpix1,
    crpix2,
    crval1: calibration.ra,
    crval2: calibration.dec,
  };
}

/**
 * 计算 CD 矩阵的逆矩阵
 */
export function invertCDMatrix(cd: CDMatrix): CDMatrixInverse {
  const det = cd.cd1_1 * cd.cd2_2 - cd.cd1_2 * cd.cd2_1;
  if (Math.abs(det) < 1e-30) {
    throw new Error("CD matrix is singular (det ≈ 0)");
  }
  return {
    cdi1_1: cd.cd2_2 / det,
    cdi1_2: -cd.cd1_2 / det,
    cdi2_1: -cd.cd2_1 / det,
    cdi2_2: cd.cd1_1 / det,
  };
}

/**
 * 像素坐标 → RA/Dec (TAN gnomonic 反投影)
 *
 * @param x - 像素 X (0-indexed, 对应 FITS NAXIS1)
 * @param y - 像素 Y (0-indexed, 对应 FITS NAXIS2)
 * @param calibration - WCS 标定数据
 * @returns RA/Dec in degrees, 或 null 如果投影无效
 */
export function pixelToRaDec(
  x: number,
  y: number,
  calibration: AstrometryCalibration,
): RaDec | null {
  const cd = computeCDMatrix(calibration);

  // 相对参考像素的偏移 (FITS 像素从 1 开始, 这里 x/y 是 0-indexed)
  const dx = x + 1 - cd.crpix1;
  const dy = y + 1 - cd.crpix2;

  // 中间世界坐标 (度)
  const xi = cd.cd1_1 * dx + cd.cd1_2 * dy;
  const eta = cd.cd2_1 * dx + cd.cd2_2 * dy;

  // 转换为弧度
  const xiRad = xi * DEG2RAD;
  const etaRad = eta * DEG2RAD;

  // 参考点的三角函数
  const ra0Rad = cd.crval1 * DEG2RAD;
  const dec0Rad = cd.crval2 * DEG2RAD;
  const sinDec0 = Math.sin(dec0Rad);
  const cosDec0 = Math.cos(dec0Rad);

  // TAN 反投影: 中间坐标 → 天球坐标
  const denom = cosDec0 - etaRad * sinDec0;
  if (Math.abs(denom) < 1e-15) return null;

  const raRad = ra0Rad + Math.atan2(xiRad, denom);
  const decRad = Math.atan2((sinDec0 + etaRad * cosDec0) * Math.cos(raRad - ra0Rad), denom);

  let raDeg = raRad * RAD2DEG;
  const decDeg = decRad * RAD2DEG;

  // 归一化 RA 到 [0, 360)
  raDeg = ((raDeg % 360) + 360) % 360;

  if (!Number.isFinite(raDeg) || !Number.isFinite(decDeg)) return null;

  return { ra: raDeg, dec: decDeg };
}

/**
 * RA/Dec → 像素坐标 (TAN gnomonic 正投影)
 *
 * @param ra - RA in degrees [0, 360)
 * @param dec - Dec in degrees [-90, 90]
 * @param calibration - WCS 标定数据
 * @returns 像素坐标 (0-indexed), 或 null 如果目标在投影反面
 */
export function raDecToPixel(
  ra: number,
  dec: number,
  calibration: AstrometryCalibration,
): { x: number; y: number } | null {
  const cd = computeCDMatrix(calibration);
  const inv = invertCDMatrix(cd);

  // 参考点和目标点的三角函数
  const ra0Rad = cd.crval1 * DEG2RAD;
  const dec0Rad = cd.crval2 * DEG2RAD;
  const raRad = ra * DEG2RAD;
  const decRad = dec * DEG2RAD;

  const sinDec0 = Math.sin(dec0Rad);
  const cosDec0 = Math.cos(dec0Rad);
  const sinDec = Math.sin(decRad);
  const cosDec = Math.cos(decRad);
  const deltaRa = raRad - ra0Rad;
  const cosDeltaRa = Math.cos(deltaRa);
  const sinDeltaRa = Math.sin(deltaRa);

  // TAN 正投影: 天球坐标 → 中间坐标
  const denom = sinDec * sinDec0 + cosDec * cosDec0 * cosDeltaRa;
  if (denom <= 0) return null; // 目标在投影的反面

  const xiRad = (cosDec * sinDeltaRa) / denom;
  const etaRad = (sinDec * cosDec0 - cosDec * sinDec0 * cosDeltaRa) / denom;

  // 中间坐标 (度)
  const xi = xiRad * RAD2DEG;
  const eta = etaRad * RAD2DEG;

  // 逆 CD 矩阵: 中间坐标 → 像素偏移
  const dx = inv.cdi1_1 * xi + inv.cdi1_2 * eta;
  const dy = inv.cdi2_1 * xi + inv.cdi2_2 * eta;

  // 像素坐标 (0-indexed)
  const px = dx + cd.crpix1 - 1;
  const py = dy + cd.crpix2 - 1;

  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;

  return { x: px, y: py };
}

/**
 * 检查像素坐标是否在图像范围内
 */
export function isInsideImage(
  x: number,
  y: number,
  width: number,
  height: number,
  margin: number = 0,
): boolean {
  return x >= -margin && x < width + margin && y >= -margin && y < height + margin;
}

// Re-export formatRA/formatDec from formatUtils to avoid duplication
// Consumers can import from either module
export { formatRA as formatRaFromDeg, formatDec as formatDecFromDeg } from "./formatUtils";
