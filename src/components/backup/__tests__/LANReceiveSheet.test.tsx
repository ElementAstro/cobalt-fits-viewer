/**
 * LANReceiveSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LANReceiveSheet } from "../LANReceiveSheet";
import type { BackupProgress } from "../../../lib/backup/types";
jest.mock("../../../i18n/useI18n", () => {
  const { mockI18nFactory } = require("../testHelpers");
  return mockI18nFactory();
});

jest.mock("../../../lib/utils/fileManager", () => {
  const { mockFormatFileSizeFactory } = require("../testHelpers");
  return mockFormatFileSizeFactory();
});

jest.mock("heroui-native", () => {
  const h = require("../testHelpers");
  return {
    ...h.mockDialogFactory(),
    ...h.mockButtonFactory(),
    ...h.mockInputFactory(),
    ...h.mockLabelFactory(),
    ...h.mockSpinnerFactory(),
    ...h.mockSurfaceFactory(),
    ...h.mockTextFieldFactory(),
    ...h.mockUseThemeColorFactory(),
    ...h.mockFieldErrorFactory(),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { mockIoniconsFactory } = require("../testHelpers");
  return mockIoniconsFactory();
});

jest.mock("../../../lib/backup/lanTransfer", () => ({
  LAN_PORT_BASE: 18080,
}));

const idleProgress: BackupProgress = { phase: "idle", current: 0, total: 0 };

describe("LANReceiveSheet", () => {
  const onConnect = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when visible is false", () => {
    render(
      <LANReceiveSheet
        visible={false}
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("renders dialog title", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("backup.lanReceive")).toBeTruthy();
  });

  it("shows input form when status is idle", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("backup.lanReceiveInstructions")).toBeTruthy();
    expect(screen.getByText("backup.lanHost")).toBeTruthy();
    expect(screen.getByText("PIN")).toBeTruthy();
    expect(screen.getByText("backup.lanStartReceive")).toBeTruthy();
  });

  it("calls onConnect with host, default port and pin when connect is pressed", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "10.0.0.1");
    fireEvent.changeText(screen.getByTestId("input-1234"), "5678");

    // Press connect button (the one with lanStartReceive text)
    const buttons = screen.getAllByTestId("button");
    // The first button is the connect button (has lanStartReceive text)
    fireEvent.press(buttons[0]);

    expect(onConnect).toHaveBeenCalledWith("10.0.0.1", 18080, "5678");
  });

  it("calls onConnect with custom port when port is specified", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "10.0.0.1");
    fireEvent.changeText(screen.getByTestId("input-18080"), "9090");
    fireEvent.changeText(screen.getByTestId("input-1234"), "5678");

    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);

    expect(onConnect).toHaveBeenCalledWith("10.0.0.1", 9090, "5678");
  });

  it("does not call onConnect when host is empty", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-1234"), "5678");

    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("does not call onConnect when pin is empty", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "10.0.0.1");

    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("shows spinner and connecting text when status is connecting", () => {
    render(
      <LANReceiveSheet
        visible
        status="connecting"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("spinner")).toBeTruthy();
    expect(screen.getByText("backup.lanConnecting")).toBeTruthy();
  });

  it("shows downloading text when status is downloading", () => {
    render(
      <LANReceiveSheet
        visible
        status="downloading"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("backup.lanDownloading")).toBeTruthy();
  });

  it("shows importing text when status is importing", () => {
    render(
      <LANReceiveSheet
        visible
        status="importing"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("backup.lanImporting")).toBeTruthy();
  });

  it("shows progress bar and counts when downloading with total > 0", () => {
    const progress: BackupProgress = {
      phase: "downloading",
      current: 3,
      total: 10,
      bytesTransferred: 2048,
      bytesTotal: 10240,
    };
    render(
      <LANReceiveSheet
        visible
        status="downloading"
        progress={progress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("surface")).toBeTruthy();
    expect(screen.getByText(/3 \/ 10/)).toBeTruthy();
    expect(screen.getByText(/2048B/)).toBeTruthy();
    expect(screen.getByText(/10240B/)).toBeTruthy();
  });

  it("shows success state when status is done", () => {
    render(
      <LANReceiveSheet
        visible
        status="done"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("icon-checkmark-circle")).toBeTruthy();
    expect(screen.getByText("backup.lanReceiveComplete")).toBeTruthy();
  });

  it("shows error state with error message", () => {
    render(
      <LANReceiveSheet
        visible
        status="error"
        progress={idleProgress}
        error="Connection refused"
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByTestId("icon-alert-circle")).toBeTruthy();
    expect(screen.getByText("Connection refused")).toBeTruthy();
  });

  it("shows close button in error state", () => {
    render(
      <LANReceiveSheet
        visible
        status="error"
        progress={idleProgress}
        error="Fail"
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("common.close")).toBeTruthy();
  });

  it("calls onClose and resets fields when close button is pressed in idle state", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    // Fill in some data first
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "10.0.0.1");

    // Press the close button (the last button in idle state)
    const buttons = screen.getAllByTestId("button");
    const closeButton = buttons[buttons.length - 1];
    fireEvent.press(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when dialog is dismissed via overlay", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent(screen.getByTestId("dialog"), "touchEnd");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables connect button when host is empty", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-1234"), "5678");
    const buttons = screen.getAllByTestId("button");
    expect(buttons[0].props.accessibilityState?.disabled).toBe(true);
  });

  it("disables connect button when pin is empty", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "10.0.0.1");
    const buttons = screen.getAllByTestId("button");
    expect(buttons[0].props.accessibilityState?.disabled).toBe(true);
  });

  it("shows validation error when pin is not 4 digits", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "10.0.0.1");
    fireEvent.changeText(screen.getByTestId("input-1234"), "abc");
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);
    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByText("backup.lanPinInvalid")).toBeTruthy();
  });

  it("shows validation error when port is out of range", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "10.0.0.1");
    fireEvent.changeText(screen.getByTestId("input-18080"), "99999");
    fireEvent.changeText(screen.getByTestId("input-1234"), "5678");
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);
    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByText("backup.lanPortInvalid")).toBeTruthy();
  });

  it("allows valid IP address and connects successfully", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "192.168.1.50");
    fireEvent.changeText(screen.getByTestId("input-1234"), "1234");
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);
    expect(onConnect).toHaveBeenCalledWith("192.168.1.50", 18080, "1234");
  });

  it("allows valid hostname and connects successfully", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "my-nas.local");
    fireEvent.changeText(screen.getByTestId("input-1234"), "9999");
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);
    expect(onConnect).toHaveBeenCalledWith("my-nas.local", 18080, "9999");
  });

  it("calls onClose when close button is pressed in error state", () => {
    render(
      <LANReceiveSheet
        visible
        status="error"
        progress={idleProgress}
        error="Something went wrong"
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.press(screen.getByText("common.close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows validation error for invalid host format", () => {
    render(
      <LANReceiveSheet
        visible
        status="idle"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    fireEvent.changeText(screen.getByTestId("input-192.168.1.100"), "bad host!");
    fireEvent.changeText(screen.getByTestId("input-1234"), "1234");
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[0]);
    expect(onConnect).not.toHaveBeenCalled();
    expect(screen.getByText("backup.lanHostInvalid")).toBeTruthy();
  });

  it("shows close button in done state", () => {
    render(
      <LANReceiveSheet
        visible
        status="done"
        progress={idleProgress}
        error={null}
        onConnect={onConnect}
        onClose={onClose}
      />,
    );
    expect(screen.getByText("common.close")).toBeTruthy();
  });
});
