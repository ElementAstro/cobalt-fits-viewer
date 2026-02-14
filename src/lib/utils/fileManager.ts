/**
 * 文件管理操作
 * 使用 expo-file-system v19 新 API
 */

import { Paths, File, Directory } from "expo-file-system";

const FITS_SUBDIR = "fits_files";

/**
 * 获取 FITS 文件存储目录
 */
export function getFitsDir(): Directory {
  const dir = new Directory(Paths.document, FITS_SUBDIR);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

/**
 * 将文件复制到应用存储目录
 */
export function importFile(sourceUri: string, filename: string): File {
  const destFile = new File(getFitsDir(), filename);
  const srcFile = new File(sourceUri);

  if (destFile.exists) {
    const baseName = filename.replace(/\.[^.]+$/, "");
    const ext = filename.match(/\.[^.]+$/)?.[0] ?? "";
    const newName = `${baseName}_${Date.now()}${ext}`;
    const newDest = new File(getFitsDir(), newName);
    srcFile.copy(newDest);
    return newDest;
  }

  srcFile.copy(destFile);
  return destFile;
}

/**
 * 删除 FITS 文件
 */
export function deleteFile(filepath: string): void {
  const file = new File(filepath);
  if (file.exists) {
    file.delete();
  }
}

/**
 * 批量删除文件
 */
export function deleteFiles(filepaths: string[]): void {
  for (const path of filepaths) {
    deleteFile(path);
  }
}

/**
 * 获取文件大小
 */
export function getFileSize(filepath: string): number {
  const file = new File(filepath);
  if (!file.exists) return 0;
  return file.size ?? 0;
}

/**
 * 读取 FITS 文件为 ArrayBuffer
 */
export async function readFileAsArrayBuffer(filepath: string): Promise<ArrayBuffer> {
  const file = new File(filepath);
  return file.arrayBuffer();
}

/**
 * 列出所有已导入的 FITS 文件
 */
export function listFitsFiles(): File[] {
  const dir = getFitsDir();
  if (!dir.exists) return [];

  return dir
    .list()
    .filter(
      (item): item is File =>
        item instanceof File &&
        (item.name.toLowerCase().endsWith(".fits") ||
          item.name.toLowerCase().endsWith(".fit") ||
          item.name.toLowerCase().endsWith(".fts")),
    );
}

/**
 * 检查文件是否存在
 */
export function fileExists(filepath: string): boolean {
  const file = new File(filepath);
  return file.exists;
}

/**
 * 获取存储使用统计
 */
export function getStorageStats(): {
  fitsCount: number;
  fitsSize: number;
} {
  const files = listFitsFiles();
  let totalSize = 0;

  for (const file of files) {
    totalSize += file.size ?? 0;
  }

  return {
    fitsCount: files.length,
    fitsSize: totalSize,
  };
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 生成唯一文件 ID
 */
export function generateFileId(): string {
  return `fits_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 判断文件名是否为 FITS 格式
 */
export function isFitsFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.endsWith(".fits") || lower.endsWith(".fit") || lower.endsWith(".fts");
}

/**
 * 递归扫描目录中的 FITS 文件
 */
export function scanDirectoryForFits(dir: Directory): File[] {
  const results: File[] = [];
  if (!dir.exists) return results;

  const items = dir.list();
  for (const item of items) {
    if (item instanceof Directory) {
      results.push(...scanDirectoryForFits(item));
    } else if (item instanceof File && isFitsFile(item.name)) {
      results.push(item);
    }
  }
  return results;
}

/**
 * 获取临时解压目录
 */
export function getTempExtractDir(): Directory {
  const dir = new Directory(Paths.cache, "zip_extract_temp");
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

/**
 * 清理临时解压目录
 */
export function cleanTempExtractDir(): void {
  const dir = new Directory(Paths.cache, "zip_extract_temp");
  if (dir.exists) {
    dir.delete();
  }
}
