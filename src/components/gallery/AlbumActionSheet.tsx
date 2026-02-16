import { View, Text, Pressable } from "react-native";
import { BottomSheet, Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface AlbumActionSheetProps {
  visible: boolean;
  albumName: string;
  isPinned?: boolean;
  isSmart?: boolean;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
  onTogglePin?: () => void;
  onEditNotes?: () => void;
  onExport?: () => void;
  onMerge?: () => void;
  onViewStats?: () => void;
}

export function AlbumActionSheet({
  visible,
  albumName,
  isPinned = false,
  isSmart = false,
  onClose,
  onRename,
  onDelete,
  onViewDetail,
  onTogglePin,
  onEditNotes,
  onExport,
  onMerge,
  onViewStats,
}: AlbumActionSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  const actions: {
    label: string;
    icon: string;
    onPress: () => void;
    destructive?: boolean;
    highlight?: boolean;
    visible?: boolean;
  }[] = [
    {
      label: t("album.viewDetail"),
      icon: "albums-outline",
      onPress: onViewDetail,
      visible: true,
    },
    {
      label: isPinned ? t("album.unpin") : t("album.pin"),
      icon: isPinned ? "pin" : "pin-outline",
      onPress: onTogglePin ?? (() => {}),
      highlight: isPinned,
      visible: !!onTogglePin,
    },
    {
      label: t("album.rename"),
      icon: "pencil-outline",
      onPress: onRename,
      visible: true,
    },
    {
      label: t("album.editNotes"),
      icon: "document-text-outline",
      onPress: onEditNotes ?? (() => {}),
      visible: !!onEditNotes,
    },
    {
      label: t("album.statistics"),
      icon: "stats-chart-outline",
      onPress: onViewStats ?? (() => {}),
      visible: !!onViewStats,
    },
    {
      label: t("album.exportZip"),
      icon: "archive-outline",
      onPress: onExport ?? (() => {}),
      visible: !!onExport,
    },
    {
      label: t("album.mergeAlbum"),
      icon: "git-merge-outline",
      onPress: onMerge ?? (() => {}),
      visible: !!onMerge && !isSmart,
    },
    {
      label: t("album.deleteAlbum"),
      icon: "trash-outline",
      onPress: onDelete,
      destructive: true,
      visible: true,
    },
  ].filter((a) => a.visible !== false);

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="flex-row items-center justify-center gap-2">
            <BottomSheet.Title className="text-center">{albumName}</BottomSheet.Title>
            {isPinned && <Ionicons name="pin" size={14} color={successColor} />}
          </View>
          <Separator className="my-1" />
          {actions.map((action, i) => (
            <Pressable
              key={i}
              onPress={() => {
                onClose();
                action.onPress();
              }}
              className="flex-row items-center gap-3 px-4 py-3.5"
            >
              <Ionicons
                name={action.icon as keyof typeof Ionicons.glyphMap}
                size={18}
                color={
                  action.destructive ? "#ef4444" : action.highlight ? successColor : mutedColor
                }
              />
              <Text
                className={`text-sm ${
                  action.destructive
                    ? "text-red-500"
                    : action.highlight
                      ? "text-success"
                      : "text-foreground"
                }`}
              >
                {action.label}
              </Text>
            </Pressable>
          ))}
          <Separator className="my-1" />
          <View className="px-4 py-2">
            <Button variant="outline" onPress={onClose} className="w-full">
              <Button.Label>{t("common.cancel")}</Button.Label>
            </Button>
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
