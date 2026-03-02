import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { Button, Dialog, useToast } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { File as FSFile, Paths } from "expo-file-system";
import { useI18n } from "../../i18n/useI18n";
import type { HeaderKeyword } from "../../lib/fits/types";
import { formatHeaderAsCSV, formatHeaderAsText } from "../../lib/fits/headerWriter";
import { shareFile } from "../../lib/utils/imageExport";

type ExportAction = "copy" | "text" | "csv";

interface HeaderExportDialogProps {
  visible: boolean;
  keywords: HeaderKeyword[];
  onClose: () => void;
}

export function HeaderExportDialog({ visible, keywords, onClose }: HeaderExportDialogProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [runningAction, setRunningAction] = useState<ExportAction | null>(null);
  const hasKeywords = keywords.length > 0;
  const isBusy = runningAction !== null;

  const handleExportFile = useCallback(
    async (ext: "txt" | "csv", mimeType: "text/plain" | "text/csv", content: string) => {
      const tmpFile = new FSFile(Paths.cache, `header_${Date.now()}.${ext}`);
      try {
        tmpFile.write(content);
        await shareFile(tmpFile.uri, { mimeType });
      } finally {
        try {
          if (tmpFile.exists) tmpFile.delete();
        } catch {
          // Ignore cleanup failures from temp files.
        }
      }
    },
    [],
  );

  const runAction = useCallback(
    async (
      action: ExportAction,
      task: () => Promise<void>,
      successKey: Parameters<typeof t>[0],
    ) => {
      if (isBusy || !hasKeywords) return;

      setRunningAction(action);
      try {
        await task();
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        toast.show({ variant: "success", label: t(successKey) });
        onClose();
      } catch {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        toast.show({
          variant: "danger",
          label: t("header.exportFailed" as Parameters<typeof t>[0]),
        });
      } finally {
        setRunningAction(null);
      }
    },
    [hasKeywords, isBusy, onClose, t, toast],
  );

  const actionsDisabled = useMemo(() => !hasKeywords || isBusy, [hasKeywords, isBusy]);

  const handleCopyAll = useCallback(() => {
    void runAction(
      "copy",
      async () => {
        await Clipboard.setStringAsync(formatHeaderAsText(keywords));
      },
      "header.copySuccess" as Parameters<typeof t>[0],
    );
  }, [keywords, runAction]);

  const handleExportText = useCallback(() => {
    void runAction(
      "text",
      async () => {
        await handleExportFile("txt", "text/plain", formatHeaderAsText(keywords));
      },
      "header.exportSuccess" as Parameters<typeof t>[0],
    );
  }, [handleExportFile, keywords, runAction]);

  const handleExportCSV = useCallback(() => {
    void runAction(
      "csv",
      async () => {
        await handleExportFile("csv", "text/csv", formatHeaderAsCSV(keywords));
      },
      "header.exportSuccess" as Parameters<typeof t>[0],
    );
  }, [handleExportFile, keywords, runAction]);

  return (
    <Dialog
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open && !isBusy) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay isCloseOnPress={!isBusy} />
        <Dialog.Content className="mx-4 w-full max-w-md rounded-2xl bg-background p-5">
          <View className="mb-4 flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Dialog.Title>{t("header.exportHeader" as Parameters<typeof t>[0])}</Dialog.Title>
              <Dialog.Description className="mt-1">
                {t("header.exportHint" as Parameters<typeof t>[0])}
              </Dialog.Description>
            </View>
            {!isBusy ? <Dialog.Close /> : null}
          </View>

          <View className="gap-2">
            <Button
              variant="primary"
              testID="e2e-action-header__param_id-export-copy-all"
              onPress={handleCopyAll}
              isDisabled={actionsDisabled}
            >
              <Ionicons name="copy-outline" size={16} color="#fff" />
              <Button.Label>{t("header.copyAll" as Parameters<typeof t>[0])}</Button.Label>
            </Button>
            <Button
              variant="outline"
              testID="e2e-action-header__param_id-export-text"
              onPress={handleExportText}
              isDisabled={actionsDisabled}
            >
              <Ionicons name="document-text-outline" size={16} />
              <Button.Label>{t("header.exportText" as Parameters<typeof t>[0])}</Button.Label>
            </Button>
            <Button
              variant="outline"
              testID="e2e-action-header__param_id-export-csv"
              onPress={handleExportCSV}
              isDisabled={actionsDisabled}
            >
              <Ionicons name="grid-outline" size={16} />
              <Button.Label>{t("header.exportCSV" as Parameters<typeof t>[0])}</Button.Label>
            </Button>
          </View>

          <Button
            className="mt-4"
            size="sm"
            variant="outline"
            onPress={onClose}
            isDisabled={isBusy}
          >
            <Button.Label>{t("common.cancel")}</Button.Label>
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog>
  );
}
