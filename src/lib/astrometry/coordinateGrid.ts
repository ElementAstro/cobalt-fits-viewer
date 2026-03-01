/**
 * RA/Dec 坐标网格计算
 * 根据 WCS 标定数据生成天球坐标网格线的像素路径
 */

import type { AstrometryCalibration } from "./types";
import {
  computeProjectionContext,
  pixelToRaDecWithContext,
  raDecToPixelWithContext,
} from "./wcsProjection";

/** 网格线上的一个采样点 */
export interface GridPoint {
  x: number;
  y: number;
}

/** 一条网格线 */
export interface GridLine {
  points: GridPoint[];
  label: string;
  labelPos: GridPoint | null;
  isRA: boolean;
}

/** 网格间距级别 (角秒) */
const SPACING_LEVELS = [
  36000, // 10°
  18000, // 5°
  7200, // 2°
  3600, // 1°
  1800, // 30'
  600, // 10'
  300, // 5'
  60, // 1'
  30, // 30"
  10, // 10"
];

/**
 * 根据视场大小自动选择合适的网格间距 (角秒)
 * 目标: 在视场内显示 3-8 条网格线
 */
export function computeGridSpacing(fieldWidthDeg: number): number {
  const fieldArcsec = fieldWidthDeg * 3600;
  for (const spacing of SPACING_LEVELS) {
    const numLines = fieldArcsec / spacing;
    if (numLines >= 3 && numLines <= 10) return spacing;
  }
  // Fallback: 如果视场太小或太大
  if (fieldWidthDeg > 30) return 36000;
  return 10;
}

/**
 * 格式化角秒为可读标签
 */
function formatSpacingLabel(arcsec: number, value: number, isRA: boolean): string {
  if (isRA) {
    // RA: 转为时角
    const hours = value / 15;
    if (arcsec >= 3600) {
      return `${hours.toFixed(0)}h`;
    }
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h${m}m`;
  } else {
    // Dec: 度分秒
    const sign = value >= 0 ? "+" : "-";
    const abs = Math.abs(value);
    if (arcsec >= 3600) {
      return `${sign}${abs.toFixed(0)}°`;
    }
    const deg = Math.floor(abs);
    const arcmin = Math.round((abs - deg) * 60);
    return `${sign}${deg}°${arcmin}'`;
  }
}

/**
 * 生成 RA/Dec 坐标网格线
 *
 * @param calibration - WCS 标定数据
 * @param imageWidth - 图像宽度 (像素)
 * @param imageHeight - 图像高度 (像素)
 * @param spacingOverride - 可选：强制网格间距 (角秒)
 * @returns 网格线数组
 */
export function generateGridLines(
  calibration: AstrometryCalibration,
  imageWidth: number,
  imageHeight: number,
  spacingOverride?: number,
): GridLine[] {
  const spacing = spacingOverride ?? computeGridSpacing(calibration.fieldWidth);
  const spacingDeg = spacing / 3600;
  const lines: GridLine[] = [];
  const samples = 40; // 每条线的采样点数
  const margin = spacingDeg * 2;

  const ctx = computeProjectionContext(calibration);

  // 获取图像四角的 RA/Dec 范围
  const corners = [
    pixelToRaDecWithContext(0, 0, ctx),
    pixelToRaDecWithContext(imageWidth - 1, 0, ctx),
    pixelToRaDecWithContext(0, imageHeight - 1, ctx),
    pixelToRaDecWithContext(imageWidth - 1, imageHeight - 1, ctx),
    pixelToRaDecWithContext(imageWidth / 2, 0, ctx),
    pixelToRaDecWithContext(imageWidth / 2, imageHeight - 1, ctx),
    pixelToRaDecWithContext(0, imageHeight / 2, ctx),
    pixelToRaDecWithContext(imageWidth - 1, imageHeight / 2, ctx),
  ].filter(Boolean) as Array<{ ra: number; dec: number }>;

  if (corners.length < 4) return lines;

  // Dec 范围
  const decMin = Math.min(...corners.map((c) => c.dec)) - margin;
  const decMax = Math.max(...corners.map((c) => c.dec)) + margin;

  // RA 范围 — 需要处理 0°/360° 跨越
  let raValues = corners.map((c) => c.ra);
  const raSpread = Math.max(...raValues) - Math.min(...raValues);
  // 如果 RA 跨越 0°/360° 边界
  if (raSpread > 180) {
    raValues = raValues.map((r) => (r > 180 ? r - 360 : r));
  }
  const raMin = Math.min(...raValues) - margin;
  const raMax = Math.max(...raValues) + margin;

  // Dec 网格线 (水平方向, 等 Dec 线)
  const decStart = Math.ceil(decMin / spacingDeg) * spacingDeg;
  for (let dec = decStart; dec <= decMax; dec += spacingDeg) {
    if (dec < -90 || dec > 90) continue;
    const points: GridPoint[] = [];
    let labelPos: GridPoint | null = null;

    for (let i = 0; i <= samples; i++) {
      const ra = raMin + ((raMax - raMin) * i) / samples;
      const normalRA = ((ra % 360) + 360) % 360;
      const px = raDecToPixelWithContext(normalRA, dec, ctx);
      if (
        px &&
        px.x >= -imageWidth * 0.5 &&
        px.x < imageWidth * 1.5 &&
        px.y >= -imageHeight * 0.5 &&
        px.y < imageHeight * 1.5
      ) {
        points.push({ x: px.x, y: px.y });
        // 标签放在最左侧可见点
        if (!labelPos && px.x >= 0 && px.x < imageWidth && px.y >= 0 && px.y < imageHeight) {
          labelPos = { x: px.x, y: px.y };
        }
      }
    }

    if (points.length >= 2) {
      lines.push({
        points,
        label: formatSpacingLabel(spacing, dec, false),
        labelPos,
        isRA: false,
      });
    }
  }

  // RA 网格线 (垂直方向, 等 RA 线)
  const raStart = Math.ceil(raMin / spacingDeg) * spacingDeg;
  for (let ra = raStart; ra <= raMax; ra += spacingDeg) {
    const normalRA = ((ra % 360) + 360) % 360;
    const points: GridPoint[] = [];
    let labelPos: GridPoint | null = null;

    for (let i = 0; i <= samples; i++) {
      const dec = decMin + ((decMax - decMin) * i) / samples;
      if (dec < -90 || dec > 90) continue;
      const px = raDecToPixelWithContext(normalRA, dec, ctx);
      if (
        px &&
        px.x >= -imageWidth * 0.5 &&
        px.x < imageWidth * 1.5 &&
        px.y >= -imageHeight * 0.5 &&
        px.y < imageHeight * 1.5
      ) {
        points.push({ x: px.x, y: px.y });
        // 标签放在最上方可见点
        if (!labelPos && px.x >= 0 && px.x < imageWidth && px.y >= 0 && px.y < imageHeight) {
          labelPos = { x: px.x, y: px.y };
        }
      }
    }

    if (points.length >= 2) {
      lines.push({
        points,
        label: formatSpacingLabel(spacing, normalRA, true),
        labelPos,
        isRA: true,
      });
    }
  }

  return lines;
}
