import { View, Text, TouchableOpacity, Modal } from "react-native";
import { useThemeColor } from "heroui-native";
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 justify-end bg-black/60"
      >
        <View className="mx-4 mb-8 rounded-2xl bg-surface-secondary overflow-hidden">
          <View className="px-4 py-3 border-b border-separator">
            <Text className="text-sm font-semibold text-foreground text-center" numberOfLines={1}>
              {albumName}
            </Text>
          </View>
          {actions.map((action, i) => (
            <TouchableOpacity
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
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={onClose} className="border-t border-separator px-4 py-3.5">
            <Text className="text-sm font-semibold text-foreground text-center">
              {t("common.cancel")}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
