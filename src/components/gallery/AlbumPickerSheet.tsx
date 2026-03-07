import { useMemo, useState } from "react";
import { ScrollView, View, Text } from "react-native";
import { Image } from "expo-image";
import { BottomSheet, Button, PressableFeedback, Separator, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import { useI18n } from "../../i18n/useI18n";
import { useFitsStore } from "../../stores/files/useFitsStore";
import { SearchBar } from "../common/SearchBar";
import { EmptyState } from "../common/EmptyState";
import { resolveAlbumCoverUri } from "../../lib/gallery/thumbnailCache";
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
  const getFileById = useFitsStore((s) => s.getFileById);
  const [query, setQuery] = useState("");

  const selectableAlbums = useMemo(() => {
    const nonSmart = albums.filter((a) => !a.isSmart);
    if (!query) return nonSmart;
    const q = query.toLowerCase();
    return nonSmart.filter((a) => a.name.toLowerCase().includes(q));
  }, [albums, query]);

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) {
          setQuery("");
          onClose();
        }
      }}
    >
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content>
          <View className="flex-row items-center justify-between mb-2">
            <BottomSheet.Title>{t("gallery.addToAlbum")}</BottomSheet.Title>
            <BottomSheet.Close />
          </View>
          <Separator className="mb-2" />

          {albums.length > 3 && (
            <View className="px-2 mb-2">
              <SearchBar value={query} onChangeText={setQuery} compact />
            </View>
          )}

          {selectableAlbums.length === 0 ? (
            <EmptyState
              icon="albums-outline"
              title={query ? t("album.noAlbums") : t("gallery.emptyAlbum")}
            />
          ) : (
            <ScrollView style={{ maxHeight: 320 }}>
              {selectableAlbums.map((album) => {
                const coverUri = resolveAlbumCoverUri(album, getFileById);
                return (
                  <PressableFeedback
                    key={album.id}
                    onPress={() => {
                      onSelect(album.id);
                      setQuery("");
                      onClose();
                    }}
                  >
                    <View className="flex-row items-center gap-3 px-4 py-3 border-b border-separator/50">
                      <View className="h-9 w-9 items-center justify-center rounded-lg bg-surface-secondary overflow-hidden">
                        {coverUri ? (
                          <Image
                            source={{ uri: coverUri }}
                            className="h-full w-full"
                            contentFit="cover"
                            cachePolicy="memory-disk"
                          />
                        ) : (
                          <Ionicons name="albums-outline" size={16} color={successColor} />
                        )}
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
                    </View>
                  </PressableFeedback>
                );
              })}
            </ScrollView>
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
