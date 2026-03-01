/**
 * LANSendSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LANSendSheet } from "../LANSendSheet";
import type { LANServerInfo } from "../../../lib/backup/lanTransfer";
jest.mock("../../../i18n/useI18n", () => {
  const { mockI18nFactory } = require("../testHelpers");
  return mockI18nFactory();
});

jest.mock("heroui-native", () => {
  const h = require("../testHelpers");
  return {
    ...h.mockDialogFactory(),
    ...h.mockButtonFactory("action-button"),
    ...h.mockSpinnerFactory(),
    ...h.mockUseThemeColorFactory(),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { mockIoniconsFactory } = require("../testHelpers");
  return mockIoniconsFactory();
});

const mockInfo: LANServerInfo = {
  ip: "192.168.1.100",
  port: 18080,
  pin: "1234",
  fileCount: 42,
  estimatedSize: 1024 * 1024 * 50,
  deviceName: "TestDevice",
};

describe("LANSendSheet", () => {
  const onStop = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when visible is false", () => {
    render(
      <LANSendSheet
        visible={false}
        status="idle"
        info={null}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("renders dialog title", () => {
    render(
      <LANSendSheet
        visible
        status="preparing"
        info={null}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("backup.lanSend")).toBeTruthy();
  });

  it("shows spinner when status is preparing", () => {
    render(
      <LANSendSheet
        visible
        status="preparing"
        info={null}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.getByText("backup.lanPreparing")).toBeTruthy();
  });

  it("shows connection info when status is ready", () => {
    render(
      <LANSendSheet
        visible
        status="ready"
        info={mockInfo}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("192.168.1.100:18080")).toBeTruthy();
    expect(screen.getByText("1234")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("50MB")).toBeTruthy();
    expect(screen.getByText("backup.lanSendInstructions")).toBeTruthy();
    expect(screen.getByText("backup.lanWaiting")).toBeTruthy();
  });

  it("shows file count and estimated size labels", () => {
    render(
      <LANSendSheet
        visible
        status="ready"
        info={mockInfo}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("backup.summaryFiles")).toBeTruthy();
    expect(screen.getByText("backup.summaryEstimatedSize")).toBeTruthy();
  });

  it("shows error message when status is error", () => {
    render(
      <LANSendSheet
        visible
        status="error"
        info={null}
        error="Network error occurred"
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("Network error occurred")).toBeTruthy();
    expect(screen.getByTestId("icon-alert-circle")).toBeTruthy();
  });

  it("shows stop server label when status is ready", () => {
    render(
      <LANSendSheet
        visible
        status="ready"
        info={mockInfo}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("backup.lanStopServer")).toBeTruthy();
  });

  it("shows cancel label when status is not ready", () => {
    render(
      <LANSendSheet
        visible
        status="preparing"
        info={null}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("common.cancel")).toBeTruthy();
  });

  it("calls onStop and onClose when action button is pressed", () => {
    render(
      <LANSendSheet
        visible
        status="ready"
        info={mockInfo}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    fireEvent.press(screen.getByTestId("action-button"));
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onStop and onClose when dialog is dismissed", () => {
    render(
      <LANSendSheet
        visible
        status="ready"
        info={mockInfo}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    fireEvent(screen.getByTestId("dialog"), "touchEnd");
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not show connection info when status is not ready", () => {
    render(
      <LANSendSheet
        visible
        status="preparing"
        info={null}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText("192.168.1.100:18080")).toBeNull();
    expect(screen.queryByText("1234")).toBeNull();
    expect(screen.queryByText("backup.lanSendInstructions")).toBeNull();
  });

  it("shows wifi icon in ready state", () => {
    render(
      <LANSendSheet
        visible
        status="ready"
        info={mockInfo}
        error={null}
        onStop={onStop}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("icon-wifi")).toBeTruthy();
  });
});
