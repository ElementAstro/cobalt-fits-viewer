/**
 * AddProviderSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { AddProviderSheet } from "../AddProviderSheet";
import type { CloudProvider } from "../../../lib/backup/types";
jest.mock("../../../i18n/useI18n", () => {
  const { mockI18nFactory } = require("../testHelpers");
  return mockI18nFactory();
});

jest.mock("heroui-native", () => {
  const h = require("../testHelpers");
  return {
    ...h.mockBottomSheetFactory(),
    ...h.mockPressableFeedbackFactory(),
    ...h.mockSeparatorFactory(),
    ...h.mockUseThemeColorFactory(),
  };
});

jest.mock("@expo/vector-icons", () => {
  const { mockIoniconsFactory } = require("../testHelpers");
  return mockIoniconsFactory();
});

describe("AddProviderSheet", () => {
  const onSelect = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when visible is false", () => {
    render(
      <AddProviderSheet
        visible={false}
        existingProviders={[]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(screen.queryByTestId("bottom-sheet")).toBeNull();
  });

  it("renders all 5 providers when none are connected", () => {
    render(
      <AddProviderSheet visible existingProviders={[]} onSelect={onSelect} onClose={onClose} />,
    );
    expect(screen.getByText("Google Drive")).toBeTruthy();
    expect(screen.getByText("OneDrive")).toBeTruthy();
    expect(screen.getByText("Dropbox")).toBeTruthy();
    expect(screen.getByText("WebDAV")).toBeTruthy();
    expect(screen.getByText("SFTP")).toBeTruthy();
  });

  it("filters out already connected providers", () => {
    const existing: CloudProvider[] = ["google-drive", "webdav"];
    render(
      <AddProviderSheet
        visible
        existingProviders={existing}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    expect(screen.queryByText("Google Drive")).toBeNull();
    expect(screen.queryByText("WebDAV")).toBeNull();
    expect(screen.getByText("OneDrive")).toBeTruthy();
    expect(screen.getByText("Dropbox")).toBeTruthy();
    expect(screen.getByText("SFTP")).toBeTruthy();
  });

  it("shows allProvidersConnected message when all are connected", () => {
    const all: CloudProvider[] = ["google-drive", "onedrive", "dropbox", "webdav", "sftp"];
    render(
      <AddProviderSheet visible existingProviders={all} onSelect={onSelect} onClose={onClose} />,
    );
    expect(screen.getByText("backup.allProvidersConnected")).toBeTruthy();
  });

  it("calls onSelect with correct provider when pressed", () => {
    render(
      <AddProviderSheet
        visible
        existingProviders={["google-drive", "onedrive", "dropbox"]}
        onSelect={onSelect}
        onClose={onClose}
      />,
    );
    fireEvent.press(screen.getByText("WebDAV"));
    expect(onSelect).toHaveBeenCalledWith("webdav");
  });

  it("calls onClose when bottom sheet closes", () => {
    render(
      <AddProviderSheet visible existingProviders={[]} onSelect={onSelect} onClose={onClose} />,
    );
    fireEvent(screen.getByTestId("bottom-sheet"), "touchEnd");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders sheet title", () => {
    render(
      <AddProviderSheet visible existingProviders={[]} onSelect={onSelect} onClose={onClose} />,
    );
    expect(screen.getByText("backup.addProvider")).toBeTruthy();
  });

  it("renders separator between provider items", () => {
    render(
      <AddProviderSheet visible existingProviders={[]} onSelect={onSelect} onClose={onClose} />,
    );
    // 5 providers → 4 separators
    expect(screen.getAllByTestId("separator")).toHaveLength(4);
  });
});
