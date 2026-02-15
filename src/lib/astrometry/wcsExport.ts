/**
 * WCS 数据导出工具
 * 将 Astrometry.net 标定结果转换为 FITS WCS header keywords
 * 并支持导出为文本格式
 */

import { Paths, File as FSFile } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Logger } from "../logger/logger";
import { writeHeaderKeywords } from "../fits/headerWriter";
import type { AstrometryCalibration, AstrometryResult } from "./types";

const TAG = "WCSExport";

export interface WCSKeyword {
  key: string;
  value: string | number;
  comment: string;
}

/**
 * 从标定数据生成 WCS header keywords
 */
export function generateWCSKeywords(calibration: AstrometryCalibration): WCSKeyword[] {
  const pixscaleDeg = calibration.pixscale / 3600;
  const orientationRad = (calibration.orientation * Math.PI) / 180;
  const cosTheta = Math.cos(orientationRad);
  const sinTheta = Math.sin(orientationRad);

  // CD matrix (考虑 parity)
  const paritySign = calibration.parity === 1 ? -1 : 1;
  const cd1_1 = -pixscaleDeg * cosTheta * paritySign;
  const cd1_2 = pixscaleDeg * sinTheta * paritySign;
  const cd2_1 = -pixscaleDeg * sinTheta;
  const cd2_2 = -pixscaleDeg * cosTheta;

  const keywords: WCSKeyword[] = [
    { key: "WCSAXES", value: 2, comment: "Number of WCS axes" },
    { key: "CTYPE1", value: "RA---TAN", comment: "Gnomonic projection" },
    { key: "CTYPE2", value: "DEC--TAN", comment: "Gnomonic projection" },
    {
      key: "CRVAL1",
      value: Number(calibration.ra.toFixed(8)),
      comment: "[deg] RA at reference pixel",
    },
    {
      key: "CRVAL2",
      value: Number(calibration.dec.toFixed(8)),
      comment: "[deg] DEC at reference pixel",
    },
    {
      key: "CRPIX1",
      value: calibration.fieldWidth > 0 ? Math.round(calibration.fieldWidth / pixscaleDeg / 2) : 0,
      comment: "Reference pixel X",
    },
    {
      key: "CRPIX2",
      value:
        calibration.fieldHeight > 0 ? Math.round(calibration.fieldHeight / pixscaleDeg / 2) : 0,
      comment: "Reference pixel Y",
    },
    { key: "CD1_1", value: Number(cd1_1.toFixed(12)), comment: "WCS transformation matrix" },
    { key: "CD1_2", value: Number(cd1_2.toFixed(12)), comment: "WCS transformation matrix" },
    { key: "CD2_1", value: Number(cd2_1.toFixed(12)), comment: "WCS transformation matrix" },
    { key: "CD2_2", value: Number(cd2_2.toFixed(12)), comment: "WCS transformation matrix" },
    {
      key: "CDELT1",
      value: Number((-pixscaleDeg * paritySign).toFixed(12)),
      comment: "[deg/pix] Pixel scale RA",
    },
    {
      key: "CDELT2",
      value: Number((-pixscaleDeg).toFixed(12)),
      comment: "[deg/pix] Pixel scale DEC",
    },
    {
      key: "CROTA2",
      value: Number(calibration.orientation.toFixed(6)),
      comment: "[deg] Rotation angle",
    },
    { key: "EQUINOX", value: 2000.0, comment: "Equinox of coordinates" },
    { key: "ASTRSOLV", value: "Astrometry.net", comment: "Plate solve source" },
    {
      key: "ASTPSCAL",
      value: Number(calibration.pixscale.toFixed(4)),
      comment: "[arcsec/pix] Pixel scale",
    },
  ];

  if (calibration.radius != null) {
    keywords.push({
      key: "ASTRAD",
      value: Number(calibration.radius.toFixed(6)),
      comment: "[deg] Field radius",
    });
  }

  return keywords;
}

/**
 * 将 WCS keywords 格式化为 FITS header 文本
 */
export function formatWCSAsText(keywords: WCSKeyword[]): string {
  return keywords
    .map((kw) => {
      const key = kw.key.padEnd(8);
      const val =
        typeof kw.value === "string" ? `'${kw.value}'`.padEnd(20) : String(kw.value).padStart(20);
      return `${key}= ${val} / ${kw.comment}`;
    })
    .join("\n");
}

/**
 * 导出 WCS 数据为文本文件并分享
 */
export async function exportWCSToFile(
  result: AstrometryResult,
  fileName: string,
): Promise<string | null> {
  try {
    const keywords = generateWCSKeywords(result.calibration);
    const text = [
      `# WCS Plate Solution for: ${fileName}`,
      `# Solved by Astrometry.net`,
      `# Generated: ${new Date().toISOString()}`,
      `#`,
      `# Center: RA=${result.calibration.ra.toFixed(6)}° DEC=${result.calibration.dec.toFixed(6)}°`,
      `# Field: ${result.calibration.fieldWidth.toFixed(4)}° × ${result.calibration.fieldHeight.toFixed(4)}°`,
      `# Pixel scale: ${result.calibration.pixscale.toFixed(4)} arcsec/pixel`,
      `# Orientation: ${result.calibration.orientation.toFixed(4)}°`,
      `#`,
      `# FITS Header Keywords:`,
      ``,
      formatWCSAsText(keywords),
      ``,
      `# Detected objects (${result.annotations.length}):`,
      ...result.annotations
        .filter((a) => a.names.length > 0)
        .map((a) => `# ${a.names.join(", ")} at (${a.pixelx.toFixed(1)}, ${a.pixely.toFixed(1)})`),
      ``,
      `# Tags: ${result.tags.join(", ")}`,
    ].join("\n");

    const baseName = fileName.replace(/\.[^.]+$/, "");
    const outputFile = new FSFile(Paths.cache, `${baseName}_wcs.txt`);
    outputFile.write(text);

    const outputPath = outputFile.uri;
    Logger.info(TAG, `WCS exported to ${outputPath}`);
    return outputPath;
  } catch (error) {
    Logger.error(TAG, "Failed to export WCS", error);
    return null;
  }
}

/**
 * 将 WCS 标定数据写入 FITS 文件 header
 */
export async function writeWCSToFitsHeader(
  result: AstrometryResult,
  fitsFilePath: string,
): Promise<number> {
  const keywords = generateWCSKeywords(result.calibration);

  const entries = keywords.map((kw) => ({
    key: kw.key,
    value: kw.value,
    comment: kw.comment,
  }));

  const count = await writeHeaderKeywords(fitsFilePath, entries);
  Logger.info(TAG, `Wrote ${count} WCS keywords to ${fitsFilePath}`);
  return count;
}

export async function shareWCS(result: AstrometryResult, fileName: string): Promise<boolean> {
  const path = await exportWCSToFile(result, fileName);
  if (!path) return false;

  try {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(path, {
        mimeType: "text/plain",
        dialogTitle: `WCS Data - ${fileName}`,
      });
      return true;
    }
    return false;
  } catch (error) {
    Logger.error(TAG, "Failed to share WCS", error);
    return false;
  }
}
