/**
 * BackupProgressSheet 组件测试
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { BackupProgressSheet } from "../BackupProgressSheet";
import type { BackupProgress } from "../../../lib/backup/types";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

jest.mock("../../../lib/utils/fileManager", () => ({
  formatFileSize: (bytes: number) => `${bytes}B`,
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

  const Dialog = ({ isOpen, children }: MockDialogProps) =>
    isOpen ? <RN.View testID="dialog">{children}</RN.View> : null;
  Dialog.Portal = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Dialog.Overlay = () => <RN.View />;
  Dialog.Content = ({ children }: MockProps) => <RN.View>{children}</RN.View>;
  Dialog.Title = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  Dialog.Description = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;
  Dialog.Close = () => <RN.Pressable testID="dialog-close" />;

  const Button = ({ children, onPress, isDisabled }: MockButtonProps) => (
    <RN.Pressable testID="button" disabled={isDisabled} onPress={onPress}>
      {children}
    </RN.Pressable>
  );
  Button.Label = ({ children }: MockProps) => <RN.Text>{children}</RN.Text>;

  const Spinner = () => <RN.View testID="spinner" />;

  const Surface = ({ children }: MockProps) => <RN.View testID="surface">{children}</RN.View>;

  return { Button, Dialog, Spinner, Surface };
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
});
