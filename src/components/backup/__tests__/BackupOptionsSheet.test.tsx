import { fireEvent, render, screen } from "@testing-library/react-native";
import { BackupOptionsSheet } from "../BackupOptionsSheet";
jest.mock("../../../i18n/useI18n", () => {
  const { mockI18nFactory } = require("../testHelpers");
  return mockI18nFactory({
    "backup.selectBackupOptions": "Backup Options",
    "backup.selectRestoreOptions": "Restore Options",
    "backup.selectBackupOptionsDesc": "Choose backup items",
    "backup.selectRestoreOptionsDesc": "Choose restore items",
    "backup.optionFiles": "Files",
    "backup.optionAlbums": "Albums",
    "backup.optionTargets": "Targets",
    "backup.optionSessions": "Sessions",
    "backup.optionSettings": "Settings",
    "backup.startBackup": "Start Backup",
    "backup.startRestore": "Start Restore",
    "backup.optionSelectAtLeastOne": "Select at least one item",
    "backup.conflictTitle": "Conflict Strategy",
    "backup.conflictSkip": "Skip Existing",
    "backup.conflictOverwrite": "Overwrite Existing",
    "backup.conflictMerge": "Merge",
  });
});

jest.mock("heroui-native", () => {
  const h = require("../testHelpers");
  return {
    ...h.mockBottomSheetFactory(),
    ...h.mockButtonFactory(),
    ...h.mockChipFactory(),
    ...h.mockSwitchFactory(),
  };
});

describe("BackupOptionsSheet", () => {
  const onConfirm = jest.fn();
  const onClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses local-export defaults and excludes file metadata by default", () => {
    render(
      <BackupOptionsSheet visible mode="local-export" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.press(screen.getByTestId("backup-options-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toMatchObject({
      includeFiles: true,
      includeAlbums: true,
      includeTargets: true,
      includeSessions: true,
      includeSettings: true,
      localPayloadMode: "full",
      localEncryption: { enabled: false },
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows conflict strategy chips in restore mode and submits selected strategy", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-restore" onConfirm={onConfirm} onClose={onClose} />,
    );

    expect(screen.getByText("Conflict Strategy")).toBeTruthy();
    fireEvent.press(screen.getByTestId("backup-conflict-merge"));
    fireEvent.press(screen.getByTestId("backup-options-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].restoreConflictStrategy).toBe("merge");
  });

  it("prevents submit when all options are disabled", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-backup" onConfirm={onConfirm} onClose={onClose} />,
    );

    const keys = [
      "includeFiles",
      "includeAlbums",
      "includeTargets",
      "includeSessions",
      "includeSettings",
    ];
    for (const key of keys) {
      fireEvent.press(screen.getByTestId(`backup-option-${key}`));
    }

    expect(screen.getByText("Select at least one item")).toBeTruthy();
    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("resets options when sheet is closed and reopened", () => {
    const { rerender } = render(
      <BackupOptionsSheet visible mode="local-export" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.press(screen.getByTestId("backup-option-includeFiles"));

    rerender(
      <BackupOptionsSheet
        visible={false}
        mode="local-export"
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );
    rerender(
      <BackupOptionsSheet visible mode="local-export" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].includeFiles).toBe(true);
  });

  it("requires password when local export encryption is enabled", () => {
    render(
      <BackupOptionsSheet visible mode="local-export" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.press(screen.getByTestId("backup-option-local-encryption"));
    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByTestId("backup-option-password"), "pass-123");
    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].localEncryption).toEqual({
      enabled: true,
      password: "pass-123",
    });
  });

  it("shows local payload mode selector in local-export mode", () => {
    render(
      <BackupOptionsSheet visible mode="local-export" onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.getByTestId("backup-payload-full")).toBeTruthy();
    expect(screen.getByTestId("backup-payload-metadata")).toBeTruthy();
  });

  it("does not show conflict strategy in backup modes", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-backup" onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.queryByText("Conflict Strategy")).toBeNull();
  });

  it("shows thumbnails switch independently of data options", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-backup" onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.getByTestId("backup-option-includeThumbnails")).toBeTruthy();
  });

  it("shows correct title and description for restore mode", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-restore" onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.getByText("Restore Options")).toBeTruthy();
    expect(screen.getByText("Choose restore items")).toBeTruthy();
    expect(screen.getByText("Start Restore")).toBeTruthy();
  });

  it("shows correct title and description for backup mode", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-backup" onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.getByText("Backup Options")).toBeTruthy();
    expect(screen.getByText("Choose backup items")).toBeTruthy();
    expect(screen.getByText("Start Backup")).toBeTruthy();
  });

  it("shows conflict strategy chips in local-import mode", () => {
    render(
      <BackupOptionsSheet visible mode="local-import" onConfirm={onConfirm} onClose={onClose} />,
    );
    expect(screen.getByText("Conflict Strategy")).toBeTruthy();
    expect(screen.getByText("Start Restore")).toBeTruthy();
  });

  it("requires password for local-import with encrypted preview", () => {
    const encryptedPreview = {
      fileName: "backup.zip",
      sourceUri: "file:///backup.zip",
      sourceType: "encrypted-package",
      encrypted: true,
      summary: {},
    } as unknown as import("../../../lib/backup/localBackup").LocalBackupPreview;
    render(
      <BackupOptionsSheet
        visible
        mode="local-import"
        localPreview={encryptedPreview}
        onConfirm={onConfirm}
        onClose={onClose}
      />,
    );

    // Should not confirm without password
    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).not.toHaveBeenCalled();

    // Enter password and confirm
    fireEvent.changeText(screen.getByTestId("backup-option-password"), "my-secret");
    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].localEncryption).toEqual({
      enabled: true,
      password: "my-secret",
    });
  });

  it("toggles payload mode to metadata-only in local-export", () => {
    render(
      <BackupOptionsSheet visible mode="local-export" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.press(screen.getByTestId("backup-payload-metadata"));
    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].localPayloadMode).toBe("metadata-only");
  });

  it("toggles thumbnails switch", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-backup" onConfirm={onConfirm} onClose={onClose} />,
    );

    // Toggle thumbnails on
    fireEvent.press(screen.getByTestId("backup-option-includeThumbnails"));
    fireEvent.press(screen.getByTestId("backup-options-confirm"));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0].includeThumbnails).toBe(true);
  });

  it("calls handleClose and resets when bottom sheet closes via onOpenChange", () => {
    render(
      <BackupOptionsSheet visible mode="cloud-backup" onConfirm={onConfirm} onClose={onClose} />,
    );

    // Modify an option first
    fireEvent.press(screen.getByTestId("backup-option-includeFiles"));

    // Close via bottom sheet onOpenChange(false)
    fireEvent(screen.getByTestId("bottom-sheet"), "touchEnd");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows password-required warning when encryption enabled but password empty", () => {
    render(
      <BackupOptionsSheet visible mode="local-export" onConfirm={onConfirm} onClose={onClose} />,
    );

    fireEvent.press(screen.getByTestId("backup-option-local-encryption"));
    // Password is empty — confirm button should be disabled
    expect(screen.getByTestId("backup-options-confirm").props.accessibilityState?.disabled).toBe(
      true,
    );
  });
});
