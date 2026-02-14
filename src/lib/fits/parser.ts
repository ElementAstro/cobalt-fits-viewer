/**
 * fitsjs-ng 封装层
 * 提供统一的 FITS 文件加载、解析和元数据提取接口
 */

import { FITS, Image, BinaryTable, Table, CompressedImage } from "fitsjs-ng";
import type { FitsMetadata, HeaderKeyword, HDUDataType } from "./types";

// ===== FITS 文件加载 =====

/**
 * 从 ArrayBuffer 加载 FITS 文件（同步）
 */
export function loadFitsFromBuffer(buffer: ArrayBuffer): FITS {
  return FITS.fromArrayBuffer(buffer);
}

/**
 * 从 Blob/File 加载 FITS 文件（异步）
 */
export async function loadFitsFromBlob(blob: Blob): Promise<FITS> {
  return FITS.fromBlob(blob);
}

/**
 * 从 URL 加载 FITS 文件（异步）
 */
export async function loadFitsFromURL(url: string): Promise<FITS> {
  return FITS.fromURL(url);
}

// ===== Header 解析 =====

/**
 * 获取 FITS 文件的所有 header 关键字
 */
export function getHeaderKeywords(fits: FITS, hduIndex?: number): HeaderKeyword[] {
  const header = fits.getHeader(hduIndex);
  if (!header) return [];

  const keys = header.keys();
  return keys.map((key: string) => ({
    key,
    value: header.get(key),
    comment: undefined, // fitsjs-ng 不直接暴露 comment
  }));
}

/**
 * 获取指定 header 关键字的值
 */
export function getHeaderValue(
  fits: FITS,
  key: string,
  hduIndex?: number,
): string | number | boolean | null {
  const header = fits.getHeader(hduIndex);
  if (!header) return null;
  return header.get(key);
}

/**
 * 获取 HDU 数据类型
 */
export function getHDUDataType(fits: FITS, hduIndex?: number): HDUDataType {
  const header = fits.getHeader(hduIndex);
  if (!header) return null;
  return header.getDataType() as HDUDataType;
}

/**
 * 获取所有 HDU 信息
 */
export function getHDUList(fits: FITS): Array<{
  index: number;
  type: HDUDataType;
  hasData: boolean;
}> {
  return fits.hdus.map(
    (
      hdu: { header: { getDataType: () => HDUDataType; hasDataUnit: () => boolean } },
      i: number,
    ) => ({
      index: i,
      type: hdu.header.getDataType() as HDUDataType,
      hasData: hdu.header.hasDataUnit(),
    }),
  );
}

// ===== 图像数据 =====

/**
 * 获取图像像素数据
 */
export async function getImagePixels(
  fits: FITS,
  hduIndex?: number,
  frame: number = 0,
): Promise<Float32Array | null> {
  const dataUnit = fits.getDataUnit(hduIndex);
  if (!dataUnit) return null;

  if (dataUnit instanceof Image || dataUnit instanceof CompressedImage) {
    const pixels = await dataUnit.getFrame(frame);
    return pixels as unknown as Float32Array;
  }
  return null;
}

/**
 * 获取图像尺寸信息
 */
export function getImageDimensions(
  fits: FITS,
  hduIndex?: number,
): {
  width: number;
  height: number;
  depth: number;
  isDataCube: boolean;
} | null {
  const header = fits.getHeader(hduIndex);
  if (!header) return null;

  const naxis1 = header.get("NAXIS1") as number | null;
  const naxis2 = header.get("NAXIS2") as number | null;
  const naxis3 = header.get("NAXIS3") as number | null;
  const naxis = header.get("NAXIS") as number | null;

  if (!naxis1 || !naxis2) return null;

  return {
    width: naxis1,
    height: naxis2,
    depth: naxis3 ?? 1,
    isDataCube: (naxis ?? 0) > 2,
  };
}

/**
 * 获取像素值范围
 */
export function getPixelExtent(pixels: Float32Array): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < pixels.length; i++) {
    const v = pixels[i];
    if (!isNaN(v)) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }
  return [min, max];
}

/**
 * 获取单个像素值
 */
export function getPixelValue(pixels: Float32Array, x: number, y: number, width: number): number {
  return pixels[y * width + x];
}

// ===== Table 数据 =====

/**
 * 获取表格行数据
 */
export async function getTableRows(
  fits: FITS,
  hduIndex: number,
  startRow: number = 0,
  count: number = 100,
): Promise<Record<string, unknown>[] | null> {
  const dataUnit = fits.getDataUnit(hduIndex);
  if (!dataUnit) return null;

  if (dataUnit instanceof Table || dataUnit instanceof BinaryTable) {
    const rows = await dataUnit.getRows(startRow, count);
    return rows as unknown as Record<string, unknown>[];
  }
  return null;
}

/**
 * 获取表格列数据
 */
export async function getTableColumn(
  fits: FITS,
  hduIndex: number,
  columnName: string,
): Promise<unknown[] | null> {
  const dataUnit = fits.getDataUnit(hduIndex);
  if (!dataUnit) return null;

  if (dataUnit instanceof Table || dataUnit instanceof BinaryTable) {
    const column = await dataUnit.getColumn(columnName);
    return column as unknown as unknown[];
  }
  return null;
}

// ===== 元数据提取 =====

/**
 * 从 FITS 文件提取标准化元数据
 */
export function extractMetadata(
  fits: FITS,
  fileInfo: { filename: string; filepath: string; fileSize: number },
): Omit<FitsMetadata, "id" | "importDate" | "isFavorite" | "tags" | "albumIds"> {
  const header = fits.getHeader();

  const getString = (key: string): string | undefined => {
    const v = header?.get(key);
    return typeof v === "string" ? v.trim() : undefined;
  };

  const getNumber = (key: string): number | undefined => {
    const v = header?.get(key);
    return typeof v === "number" ? v : undefined;
  };

  return {
    filename: fileInfo.filename,
    filepath: fileInfo.filepath,
    fileSize: fileInfo.fileSize,

    bitpix: getNumber("BITPIX"),
    naxis: getNumber("NAXIS"),
    naxis1: getNumber("NAXIS1"),
    naxis2: getNumber("NAXIS2"),
    naxis3: getNumber("NAXIS3"),

    object: getString("OBJECT"),
    dateObs: getString("DATE-OBS"),
    exptime: getNumber("EXPTIME"),
    filter: getString("FILTER"),
    instrument: getString("INSTRUME"),
    telescope: getString("TELESCOP"),
    ra: getNumber("RA"),
    dec: getNumber("DEC"),
    airmass: getNumber("AIRMASS"),

    detector: getString("DETECTOR"),
    gain: getNumber("GAIN"),
    ccdTemp: getNumber("CCD-TEMP") ?? getNumber("SET-TEMP"),
  };
}

/**
 * 获取 FITS 文件的 COMMENT 和 HISTORY 记录
 */
export function getCommentsAndHistory(
  fits: FITS,
  hduIndex?: number,
): {
  comments: string[];
  history: string[];
} {
  const header = fits.getHeader(hduIndex);
  if (!header) return { comments: [], history: [] };

  return {
    comments: header.getComments?.() ?? [],
    history: header.getHistory?.() ?? [],
  };
}
