/**
 * WebDAVConfigSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react-native";
import { WebDAVConfigSheet } from "../WebDAVConfigSheet";
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

  it("disables connect button while connection test is in progress", async () => {
    let resolveConnect: (value: boolean) => void;
    onConnect.mockImplementation(
      () => new Promise<boolean>((resolve) => (resolveConnect = resolve)),
    );
    render(<WebDAVConfigSheet visible onConnect={onConnect} onClose={onClose} />);

    fireEvent.changeText(
      screen.getByTestId("input-https://cloud.example.com/remote.php/dav/files/user"),
      "https://my.server.com/dav",
    );
    fireEvent.changeText(screen.getByTestId("input-backup.webdavUsername"), "admin");

    // Start connection test (don't await — it's pending)
    act(() => {
      fireEvent.press(screen.getByTestId("connect-button"));
    });

    // Button should be disabled while testing
    expect(screen.getByTestId("connect-button").props.accessibilityState?.disabled).toBe(true);

    // Resolve and cleanup
    await act(async () => {
      resolveConnect!(true);
    });
  });
});
