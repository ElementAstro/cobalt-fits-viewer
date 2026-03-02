/**
 * FITS Header Validator
 * 校验 FITS header keyword 是否符合标准
 */

import type { HeaderKeyword } from "./types";
import { formatHeaderRecord } from "./headerWriter";

const RECORD_LEN = 80;

// FITS 标准必要关键字，不可删除
export const PROTECTED_KEYWORDS: ReadonlySet<string> = new Set([
  "SIMPLE",
  "BITPIX",
  "NAXIS",
  "NAXIS1",
  "NAXIS2",
  "NAXIS3",
  "END",
]);

// Key 合法字符: A-Z 0-9 _ -
const KEY_PATTERN = /^[A-Z0-9_-]{1,8}$/;

export interface HeaderValidationError {
  field: "key" | "value" | "comment" | "record";
  message: string;
}

/**
 * 校验 FITS header key
 */
export function validateHeaderKey(key: string): HeaderValidationError | null {
  if (!key || key.length === 0) {
    return { field: "key", message: "header.invalidKey" };
  }
  if (key.length > 8) {
    return { field: "key", message: "header.invalidKey" };
  }
  if (!KEY_PATTERN.test(key)) {
    return { field: "key", message: "header.invalidKey" };
  }
  return null;
}

/**
 * 校验 FITS header value
 */
export function validateHeaderValue(
  value: string | number | boolean | null,
): HeaderValidationError | null {
  if (value === null || value === undefined) {
    return { field: "value", message: "header.invalidValue" };
  }
  if (typeof value === "string") {
    // FITS 字符串值在引号内最长 68 字符
    if (value.length > 68) {
      return { field: "value", message: "header.valueTooLong" };
    }
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { field: "value", message: "header.invalidValue" };
    }
  }
  return null;
}

/**
 * 校验整条 FITS header record 是否合规
 */
export function validateHeaderRecord(keyword: HeaderKeyword): HeaderValidationError[] {
  const errors: HeaderValidationError[] = [];

  const keyErr = validateHeaderKey(keyword.key);
  if (keyErr) errors.push(keyErr);

  const valErr = validateHeaderValue(keyword.value);
  if (valErr) errors.push(valErr);

  // 检查序列化后是否超过 80 字节
  if (!keyErr && !valErr && keyword.value !== null) {
    const record = formatHeaderRecord({
      key: keyword.key,
      value: keyword.value,
      comment: keyword.comment,
    });
    if (record.length > RECORD_LEN) {
      errors.push({ field: "record", message: "header.valueTooLong" });
    }
  }

  return errors;
}

/**
 * 判断是否为受保护的关键字
 */
export function isProtectedKeyword(key: string): boolean {
  return PROTECTED_KEYWORDS.has(key.toUpperCase().trim());
}

/**
 * 从原始字符串推断值类型
 */
export function inferValueType(raw: string): {
  value: string | number | boolean;
  type: "string" | "number" | "boolean";
} {
  const trimmed = raw.trim();

  // Boolean
  if (trimmed === "true" || trimmed === "T") {
    return { value: true, type: "boolean" };
  }
  if (trimmed === "false" || trimmed === "F") {
    return { value: false, type: "boolean" };
  }

  // Number
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) {
    return { value: Number(trimmed), type: "number" };
  }

  // Default: string
  return { value: trimmed, type: "string" };
}
