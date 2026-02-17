import type { SystemInfo } from "../types";

const mockPlatform = { OS: "ios" };
const mockDimensionsGet = jest.fn(() => ({ width: 390, height: 844 }));
const mockPixelRatioGet = jest.fn(() => 3);
const mockPixelRatioFontScale = jest.fn(() => 1.2);

const mockDevice = {
  brand: "MockBrand",
  modelName: "MockModel",
  osName: "MockOS",
  osVersion: "1.0",
  deviceName: "Mock Device",
  totalMemory: 8 * 1024 * 1024 * 1024,
  isDevice: true,
  getDeviceTypeAsync: jest.fn(),
};

const mockApplication = {
  applicationName: "Cobalt",
  nativeApplicationVersion: "1.2.3",
  nativeBuildVersion: "123",
  applicationId: "com.example.cobalt",
  getInstallationTimeAsync: jest.fn(),
};

const mockBattery = {
  getBatteryLevelAsync: jest.fn(),
  getBatteryStateAsync: jest.fn(),
  isLowPowerModeEnabledAsync: jest.fn(),
};

const mockNetwork = {
  getNetworkStateAsync: jest.fn(),
  getIpAddressAsync: jest.fn(),
};

const mockGetAppVersionInfo = jest.fn(() => ({
  runtimeVersion: "runtime-1",
  sdkVersion: "54.0.0",
}));

function loadSystemInfoModule() {
  jest.resetModules();

  jest.doMock("react-native", () => ({
    Platform: mockPlatform,
    Dimensions: {
      get: (...args: unknown[]) => mockDimensionsGet(...args),
    },
    PixelRatio: {
      get: (...args: unknown[]) => mockPixelRatioGet(...args),
      getFontScale: (...args: unknown[]) => mockPixelRatioFontScale(...args),
    },
  }));

  jest.doMock("expo-device", () => ({ ...mockDevice }));
  jest.doMock("expo-application", () => ({ ...mockApplication }));
  jest.doMock("expo-battery", () => ({ ...mockBattery }));
  jest.doMock("expo-network", () => ({ ...mockNetwork }));

  jest.doMock("../../version", () => ({
    getAppVersionInfo: (...args: unknown[]) => mockGetAppVersionInfo(...args),
  }));

  return require("../systemInfo") as {
    collectSystemInfo: () => Promise<SystemInfo>;
    formatSystemInfo: (info: SystemInfo) => string;
    formatBytes: (bytes: number) => string;
  };
}

describe("logger systemInfo", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockPlatform.OS = "ios";

    mockDevice.brand = "MockBrand";
    mockDevice.modelName = "MockModel";
    mockDevice.osName = "MockOS";
    mockDevice.osVersion = "1.0";
    mockDevice.deviceName = "Mock Device";
    mockDevice.totalMemory = 8 * 1024 * 1024 * 1024;
    mockDevice.isDevice = true;
    mockDevice.getDeviceTypeAsync.mockResolvedValue(1);

    mockApplication.applicationName = "Cobalt";
    mockApplication.nativeApplicationVersion = "1.2.3";
    mockApplication.nativeBuildVersion = "123";
    mockApplication.applicationId = "com.example.cobalt";
    mockApplication.getInstallationTimeAsync.mockResolvedValue(
      new Date("2024-01-01T00:00:00.000Z"),
    );

    mockBattery.getBatteryLevelAsync.mockResolvedValue(0.56);
    mockBattery.getBatteryStateAsync.mockResolvedValue(2);
    mockBattery.isLowPowerModeEnabledAsync.mockResolvedValue(true);

    mockNetwork.getNetworkStateAsync.mockResolvedValue({
      type: "wifi",
      isConnected: true,
      isInternetReachable: true,
    });
    mockNetwork.getIpAddressAsync.mockResolvedValue("192.168.0.2");
  });

  it("collects device/app/battery/network/runtime info", async () => {
    jest.spyOn(Date, "now").mockReturnValue(1700000000000);

    const mod = loadSystemInfoModule();
    const info = await mod.collectSystemInfo();

    expect(info.device.deviceType).toBe("Phone");
    expect(info.device.brand).toBe("MockBrand");
    expect(info.app.installTime).toEqual(new Date("2024-01-01T00:00:00.000Z"));
    expect(info.app.runtimeVersion).toBe("runtime-1");
    expect(info.app.sdkVersion).toBe("54.0.0");
    expect(info.battery).toEqual({
      level: 56,
      state: "Charging",
      isLowPowerMode: true,
    });
    expect(info.network).toEqual({
      type: "wifi",
      isConnected: true,
      isInternetReachable: true,
      ipAddress: "192.168.0.2",
    });
    expect(info.runtime).toEqual({
      platform: "ios",
      screenWidth: 390,
      screenHeight: 844,
      pixelRatio: 3,
      fontScale: 1.2,
    });
    expect(info.collectedAt).toBe(1700000000000);
    expect(mockApplication.getInstallationTimeAsync).toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it("falls back to safe defaults when platform/services fail", async () => {
    mockPlatform.OS = "android";

    mockDevice.getDeviceTypeAsync.mockRejectedValue(new Error("device fail"));
    mockBattery.getBatteryLevelAsync.mockRejectedValue(new Error("battery fail"));
    mockNetwork.getNetworkStateAsync.mockRejectedValue(new Error("network fail"));

    const mod = loadSystemInfoModule();
    const info = await mod.collectSystemInfo();

    expect(info.device.deviceType).toBe("Unknown");
    expect(info.app.installTime).toBeNull();
    expect(mockApplication.getInstallationTimeAsync).not.toHaveBeenCalled();
    expect(info.battery).toEqual({
      level: -1,
      state: "Unknown",
      isLowPowerMode: false,
    });
    expect(info.network).toEqual({
      type: "Unknown",
      isConnected: false,
      isInternetReachable: null,
      ipAddress: null,
    });
  });

  it("formats system info text and byte sizes", () => {
    const mod = loadSystemInfoModule();

    const formatted = mod.formatSystemInfo({
      device: {
        brand: "MockBrand",
        modelName: "MockModel",
        deviceType: "Phone",
        osName: "MockOS",
        osVersion: "1.0",
        deviceName: "Mock Device",
        totalMemory: 8 * 1024 * 1024 * 1024,
        isDevice: true,
      },
      app: {
        appName: "Cobalt",
        appVersion: "1.2.3",
        buildVersion: "123",
        appId: "com.example.cobalt",
        installTime: null,
        runtimeVersion: "runtime-1",
        sdkVersion: "54.0.0",
        isDebugMode: true,
      },
      battery: {
        level: 56,
        state: "Charging",
        isLowPowerMode: false,
      },
      network: {
        type: "wifi",
        isConnected: true,
        isInternetReachable: true,
        ipAddress: "192.168.0.2",
      },
      runtime: {
        platform: "ios",
        screenWidth: 390,
        screenHeight: 844,
        pixelRatio: 3,
        fontScale: 1.2,
      },
      collectedAt: Date.parse("2024-01-01T00:00:00.000Z"),
    });

    expect(formatted).toContain("=== Device ===");
    expect(formatted).toContain("Brand: MockBrand");
    expect(formatted).toContain("Total Memory: 8.0 GB");
    expect(formatted).toContain("=== App ===");
    expect(formatted).toContain("Runtime Version: runtime-1");
    expect(formatted).toContain("=== Runtime ===");
    expect(formatted).toContain("Screen: 390x844");
    expect(formatted).toContain("Collected at: 2024-01-01T00:00:00.000Z");

    expect(mod.formatBytes(500)).toBe("500 B");
    expect(mod.formatBytes(1536)).toBe("1.5 KB");
    expect(mod.formatBytes(1048576)).toBe("1.0 MB");
    expect(mod.formatBytes(3 * 1024 * 1024 * 1024)).toBe("3.00 GB");
  });
});
