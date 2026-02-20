import { fireEvent, render, screen } from "@testing-library/react-native";
import { BackupOptionsSheet } from "../BackupOptionsSheet";

jest.mock("../../../i18n/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) =>
      (
        ({
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
        }) as Record<string, string>
      )[key] ?? key,
  }),
}));

jest.mock("heroui-native", () => {
  const React = require("react");
  const { View, Text, Pressable } = require("react-native");
  type mockProps = { children?: unknown } & Record<string, unknown>;
  type mockBottomSheetProps = mockProps & {
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  };
  type mockButtonLikeProps = mockProps & {
    onPress?: () => void;
    isDisabled?: boolean;
    testID?: string;
  };
  type mockSwitchProps = {
    onSelectedChange?: (next: boolean) => void;
    isSelected?: boolean;
    testID?: string;
  };

  const BottomSheet = ({ isOpen, children, onOpenChange }: mockBottomSheetProps) =>
    isOpen ? (
      <View testID="bottom-sheet" onTouchEnd={() => onOpenChange?.(true)}>
        {children}
      </View>
    ) : null;
  BottomSheet.Portal = ({ children }: mockProps) => <View>{children}</View>;
  BottomSheet.Overlay = () => <View />;
  BottomSheet.Content = ({ children }: mockProps) => <View>{children}</View>;
  BottomSheet.Title = ({ children }: mockProps) => <Text>{children}</Text>;
  BottomSheet.Description = ({ children }: mockProps) => <Text>{children}</Text>;
  BottomSheet.Close = () => <Pressable testID="bottom-sheet-close" />;

  const Button = ({ children, onPress, isDisabled, testID }: mockButtonLikeProps) => (
    <Pressable testID={testID ?? "button"} disabled={isDisabled} onPress={onPress}>
      {children}
    </Pressable>
  );
  Button.Label = ({ children }: mockProps) => <Text>{children}</Text>;

  const Chip = ({ children, onPress, testID }: mockButtonLikeProps) => (
    <Pressable testID={testID ?? "chip"} onPress={onPress}>
      {children}
    </Pressable>
  );
  Chip.Label = ({ children }: mockProps) => <Text>{children}</Text>;

  const Switch = ({ onSelectedChange, isSelected, testID }: mockSwitchProps) => (
    <Pressable
      testID={testID ?? "switch"}
      onPress={() => onSelectedChange?.(!isSelected)}
      accessibilityState={{ checked: isSelected }}
    >
      <View />
    </Pressable>
  );
  Switch.Thumb = () => <View />;

  return {
    BottomSheet,
    Button,
    Chip,
    Switch,
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
});
