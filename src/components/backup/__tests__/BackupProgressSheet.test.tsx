/**
 * BackupProgressSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BackupProgressSheet, formatEta } from "../BackupProgressSheet";
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
    ...h.mockSpinnerFactory(),
    ...h.mockSurfaceFactory(),
  };
});

const idleProgress: BackupProgress = {
  phase: "idle",
  current: 0,
  total: 0,
};

describe("BackupProgressSheet", () => {
  const onCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not render when visible is false", () => {
    render(
      <BackupProgressSheet visible={false} isBackup progress={idleProgress} onCancel={onCancel} />,
    );
    expect(screen.queryByTestId("dialog")).toBeNull();
  });

  it("renders spinner when visible", () => {
    render(<BackupProgressSheet visible isBackup progress={idleProgress} onCancel={onCancel} />);
    expect(screen.getByTestId("spinner")).toBeTruthy();
  });

  it("shows backup phase text when isBackup and preparing", () => {
    const progress: BackupProgress = { phase: "preparing", current: 0, total: 0 };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.getByText("backup.backupInProgress")).toBeTruthy();
  });

  it("shows restore phase text when not isBackup and preparing", () => {
    const progress: BackupProgress = { phase: "preparing", current: 0, total: 0 };
    render(
      <BackupProgressSheet visible isBackup={false} progress={progress} onCancel={onCancel} />,
    );
    expect(screen.getByText("backup.restoreInProgress")).toBeTruthy();
  });

  it("shows uploading phase text", () => {
    const progress: BackupProgress = { phase: "uploading", current: 1, total: 5 };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.getByText("backup.backupInProgress")).toBeTruthy();
  });

  it("shows downloading phase text", () => {
    const progress: BackupProgress = { phase: "downloading", current: 2, total: 10 };
    render(
      <BackupProgressSheet visible isBackup={false} progress={progress} onCancel={onCancel} />,
    );
    expect(screen.getByText("backup.restoreInProgress")).toBeTruthy();
  });

  it("shows finalizing phase text", () => {
    const progress: BackupProgress = { phase: "finalizing", current: 5, total: 5 };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.getByText("backup.backupInProgress")).toBeTruthy();
  });

  it("shows progress bar and file count when total > 0", () => {
    const progress: BackupProgress = { phase: "uploading", current: 3, total: 10 };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.getByText(/3 \/ 10/)).toBeTruthy();
    expect(screen.getByTestId("surface")).toBeTruthy();
  });

  it("does not show progress bar when total is 0", () => {
    const progress: BackupProgress = { phase: "preparing", current: 0, total: 0 };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.queryByTestId("surface")).toBeNull();
  });

  it("shows byte progress when bytesTransferred and bytesTotal are provided", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 2,
      total: 5,
      bytesTransferred: 1024,
      bytesTotal: 5120,
    };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.getByText(/1024B/)).toBeTruthy();
    expect(screen.getByText(/5120B/)).toBeTruthy();
  });

  it("shows current file name when provided", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 1,
      total: 3,
      currentFile: "image_001.fits",
    };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.getByText("image_001.fits")).toBeTruthy();
  });

  it("calls onCancel when cancel button is pressed", () => {
    render(<BackupProgressSheet visible isBackup progress={idleProgress} onCancel={onCancel} />);
    fireEvent.press(screen.getByTestId("button"));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows cancel button label", () => {
    render(<BackupProgressSheet visible isBackup progress={idleProgress} onCancel={onCancel} />);
    expect(screen.getByText("common.cancel")).toBeTruthy();
  });

  it("shows empty string for idle phase", () => {
    render(<BackupProgressSheet visible isBackup progress={idleProgress} onCancel={onCancel} />);
    expect(screen.queryByText("backup.backupInProgress")).toBeNull();
    expect(screen.queryByText("backup.restoreInProgress")).toBeNull();
  });

  it("renders correctly with all progress fields populated", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 2,
      total: 5,
      bytesTransferred: 2048,
      bytesTotal: 10240,
      currentFile: "test_image.fits",
    };
    render(<BackupProgressSheet visible isBackup progress={progress} onCancel={onCancel} />);
    expect(screen.getByText(/2 \/ 5/)).toBeTruthy();
    expect(screen.getByText(/2048B/)).toBeTruthy();
    expect(screen.getByText(/10240B/)).toBeTruthy();
    expect(screen.getByText("test_image.fits")).toBeTruthy();
  });
});

describe("formatEta", () => {
  it("formats seconds < 60 correctly", () => {
    expect(formatEta(0)).toBe("0s");
    expect(formatEta(1)).toBe("1s");
    expect(formatEta(30)).toBe("30s");
    expect(formatEta(59.5)).toBe("60s");
  });

  it("formats minutes correctly", () => {
    expect(formatEta(60)).toBe("1m 0s");
    expect(formatEta(90)).toBe("1m 30s");
    expect(formatEta(150)).toBe("2m 30s");
    expect(formatEta(3599)).toBe("59m 59s");
  });

  it("formats hours correctly", () => {
    expect(formatEta(3600)).toBe("1h 0m");
    expect(formatEta(3660)).toBe("1h 1m");
    expect(formatEta(7200)).toBe("2h 0m");
    expect(formatEta(86400)).toBe("24h 0m");
  });

  it("handles edge cases", () => {
    expect(formatEta(0.1)).toBe("1s");
    expect(formatEta(0.001)).toBe("1s");
  });
});
