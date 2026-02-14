/**
 * 日志导出与分享服务
 * 支持 JSON/文本格式导出、可选 gzip 压缩、附带系统信息
 */

import { Paths, Directory, File as FSFile } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { gzip } from "pako";
import { Logger } from "./logger";
import { collectSystemInfo, formatSystemInfo } from "./systemInfo";
import type { LogEntry, SystemInfo } from "./types";

const LOG_EXPORT_SUBDIR = "log_exports";

export interface LogExportOptions {
  /** 导出格式 */
  format: "json" | "text";
  /** 是否启用 gzip 压缩 */
  compress?: boolean;
  /** 是否附带系统信息 */
  includeSystemInfo?: boolean;
}

interface LogExportPackage {
  exportedAt: string;
  appVersion: string;
  totalEntries: number;
  systemInfo?: SystemInfo;
  entries: LogEntry[];
}

/**
 * 获取日志导出目录
 */
function getLogExportDir(): Directory {
  const dir = new Directory(Paths.cache, LOG_EXPORT_SUBDIR);
  if (!dir.exists) {
    dir.create();
  }
  return dir;
}

/**
 * 生成导出文件名
 */
function generateFilename(format: "json" | "text", compress: boolean): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const ext = format === "json" ? "json" : "txt";
  return compress ? `cobalt-logs-${timestamp}.${ext}.gz` : `cobalt-logs-${timestamp}.${ext}`;
}

/**
 * 构建文本格式的导出内容
 */
function buildTextContent(entries: LogEntry[], systemInfo?: SystemInfo): string {
  const lines: string[] = [];

  lines.push("=== COBALT FITS Viewer - Log Export ===");
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`Total Entries: ${entries.length}`);
  lines.push("");

  if (systemInfo) {
    lines.push(formatSystemInfo(systemInfo));
    lines.push("");
  }

  lines.push(`=== Log Entries (${entries.length}) ===`);
  lines.push("");

  for (const entry of entries) {
    const time = new Date(entry.timestamp).toISOString();
    const line = `[${time}][${entry.level.toUpperCase()}][${entry.tag}] ${entry.message}`;
    lines.push(line);
    if (entry.data !== undefined) {
      lines.push(`  data: ${JSON.stringify(entry.data)}`);
    }
    if (entry.stackTrace) {
      lines.push(`  stack: ${entry.stackTrace}`);
    }
  }

  return lines.join("\n");
}

/**
 * 构建 JSON 格式的导出内容
 */
function buildJsonContent(entries: LogEntry[], systemInfo?: SystemInfo): string {
  const pkg: LogExportPackage = {
    exportedAt: new Date().toISOString(),
    appVersion: "1.0.0",
    totalEntries: entries.length,
    entries,
  };

  if (systemInfo) {
    pkg.systemInfo = systemInfo;
  }

  return JSON.stringify(pkg, null, 2);
}

/**
 * 导出日志到临时文件
 * @returns 文件 URI，失败返回 null
 */
export async function exportLogsToFile(
  options: LogExportOptions = { format: "text" },
): Promise<string | null> {
  const { format, compress = false, includeSystemInfo = false } = options;

  try {
    const entries = Logger.getEntries();

    let systemInfo: SystemInfo | undefined;
    if (includeSystemInfo) {
      try {
        systemInfo = await collectSystemInfo();
      } catch {
        // 系统信息采集失败不阻断导出
      }
    }

    const content =
      format === "json"
        ? buildJsonContent(entries, systemInfo)
        : buildTextContent(entries, systemInfo);

    const dir = getLogExportDir();
    const filename = generateFilename(format, compress);

    if (compress) {
      const compressed = gzip(content);
      const file = new FSFile(dir, filename);
      file.write(compressed);
      Logger.info("LogExport", `Logs exported (compressed): ${filename}`, {
        entries: entries.length,
        size: compressed.length,
      });
      return file.uri;
    } else {
      const file = new FSFile(dir, filename);
      file.write(content);
      Logger.info("LogExport", `Logs exported: ${filename}`, {
        entries: entries.length,
        size: content.length,
      });
      return file.uri;
    }
  } catch (e) {
    Logger.error("LogExport", "Failed to export logs to file", e);
    return null;
  }
}

/**
 * 分享日志文件
 */
export async function shareLogFile(
  options: LogExportOptions = { format: "text" },
): Promise<boolean> {
  try {
    const fileUri = await exportLogsToFile(options);
    if (!fileUri) return false;

    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      Logger.warn("LogExport", "Sharing is not available on this device");
      return false;
    }

    const mimeType = options.compress
      ? "application/gzip"
      : options.format === "json"
        ? "application/json"
        : "text/plain";

    await Sharing.shareAsync(fileUri, {
      mimeType,
      dialogTitle: "Share App Logs",
    });

    Logger.info("LogExport", "Logs shared successfully");
    return true;
  } catch (e) {
    Logger.error("LogExport", "Failed to share logs", e);
    return false;
  }
}

/**
 * 清理导出的临时日志文件
 */
export function cleanLogExports(): void {
  const dir = new Directory(Paths.cache, LOG_EXPORT_SUBDIR);
  if (dir.exists) {
    try {
      dir.delete();
    } catch {
      // ignore
    }
  }
}
