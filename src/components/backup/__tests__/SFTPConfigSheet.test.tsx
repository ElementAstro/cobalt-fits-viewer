/**
 * SFTPConfigSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { SFTPConfigSheet } from "../SFTPConfigSheet";
jest.mock("../../../i18n/useI18n", () => {
  const { mockI18nFactory } = require("../testHelpers");
  return mockI18nFactory();
});

jest.mock("heroui-native", () => {
  const h = require("../testHelpers");
  return {
    ...h.mockDialogFactory(),
    ...h.mockButtonFactory("connect-button"),
    ...h.mockInputFactory(),
    ...h.mockLabelFactory(),
    ...h.mockFieldErrorFactory(),
    ...h.mockSpinnerFactory(),
    ...h.mockTextFieldFactory(),
    ...h.mockAlertFactory(),
  };
});

describe("SFTPConfigSheet", () => {
  const onClose = jest.fn();
  let onConnect: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    onConnect = jest.fn().mockResolvedValue(true);
  });

  it("does not render when visible is false", () => {
    render(<SFTPConfigSheet visible={false} onConnect={onConnect} onClose={onClose} />);
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("renders dialog title as SFTP", () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    expect(screen.getByText("SFTP")).toBeTruthy();
  });

  it("renders all form fields", () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    expect(screen.getByText("backup.sftpHost")).toBeTruthy();
    expect(screen.getByText("backup.sftpPort")).toBeTruthy();
    expect(screen.getByText("backup.sftpUsername")).toBeTruthy();
    expect(screen.getByText("backup.sftpPassword")).toBeTruthy();
    expect(screen.getByText("backup.sftpRemotePath")).toBeTruthy();
  });

  it("renders test connection button", () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    expect(screen.getByText("backup.testConnection")).toBeTruthy();
  });

  it("does not call onConnect when host is empty", async () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    // Only fill username, not host
    fireEvent.changeText(screen.getByTestId("input-backup.sftpUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("does not call onConnect when username is empty", async () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);
    // Only fill host, not username
    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("calls onConnect with correct params when form is filled", async () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.sftpUsername"), "admin");
    fireEvent.changeText(screen.getByTestId("input-backup.sftpPassword"), "secret");
    fireEvent.changeText(screen.getByTestId("input-/"), "/backup/data");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).toHaveBeenCalledWith("myhost.com", 22, "admin", "secret", "/backup/data");
  });

  it("calls onConnect with custom port", async () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );
    fireEvent.changeText(screen.getByTestId("input-22"), "2222");
    fireEvent.changeText(screen.getByTestId("input-backup.sftpUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    expect(onConnect).toHaveBeenCalledWith("myhost.com", 2222, "admin", "", "/");
  });

  it("shows success alert after successful connection", async () => {
    onConnect.mockResolvedValue(true);
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.sftpUsername"), "admin");

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
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.sftpUsername"), "admin");

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
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.sftpUsername"), "admin");

    await act(async () => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("alert-danger")).toBeTruthy();
    });
  });

  it("resets form fields and calls onClose when dialog is dismissed", () => {
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );

    fireEvent(screen.getByTestId("dialog"), "touchEnd");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("auto-closes after successful connection", async () => {
    jest.useFakeTimers();
    onConnect.mockResolvedValue(true);
    render(<SFTPConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-192.168.1.100 or nas.example.com"),
      "myhost.com",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.sftpUsername"), "admin");

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
