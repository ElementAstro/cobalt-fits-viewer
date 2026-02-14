import { View, Text, Pressable } from "react-native";
import { BottomSheet, Button, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";

interface AlbumActionSheetProps {
  visible: boolean;
  albumName: string;
  onClose: () => void;
  onRename: () => void;
  onDelete: () => void;
  onViewDetail: () => void;
}

export function AlbumActionSheet({
  visible,
  albumName,
  onClose,
  onRename,
  onDelete,
  onViewDetail,
}: AlbumActionSheetProps) {
  const { t } = useI18n();
  const [mutedColor] = useThemeColor(["muted"]);

  const actions: {
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    destructive?: boolean;
  }[] = [
    {
      label: t("album.viewDetail"),
      icon: "albums-outline",
      onPress: onViewDetail,
    },
    {
      label: t("album.rename"),
      icon: "pencil-outline",
      onPress: onRename,
    },
    {
      label: t("album.deleteAlbum"),
      icon: "trash-outline",
      onPress: onDelete,
      destructive: true,
    },
  ];

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
          <BottomSheet.Title className="text-center">{albumName}</BottomSheet.Title>
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
                name={action.icon}
                size={18}
                color={action.destructive ? "#ef4444" : mutedColor}
              />
              <Text
                className={`text-sm ${action.destructive ? "text-red-500" : "text-foreground"}`}
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
