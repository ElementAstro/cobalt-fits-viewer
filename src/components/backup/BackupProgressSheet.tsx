/**
 * 备份/恢复进度 Dialog 组件
 */

import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Button, Dialog, Spinner } from "heroui-native";
import { useI18n } from "../../i18n/useI18n";
import type { BackupProgress } from "../../lib/backup/types";
import { BackupProgressDisplay } from "./BackupProgressDisplay";

interface BackupProgressSheetProps {
  visible: boolean;
  isBackup: boolean;
  progress: BackupProgress;
  onCancel: () => void;
}

export { formatEta } from "../../lib/utils/formatTime";

export function BackupProgressSheet({
  visible,
  isBackup,
  progress,
  onCancel,
}: BackupProgressSheetProps) {
  const { t } = useI18n();
  const startTimeRef = useRef<number>(Date.now());
  const [, setTick] = useState(0);

  useEffect(() => {
    if (progress.phase === "preparing") {
      startTimeRef.current = Date.now();
    }
  }, [progress.phase]);

  useEffect(() => {
    if (!visible || progress.phase === "idle") return;
    const id = setInterval(() => setTick((prev) => prev + 1), 1000);
    return () => clearInterval(id);
  }, [visible, progress.phase]);

  const elapsedMs = Date.now() - startTimeRef.current;

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
    <Dialog
      isOpen={visible}
      onOpenChange={() => {
        /* Intentionally blocked: prevent accidental dismiss during backup/restore */
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay />
        <Dialog.Content>
          <View className="items-center gap-4 py-4">
            <Spinner size="lg" />

            <Dialog.Title>{phaseText}</Dialog.Title>

            <BackupProgressDisplay progress={progress} showSpeed elapsedMs={elapsedMs} />

            <Button variant="outline" size="sm" onPress={onCancel}>
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
          </View>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
