/**
 * 备份/恢复选项选择器组件
 */

import { useState } from "react";
import { View, Text } from "react-native";
import { BottomSheet, Button, Switch } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BackupOptions } from "../../lib/backup/types";
import { DEFAULT_BACKUP_OPTIONS } from "../../lib/backup/types";

interface BackupOptionsSheetProps {
  visible: boolean;
  isBackup: boolean;
  onConfirm: (options: BackupOptions) => void;
  onClose: () => void;
}

export function BackupOptionsSheet({
  visible,
  isBackup,
  onConfirm,
  onClose,
}: BackupOptionsSheetProps) {
  const { t } = useI18n();

  const [options, setOptions] = useState<BackupOptions>({ ...DEFAULT_BACKUP_OPTIONS });

  const toggleOption = (key: keyof BackupOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirm = () => {
    onConfirm(options);
    onClose();
  };

  const handleClose = () => {
    setOptions({ ...DEFAULT_BACKUP_OPTIONS });
    onClose();
  };

  const optionItems: { key: keyof BackupOptions; icon: string; label: string }[] = [
    { key: "includeFiles", icon: "document-outline", label: t("backup.optionFiles") },
    { key: "includeAlbums", icon: "albums-outline", label: t("backup.optionAlbums") },
    { key: "includeTargets", icon: "telescope-outline", label: t("backup.optionTargets") },
    { key: "includeSessions", icon: "time-outline", label: t("backup.optionSessions") },
    { key: "includeSettings", icon: "settings-outline", label: t("backup.optionSettings") },
  ];

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
            <BottomSheet.Title>
              {isBackup ? t("backup.selectBackupOptions") : t("backup.selectRestoreOptions")}
            </BottomSheet.Title>
            <BottomSheet.Close />
          </View>

          <BottomSheet.Description className="mb-3">
            {isBackup ? t("backup.selectBackupOptionsDesc") : t("backup.selectRestoreOptionsDesc")}
          </BottomSheet.Description>

          {optionItems.map((item) => (
            <View key={item.key} className="flex-row items-center justify-between py-2">
              <Text className="text-sm text-foreground">{item.label}</Text>
              <Switch
                isSelected={options[item.key]}
                onSelectedChange={() => toggleOption(item.key)}
              >
                <Switch.Thumb />
              </Switch>
            </View>
          ))}

          <Button variant="primary" className="mt-4" onPress={handleConfirm}>
            <Button.Label>
              {isBackup ? t("backup.startBackup") : t("backup.startRestore")}
            </Button.Label>
          </Button>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
