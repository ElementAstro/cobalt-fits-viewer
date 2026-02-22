/**
 * ProviderCard 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ProviderCard } from "../ProviderCard";
import type { ProviderConnectionState, BackupInfo } from "../../../lib/backup/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: "en",
    setLocale: jest.fn(),
  }),
}));

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
});
