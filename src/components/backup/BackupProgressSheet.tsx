/**
 * 备份/恢复进度 Dialog 组件
 */

import { useRef } from "react";
import { View, Text } from "react-native";
import { Button, Dialog, Spinner, Surface } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BackupProgress } from "../../lib/backup/types";
import { formatFileSize } from "../../lib/utils/fileManager";

interface BackupProgressSheetProps {
  visible: boolean;
  isBackup: boolean;
  progress: BackupProgress;
  onCancel: () => void;
}

function formatEta(seconds: number): string {
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.ceil(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

export function BackupProgressSheet({
  visible,
  isBackup,
  progress,
  onCancel,
}: BackupProgressSheetProps) {
  const { t } = useI18n();
  const startTimeRef = useRef<number>(Date.now());

  if (progress.phase === "preparing") {
    startTimeRef.current = Date.now();
  }

  const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  const hasByteProgress =
    progress.bytesTransferred != null && progress.bytesTotal != null && progress.bytesTotal > 0;

  const bytePercentage = hasByteProgress
    ? Math.round((progress.bytesTransferred! / progress.bytesTotal!) * 100)
    : percentage;

  const elapsedMs = Date.now() - startTimeRef.current;
  const speed =
    hasByteProgress && elapsedMs > 1000
      ? Math.round((progress.bytesTransferred! / elapsedMs) * 1000)
      : 0;

  const eta =
    hasByteProgress && speed > 0 ? (progress.bytesTotal! - progress.bytesTransferred!) / speed : 0;

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
                    style={{ width: `${bytePercentage}%` }}
                  />
                </Surface>

                <Dialog.Description>
                  {progress.current} / {progress.total} ({bytePercentage}%)
                </Dialog.Description>

                {hasByteProgress && (
                  <Text className="text-xs text-muted">
                    {formatFileSize(progress.bytesTransferred!)} /{" "}
                    {formatFileSize(progress.bytesTotal!)}
                    {speed > 0 && ` · ${formatFileSize(speed)}/s`}
                    {eta > 0 && ` · ${t("backup.eta")} ${formatEta(eta)}`}
                  </Text>
                )}

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
