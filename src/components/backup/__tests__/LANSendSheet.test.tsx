/**
 * LANSendSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { LANSendSheet } from "../LANSendSheet";
import type { LANServerInfo } from "../../../lib/backup/lanTransfer";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("heroui-native", () => {
  const RN = require("react-native");
  type MockProps = { children?: React.ReactNode } & Record<string, unknown>;
  type MockDialogProps = MockProps & {
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  };
  type MockButtonProps = MockProps & {
    onPress?: () => void;
    isDisabled?: boolean;
  };

  const Dialog = ({ isOpen, children, onOpenChange }: MockDialogProps) =>
    isOpen ? (
      <RN.View testID="dialog" onTouchEnd={() => onOpenChange?.(false)}>
        {children}
      </RN.View>
    ) : null;
  Dialog.Portal = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Dialog.Overlay = () => <RN.View />;
  Dialog.Content = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Dialog.Title = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  Dialog.Close = () => <RN.Pressable testID="dialog-close" />;

  const Button = ({ children, onPress }: MockButtonProps) => (
    <RN.Pressable testID="action-button" onPress={onPress}>
      {children}
    </RN.Pressable>
  );
  Button.Label = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;

  const Spinner = () => <RN.View testID="spinner" />;

  return { Button, Dialog, Spinner };
});

jest.mock("@expo/vector-icons", () => {
  const RN = require("react-native");
  return {
    Ionicons: ({ name, ...props }: Record<string, unknown>) => (
      <RN.Text testID={`icon-${name}`} {...props} />
    ),
  };
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
});
