import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { SystemInfoCard } from "../SystemInfoCard";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../hooks/useHapticFeedback", () => ({
  useHapticFeedback: () => ({
    selection: jest.fn(),
    impact: jest.fn(),
    notify: jest.fn(),
  }),
}));

jest.mock("expo-clipboard", () => ({
  setStringAsync: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("expo-haptics", () => ({
  NotificationFeedbackType: {
    Success: "success",
    Warning: "warning",
    Error: "error",
  },
}));

jest.mock("../../../lib/logger", () => ({
  formatBytes: (bytes: number) => `${(bytes / 1024 / 1024).toFixed(0)} MB`,
}));

const mockSystemInfo = {
  device: {
    brand: "Apple",
    modelName: "iPhone 15 Pro",
    deviceType: "Phone",
    osName: "iOS",
    osVersion: "17.2",
    totalMemory: 6442450944,
    isDevice: true,
  },
  app: {
    appVersion: "1.2.0",
    buildVersion: "42",
    appId: "com.cobalt.fits",
    runtimeVersion: "1.0.0",
    sdkVersion: "51",
    isDebugMode: true,
  },
  battery: {
    level: 85,
    state: "Charging",
    isLowPowerMode: false,
  },
  network: {
    type: "WiFi",
    isConnected: true,
    ipAddress: "192.168.1.100",
  },
  runtime: {
    platform: "ios",
    screenWidth: 390,
    screenHeight: 844,
    pixelRatio: 3.0,
    fontScale: 1.0,
  },
};

const mockUseSystemInfo = {
  systemInfo: mockSystemInfo,
  isCollecting: false,
  refreshSystemInfo: jest.fn(),
  getFormattedInfo: jest.fn().mockReturnValue("Formatted system info"),
};

jest.mock("../../../hooks/useLogger", () => ({
  useSystemInfo: () => mockUseSystemInfo,
}));

describe("SystemInfoCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSystemInfo.systemInfo = mockSystemInfo;
    mockUseSystemInfo.isCollecting = false;
  });

  it("renders all section headers", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("systemInfo.device")).toBeTruthy();
    expect(screen.getByText("systemInfo.app")).toBeTruthy();
    expect(screen.getByText("systemInfo.battery")).toBeTruthy();
    expect(screen.getByText("systemInfo.network")).toBeTruthy();
    expect(screen.getByText("systemInfo.runtime")).toBeTruthy();
  });

  it("renders device information", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("Apple")).toBeTruthy();
    expect(screen.getByText("iPhone 15 Pro")).toBeTruthy();
    expect(screen.getByText("Phone")).toBeTruthy();
    expect(screen.getByText("iOS 17.2")).toBeTruthy();
  });

  it("renders app information", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("1.2.0 (42)")).toBeTruthy();
    expect(screen.getByText("com.cobalt.fits")).toBeTruthy();
  });

  it("renders battery information", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("85%")).toBeTruthy();
    expect(screen.getByText("Charging")).toBeTruthy();
  });

  it("renders network information", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("WiFi")).toBeTruthy();
    expect(screen.getByText("192.168.1.100")).toBeTruthy();
  });

  it("renders runtime information", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("ios")).toBeTruthy();
    expect(screen.getByText("390×844")).toBeTruthy();
    expect(screen.getByText("3.0")).toBeTruthy();
    expect(screen.getByText("1.00")).toBeTruthy();
  });

  it("renders refresh and copy buttons", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("systemInfo.refresh")).toBeTruthy();
    expect(screen.getByText("systemInfo.copy")).toBeTruthy();
  });

  it("calls refreshSystemInfo when refresh button is pressed", () => {
    render(<SystemInfoCard />);

    fireEvent.press(screen.getByText("systemInfo.refresh"));
    expect(mockUseSystemInfo.refreshSystemInfo).toHaveBeenCalled();
  });

  it("calls getFormattedInfo when copy button is pressed", async () => {
    render(<SystemInfoCard />);

    fireEvent.press(screen.getByText("systemInfo.copy"));
    expect(mockUseSystemInfo.getFormattedInfo).toHaveBeenCalled();
  });

  it("shows loading state when collecting and no data", () => {
    mockUseSystemInfo.systemInfo = null as any;
    mockUseSystemInfo.isCollecting = true;

    render(<SystemInfoCard />);

    expect(screen.getByText("systemInfo.collecting")).toBeTruthy();
    expect(screen.getByTestId("spinner")).toBeTruthy();
  });

  it("returns null when not collecting and no systemInfo", () => {
    mockUseSystemInfo.systemInfo = null as any;
    mockUseSystemInfo.isCollecting = false;

    const { toJSON } = render(<SystemInfoCard />);

    expect(toJSON()).toBeNull();
  });

  it("renders memory as formatted bytes", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("6144 MB")).toBeTruthy();
  });

  it("renders isDevice correctly", () => {
    render(<SystemInfoCard />);

    // Multiple 'Yes' entries: isDevice, isDebugMode, isConnected
    const yesTexts = screen.getAllByText("Yes");
    expect(yesTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders debug mode", () => {
    render(<SystemInfoCard />);

    // isDebugMode: true => "Yes", isDevice: true => "Yes", isConnected: true => "Yes"
    const yesTexts = screen.getAllByText("Yes");
    expect(yesTexts.length).toBeGreaterThanOrEqual(2);
  });

  it("renders optional runtimeVersion and sdkVersion", () => {
    render(<SystemInfoCard />);

    expect(screen.getByText("1.0.0")).toBeTruthy();
    expect(screen.getByText("51")).toBeTruthy();
  });
});
