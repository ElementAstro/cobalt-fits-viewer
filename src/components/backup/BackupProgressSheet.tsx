/**
 * 备份/恢复进度 Dialog 组件
 */

import { View, Text } from "react-native";
import { Button, Dialog, Spinner, Surface } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BackupProgress } from "../../lib/backup/types";

interface BackupProgressSheetProps {
  visible: boolean;
  isBackup: boolean;
  progress: BackupProgress;
  onCancel: () => void;
}

export function BackupProgressSheet({
  visible,
  isBackup,
  progress,
  onCancel,
}: BackupProgressSheetProps) {
  const { t } = useI18n();

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const phaseText = (() => {
    switch (progress.phase) {
      case "preparing":
        return isBackup ? t("backup.backupInProgress") : t("backup.restoreInProgress");
      case "uploading":
        return t("backup.backupInProgress");
      case "downloading":
        return t("backup.restoreInProgress");
      case "finalizing":
        return t("backup.backupInProgress");
      default:
        return "";
    }
  })();

  return (
    <Dialog isOpen={visible} onOpenChange={() => {}}>
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="items-center gap-4 py-4">
            <Spinner size="lg" />

            <Dialog.Title>{phaseText}</Dialog.Title>

            {progress.total > 0 && (
              <>
                {/* Progress bar */}
                <Surface variant="secondary" className="h-2 w-full overflow-hidden rounded-full">
                  <View
                    className="h-full rounded-full bg-accent"
                    style={{ width: `${percentage}%` }}
                  />
                </Surface>

                <Dialog.Description>
                  {progress.current} / {progress.total} ({percentage}%)
                </Dialog.Description>

                {progress.currentFile && (
                  <Text className="text-xs text-muted" numberOfLines={1} ellipsizeMode="middle">
                    {progress.currentFile}
                  </Text>
                )}
              </>
            )}

            <Button variant="outline" size="sm" onPress={onCancel}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
