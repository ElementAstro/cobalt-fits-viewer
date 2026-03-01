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

const mockConfig = {
  apiKey: "",
  serverUrl: "https://nova.astrometry.net",
  useCustomServer: false,
  maxConcurrent: 3,
  autoSolve: false,
  defaultScaleUnits: "degwidth" as const,
  defaultScaleLower: undefined as number | undefined,
  defaultScaleUpper: undefined as number | undefined,
};

jest.mock("../../../hooks/useAstrometry", () => ({
  useAstrometry: () => ({
    config: mockConfig,
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
  const { View: RNView, Pressable, Text: RNText } = require("react-native");
  return {
    OptionPickerModal: (props: {
      visible: boolean;
      onSelect?: (val: unknown) => void;
      onClose?: () => void;
    }) =>
      props.visible
        ? ReactLocal.createElement(
            RNView,
            { testID: "option-picker-modal" },
            props.onSelect
              ? ReactLocal.createElement(
                  Pressable,
                  { testID: "picker-select", onPress: () => props.onSelect?.("mock-value") },
                  ReactLocal.createElement(RNText, null, "picker-select-btn"),
                )
              : null,
            props.onClose
              ? ReactLocal.createElement(
                  Pressable,
                  { testID: "picker-close", onPress: props.onClose },
                  ReactLocal.createElement(RNText, null, "picker-close-btn"),
                )
              : null,
          )
        : null,
  };
});

const mockAlert = jest.fn();
jest.spyOn(require("react-native").Alert, "alert").mockImplementation(mockAlert);

describe("AstrometrySettings", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConfig.apiKey = "";
    mockConfig.serverUrl = "https://nova.astrometry.net";
    mockConfig.useCustomServer = false;
    mockConfig.maxConcurrent = 3;
    mockConfig.autoSolve = false;
    mockConfig.defaultScaleUnits = "degwidth";
    mockConfig.defaultScaleLower = undefined;
    mockConfig.defaultScaleUpper = undefined;
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

  it("calls saveApiKey and shows alert when API key is entered and saved", async () => {
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    // First input is the API key field
    fireEvent.changeText(inputs[0], "my-secret-key");
    fireEvent.press(screen.getByText("common.save"));
    await waitFor(() => {
      expect(mockSaveApiKey).toHaveBeenCalledWith("my-secret-key");
    });
    expect(mockAlert).toHaveBeenCalledWith("common.success", "astrometry.apiKeySaved");
  });

  it("does not call saveApiKey when input is empty", async () => {
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    fireEvent.changeText(inputs[0], "   ");
    fireEvent.press(screen.getByText("common.save"));
    expect(mockSaveApiKey).not.toHaveBeenCalled();
  });

  it("shows connected text when apiKey is present", () => {
    mockConfig.apiKey = "existing-key";
    render(<AstrometrySettings />);
    expect(screen.getByText(/astrometry.connected/)).toBeTruthy();
  });

  it("shows custom server input when useCustomServer is true", () => {
    mockConfig.useCustomServer = true;
    render(<AstrometrySettings />);
    // Should not show default URL text
    expect(screen.queryByText("https://nova.astrometry.net")).toBeNull();
  });

  it("calls setConfig with serverUrl on server input blur", () => {
    mockConfig.useCustomServer = true;
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    // Find the server input (second input after API key)
    const serverInput = inputs[1];
    fireEvent.changeText(serverInput, "https://custom.server.com");
    fireEvent(serverInput, "blur");
    expect(mockSetConfig).toHaveBeenCalledWith({ serverUrl: "https://custom.server.com" });
  });

  it("calls setConfig for useCustomServer switch toggle", () => {
    render(<AstrometrySettings />);
    const switches = screen.getAllByTestId("switch");
    // First switch is the custom server toggle
    fireEvent(switches[0], "selectedChange", true);
    expect(mockSetConfig).toHaveBeenCalledWith({ useCustomServer: true });
  });

  it("calls setConfig for autoSolve switch toggle", () => {
    render(<AstrometrySettings />);
    const switches = screen.getAllByTestId("switch");
    // Second switch is the autoSolve toggle
    fireEvent(switches[1], "selectedChange", true);
    expect(mockSetConfig).toHaveBeenCalledWith({ autoSolve: true });
  });

  it("calls setConfig with parsed number for scale lower input", () => {
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    // Scale lower is the 2nd input (after API key) when useCustomServer is false
    // Inputs: [apiKey, scaleLower, scaleUpper]
    fireEvent.changeText(inputs[1], "0.5");
    expect(mockSetConfig).toHaveBeenCalledWith({ defaultScaleLower: 0.5 });
  });

  it("calls setConfig with undefined for invalid scale lower input", () => {
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    fireEvent.changeText(inputs[1], "abc");
    expect(mockSetConfig).toHaveBeenCalledWith({ defaultScaleLower: undefined });
  });

  it("calls setConfig with parsed number for scale upper input", () => {
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    fireEvent.changeText(inputs[2], "2.0");
    expect(mockSetConfig).toHaveBeenCalledWith({ defaultScaleUpper: 2.0 });
  });

  it("calls setConfig with undefined for invalid scale upper input", () => {
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    fireEvent.changeText(inputs[2], "");
    expect(mockSetConfig).toHaveBeenCalledWith({ defaultScaleUpper: undefined });
  });

  it("calls setConfig and closes picker when concurrent picker option is selected", () => {
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.maxConcurrent"));
    fireEvent.press(screen.getByText("picker-select-btn"));
    expect(mockSetConfig).toHaveBeenCalledWith({ maxConcurrent: "mock-value" });
  });

  it("closes concurrent picker when close is pressed", () => {
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.maxConcurrent"));
    expect(screen.getByTestId("option-picker-modal")).toBeTruthy();
    fireEvent.press(screen.getByText("picker-close-btn"));
    expect(screen.queryByTestId("option-picker-modal")).toBeNull();
  });

  it("calls setConfig and closes picker when scaleUnits picker option is selected", () => {
    render(<AstrometrySettings />);
    fireEvent.press(screen.getByText("astrometry.scaleUnits"));
    fireEvent.press(screen.getByText("picker-select-btn"));
    expect(mockSetConfig).toHaveBeenCalledWith({ defaultScaleUnits: "mock-value" });
  });

  it("renders scale input values when defined", () => {
    mockConfig.defaultScaleLower = 0.5;
    mockConfig.defaultScaleUpper = 2.0;
    render(<AstrometrySettings />);
    const inputs = screen.getAllByTestId("input");
    expect(inputs[1].props.value).toBe("0.5");
    expect(inputs[2].props.value).toBe("2");
  });
});
