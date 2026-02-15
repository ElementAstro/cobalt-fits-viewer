/**
 * FITS Header Writer
 * 在 FITS 文件中注入/更新 header keywords（如 WCS 数据）
 *
 * FITS header 规则:
 * - 每条记录固定 80 字节 ASCII
 * - Header 块以 2880 字节对齐
 * - END 关键字标记 header 结束
 */

import { File as FSFile, Paths } from "expo-file-system";
import { Logger } from "../logger/logger";

const TAG = "FitsHeaderWriter";
const RECORD_LEN = 80;
const BLOCK_SIZE = 2880;

interface HeaderEntry {
  key: string;
  value: string | number | boolean;
  comment?: string;
}

/**
 * 格式化一条 FITS header 记录（80 字节）
 */
export function formatHeaderRecord(entry: HeaderEntry): string {
  const key = entry.key.padEnd(8).substring(0, 8);
  let record: string;

  if (typeof entry.value === "string") {
    // 字符串值用单引号包裹，左对齐，最少占 8 字符
    const strVal = `'${entry.value}'`.padEnd(20);
    record = `${key}= ${strVal}`;
  } else if (typeof entry.value === "boolean") {
    const boolVal = entry.value ? "T" : "F";
    record = `${key}= ${boolVal.padStart(20)}`;
  } else {
    // 数值右对齐，占 20 字符
    const numStr = formatNumber(entry.value);
    record = `${key}= ${numStr.padStart(20)}`;
  }

  if (entry.comment) {
    record = `${record} / ${entry.comment}`;
  }

  // 截断或填充到 80 字符
  return record.padEnd(RECORD_LEN).substring(0, RECORD_LEN);
}

/**
 * 格式化数值，保持 FITS 兼容精度
 */
export function formatNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }
  // 对于浮点数，使用足够精度但不超过 20 字符
  const str = value.toPrecision(15);
  // 去除尾部多余的 0
  return str.replace(/\.?0+$/, "") || "0";
}

/**
 * 在 FITS 文件中注入 header keywords
 * 会在 END 关键字之前插入，如果关键字已存在则更新
 *
 * @returns 写入的 keyword 数量
 */
export async function writeHeaderKeywords(
  filePath: string,
  entries: HeaderEntry[],
): Promise<number> {
  const file = new FSFile(filePath);
  if (!file.exists) {
    throw new Error(`File not found: ${filePath}`);
  }

  const bytes = await file.bytes();
  const buffer = bytes.buffer as ArrayBuffer;
  const view = new Uint8Array(buffer);

  // 解析现有 header，找到 END 位置和所有已存在的 key
  const { endOffset, existingKeys, headerEnd } = parseHeaderPositions(view);

  if (endOffset < 0) {
    throw new Error("Invalid FITS file: END keyword not found");
  }

  // 分离需要更新和需要插入的 entries
  const toUpdate: Array<{ entry: HeaderEntry; offset: number }> = [];
  const toInsert: HeaderEntry[] = [];

  for (const entry of entries) {
    const existingOffset = existingKeys.get(entry.key);
    if (existingOffset != null) {
      toUpdate.push({ entry, offset: existingOffset });
    } else {
      toInsert.push(entry);
    }
  }

  // 1. 就地更新已存在的 keywords
  for (const { entry, offset } of toUpdate) {
    const record = formatHeaderRecord(entry);
    writeAscii(view, offset, record);
  }

  // 2. 插入新 keywords（在 END 之前）
  if (toInsert.length > 0) {
    const newRecords = toInsert.map(formatHeaderRecord);
    const insertBytes = newRecords.length * RECORD_LEN;

    // 计算 END 后剩余的空白空间
    const blankAfterEnd = headerEnd - endOffset - RECORD_LEN;

    if (blankAfterEnd >= insertBytes) {
      // 有足够空间：把 END 后移，在原 END 位置写入新 keywords
      // 先写新 keywords
      let offset = endOffset;
      for (const record of newRecords) {
        writeAscii(view, offset, record);
        offset += RECORD_LEN;
      }
      // 写 END
      writeAscii(view, offset, "END".padEnd(RECORD_LEN));

      // 写回文件
      file.write(bytes);
      Logger.info(
        TAG,
        `Updated ${toUpdate.length}, inserted ${toInsert.length} keywords (in-place)`,
      );
    } else {
      // 需要扩展 header：创建新文件
      const newFile = await expandHeaderAndInsert(view, endOffset, headerEnd, newRecords);

      // 写入临时文件再替换
      const tmpFile = new FSFile(Paths.cache, `tmp_header_${Date.now()}.fits`);
      tmpFile.write(newFile);

      // 用临时文件覆盖原文件
      const originalFile = new FSFile(filePath);
      const tmpBytes = await tmpFile.bytes();
      originalFile.write(tmpBytes);

      // 清理临时文件
      tmpFile.delete();

      Logger.info(
        TAG,
        `Updated ${toUpdate.length}, inserted ${toInsert.length} keywords (expanded)`,
      );
    }
  } else {
    // 只有更新，直接写回
    file.write(bytes);
    Logger.info(TAG, `Updated ${toUpdate.length} keywords`);
  }

  return toUpdate.length + toInsert.length;
}

/**
 * 解析 header 中所有 keyword 的位置
 */
export function parseHeaderPositions(data: Uint8Array): {
  endOffset: number;
  existingKeys: Map<string, number>;
  headerEnd: number;
} {
  const existingKeys = new Map<string, number>();
  let endOffset = -1;
  let offset = 0;

  while (offset < data.length) {
    const record = readAscii(data, offset, RECORD_LEN);
    const key = record.substring(0, 8).trim();

    if (key === "END") {
      endOffset = offset;
      // headerEnd 是当前 2880 块的结尾
      const headerEnd = Math.ceil((offset + RECORD_LEN) / BLOCK_SIZE) * BLOCK_SIZE;
      return { endOffset, existingKeys, headerEnd };
    }

    if (key && key !== "COMMENT" && key !== "HISTORY" && record.charAt(8) === "=") {
      existingKeys.set(key, offset);
    }

    offset += RECORD_LEN;

    // 安全限制：header 不应超过 100 blocks
    if (offset > BLOCK_SIZE * 100) break;
  }

  return { endOffset, existingKeys, headerEnd: offset };
}

/**
 * 扩展 header 块并插入新记录
 */
export async function expandHeaderAndInsert(
  originalData: Uint8Array,
  endOffset: number,
  headerEnd: number,
  newRecords: string[],
): Promise<Uint8Array> {
  const insertBytes = newRecords.length * RECORD_LEN;
  // 新的 header 需要的总字节数（含已有 header + 新记录 + END + 空白对齐）
  const newHeaderContentLen = endOffset + insertBytes + RECORD_LEN; // +END
  const newHeaderEnd = Math.ceil(newHeaderContentLen / BLOCK_SIZE) * BLOCK_SIZE;
  const extraBytes = newHeaderEnd - headerEnd;

  // 创建新的文件数据
  const newData = new Uint8Array(originalData.length + extraBytes);

  // 复制 header 到 END 之前
  newData.set(originalData.subarray(0, endOffset), 0);

  // 写入新 records
  let offset = endOffset;
  for (const record of newRecords) {
    writeAscii(newData, offset, record);
    offset += RECORD_LEN;
  }

  // 写入 END
  writeAscii(newData, offset, "END".padEnd(RECORD_LEN));
  offset += RECORD_LEN;

  // 填充空白到块对齐
  while (offset < newHeaderEnd) {
    writeAscii(newData, offset, " ".repeat(RECORD_LEN));
    offset += RECORD_LEN;
  }

  // 复制数据部分（header 结束后的所有内容）
  newData.set(originalData.subarray(headerEnd), newHeaderEnd);

  return newData;
}

/**
 * 从 Uint8Array 读取 ASCII 字符串
 */
export function readAscii(data: Uint8Array, offset: number, length: number): string {
  let s = "";
  for (let i = 0; i < length && offset + i < data.length; i++) {
    s += String.fromCharCode(data[offset + i]);
  }
  return s;
}

/**
 * 将 ASCII 字符串写入 Uint8Array
 */
export function writeAscii(data: Uint8Array, offset: number, str: string): void {
  for (let i = 0; i < str.length && offset + i < data.length; i++) {
    data[offset + i] = str.charCodeAt(i);
  }
}
