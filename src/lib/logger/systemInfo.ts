/**
 * 系统信息采集模块
 * 采集设备、应用、电池、网络、运行时信息
 */

import { Platform, Dimensions, PixelRatio } from "react-native";
import * as Device from "expo-device";
import * as Application from "expo-application";
import * as Battery from "expo-battery";
import * as Network from "expo-network";
import { getAppVersionInfo } from "../version";
import type {
  SystemInfo,
  DeviceInfo,
  AppInfo,
  BatteryInfo,
  NetworkInfo,
  RuntimeInfo,
} from "./types";

const DEVICE_TYPE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Phone",
  2: "Tablet",
  3: "Desktop",
  4: "TV",
};

const BATTERY_STATE_MAP: Record<number, string> = {
  0: "Unknown",
  1: "Unplugged",
  2: "Charging",
  3: "Full",
};

/**
 * 采集设备信息
 */
async function collectDeviceInfo(): Promise<DeviceInfo> {
  let deviceType = "Unknown";
  try {
    const type = await Device.getDeviceTypeAsync();
    deviceType = DEVICE_TYPE_MAP[type] ?? "Unknown";
  } catch {
    deviceType = "Unknown";
  }

  return {
    brand: Device.brand,
    modelName: Device.modelName,
    deviceType,
    osName: Device.osName,
    osVersion: Device.osVersion,
    deviceName: Device.deviceName,
    totalMemory: Device.totalMemory,
    isDevice: Device.isDevice,
  };
}

/**
 * 采集应用信息
 */
async function collectAppInfo(): Promise<AppInfo> {
  let installTime: Date | null = null;
  try {
    if (Platform.OS === "ios") {
      installTime = await Application.getInstallationTimeAsync();
    }
  } catch {
    installTime = null;
  }

  const versionInfo = getAppVersionInfo();

  return {
    appName: Application.applicationName,
    appVersion: Application.nativeApplicationVersion,
    buildVersion: Application.nativeBuildVersion,
    appId: Application.applicationId,
    installTime,
    runtimeVersion: versionInfo.runtimeVersion,
    sdkVersion: versionInfo.sdkVersion,
    isDebugMode: __DEV__,
  };
}

/**
 * 采集电池信息
 */
async function collectBatteryInfo(): Promise<BatteryInfo> {
  try {
    const [level, state, isLowPowerMode] = await Promise.all([
      Battery.getBatteryLevelAsync(),
      Battery.getBatteryStateAsync(),
      Battery.isLowPowerModeEnabledAsync(),
    ]);

    return {
      level: Math.round(level * 100),
      state: BATTERY_STATE_MAP[state] ?? "Unknown",
      isLowPowerMode,
    };
  } catch {
    return {
      level: -1,
      state: "Unknown",
      isLowPowerMode: false,
    };
  }
}

/**
 * 采集网络信息
 */
async function collectNetworkInfo(): Promise<NetworkInfo> {
  try {
    const [networkState, ipAddress] = await Promise.all([
      Network.getNetworkStateAsync(),
      Network.getIpAddressAsync().catch(() => null),
    ]);

    return {
      type: networkState.type ?? "Unknown",
      isConnected: networkState.isConnected ?? false,
      isInternetReachable: networkState.isInternetReachable ?? null,
      ipAddress,
    };
  } catch {
    return {
      type: "Unknown",
      isConnected: false,
      isInternetReachable: null,
      ipAddress: null,
    };
  }
}

/**
 * 采集运行时信息（同步）
 */
function collectRuntimeInfo(): RuntimeInfo {
  const window = Dimensions.get("window");
  return {
    platform: Platform.OS,
    screenWidth: window.width,
    screenHeight: window.height,
    pixelRatio: PixelRatio.get(),
    fontScale: PixelRatio.getFontScale(),
  };
}

/**
 * 一次性采集所有系统信息
 */
export async function collectSystemInfo(): Promise<SystemInfo> {
  const [device, app, battery, network] = await Promise.all([
    collectDeviceInfo(),
    collectAppInfo(),
    collectBatteryInfo(),
    collectNetworkInfo(),
  ]);

  return {
    device,
    app,
    battery,
    network,
    runtime: collectRuntimeInfo(),
    collectedAt: Date.now(),
  };
}

/**
 * 格式化系统信息为可读文本（用于复制/分享）
 */
export function formatSystemInfo(info: SystemInfo): string {
  const lines: string[] = [];

  lines.push("=== Device ===");
  lines.push(`Brand: ${info.device.brand ?? "N/A"}`);
  lines.push(`Model: ${info.device.modelName ?? "N/A"}`);
  lines.push(`Type: ${info.device.deviceType}`);
  lines.push(`OS: ${info.device.osName ?? "N/A"} ${info.device.osVersion ?? ""}`);
  lines.push(`Physical Device: ${info.device.isDevice ? "Yes" : "No (Simulator)"}`);
  if (info.device.totalMemory) {
    lines.push(`Total Memory: ${(info.device.totalMemory / (1024 * 1024 * 1024)).toFixed(1)} GB`);
  }

  lines.push("");
  lines.push("=== App ===");
  lines.push(`Name: ${info.app.appName ?? "N/A"}`);
  lines.push(`Version: ${info.app.appVersion ?? "N/A"} (${info.app.buildVersion ?? "N/A"})`);
  lines.push(`App ID: ${info.app.appId ?? "N/A"}`);
  if (info.app.runtimeVersion) {
    lines.push(`Runtime Version: ${info.app.runtimeVersion}`);
  }
  if (info.app.sdkVersion) {
    lines.push(`Expo SDK: ${info.app.sdkVersion}`);
  }
  lines.push(`Debug Mode: ${info.app.isDebugMode ? "Yes" : "No"}`);

  lines.push("");
  lines.push("=== Battery ===");
  lines.push(`Level: ${info.battery.level >= 0 ? `${info.battery.level}%` : "N/A"}`);
  lines.push(`State: ${info.battery.state}`);
  lines.push(`Low Power Mode: ${info.battery.isLowPowerMode ? "Yes" : "No"}`);

  lines.push("");
  lines.push("=== Network ===");
  lines.push(`Type: ${info.network.type}`);
  lines.push(`Connected: ${info.network.isConnected ? "Yes" : "No"}`);
  lines.push(`Internet Reachable: ${info.network.isInternetReachable ?? "N/A"}`);
  if (info.network.ipAddress) {
    lines.push(`IP: ${info.network.ipAddress}`);
  }

  lines.push("");
  lines.push("=== Runtime ===");
  lines.push(`Platform: ${info.runtime.platform}`);
  lines.push(`Screen: ${info.runtime.screenWidth}x${info.runtime.screenHeight}`);
  lines.push(`Pixel Ratio: ${info.runtime.pixelRatio}`);
  lines.push(`Font Scale: ${info.runtime.fontScale}`);

  lines.push("");
  lines.push(`Collected at: ${new Date(info.collectedAt).toISOString()}`);

  return lines.join("\n");
}

/**
 * 格式化内存大小
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
