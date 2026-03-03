/**
 * 独立 WCS 文件解析器
 * 支持从 .wcs 文件（FITS 仅 header 格式或文本 key=value 格式）中提取 WCS 标定信息
 */

import type { AstrometryCalibration } from "./types";
import type { HeaderKeyword } from "../fits/types";
import { parseWCSFromHeaders } from "./wcsParser";

const FITS_BLOCK_SIZE = 2880;
const FITS_CARD_LENGTH = 80;

/**
 * 从 .wcs 文件 buffer 解析 WCS 标定信息
 * 自动检测格式: FITS header-only 或 文本 key=value
 */
export function parseWCSFile(buffer: ArrayBuffer): AstrometryCalibration | null {
  if (!buffer || buffer.byteLength === 0) return null;

  // 尝试 FITS 格式 (以 "SIMPLE" 开头)
  const bytes = new Uint8Array(buffer);
  const header8 = String.fromCharCode(...bytes.slice(0, 8));
  if (header8.startsWith("SIMPLE")) {
    return parseFitsWCSFile(bytes);
  }

  // 否则尝试文本格式
  const text = new TextDecoder("utf-8").decode(buffer);
  return parseTextWCSFile(text);
}

/**
 * 解析 FITS 格式的 WCS 文件 (仅 header, 无数据)
 * 按 2880 字节块读取 80 字节卡片
 */
function parseFitsWCSFile(bytes: Uint8Array): AstrometryCalibration | null {
  const keywords: HeaderKeyword[] = [];
  const totalBytes = bytes.length;
  let offset = 0;

  while (offset < totalBytes) {
    const blockEnd = Math.min(offset + FITS_BLOCK_SIZE, totalBytes);

    for (
      let cardStart = offset;
      cardStart + FITS_CARD_LENGTH <= blockEnd;
      cardStart += FITS_CARD_LENGTH
    ) {
      const cardBytes = bytes.slice(cardStart, cardStart + FITS_CARD_LENGTH);
      const card = String.fromCharCode(...cardBytes).trimEnd();

      if (card.startsWith("END")) {
        return parseWCSFromHeaders(keywords);
      }

      const parsed = parseFitsCard(card);
      if (parsed) {
        keywords.push(parsed);
      }
    }

    offset = blockEnd;
  }

  // No END card found, try parsing what we have
  return keywords.length > 0 ? parseWCSFromHeaders(keywords) : null;
}

/**
 * 解析单个 FITS header 卡片 (80 字符)
 */
function parseFitsCard(card: string): HeaderKeyword | null {
  if (card.length < 8) return null;

  const key = card.substring(0, 8).trim();
  if (!key || key === "COMMENT" || key === "HISTORY" || key === "END") return null;

  // Check for '= ' value indicator at columns 9-10
  if (card.length < 10 || card[8] !== "=" || card[9] !== " ") {
    return null;
  }

  const valueStr = card.substring(10).split("/")[0].trim();
  if (!valueStr) return null;

  // String value (quoted)
  if (valueStr.startsWith("'")) {
    const endQuote = valueStr.indexOf("'", 1);
    const strVal =
      endQuote > 0 ? valueStr.substring(1, endQuote).trim() : valueStr.substring(1).trim();
    return { key, value: strVal, comment: undefined };
  }

  // Boolean
  if (valueStr === "T") return { key, value: 1, comment: undefined };
  if (valueStr === "F") return { key, value: 0, comment: undefined };

  // Numeric
  const num = parseFloat(valueStr);
  if (Number.isFinite(num)) {
    return { key, value: num, comment: undefined };
  }

  return { key, value: valueStr, comment: undefined };
}

/**
 * 解析文本格式的 WCS 文件
 * 支持 "KEY = VALUE / comment" 和 "KEY = VALUE" 格式
 */
function parseTextWCSFile(text: string): AstrometryCalibration | null {
  const keywords: HeaderKeyword[] = [];

  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) continue;

    // Try "KEY = VALUE / comment" format
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex < 1) continue;

    const key = trimmed.substring(0, eqIndex).trim().toUpperCase();
    if (!key) continue;

    let valueStr = trimmed.substring(eqIndex + 1);
    // Remove inline comment (after /)
    const slashIndex = valueStr.indexOf("/");
    if (slashIndex >= 0) {
      valueStr = valueStr.substring(0, slashIndex);
    }
    valueStr = valueStr.trim();

    if (!valueStr) continue;

    // String value (quoted)
    if (valueStr.startsWith("'") || valueStr.startsWith('"')) {
      const quote = valueStr[0];
      const endQuote = valueStr.indexOf(quote, 1);
      const strVal =
        endQuote > 0 ? valueStr.substring(1, endQuote).trim() : valueStr.substring(1).trim();
      keywords.push({ key, value: strVal, comment: undefined });
      continue;
    }

    // Numeric
    const num = parseFloat(valueStr);
    if (Number.isFinite(num)) {
      keywords.push({ key, value: num, comment: undefined });
      continue;
    }

    // Plain string
    keywords.push({ key, value: valueStr, comment: undefined });
  }

  return keywords.length > 0 ? parseWCSFromHeaders(keywords) : null;
}
