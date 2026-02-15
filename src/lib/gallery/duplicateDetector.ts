/**
 * 重复文件检测
 * 使用文件大小 + 前 64KB 内容的快速哈希进行检测
 */

import type { FitsMetadata } from "../fits/types";

/**
 * 计算简单的快速哈希 (基于文件大小 + 前 64KB 内容的 djb2 哈希)
 * 不使用 crypto API，纯 JS 实现，适合 React Native 环境
 */
export function computeQuickHash(buffer: ArrayBuffer, fileSize: number): string {
  const sampleSize = Math.min(buffer.byteLength, 65536);
  const view = new Uint8Array(buffer, 0, sampleSize);

  let hash = 5381;
  for (let i = 0; i < view.length; i++) {
    hash = ((hash << 5) + hash + view[i]) | 0;
  }

  // Combine content hash with file size for uniqueness
  return `${(hash >>> 0).toString(36)}_${fileSize}`;
}

/**
 * 在现有文件中查找重复
 * @returns 匹配的已存在文件，或 null
 */
export function findDuplicateOnImport(
  hash: string,
  existingFiles: FitsMetadata[],
): FitsMetadata | null {
  return existingFiles.find((f) => f.hash === hash) ?? null;
}

/**
 * 按 hash 分组，找出所有重复文件组
 * @returns Map<hash, fileIds[]>，仅包含有 2+ 文件的组
 */
export function findDuplicateGroups(files: FitsMetadata[]): Map<string, FitsMetadata[]> {
  const groups = new Map<string, FitsMetadata[]>();

  for (const file of files) {
    if (!file.hash) continue;
    const existing = groups.get(file.hash);
    if (existing) {
      existing.push(file);
    } else {
      groups.set(file.hash, [file]);
    }
  }

  // Only return groups with duplicates
  const duplicates = new Map<string, FitsMetadata[]>();
  for (const [hash, group] of groups) {
    if (group.length > 1) {
      duplicates.set(hash, group);
    }
  }

  return duplicates;
}

/**
 * 获取重复文件统计
 */
export function getDuplicateStats(files: FitsMetadata[]): {
  duplicateGroups: number;
  duplicateFiles: number;
  wastedBytes: number;
} {
  const groups = findDuplicateGroups(files);
  let duplicateFiles = 0;
  let wastedBytes = 0;

  for (const group of groups.values()) {
    // Count extra files (first one is the "original")
    const extras = group.length - 1;
    duplicateFiles += extras;
    wastedBytes += extras * (group[0].fileSize ?? 0);
  }

  return {
    duplicateGroups: groups.size,
    duplicateFiles,
    wastedBytes,
  };
}
