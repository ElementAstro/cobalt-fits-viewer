/**
 * 备份/恢复选项选择器组件
 */

import { useEffect, useMemo, useState } from "react";
import { View, Text } from "react-native";
import { BottomSheet, Button, Chip, Switch } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BackupOptions, RestoreConflictStrategy } from "../../lib/backup/types";
import { DEFAULT_BACKUP_OPTIONS } from "../../lib/backup/types";

export type BackupOptionsSheetMode =
  | "cloud-backup"
  | "cloud-restore"
  | "local-export"
  | "local-import";

interface BackupOptionsSheetProps {
  visible: boolean;
  mode: BackupOptionsSheetMode;
  onConfirm: (options: BackupOptions) => void;
  onClose: () => void;
}

const LOCAL_EXPORT_DEFAULT_OPTIONS: BackupOptions = {
  ...DEFAULT_BACKUP_OPTIONS,
  includeFiles: false,
};

function getDefaultOptionsForMode(mode: BackupOptionsSheetMode): BackupOptions {
  if (mode === "local-export") return { ...LOCAL_EXPORT_DEFAULT_OPTIONS };
  return { ...DEFAULT_BACKUP_OPTIONS };
}

const DATA_OPTION_KEYS = [
  "includeFiles",
  "includeAlbums",
  "includeTargets",
  "includeSessions",
  "includeSettings",
] as const;

type DataOptionKey = (typeof DATA_OPTION_KEYS)[number];

export function BackupOptionsSheet({ visible, mode, onConfirm, onClose }: BackupOptionsSheetProps) {
  const { t } = useI18n();

  const [options, setOptions] = useState<BackupOptions>(() => getDefaultOptionsForMode(mode));

  const isRestore = mode === "cloud-restore" || mode === "local-import";

  useEffect(() => {
    if (visible) {
      setOptions(getDefaultOptionsForMode(mode));
    }
  }, [visible, mode]);

  const toggleOption = (key: DataOptionKey) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const selectedDataCount = useMemo(
    () => DATA_OPTION_KEYS.filter((key) => options[key]).length,
    [options],
  );

  const canConfirm = selectedDataCount > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(options);
    onClose();
  };

  const handleClose = () => {
    setOptions(getDefaultOptionsForMode(mode));
    onClose();
  };

  const optionItems: { key: DataOptionKey; icon: string; label: string }[] = [
    { key: "includeFiles", icon: "document-outline", label: t("backup.optionFiles") },
    { key: "includeAlbums", icon: "albums-outline", label: t("backup.optionAlbums") },
    { key: "includeTargets", icon: "telescope-outline", label: t("backup.optionTargets") },
    { key: "includeSessions", icon: "time-outline", label: t("backup.optionSessions") },
    { key: "includeSettings", icon: "settings-outline", label: t("backup.optionSettings") },
  ];

  const strategyItems: Array<{ value: RestoreConflictStrategy; label: string }> = [
    { value: "skip-existing", label: t("backup.conflictSkip") },
    { value: "overwrite-existing", label: t("backup.conflictOverwrite") },
    { value: "merge", label: t("backup.conflictMerge") },
  ];

  const title =
    mode === "cloud-backup" || mode === "local-export"
      ? t("backup.selectBackupOptions")
      : t("backup.selectRestoreOptions");
  const description =
    mode === "cloud-backup" || mode === "local-export"
      ? t("backup.selectBackupOptionsDesc")
      : t("backup.selectRestoreOptionsDesc");
  const confirmLabel =
    mode === "cloud-backup" || mode === "local-export"
      ? t("backup.startBackup")
      : t("backup.startRestore");

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="flex-row items-center justify-between mb-2">
            <BottomSheet.Title>{title}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          <BottomSheet.Description className="mb-3">{description}</BottomSheet.Description>

          {optionItems.map((item) => (
            <View key={item.key} className="flex-row items-center justify-between py-2">
              <Text className="text-sm text-foreground">{item.label}</Text>
              <Switch
                testID={`backup-option-${item.key}`}
                isSelected={options[item.key]}
                onSelectedChange={() => toggleOption(item.key)}
              >
                <Switch.Thumb />
              </Switch>
            </View>
          ))}

          {isRestore && (
            <View className="mt-3">
              <Text className="mb-2 text-xs font-semibold uppercase text-muted">
                {t("backup.conflictTitle")}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {strategyItems.map((item) => (
                  <Chip
                    key={item.value}
                    testID={`backup-conflict-${item.value}`}
                    size="sm"
                    variant={
                      (options.restoreConflictStrategy ?? "skip-existing") === item.value
                        ? "primary"
                        : "secondary"
                    }
                    onPress={() =>
                      setOptions((prev) => ({ ...prev, restoreConflictStrategy: item.value }))
                    }
                  >
                    <Chip.Label>{item.label}</Chip.Label>
                  </Chip>
                ))}
              </View>
            </View>
          )}

          {!canConfirm && (
            <Text className="mt-3 text-xs text-danger">{t("backup.optionSelectAtLeastOne")}</Text>
          )}

          <Button
            testID="backup-options-confirm"
            variant="primary"
            className="mt-4"
            onPress={handleConfirm}
            isDisabled={!canConfirm}
          >
            <Button.Label>{confirmLabel}</Button.Label>
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
