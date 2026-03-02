/**
 * 局域网传输核心逻辑
 * 发送端：启动嵌入式 HTTP Server 提供备份包下载
 * 接收端：通过 HTTP 下载备份包并导入
 */

import { File, Paths } from "expo-file-system";
import * as Network from "expo-network";
import { LOG_TAGS, Logger } from "../logger";
import type { BackupManifest, BackupProgress } from "./types";
import { getManifestSummary, serializeManifest } from "./manifest";

const TAG = LOG_TAGS.LANTransfer;

export interface LANServerInfo {
  ip: string;
  port: number;
  pin: string;
  fileCount: number;
  estimatedSize: number;
  deviceName: string;
}

export interface LANServerHandle {
  info: LANServerInfo;
  stop: () => void;
}

function generatePin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export const LAN_PORT_BASE = 18080;

function randomPort(): number {
  return LAN_PORT_BASE + Math.floor(Math.random() * 920);
}

type HttpServerModule = {
  setup: (port: number, callback: (event: { status: string }) => void) => void;
  route: (
    path: string,
    method: string,
    handler: (req: { headers: Record<string, string>; url: string }) => {
      status: number;
      type: string;
      body: string;
    },
  ) => void;
  stop: () => void;
};

function loadHttpServerModule(): HttpServerModule {
  return require("expo-http-server") as HttpServerModule;
}

/**
 * 启动 LAN 传输服务端
 */
export async function startLANServer(
  zipFilePath: string,
  manifest: BackupManifest,
  onStatusChange?: (status: string) => void,
): Promise<LANServerHandle> {
  const ip = await Network.getIpAddressAsync();
  if (!ip || ip === "0.0.0.0") {
    throw new Error("Cannot determine local IP address. Ensure WiFi is connected.");
  }

  const pin = generatePin();
  const port = randomPort();
  const summary = getManifestSummary(manifest);

  const zipFile = new File(zipFilePath);
  if (!zipFile.exists) {
    throw new Error("Backup package not found");
  }

  const server = loadHttpServerModule();

  const serverInfo: LANServerInfo = {
    ip,
    port,
    pin,
    fileCount: summary.fileCount,
    estimatedSize: zipFile.size ?? 0,
    deviceName: summary.deviceName,
  };

  const validatePin = (req: { headers: Record<string, string> }): boolean => {
    const authHeader = req.headers["authorization"] ?? req.headers["Authorization"] ?? "";
    return authHeader === `PIN ${pin}`;
  };

  server.route("/info", "GET", (req) => {
    if (!validatePin(req)) {
      return { status: 401, type: "application/json", body: '{"error":"Invalid PIN"}' };
    }
    return {
      status: 200,
      type: "application/json",
      body: JSON.stringify({
        fileCount: summary.fileCount,
        estimatedSize: zipFile.size ?? 0,
        deviceName: summary.deviceName,
        createdAt: summary.createdAt,
        appVersion: summary.appVersion,
      }),
    };
  });

  server.route("/manifest", "GET", (req) => {
    if (!validatePin(req)) {
      return { status: 401, type: "application/json", body: '{"error":"Invalid PIN"}' };
    }
    return {
      status: 200,
      type: "application/json",
      body: serializeManifest(manifest),
    };
  });

  server.route("/backup", "GET", (req) => {
    if (!validatePin(req)) {
      return { status: 401, type: "application/json", body: '{"error":"Invalid PIN"}' };
    }
    // For large file serving, expo-http-server handles reading from disk
    // Return the file path for the server to stream
    return {
      status: 200,
      type: "application/zip",
      body: zipFilePath,
    };
  });

  server.setup(port, (event) => {
    Logger.debug(TAG, `Server event: ${event.status}`);
    onStatusChange?.(event.status);
  });

  Logger.info(TAG, `LAN server started at ${ip}:${port}`);

  return {
    info: serverInfo,
    stop: () => {
      try {
        server.stop();
        Logger.info(TAG, "LAN server stopped");
      } catch {
        // ignore stop errors
      }
    },
  };
}

/**
 * 从 LAN 服务端下载备份包
 */
export async function downloadFromLAN(
  host: string,
  port: number,
  pin: string,
  onProgress?: (progress: BackupProgress) => void,
): Promise<{ success: boolean; zipPath?: string; error?: string }> {
  const baseUrl = `http://${host}:${port}`;
  const headers: Record<string, string> = { Authorization: `PIN ${pin}` };

  try {
    onProgress?.({ phase: "preparing", current: 0, total: 0 });

    // 1. Fetch info
    const infoRes = await fetch(`${baseUrl}/info`, { headers });
    if (!infoRes.ok) {
      if (infoRes.status === 401) return { success: false, error: "Invalid PIN" };
      return { success: false, error: `Connection failed: ${infoRes.status}` };
    }
    const info = (await infoRes.json()) as { estimatedSize: number; fileCount: number };
    Logger.info(TAG, `LAN transfer info: ${info.fileCount} files, ${info.estimatedSize} bytes`);

    // 2. Download backup ZIP
    onProgress?.({
      phase: "downloading",
      current: 0,
      total: 1,
      bytesTotal: info.estimatedSize,
      bytesTransferred: 0,
    });

    const destFile = new File(Paths.cache, `lan-backup-${Date.now()}.zip`);
    const backupRes = await fetch(`${baseUrl}/backup`, { headers });
    if (!backupRes.ok) {
      return { success: false, error: `Download failed: ${backupRes.status}` };
    }

    const contentLength =
      parseInt(backupRes.headers.get("content-length") ?? "0", 10) || info.estimatedSize;
    const reader = backupRes.body?.getReader();

    let totalReceived = 0;
    if (reader) {
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          totalReceived += value.length;
          onProgress?.({
            phase: "downloading",
            current: 0,
            total: 1,
            bytesTotal: contentLength,
            bytesTransferred: totalReceived,
          });
        }
      }
      const merged = new Uint8Array(totalReceived);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      destFile.write(merged);
    } else {
      const data = new Uint8Array(await backupRes.arrayBuffer());
      totalReceived = data.length;
      destFile.write(data);
    }

    onProgress?.({
      phase: "downloading",
      current: 1,
      total: 1,
      bytesTotal: totalReceived,
      bytesTransferred: totalReceived,
    });

    Logger.info(TAG, `LAN backup downloaded: ${totalReceived} bytes`);
    return { success: true, zipPath: destFile.uri };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "LAN download failed";
    Logger.error(TAG, "LAN download failed", { error });
    return { success: false, error: msg };
  }
}
