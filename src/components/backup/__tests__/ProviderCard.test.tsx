/**
 * ProviderCard 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProviderCard } from "../ProviderCard";
import type { ProviderConnectionState, BackupInfo } from "../../../lib/backup/types";
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
    ...h.mockCardFactory(),
    ...h.mockButtonFactory(),
    ...h.mockChipFactory(),
    ...h.mockUseThemeColorFactory(),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { mockIoniconsFactory } = require("../testHelpers");
  return mockIoniconsFactory();
});

const baseConnection: ProviderConnectionState = {
  provider: "webdav",
  connected: true,
  userName: "user@example.com",
  lastBackupDate: Date.now(),
};

const noop = jest.fn();

describe("ProviderCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders provider name and user", () => {
    render(
      <ProviderCard
        connection={baseConnection}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.getByText("WebDAV")).toBeTruthy();
    expect(screen.getByText("user@example.com")).toBeTruthy();
  });

  it("shows connected chip when connected", () => {
    render(
      <ProviderCard
        connection={baseConnection}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.getByText("backup.connected")).toBeTruthy();
  });

  it("shows disconnected chip when not connected", () => {
    render(
      <ProviderCard
        connection={{ ...baseConnection, connected: false }}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.getByText("backup.disconnected")).toBeTruthy();
  });

  it("displays backup info when provided", () => {
    const backupInfo: BackupInfo = {
      provider: "webdav",
      manifestDate: new Date().toISOString(),
      fileCount: 42,
      totalSize: 1024 * 1024 * 10,
      deviceName: "TestDevice",
      appVersion: "1.0.0",
    };

    render(
      <ProviderCard
        connection={baseConnection}
        backupInfo={backupInfo}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.getByText("backup.remoteFiles")).toBeTruthy();
    expect(screen.getByText("42")).toBeTruthy();
    expect(screen.getByText("backup.remoteSize")).toBeTruthy();
  });

  it("does not display backup info section when backupInfo is null", () => {
    render(
      <ProviderCard
        connection={baseConnection}
        backupInfo={null}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.queryByText("backup.remoteFiles")).toBeNull();
  });

  it("calls onBackup when backup button is pressed", () => {
    const onBackup = jest.fn();
    render(
      <ProviderCard
        connection={baseConnection}
        onBackup={onBackup}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    fireEvent.press(screen.getByText("backup.backupNow"));
    expect(onBackup).toHaveBeenCalledTimes(1);
  });

  it("calls onRestore when restore button is pressed", () => {
    const onRestore = jest.fn();
    render(
      <ProviderCard
        connection={baseConnection}
        onBackup={noop}
        onRestore={onRestore}
        onDisconnect={noop}
      />,
    );
    fireEvent.press(screen.getByText("backup.restoreNow"));
    expect(onRestore).toHaveBeenCalledTimes(1);
  });

  it("shows active provider chip when isActive", () => {
    render(
      <ProviderCard
        connection={baseConnection}
        isActive={true}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.getByText("backup.activeProvider")).toBeTruthy();
  });

  it("calls onDisconnect when disconnect button is pressed", () => {
    const onDisconnect = jest.fn();
    render(
      <ProviderCard
        connection={baseConnection}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={onDisconnect}
      />,
    );
    // The disconnect button is the last button (icon-only)
    const buttons = screen.getAllByTestId("button");
    fireEvent.press(buttons[buttons.length - 1]);
    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("disables backup/restore buttons when disabled prop is true", () => {
    render(
      <ProviderCard
        connection={baseConnection}
        disabled
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    const buttons = screen.getAllByTestId("button");
    // First two buttons are backup and restore
    expect(buttons[0].props.accessibilityState?.disabled).toBe(true);
    expect(buttons[1].props.accessibilityState?.disabled).toBe(true);
  });

  it("disables backup/restore buttons when not connected", () => {
    render(
      <ProviderCard
        connection={{ ...baseConnection, connected: false }}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    const buttons = screen.getAllByTestId("button");
    expect(buttons[0].props.accessibilityState?.disabled).toBe(true);
    expect(buttons[1].props.accessibilityState?.disabled).toBe(true);
  });

  it("displays quota information when quotaUsed and quotaTotal are provided", () => {
    const connWithQuota: ProviderConnectionState = {
      ...baseConnection,
      quotaUsed: 1024 * 1024 * 500,
      quotaTotal: 1024 * 1024 * 1024,
    };
    render(
      <ProviderCard
        connection={connWithQuota}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.getByText("backup.storageUsed")).toBeTruthy();
  });

  it("shows 'never' for last backup when no lastBackupDate", () => {
    const connNoDate: ProviderConnectionState = {
      ...baseConnection,
      lastBackupDate: undefined,
    };
    render(
      <ProviderCard connection={connNoDate} onBackup={noop} onRestore={noop} onDisconnect={noop} />,
    );
    expect(screen.getByText("backup.never")).toBeTruthy();
  });

  it("does not render userName when undefined", () => {
    const connNoUser: ProviderConnectionState = {
      ...baseConnection,
      userName: undefined,
    };
    render(
      <ProviderCard connection={connNoUser} onBackup={noop} onRestore={noop} onDisconnect={noop} />,
    );
    expect(screen.queryByText("user@example.com")).toBeNull();
  });

  it("does not show active provider chip when isActive is false", () => {
    render(
      <ProviderCard
        connection={baseConnection}
        isActive={false}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.queryByText("backup.activeProvider")).toBeNull();
  });

  it("does not show quota when quotaUsed/quotaTotal are undefined", () => {
    render(
      <ProviderCard
        connection={baseConnection}
        onBackup={noop}
        onRestore={noop}
        onDisconnect={noop}
      />,
    );
    expect(screen.queryByText("backup.storageUsed")).toBeNull();
  });
});
