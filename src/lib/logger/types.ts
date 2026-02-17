/**
 * 日志系统类型定义
 */

// ===== 日志级别 =====
export type LogLevel = "debug" | "info" | "warn" | "error";

export const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ===== 日志条目 =====
export interface LogEntry {
  id: string;
  timestamp: number;
  level: LogLevel;
  tag: string;
  message: string;
  data?: unknown;
  stackTrace?: string;
}

export type LoggerListener = () => void;

export interface LogSerializationOptions {
  /** Redact sensitive keys such as token/apiKey/password */
  redact?: boolean;
  /** Maximum traversal depth to prevent huge payloads */
  maxDepth?: number;
}

export interface LogQuery {
  /** minimum level filter (inclusive) */
  level?: LogLevel;
  /** tag contains (case-insensitive) */
  tag?: string;
  /** message/tag/data contains (case-insensitive) */
  query?: string;
  /** keep latest N entries */
  limit?: number;
}

// ===== Logger 配置 =====
export interface LoggerConfig {
  /** 最大日志条目数（环形缓冲区） */
  maxEntries: number;
  /** 最小输出级别 */
  minLevel: LogLevel;
  /** 是否输出到 console */
  consoleOutput: boolean;
  /** 是否启用本地持久化 */
  persistEnabled: boolean;
  /** 持久化存储 key */
  persistKey: string;
  /** 持久化写入防抖（毫秒） */
  persistDebounceMs: number;
}

// ===== 系统信息 =====
export interface DeviceInfo {
  brand: string | null;
  modelName: string | null;
  deviceType: string;
  osName: string | null;
  osVersion: string | null;
  deviceName: string | null;
  totalMemory: number | null;
  isDevice: boolean;
}

export interface AppInfo {
  appName: string | null;
  appVersion: string | null;
  buildVersion: string | null;
  appId: string | null;
  installTime: Date | null;
  runtimeVersion: string | null;
  sdkVersion: string | undefined;
  isDebugMode: boolean;
}

export interface BatteryInfo {
  level: number;
  state: string;
  isLowPowerMode: boolean;
}

export interface NetworkInfo {
  type: string;
  isConnected: boolean;
  isInternetReachable: boolean | null;
  ipAddress: string | null;
}

export interface RuntimeInfo {
  platform: string;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  fontScale: number;
}

export interface SystemInfo {
  device: DeviceInfo;
  app: AppInfo;
  battery: BatteryInfo;
  network: NetworkInfo;
  runtime: RuntimeInfo;
  collectedAt: number;
}
