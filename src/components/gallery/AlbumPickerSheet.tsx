import { View, Text, TouchableOpacity, Modal, ScrollView } from "react-native";
import { useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import type { Album } from "../../lib/fits/types";

interface AlbumPickerSheetProps {
  visible: boolean;
  albums: Album[];
  onClose: () => void;
  onSelect: (albumId: string) => void;
}

export function AlbumPickerSheet({ visible, albums, onClose, onSelect }: AlbumPickerSheetProps) {
  const { t } = useI18n();
  const [mutedColor, successColor] = useThemeColor(["muted", "success"]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={onClose}
        className="flex-1 justify-end bg-black/60"
      >
        <View className="mx-4 mb-8 max-h-[60%] rounded-2xl bg-surface-secondary overflow-hidden">
          <View className="px-4 py-3 border-b border-separator">
            <Text className="text-sm font-semibold text-foreground text-center">
              {t("gallery.addToAlbum")}
            </Text>
          </View>

          {albums.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="albums-outline" size={32} color={mutedColor} />
              <Text className="mt-2 text-xs text-muted">{t("gallery.emptyAlbum")}</Text>
            </View>
          ) : (
            <ScrollView className="max-h-80">
              {albums
                .filter((a) => !a.isSmart)
                .map((album) => (
                  <TouchableOpacity
                    key={album.id}
                    onPress={() => {
                      onSelect(album.id);
                      onClose();
                    }}
                    className="flex-row items-center gap-3 px-4 py-3 border-b border-separator/50"
                  >
                    <View className="h-8 w-8 items-center justify-center rounded-lg bg-success/10">
                      <Ionicons
                        name={album.isSmart ? "sparkles" : "albums-outline"}
                        size={16}
                        color={successColor}
                      />
                    </View>
                    <View className="flex-1">
                      <Text className="text-sm text-foreground" numberOfLines={1}>
                        {album.name}
                      </Text>
                      <Text className="text-[10px] text-muted">
                        {album.imageIds.length} {t("album.images")}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={14} color={mutedColor} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          )}

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
