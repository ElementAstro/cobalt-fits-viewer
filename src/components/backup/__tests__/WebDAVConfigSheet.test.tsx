/**
 * WebDAVConfigSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { WebDAVConfigSheet } from "../WebDAVConfigSheet";

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
  type MockTextFieldProps = MockProps & { isRequired?: boolean; isInvalid?: boolean };
  type MockAlertProps = MockProps & { status?: string };

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

  const Button = ({ children, onPress, isDisabled }: MockButtonProps) => (
    <RN.Pressable
      testID="connect-button"
      disabled={isDisabled}
      onPress={onPress}
      accessibilityState={{ disabled: !!isDisabled }}
    >
      {children}
    </RN.Pressable>
  );
  Button.Label = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;

  const Input = ({
    value,
    onChangeText,
    placeholder,
    testID,
    ...rest
  }: {
    value?: string;
    onChangeText?: (t: string) => void;
    placeholder?: string;
    testID?: string;
  } & Record<string, unknown>) => (
    <RN.TextInput
      testID={testID ?? `input-${placeholder}`}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      {...rest}
    />
  );

  const Label = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  const FieldError = ({ children }: MockProps) => (
    <RN.Text testID="field-error">{children}</RN.Text>
  );
  const Spinner = () => <RN.View testID="spinner" />;
  const TextField = ({ children }: MockTextFieldProps) => <RN.View>{children}</RN.View>;

  const Alert = ({ children, status }: MockAlertProps) => (
    <RN.View testID={`alert-${status}`}>{children}</RN.View>
  );
  Alert.Indicator = () => <RN.View />;
  Alert.Content = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Alert.Title = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;

  return { Alert, Button, Dialog, FieldError, Input, Label, Spinner, TextField };
});

describe("WebDAVConfigSheet", () => {
  const onClose = jest.fn();
  let onConnect: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onConnect = jest.fn().mockResolvedValue(true);
  });

  it("does not render when visible is false", () => {
    render(<WebDAVConfigSheet visible={false} onConnect={onConnect} onClose={onClose} />);
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("renders dialog title as WebDAV", () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    expect(screen.getByText("WebDAV")).toBeTruthy();
  });

  it("renders all form fields", () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    expect(screen.getByText("backup.webdavUrl")).toBeTruthy();
    expect(screen.getByText("backup.webdavUsername")).toBeTruthy();
    expect(screen.getByText("backup.webdavPassword")).toBeTruthy();
  });

  it("renders test connection button", () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    expect(screen.getByText("backup.testConnection")).toBeTruthy();
  });

  it("does not call onConnect when url is empty", async () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("does not call onConnect when username is empty", async () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("calls onConnect with correct params when form is filled", async () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");
    fireEvent.changeText(screen.getByTestId("input-backup.webdavPassword"), "secret");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).toHaveBeenCalledWith("https://my.server.com/dav", "admin", "secret");
  });

  it("calls onConnect with empty password when password not provided", async () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).toHaveBeenCalledWith("https://my.server.com/dav", "admin", "");
  });

  it("shows success alert after successful connection", async () => {
    onConnect.mockResolvedValue(true);
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("alert-success")).toBeTruthy();
      expect(screen.getByText("backup.connectionSuccess")).toBeTruthy();
    });
  });

  it("shows danger alert after failed connection", async () => {
    onConnect.mockResolvedValue(false);
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("alert-danger")).toBeTruthy();
      expect(screen.getByText("backup.connectionFailed")).toBeTruthy();
    });
  });

  it("shows danger alert when onConnect throws", async () => {
    onConnect.mockRejectedValue(new Error("Network error"));
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("alert-danger")).toBeTruthy();
    });
  });

  it("resets form fields and calls onClose when dialog is dismissed", () => {
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );

    fireEvent(screen.getByTestId("dialog"), "touchEnd");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("auto-closes after successful connection", async () => {
    jest.useFakeTimers();
    onConnect.mockResolvedValue(true);
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    expect(onClose).toHaveBeenCalled();
    jest.useRealTimers();
  });
});
