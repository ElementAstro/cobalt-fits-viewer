import { useMemo } from "react";
import { ScrollView, View, Text } from "react-native";
import { BottomSheet, Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { TrashedFitsRecord } from "../../lib/fits/types";
import { formatFileSize } from "../../lib/utils/fileManager";

interface TrashSheetProps {
  visible: boolean;
  items: TrashedFitsRecord[];
  onClose: () => void;
  onRestore: (trashIds: string[]) => void;
  onDeleteForever: (trashIds?: string[]) => void;
}

function formatExpireTime(expireAt: number): string {
  const delta = expireAt - Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  if (delta <= 0) return "0d";
  const days = Math.ceil(delta / dayMs);
  return `${days}d`;
}

export function TrashSheet({
  visible,
  items,
  onClose,
  onRestore,
  onDeleteForever,
}: TrashSheetProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);

  const totalSize = useMemo(
    () => items.reduce((sum, item) => sum + item.file.fileSize, 0),
    [items],
  );

  return (
    <BottomSheet isOpen={visible} onOpenChange={(open) => !open && onClose()}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content snapPoints={["70%"]}>
          <View className="px-4 py-1">
            <BottomSheet.Title>{t("files.trashTitle")}</BottomSheet.Title>
            <Text className="text-xs text-muted">
              {t("files.filesCount").replace("{count}", String(items.length))} ·{" "}
              {formatFileSize(totalSize)}
            </Text>
          </View>

          <Separator className="my-2" />

          {items.length === 0 ? (
            <View className="items-center py-12">
              <Ionicons name="trash-bin-outline" size={32} color={mutedColor} />
              <Text className="mt-3 text-sm text-muted">{t("files.trashEmpty")}</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 420 }}>
              <View className="gap-2 px-4 pb-2">
                {items.map((item) => (
                  <View
                    key={item.trashId}
                    className="rounded-xl bg-surface-secondary px-3 py-2.5 flex-row items-center gap-2"
                  >
                    <View className="flex-1">
                      <Text className="text-sm text-foreground" numberOfLines={1}>
                        {item.file.filename}
                      </Text>
                      <Text className="text-[11px] text-muted">
                        {formatFileSize(item.file.fileSize)} · {t("files.trashExpires")}{" "}
                        {formatExpireTime(item.expireAt)}
                      </Text>
                    </View>
                    <Button size="sm" variant="outline" onPress={() => onRestore([item.trashId])}>
                      <Button.Label>{t("files.restore")}</Button.Label>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onPress={() => onDeleteForever([item.trashId])}
                    >
                      <Ionicons name="trash-outline" size={16} color="#ef4444" />
                    </Button>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          <Separator className="my-2" />
          <View className="px-4 pb-3 flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onPress={() => onRestore(items.map((item) => item.trashId))}
              isDisabled={items.length === 0}
            >
              <Button.Label>{t("files.restoreAll")}</Button.Label>
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              onPress={() => onDeleteForever()}
              isDisabled={items.length === 0}
            >
              <Button.Label>{t("files.emptyTrash")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
