/**
 * 帧类型自动分类
 * 基于 FITS header (IMAGETYP/FRAME) 和文件名模式匹配
 */

import type { FrameType } from "../fits/types";

/** IMAGETYP / FRAME header 常见值映射 */
const HEADER_VALUE_MAP: Record<string, FrameType> = {
  light: "light",
  "light frame": "light",
  science: "light",
  object: "light",

  dark: "dark",
  "dark frame": "dark",

  flat: "flat",
  "flat frame": "flat",
  "flat field": "flat",
  skyflat: "flat",
  "sky flat": "flat",
  domeflat: "flat",
  "dome flat": "flat",
  "twilight flat": "flat",

  bias: "bias",
  "bias frame": "bias",
  offset: "bias",
  zero: "bias",
};

/** 文件名模式 (优先级从高到低)
 *  使用 (?:^|[\s_\-./]) ... (?:[\s_\-./]|$) 来模拟单词边界，
 *  因为 \b 将 _ 视为单词字符，对 "Bias_001" 这类文件名失效。
 */
const SEP = "(?:^|[\\s_\\-./])";
const END = "(?:[\\s_\\-./]|$)";
const FILENAME_PATTERNS: Array<{ pattern: RegExp; type: FrameType }> = [
  { pattern: new RegExp(`${SEP}bias${END}`, "i"), type: "bias" },
  { pattern: new RegExp(`${SEP}offset${END}`, "i"), type: "bias" },
  { pattern: new RegExp(`${SEP}zero${END}`, "i"), type: "bias" },
  { pattern: new RegExp(`${SEP}flat${END}`, "i"), type: "flat" },
  { pattern: /(?:sky|dome|twilight)flat/i, type: "flat" },
  { pattern: new RegExp(`${SEP}dark${END}`, "i"), type: "dark" },
  { pattern: new RegExp(`${SEP}light${END}`, "i"), type: "light" },
  { pattern: new RegExp(`${SEP}science${END}`, "i"), type: "light" },
];

/**
 * 从 IMAGETYP / FRAME header 值推断帧类型
 */
export function classifyByHeader(headerValue: string | undefined): FrameType | null {
  if (!headerValue) return null;
  const normalized = headerValue.trim().toLowerCase();
  return HEADER_VALUE_MAP[normalized] ?? null;
}

/**
 * 从文件名推断帧类型
 */
export function classifyByFilename(filename: string): FrameType | null {
  for (const { pattern, type } of FILENAME_PATTERNS) {
    if (pattern.test(filename)) return type;
  }
  return null;
}

/**
 * 综合推断帧类型
 * 优先使用 header，回退到文件名模式匹配
 */
export function classifyFrameType(
  imageType: string | undefined,
  frameHeader: string | undefined,
  filename: string,
): FrameType {
  return (
    classifyByHeader(imageType) ??
    classifyByHeader(frameHeader) ??
    classifyByFilename(filename) ??
    "unknown"
  );
}
