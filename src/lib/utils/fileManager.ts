/**
 * 文件管理操作
 * 使用 expo-file-system v19 新 API
 */

import { Paths, File, Directory } from "expo-file-system";
import {
  detectSupportedImageFormat,
  isFitsFamilyFilename,
  isSupportedImageFilename,
} from "../import/fileFormat";

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
  return listImportedImageFiles().filter((file) => isFitsFile(file.name));
}

/**
 * 列出所有已导入的受支持图像文件
 */
export function listImportedImageFiles(): File[] {
  const dir = getFitsDir();
  if (!dir.exists) return [];

  return dir
    .list()
    .filter((item): item is File => item instanceof File && isSupportedImageFile(item.name));
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
  const files = listImportedImageFiles();
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
  return isFitsFamilyFilename(filename);
}

/**
 * 判断文件名是否为支持的图像格式
 */
export function isSupportedImageFile(filename: string): boolean {
  return isSupportedImageFilename(filename);
}

/**
 * 递归扫描目录中的 FITS 文件
 */
export function scanDirectoryForFits(dir: Directory): File[] {
  return scanDirectoryForSupportedImages(dir).filter((file) => isFitsFile(file.name));
}

/**
 * 递归扫描目录中的受支持图像文件
 */
export function scanDirectoryForSupportedImages(dir: Directory): File[] {
  const results: File[] = [];
  if (!dir.exists) return results;

  const items = dir.list();
  for (const item of items) {
    if (item instanceof Directory) {
      results.push(...scanDirectoryForSupportedImages(item));
    } else if (item instanceof File && detectSupportedImageFormat(item.name)) {
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

export interface RenameFitsFileResult {
  success: boolean;
  filepath: string;
  filename: string;
  error?: string;
}

/**
 * 重命名 FITS 文件（真实文件 + 返回新路径）
 */
export function renameFitsFile(filepath: string, nextFilename: string): RenameFitsFileResult {
  const source = new File(filepath);
  if (!source.exists) {
    return {
      success: false,
      filepath,
      filename: nextFilename,
      error: "Source file does not exist.",
    };
  }

  const originalName = source.name;
  const originalExt = originalName.match(/\.[^.]+$/)?.[0] ?? ".fits";
  const sanitizedBase = sanitizeFilename(nextFilename.replace(/\.[^.]+$/, ""));
  const requestedExt = nextFilename.match(/\.[^.]+$/)?.[0];
  const finalExt = requestedExt ?? originalExt;
  const safeExt = finalExt.startsWith(".") ? finalExt : `.${finalExt}`;
  const normalizedName = `${sanitizedBase}${safeExt}`;

  const separatorIndex = filepath.lastIndexOf("/");
  const parentPath = separatorIndex >= 0 ? filepath.slice(0, separatorIndex) : getFitsDir().uri;
  const normalizedParent = parentPath.endsWith("/") ? parentPath.slice(0, -1) : parentPath;

  let candidateName = normalizedName;
  let candidatePath = `${normalizedParent}/${candidateName}`;
  let candidateFile = new File(candidatePath);

  // Avoid name collision
  if (candidateFile.exists && candidateFile.uri !== source.uri) {
    const base = candidateName.replace(/\.[^.]+$/, "");
    const ext = candidateName.match(/\.[^.]+$/)?.[0] ?? "";
    candidateName = `${base}_${Date.now()}${ext}`;
    candidatePath = `${normalizedParent}/${candidateName}`;
    candidateFile = new File(candidatePath);
  }

  if (candidateFile.uri === source.uri) {
    return {
      success: true,
      filepath,
      filename: originalName,
    };
  }

  try {
    source.copy(candidateFile);
    source.delete();
    return {
      success: true,
      filepath: candidateFile.uri,
      filename: candidateName,
    };
  } catch (error) {
    return {
      success: false,
      filepath,
      filename: originalName,
      error: error instanceof Error ? error.message : "Rename failed",
    };
  }
}

function sanitizeFilename(name: string): string {
  const sanitized = name
    .replace(/[<>:"/\\|?*]/g, "_")
    .split("")
    .map((char) => (char.charCodeAt(0) <= 31 ? "_" : char))
    .join("")
    .trim()
    .replace(/\s+/g, " ");
  return sanitized || "untitled";
}
