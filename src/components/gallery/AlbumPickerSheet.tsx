import { View, Text, Pressable } from "react-native";
import { BottomSheet, Button, Separator, useThemeColor } from "heroui-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
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
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <BottomSheet.Title className="text-center">{t("gallery.addToAlbum")}</BottomSheet.Title>
          <Separator className="my-1" />

          {albums.length === 0 ? (
            <View className="items-center py-8">
              <Ionicons name="albums-outline" size={32} color={mutedColor} />
              <Text className="mt-2 text-xs text-muted">{t("gallery.emptyAlbum")}</Text>
            </View>
          ) : (
            <BottomSheetScrollView style={{ maxHeight: 320 }}>
              {albums
                .filter((a) => !a.isSmart)
                .map((album) => (
                  <Pressable
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
                  </Pressable>
                ))}
            </BottomSheetScrollView>
          )}

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
