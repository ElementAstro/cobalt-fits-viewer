/**
 * AstrometrySettings 组件测试
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { AstrometrySettings } from "../AstrometrySettings";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

const mockSetConfig = jest.fn();
const mockSaveApiKey = jest.fn().mockResolvedValue(undefined);
const mockTestConnection = jest.fn().mockResolvedValue(true);

jest.mock("../../../hooks/useAstrometry", () => ({
  useAstrometry: () => ({
    config: {
      apiKey: "",
      serverUrl: "https://nova.astrometry.net",
      useCustomServer: false,
      maxConcurrent: 3,
      autoSolve: false,
      defaultScaleUnits: "degwidth",
      defaultScaleLower: undefined,
      defaultScaleUpper: undefined,
    },
    setConfig: mockSetConfig,
    saveApiKey: mockSaveApiKey,
    testConnection: mockTestConnection,
  }),
}));

jest.mock("../../common/SettingsRow", () => {
  const ReactLocal = require("react");
  const { Text: RNText, Pressable } = require("react-native");
  return {
    SettingsRow: (props: { label: string; value?: string; onPress?: () => void }) =>
      ReactLocal.createElement(
        Pressable,
        { onPress: props.onPress },
        ReactLocal.createElement(RNText, null, props.label),
        props.value ? ReactLocal.createElement(RNText, null, props.value) : null,
      ),
  };
});

jest.mock("../../common/OptionPickerModal", () => {
  const ReactLocal = require("react");
  const { View: RNView } = require("react-native");
  return {
    OptionPickerModal: (props: { visible: boolean }) =>
      props.visible ? ReactLocal.createElement(RNView, { testID: "option-picker-modal" }) : null,
  };
});

jest.mock("react-native/Libraries/Alert/Alert", () => ({
  alert: jest.fn(),
}));

describe("AstrometrySettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders API Key card", () => {
    render(<AstrometrySettings />);
    // "astrometry.apiKey" appears in both Card.Title and Label
    expect(screen.getAllByText("astrometry.apiKey").length).toBeGreaterThanOrEqual(1);
  });

  it("renders API key hint description", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.apiKeyHint")).toBeTruthy();
  });

  it("renders server URL card", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.serverUrl")).toBeTruthy();
  });

  it("shows default server when custom server is disabled", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("https://nova.astrometry.net")).toBeTruthy();
  });

  it("renders settings card with max concurrent", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.maxConcurrent")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
  });

  it("renders auto solve setting", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.autoSolve")).toBeTruthy();
  });

  it("renders scale units setting", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.scaleUnits")).toBeTruthy();
    expect(screen.getByText("degwidth")).toBeTruthy();
  });

  it("renders scale hint text", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.scaleHint")).toBeTruthy();
  });

  it("renders scale lower and upper labels", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.scaleLower")).toBeTruthy();
    expect(screen.getByText("astrometry.scaleUpper")).toBeTruthy();
  });

  it("shows disconnected text when apiKey is empty", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.disconnected")).toBeTruthy();
  });

  it("renders save and test connection buttons", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("common.save")).toBeTruthy();
    expect(screen.getByText("astrometry.testConnection")).toBeTruthy();
  });

  it("opens concurrent picker when maxConcurrent row pressed", () => {
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.maxConcurrent"));
    expect(screen.getByTestId("option-picker-modal")).toBeTruthy();
  });

  it("opens scale units picker when scaleUnits row pressed", () => {
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.scaleUnits"));
    expect(screen.getByTestId("option-picker-modal")).toBeTruthy();
  });

  it("renders custom server switch", () => {
    render(<AstrometrySettings />);
    expect(screen.getByText("astrometry.customServer")).toBeTruthy();
  });

  it("calls testConnection and shows success status", async () => {
    mockTestConnection.mockResolvedValueOnce(true);
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.testConnection"));
    await waitFor(() => {
      expect(screen.getByText("astrometry.connectionSuccess")).toBeTruthy();
    });
    expect(mockTestConnection).toHaveBeenCalledTimes(1);
  });

  it("calls testConnection and shows failed status on error", async () => {
    mockTestConnection.mockRejectedValueOnce(new Error("Network error"));
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.testConnection"));
    await waitFor(() => {
      expect(screen.getByText("astrometry.connectionFailed")).toBeTruthy();
    });
  });

  it("calls testConnection and shows failed status on false result", async () => {
    mockTestConnection.mockResolvedValueOnce(false);
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.testConnection"));
    await waitFor(() => {
      expect(screen.getByText("astrometry.connectionFailed")).toBeTruthy();
    });
  });
});
