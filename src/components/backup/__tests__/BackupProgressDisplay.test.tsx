/**
 * BackupProgressDisplay 组件测试
 */

import React from "react";
import { render, screen } from "@testing-library/react-native";
import { BackupProgressDisplay } from "../BackupProgressDisplay";
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
    ...h.mockSurfaceFactory(),
  };
});

jest.mock("../BackupProgressSheet", () => ({
  formatEta: (seconds: number) => `${Math.ceil(seconds)}s`,
}));

describe("BackupProgressDisplay", () => {
  it("renders nothing when total is 0", () => {
    const progress: BackupProgress = { phase: "preparing", current: 0, total: 0 };
    const { toJSON } = render(<BackupProgressDisplay progress={progress} />);
    expect(toJSON()).toBeNull();
  });

  it("renders progress bar with correct percentage text", () => {
    const progress: BackupProgress = { phase: "uploading", current: 3, total: 10 };
    render(<BackupProgressDisplay progress={progress} />);
    expect(screen.getByText(/3 \/ 10/)).toBeTruthy();
    expect(screen.getByText(/30%/)).toBeTruthy();
    expect(screen.getByTestId("surface")).toBeTruthy();
  });

  it("shows byte progress when bytesTransferred and bytesTotal are provided", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 2,
      total: 5,
      bytesTransferred: 1024,
      bytesTotal: 5120,
    };
    render(<BackupProgressDisplay progress={progress} />);
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
    render(<BackupProgressDisplay progress={progress} />);
    expect(screen.getByText("image_001.fits")).toBeTruthy();
  });

  it("does not show current file name when not provided", () => {
    const progress: BackupProgress = { phase: "uploading", current: 1, total: 3 };
    render(<BackupProgressDisplay progress={progress} />);
    expect(screen.queryByText(/\.fits/)).toBeNull();
  });

  it("shows speed when showSpeed is true and elapsedMs is sufficient", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 2,
      total: 5,
      bytesTransferred: 5000,
      bytesTotal: 10000,
    };
    render(<BackupProgressDisplay progress={progress} showSpeed elapsedMs={2000} />);
    // speed = Math.round(5000 / 2000 * 1000) = 2500 → "2500B/s"
    expect(screen.getByText(/2500B\/s/)).toBeTruthy();
  });

  it("does not show speed when showSpeed is false", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 2,
      total: 5,
      bytesTransferred: 5000,
      bytesTotal: 10000,
    };
    render(<BackupProgressDisplay progress={progress} elapsedMs={2000} />);
    expect(screen.queryByText(/\/s/)).toBeNull();
  });

  it("does not show speed when elapsedMs is too small", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 2,
      total: 5,
      bytesTransferred: 5000,
      bytesTotal: 10000,
    };
    render(<BackupProgressDisplay progress={progress} showSpeed elapsedMs={500} />);
    expect(screen.queryByText(/\/s/)).toBeNull();
  });

  it("uses bytePercentage when byte data is available", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 1,
      total: 10,
      bytesTransferred: 900,
      bytesTotal: 1000,
    };
    render(<BackupProgressDisplay progress={progress} />);
    // bytePercentage = Math.round(900/1000*100) = 90
    expect(screen.getByText(/90%/)).toBeTruthy();
  });

  it("shows ETA when speed > 0 and byte data available", () => {
    const progress: BackupProgress = {
      phase: "uploading",
      current: 2,
      total: 5,
      bytesTransferred: 5000,
      bytesTotal: 10000,
    };
    // speed = Math.round(5000/2000*1000) = 2500, eta = (10000-5000)/2500 = 2
    render(<BackupProgressDisplay progress={progress} showSpeed elapsedMs={2000} />);
    expect(screen.getByText(/backup.eta/)).toBeTruthy();
    expect(screen.getByText(/2s/)).toBeTruthy();
  });

  it("renders nothing when total is negative", () => {
    const progress: BackupProgress = { phase: "preparing", current: 0, total: -1 };
    const { toJSON } = render(<BackupProgressDisplay progress={progress} />);
    expect(toJSON()).toBeNull();
  });
});
