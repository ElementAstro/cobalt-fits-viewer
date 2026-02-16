/**
 * 相簿导出功能
 */

import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { FitsMetadata, Album } from "../fits/types";
import { calculateAlbumStatistics, formatExposureTime, formatFileSize } from "./albumStatistics";

// Workaround for missing cacheDirectory type in expo-file-system
const fs = FileSystem as unknown as {
  cacheDirectory: string;
  makeDirectoryAsync: typeof FileSystem.makeDirectoryAsync;
  copyAsync: typeof FileSystem.copyAsync;
  writeAsStringAsync: typeof FileSystem.writeAsStringAsync;
  getInfoAsync: typeof FileSystem.getInfoAsync;
  deleteAsync: typeof FileSystem.deleteAsync;
};

export interface ExportProgress {
  current: number;
  total: number;
  status: "preparing" | "copying" | "generating_manifest" | "zipping" | "complete" | "error";
  error?: string;
}

/**
 * 导出相簿（生成清单文件并分享）
 */
export async function exportAlbum(
  album: Album,
  files: FitsMetadata[],
  onProgress?: (progress: ExportProgress) => void,
): Promise<string | null> {
  try {
    let zipFn: ((source: string, target: string) => Promise<string>) | null = null;
    try {
      const zipArchive = require("react-native-zip-archive");
      zipFn = zipArchive.zip;
    } catch {
      onProgress?.({
        current: 0,
        total: 0,
        status: "error",
        error: "ZIP export unavailable on this platform",
      });
      return null;
    }
    const zip = zipFn;
    if (!zip) {
      onProgress?.({
        current: 0,
        total: 0,
        status: "error",
        error: "ZIP export unavailable on this platform",
      });
      return null;
    }

    const albumFiles = files.filter((f) => album.imageIds.includes(f.id));
    const total = albumFiles.length;

    if (total === 0) {
      onProgress?.({ current: 0, total: 0, status: "error", error: "No files to export" });
      return null;
    }

    // Create export directory
    const exportDir = `${fs.cacheDirectory}album_export_${Date.now()}/`;
    await fs.makeDirectoryAsync(exportDir, { intermediates: true });

    onProgress?.({ current: 0, total, status: "preparing" });

    // Copy files to export directory
    for (let i = 0; i < albumFiles.length; i++) {
      const file = albumFiles[i];
      const destPath = `${exportDir}${file.filename}`;

      try {
        await fs.copyAsync({
          from: file.filepath,
          to: destPath,
        });
      } catch {
        // Skip files that can't be copied
        console.warn(`Failed to copy: ${file.filename}`);
      }

      onProgress?.({ current: i + 1, total, status: "copying" });
    }

    // Generate manifest
    onProgress?.({ current: total, total, status: "generating_manifest" });
    const stats = calculateAlbumStatistics(album, files);
    const manifest = generateAlbumManifest(album, albumFiles, stats);
    const manifestPath = `${exportDir}album_manifest.json`;
    await fs.writeAsStringAsync(manifestPath, JSON.stringify(manifest, null, 2));

    onProgress?.({ current: total, total, status: "zipping" });

    const safeAlbumName = album.name.replace(/[^\w.-]/g, "_").slice(0, 48);
    const zipPath = `${fs.cacheDirectory}album_export_${safeAlbumName}_${Date.now()}.zip`;
    await zip(exportDir, zipPath);

    await fs.deleteAsync(exportDir, { idempotent: true });

    onProgress?.({ current: total, total, status: "complete" });

    return zipPath;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    onProgress?.({ current: 0, total: 0, status: "error", error: errorMessage });
    return null;
  }
}

/**
 * 分享导出的相簿目录
 */
export async function shareAlbumExport(exportPath: string): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return false;
    }

    const zipInfo = await fs.getInfoAsync(exportPath);
    if (!zipInfo.exists) return false;

    await Sharing.shareAsync(exportPath, {
      mimeType: "application/zip",
      UTI: "public.zip-archive",
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * 分享单个文件
 */
export async function shareFile(filePath: string): Promise<boolean> {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      return false;
    }

    await Sharing.shareAsync(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * 生成相册清单
 */
function generateAlbumManifest(
  album: Album,
  files: FitsMetadata[],
  stats: ReturnType<typeof calculateAlbumStatistics>,
) {
  return {
    album: {
      name: album.name,
      description: album.description,
      isSmart: album.isSmart,
      smartRules: album.smartRules,
      createdAt: new Date(album.createdAt).toISOString(),
      updatedAt: new Date(album.updatedAt).toISOString(),
    },
    statistics: {
      totalImages: files.length,
      totalExposure: formatExposureTime(stats.totalExposure),
      totalExposureSeconds: stats.totalExposure,
      totalSize: formatFileSize(stats.totalFileSize),
      totalSizeBytes: stats.totalFileSize,
      frameBreakdown: stats.frameBreakdown,
      filterBreakdown: stats.filterBreakdown,
      dateRange: stats.dateRange,
    },
    files: files.map((f) => ({
      filename: f.filename,
      object: f.object,
      filter: f.filter,
      exptime: f.exptime,
      frameType: f.frameType,
      dateObs: f.dateObs,
      telescope: f.telescope,
      instrument: f.instrument,
      fileSize: formatFileSize(f.fileSize),
    })),
    exportedAt: new Date().toISOString(),
    exportedBy: "COBALT FITS Viewer",
  };
}

/**
 * 清理导出目录
 */
export async function cleanupExport(exportPath: string): Promise<void> {
  try {
    await fs.deleteAsync(exportPath, { idempotent: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * 获取相册的导出摘要文本
 */
export function getExportSummary(
  album: Album,
  files: FitsMetadata[],
  stats: ReturnType<typeof calculateAlbumStatistics>,
): string {
  const lines = [
    `Album: ${album.name}`,
    album.description ? `Description: ${album.description}` : null,
    `Total Images: ${files.length}`,
    `Total Exposure: ${formatExposureTime(stats.totalExposure)}`,
    `Total Size: ${formatFileSize(stats.totalFileSize)}`,
    "",
    "Frame Breakdown:",
    `  Light: ${stats.frameBreakdown.light}`,
    `  Dark: ${stats.frameBreakdown.dark}`,
    `  Flat: ${stats.frameBreakdown.flat}`,
    `  Bias: ${stats.frameBreakdown.bias}`,
    stats.dateRange ? `Date Range: ${stats.dateRange[0]} to ${stats.dateRange[1]}` : null,
  ].filter(Boolean);

  return lines.join("\n");
}
