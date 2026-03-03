/**
 * WCS Header 解析器
 * 从 FITS header keywords 中提取 WCS 标定信息
 * 支持三种标准 WCS 表示法: CD 矩阵 / CDELT+CROTA / PC 矩阵
 */

import type { AstrometryCalibration, SIPCoefficients } from "./types";
import type { HeaderKeyword } from "../fits/types";

const DEG2RAD = Math.PI / 180;
const RAD2DEG = 180 / Math.PI;

interface HeaderMap {
  get(key: string): number | string | undefined;
}

function buildHeaderMap(keywords: HeaderKeyword[]): HeaderMap {
  const map = new Map<string, number | string>();
  for (const kw of keywords) {
    if (kw.key && kw.value != null) {
      map.set(kw.key.toUpperCase().trim(), kw.value as number | string);
    }
  }
  return {
    get(key: string) {
      return map.get(key.toUpperCase());
    },
  };
}

function getNum(hdr: HeaderMap, key: string): number | undefined {
  const v = hdr.get(key);
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

function getStr(hdr: HeaderMap, key: string): string | undefined {
  const v = hdr.get(key);
  if (typeof v === "string") return v.trim();
  return undefined;
}

/** 检查 CTYPE 是否为受支持的 TAN 投影 (含 -SIP 后缀) */
function isTanProjection(ctype: string | undefined): boolean {
  if (!ctype) return false;
  const upper = ctype.toUpperCase().replace(/'/g, "").trim();
  return upper.includes("TAN");
}

/** 检测 CTYPE 是否包含 SIP 后缀 */
export function hasSIPSuffix(ctype: string | undefined): boolean {
  if (!ctype) return false;
  return ctype.toUpperCase().replace(/'/g, "").trim().includes("-SIP");
}

interface CDMatrixRaw {
  cd1_1: number;
  cd1_2: number;
  cd2_1: number;
  cd2_2: number;
}

/**
 * 尝试从 header 中提取 CD 矩阵
 * 优先级: CD 矩阵 > PC 矩阵 + CDELT > CDELT + CROTA
 */
function extractCDMatrix(hdr: HeaderMap): CDMatrixRaw | null {
  // 方式 1: 直接 CD 矩阵
  const cd1_1 = getNum(hdr, "CD1_1");
  const cd1_2 = getNum(hdr, "CD1_2");
  const cd2_1 = getNum(hdr, "CD2_1");
  const cd2_2 = getNum(hdr, "CD2_2");
  if (cd1_1 !== undefined && cd2_2 !== undefined) {
    return {
      cd1_1,
      cd1_2: cd1_2 ?? 0,
      cd2_1: cd2_1 ?? 0,
      cd2_2,
    };
  }

  const cdelt1 = getNum(hdr, "CDELT1");
  const cdelt2 = getNum(hdr, "CDELT2");

  // 方式 2: PC 矩阵 + CDELT
  const pc1_1 = getNum(hdr, "PC1_1");
  const pc2_2 = getNum(hdr, "PC2_2");
  if (pc1_1 !== undefined && pc2_2 !== undefined && cdelt1 !== undefined && cdelt2 !== undefined) {
    const pc1_2 = getNum(hdr, "PC1_2") ?? 0;
    const pc2_1 = getNum(hdr, "PC2_1") ?? 0;
    return {
      cd1_1: pc1_1 * cdelt1,
      cd1_2: pc1_2 * cdelt1,
      cd2_1: pc2_1 * cdelt2,
      cd2_2: pc2_2 * cdelt2,
    };
  }

  // 方式 3: CDELT + CROTA2
  if (cdelt1 !== undefined && cdelt2 !== undefined) {
    const crota2 = getNum(hdr, "CROTA2") ?? 0;
    const cosTheta = Math.cos(crota2 * DEG2RAD);
    const sinTheta = Math.sin(crota2 * DEG2RAD);
    return {
      cd1_1: cdelt1 * cosTheta,
      cd1_2: -cdelt2 * sinTheta,
      cd2_1: cdelt1 * sinTheta,
      cd2_2: cdelt2 * cosTheta,
    };
  }

  return null;
}

/**
 * 从 CD 矩阵反算 AstrometryCalibration 的高层参数
 */
function calibrationFromCD(
  cd: CDMatrixRaw,
  crval1: number,
  crval2: number,
  crpix1: number,
  crpix2: number,
  naxis1?: number,
  naxis2?: number,
): AstrometryCalibration {
  // 像素尺度 (角秒/像素)
  const scaleX = Math.sqrt(cd.cd1_1 * cd.cd1_1 + cd.cd2_1 * cd.cd2_1);
  const scaleY = Math.sqrt(cd.cd1_2 * cd.cd1_2 + cd.cd2_2 * cd.cd2_2);
  const pixscale = ((scaleX + scaleY) / 2) * 3600; // 度 → 角秒

  // 旋转角 (度)
  const orientation = Math.atan2(-cd.cd1_2, cd.cd2_2) * RAD2DEG;

  // 奇偶性: det(CD) < 0 → parity=0 (normal), det(CD) > 0 → parity=1 (flipped)
  const det = cd.cd1_1 * cd.cd2_2 - cd.cd1_2 * cd.cd2_1;
  const parity = det > 0 ? 1 : 0;

  // 视场大小
  const w = naxis1 ?? Math.round(crpix1 * 2);
  const h = naxis2 ?? Math.round(crpix2 * 2);
  const fieldWidth = w * scaleX;
  const fieldHeight = h * scaleY;

  // 视场半径
  const radius = Math.sqrt(fieldWidth * fieldWidth + fieldHeight * fieldHeight) / 2;

  return {
    ra: crval1,
    dec: crval2,
    radius,
    pixscale,
    orientation: ((orientation % 360) + 360) % 360,
    parity,
    fieldWidth,
    fieldHeight,
  };
}

/**
 * 从 FITS header keywords 解析 WCS 标定信息
 *
 * @returns AstrometryCalibration 或 null（如果 header 中没有有效的 WCS 信息）
 */
export function parseWCSFromHeaders(keywords: HeaderKeyword[]): AstrometryCalibration | null {
  if (!keywords || keywords.length === 0) return null;

  const hdr = buildHeaderMap(keywords);

  // 验证 CTYPE（如果存在）
  const ctype1 = getStr(hdr, "CTYPE1");
  const ctype2 = getStr(hdr, "CTYPE2");
  if (ctype1 && !isTanProjection(ctype1)) return null;
  if (ctype2 && !isTanProjection(ctype2)) return null;

  // 必需: 参考像素值
  const crval1 = getNum(hdr, "CRVAL1");
  const crval2 = getNum(hdr, "CRVAL2");
  if (crval1 === undefined || crval2 === undefined) return null;

  // 必需: 参考像素坐标
  const crpix1 = getNum(hdr, "CRPIX1");
  const crpix2 = getNum(hdr, "CRPIX2");
  if (crpix1 === undefined || crpix2 === undefined) return null;

  // 提取 CD 矩阵（三种方式之一）
  const cd = extractCDMatrix(hdr);
  if (!cd) return null;

  // 图像尺寸（用于计算视场）
  const naxis1 = getNum(hdr, "NAXIS1");
  const naxis2 = getNum(hdr, "NAXIS2");

  const cal = calibrationFromCD(cd, crval1, crval2, crpix1, crpix2, naxis1, naxis2);

  // Attempt to parse SIP distortion coefficients
  const sip = parseSIPCoefficients(hdr, ctype1, ctype2);
  if (sip) {
    cal.sip = sip;
  }

  return cal;
}

/**
 * 解析 SIP 多项式系数矩阵
 */
function parseSIPPolynomial(hdr: HeaderMap, prefix: string, order: number): number[][] {
  const matrix: number[][] = [];
  for (let i = 0; i <= order; i++) {
    matrix[i] = [];
    for (let j = 0; j <= order; j++) {
      matrix[i][j] = getNum(hdr, `${prefix}_${i}_${j}`) ?? 0;
    }
  }
  return matrix;
}

/**
 * 从 FITS header 解析 SIP 畸变校正系数
 * SIP 系数的存在由 A_ORDER 关键字或 CTYPE 中的 -SIP 后缀指示
 */
function parseSIPCoefficients(
  hdr: HeaderMap,
  _ctype1: string | undefined,
  _ctype2: string | undefined,
): SIPCoefficients | null {
  const aOrder = getNum(hdr, "A_ORDER");
  const bOrder = getNum(hdr, "B_ORDER");

  // SIP requires at least A_ORDER and B_ORDER
  if (aOrder === undefined || bOrder === undefined) {
    // If CTYPE has -SIP suffix but no coefficients, skip
    return null;
  }

  if (aOrder < 0 || bOrder < 0 || aOrder > 9 || bOrder > 9) return null;

  const a = parseSIPPolynomial(hdr, "A", aOrder);
  const b = parseSIPPolynomial(hdr, "B", bOrder);

  const result: SIPCoefficients = { aOrder, bOrder, a, b };

  // Inverse coefficients (optional but useful for sky→pixel)
  const apOrder = getNum(hdr, "AP_ORDER");
  const bpOrder = getNum(hdr, "BP_ORDER");
  if (apOrder !== undefined && bpOrder !== undefined && apOrder >= 0 && bpOrder >= 0) {
    result.apOrder = apOrder;
    result.bpOrder = bpOrder;
    result.ap = parseSIPPolynomial(hdr, "AP", Math.min(apOrder, 9));
    result.bp = parseSIPPolynomial(hdr, "BP", Math.min(bpOrder, 9));
  }

  return result;
}
